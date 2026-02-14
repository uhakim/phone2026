import streamlit as st
import os
from components.auth import authenticate_admin, logout_admin
from services.approval_service import approve_application, reject_application
from services.application_service import (
    get_pending_applications,
    get_application_type_name,
    get_statistics
)

# 페이지 설정
st.set_page_config(
    page_title="교감 승인 페이지",
    page_icon="✅",
    layout="wide"
)

st.title("✅ 교감 승인 페이지")
st.divider()

# 인증 상태 초기화
if 'admin_authenticated' not in st.session_state:
    st.session_state.admin_authenticated = False
    st.session_state.admin_name = None

# ============= 미인증 상태 =============
if not st.session_state.admin_authenticated:
    st.subheader("🔐 관리자 인증")

    with st.form("admin_auth_form"):
        password = st.text_input(
            "비밀번호",
            type="password",
            placeholder="관리자 비밀번호"
        )

        submitted = st.form_submit_button(
            "로그인",
            use_container_width=True,
            type="primary"
        )

        if submitted:
            if authenticate_admin(password):
                st.session_state.admin_authenticated = True
                st.session_state.admin_name = "교감"
                st.success("✓ 인증 완료")
                st.rerun()
            else:
                st.error("❌ 비밀번호가 일치하지 않습니다")

    st.info("""
    교감 선생님 또는 생활부장 선생님만 접근 가능합니다.
    비밀번호를 입력하여 로그인해주세요.
    """)

# ============= 인증된 상태 =============
else:
    col1, col2 = st.columns([4, 1])

    with col1:
        st.markdown(f"**{st.session_state.admin_name} 선생님 로그인됨**")

    with col2:
        if st.button("🚪 로그아웃"):
            logout_admin()
            st.rerun()

    st.divider()

    # 통계
    st.subheader("📊 현황 요약")
    stats = get_statistics()

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("전체 신청", stats['total'])
    with col2:
        st.metric("⏳ 대기 중", stats['pending'])
    with col3:
        st.metric("✅ 승인 완료", stats['approved'])
    with col4:
        st.metric("🔴 반려", stats['rejected'])

    st.divider()

    # 승인 대기 목록
    st.subheader("📋 승인 대기 목록")

    pending_apps = get_pending_applications()

    if not pending_apps:
        st.success("✓ 승인 대기 중인 신청서가 없습니다")
    else:
        st.info(f"총 {len(pending_apps)}건의 대기 신청서가 있습니다")

        for idx, app in enumerate(pending_apps, 1):
            with st.container(border=True):
                col1, col2 = st.columns([3, 1])

                with col1:
                    st.markdown(
                        f"**{idx}. {get_application_type_name(app['application_type'])} - "
                        f"{app['grade']}학년 {app['class_num']}반 {app['name']}**"
                    )

                    st.markdown("---")

                    # 신청 정보
                    info_col1, info_col2 = st.columns(2)

                    with info_col1:
                        st.markdown(f"**신청 이유:** {app['reason']}")

                    with info_col2:
                        if app['extra_info']:
                            st.markdown(f"**출입 요일/시간:** {app['extra_info']}")

                    st.caption(f"신청일: {app['submitted_at']}")

                with col2:
                    st.markdown("#### 승인 처리")

                    # 승인 버튼
                    if st.button(
                        "✅ 승인",
                        key=f"approve_{app['id']}",
                        use_container_width=True
                    ):
                        success, message = approve_application(
                            app['id'],
                            "교감/생활부장"
                        )

                        if success:
                            st.success(message)
                            st.rerun()
                        else:
                            st.error(message)

                    # 반려 버튼
                    if st.button(
                        "🔴 반려",
                        key=f"reject_{app['id']}",
                        use_container_width=True
                    ):
                        st.session_state[f"reject_form_{app['id']}"] = True

                    # 반려 사유 입력
                    if st.session_state.get(f"reject_form_{app['id']}", False):
                        reason = st.text_input(
                            "반려 사유",
                            key=f"reason_{app['id']}"
                        )

                        col_reject1, col_reject2 = st.columns(2)

                        with col_reject1:
                            if st.button(
                                "반려 확인",
                                key=f"reject_confirm_{app['id']}",
                                use_container_width=True
                            ):
                                if not reason:
                                    st.error("반려 사유를 입력해주세요")
                                else:
                                    success, message = reject_application(
                                        app['id'],
                                        reason
                                    )

                                    if success:
                                        st.success(message)
                                        st.session_state[f"reject_form_{app['id']}"] = False
                                        st.rerun()
                                    else:
                                        st.error(message)

                        with col_reject2:
                            if st.button(
                                "취소",
                                key=f"reject_cancel_{app['id']}",
                                use_container_width=True
                            ):
                                st.session_state[f"reject_form_{app['id']}"] = False
                                st.rerun()

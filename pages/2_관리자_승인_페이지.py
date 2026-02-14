import streamlit as st
from utils.ui_style import inject_nav_label_override

from components.auth import authenticate_admin, logout_admin
from services.approval_service import approve_application, reject_application
from services.application_service import (
    get_application_type_name,
    get_pending_applications,
    get_statistics,
)
from utils.gate_schedule import format_gate_schedule


st.set_page_config(
    page_title="관리자 승인 페이지",
    page_icon="✅",
    layout="wide",
)
inject_nav_label_override()


st.title("✅ 관리자 승인 페이지")
st.divider()

if "admin_authenticated" not in st.session_state:
    st.session_state.admin_authenticated = False
    st.session_state.admin_name = None


if not st.session_state.admin_authenticated:
    st.subheader("🔐 관리자 인증")

    with st.form("admin_auth_form"):
        password = st.text_input(
            "비밀번호",
            type="password",
            placeholder="관리자 비밀번호",
        )

        submitted = st.form_submit_button(
            "로그인",
            use_container_width=True,
            type="primary",
        )

        if submitted:
            if authenticate_admin(password):
                st.session_state.admin_authenticated = True
                st.session_state.admin_name = "관리자"
                st.success("관리자 인증이 완료되었습니다.")
                st.rerun()
            else:
                st.error("비밀번호가 올바르지 않습니다.")

    st.info("관리자 비밀번호를 입력하면 승인/반려 업무를 처리할 수 있습니다.")

else:
    col1, col2 = st.columns([4, 1])

    with col1:
        st.markdown(f"**{st.session_state.admin_name} 로그인 상태**")

    with col2:
        if st.button("로그아웃", use_container_width=True):
            logout_admin()
            st.rerun()

    st.divider()
    st.subheader("📊 현황 요약")

    stats = get_statistics()
    s1, s2, s3, s4 = st.columns(4)
    with s1:
        st.metric("전체 신청", stats["total"])
    with s2:
        st.metric("승인 대기", stats["pending"])
    with s3:
        st.metric("승인 완료", stats["approved"])
    with s4:
        st.metric("반려", stats["rejected"])

    st.divider()
    st.subheader("📋 승인 대기 목록")

    pending_apps = get_pending_applications()

    if not pending_apps:
        st.success("현재 승인 대기 중인 신청이 없습니다.")
    else:
        st.info(f"총 {len(pending_apps)}건의 승인 대기 신청이 있습니다.")

        for idx, app in enumerate(pending_apps, start=1):
            with st.container(border=True):
                left, right = st.columns([3, 1])

                with left:
                    st.markdown(
                        f"**{idx}. {get_application_type_name(app['application_type'])} - "
                        f"{app['grade']}학년 {app['class_num']}반 {app['name']}**"
                    )
                    st.markdown("---")

                    i1, i2 = st.columns(2)
                    with i1:
                        st.markdown(f"**신청 사유:** {app['reason']}")
                    with i2:
                        if app["extra_info"]:
                            extra_text = app["extra_info"]
                            if app["application_type"] == "gate":
                                extra_text = format_gate_schedule(app["extra_info"])
                            st.markdown(f"**추가 정보:** {extra_text}")
                    st.caption(f"신청일: {app['submitted_at']}")

                with right:
                    st.markdown("#### 처리")

                    if st.button("승인", key=f"approve_{app['id']}", use_container_width=True):
                        success, message = approve_application(app["id"], "관리자")
                        if success:
                            st.success(message)
                            st.rerun()
                        else:
                            st.error(message)

                    if st.button("반려", key=f"reject_{app['id']}", use_container_width=True):
                        st.session_state[f"reject_form_{app['id']}"] = True

                    if st.session_state.get(f"reject_form_{app['id']}", False):
                        reason = st.text_input("반려 사유", key=f"reason_{app['id']}")
                        r1, r2 = st.columns(2)

                        with r1:
                            if st.button(
                                "반려 확인",
                                key=f"reject_confirm_{app['id']}",
                                use_container_width=True,
                            ):
                                if not reason.strip():
                                    st.error("반려 사유를 입력해주세요.")
                                else:
                                    success, message = reject_application(app["id"], reason.strip())
                                    if success:
                                        st.success(message)
                                        st.session_state[f"reject_form_{app['id']}"] = False
                                        st.rerun()
                                    else:
                                        st.error(message)

                        with r2:
                            if st.button(
                                "취소",
                                key=f"reject_cancel_{app['id']}",
                                use_container_width=True,
                            ):
                                st.session_state[f"reject_form_{app['id']}"] = False
                                st.rerun()

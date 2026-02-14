import streamlit as st
from components.auth import authenticate_parent, logout_parent, get_current_student
from components.forms import (
    render_phone_application_form,
    render_tablet_application_form,
    render_gate_application_form
)
from services.application_service import (
    submit_application,
    get_student_applications,
    get_approved_applications,
    get_application_type_name,
    get_status_name
)
from utils.pdf_generator import (
    generate_phone_permit_pdf,
    generate_tablet_permit_pdf,
    generate_gate_permit_pdf
)
from config.settings import APPLICATION_TYPES

# 페이지 설정
st.set_page_config(
    page_title="학부모 페이지 - 온라인 승낙서 관리",
    page_icon="👨‍👩‍👧",
    layout="wide"
)

st.title("👨‍👩‍👧 학부모 페이지")
st.divider()

# 인증 상태 초기화
if 'parent_authenticated' not in st.session_state:
    st.session_state.parent_authenticated = False
    st.session_state.student_info = None

# ============= 미인증 상태 =============
if not st.session_state.parent_authenticated:
    st.subheader("🔐 학생 인증")

    with st.form("parent_auth_form"):
        col1, col2 = st.columns(2)

        with col1:
            student_id = st.text_input(
                "학번",
                placeholder="예: 20250101"
            )

        with col2:
            name = st.text_input(
                "이름",
                placeholder="예: 홍길동"
            )

        submitted = st.form_submit_button(
            "인증하기",
            use_container_width=True,
            type="primary"
        )

        if submitted:
            student = authenticate_parent(student_id, name)

            if student:
                st.session_state.parent_authenticated = True
                st.session_state.student_info = student
                st.success(f"✓ {student['name']} 학생 인증됨")
                st.rerun()
            else:
                st.error("❌ 학번 또는 이름이 일치하지 않습니다")

    st.info("""
    학번과 이름을 입력하여 인증해주세요.
    불분명한 경우 학교에 문의하세요.
    """)

# ============= 인증된 상태 =============
else:
    student = st.session_state.student_info

    # 상단 정보 표시
    col1, col2, col3 = st.columns([2, 2, 1])

    with col1:
        st.metric(
            "학년",
            f"{student['grade']}학년 {student['class_num']}반"
        )

    with col2:
        st.metric("이름", student['name'])

    with col3:
        if st.button("🚪 로그아웃", use_container_width=True):
            logout_parent()
            st.rerun()

    st.divider()

    # 탭 구성
    tab1, tab2, tab3, tab4 = st.tabs([
        "📱 휴대전화 승낙서",
        "💻 태블릿PC 승낙서",
        "🚪 정문출입 허가서",
        "📋 신청 현황"
    ])

    # ===== TAB 1: 휴대전화 =====
    with tab1:
        form_data = render_phone_application_form(student)

        if form_data:
            success, message = submit_application(
                student['student_id'],
                form_data['type'],
                form_data['reason'],
                form_data['extra_info']
            )

            if success:
                st.success(message)
                st.rerun()
            else:
                st.warning(message)

    # ===== TAB 2: 태블릿 =====
    with tab2:
        form_data = render_tablet_application_form(student)

        if form_data:
            success, message = submit_application(
                student['student_id'],
                form_data['type'],
                form_data['reason'],
                form_data['extra_info']
            )

            if success:
                st.success(message)
                st.rerun()
            else:
                st.warning(message)

    # ===== TAB 3: 정문출입 =====
    with tab3:
        form_data = render_gate_application_form(student)

        if form_data:
            success, message = submit_application(
                student['student_id'],
                form_data['type'],
                form_data['reason'],
                form_data['extra_info']
            )

            if success:
                st.success(message)
                st.rerun()
            else:
                st.warning(message)

    # ===== TAB 4: 신청 현황 =====
    with tab4:
        st.subheader("📋 신청 현황")

        applications = get_student_applications(student['student_id'])

        if not applications:
            st.info("아직 신청하신 내역이 없습니다")
        else:
            for app in applications:
                with st.container(border=True):
                    col1, col2, col3 = st.columns([2, 2, 1])

                    with col1:
                        st.markdown(
                            f"**{get_application_type_name(app['application_type'])}**"
                        )
                        st.caption(f"신청 이유: {app['reason']}")

                    with col2:
                        status_color = {
                            'pending': '🟡',
                            'approved': '🟢',
                            'rejected': '🔴',
                            'auto_approved': '✅'
                        }
                        st.markdown(
                            f"{status_color.get(app['status'], '⚪')} {get_status_name(app['status'])}"
                        )

                        if app['rejection_reason']:
                            st.caption(f"반려 사유: {app['rejection_reason']}")

                    with col3:
                        # PDF 다운로드 버튼
                        if app['status'] in ('approved', 'auto_approved'):
                            try:
                                pdf_data = _generate_pdf(app, student)
                                st.download_button(
                                    label="📥 인쇄",
                                    data=pdf_data,
                                    file_name=f"{get_application_type_name(app['application_type'])}_허가서.pdf",
                                    mime="application/pdf",
                                    use_container_width=True
                                )
                            except Exception as e:
                                st.error(f"PDF 생성 오류: {e}")
                        else:
                            st.markdown("⏳ **대기 중**")

                    st.caption(f"신청일: {app['submitted_at'][:10]}")

def _generate_pdf(app, student):
    """신청 유형에 따른 PDF 생성"""
    app_data = {
        'grade': student['grade'],
        'class_num': student['class_num'],
        'name': student['name'],
        'reason': app['reason'],
        'extra_info': app['extra_info'],
        'approval_number': app['approval_number']
    }

    if app['application_type'] == 'phone':
        return generate_phone_permit_pdf(app_data)
    elif app['application_type'] == 'tablet':
        return generate_tablet_permit_pdf(app_data)
    elif app['application_type'] == 'gate':
        return generate_gate_permit_pdf(app_data)
    else:
        raise ValueError(f"Unknown application type: {app['application_type']}")

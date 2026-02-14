import streamlit as st
from utils.ui_style import inject_nav_label_override

from components.auth import authenticate_parent, logout_parent
from components.forms import (
    render_phone_application_form,
    render_tablet_application_form,
    render_gate_application_form,
)
from services.application_service import (
    submit_application,
    get_student_applications,
    cancel_student_application,
    get_application_type_name,
    get_status_name,
)
from utils.gate_schedule import format_gate_schedule
from utils.pdf_generator import (
    generate_phone_permit_pdf,
    generate_tablet_permit_pdf,
    generate_gate_permit_pdf,
)


def _generate_pdf(app, student):
    app_data = {
        "grade": student["grade"],
        "class_num": student["class_num"],
        "name": student["name"],
        "reason": app["reason"],
        "extra_info": app["extra_info"],
        "approval_number": app["approval_number"],
    }
    if app["application_type"] == "phone":
        return generate_phone_permit_pdf(app_data)
    if app["application_type"] == "tablet":
        return generate_tablet_permit_pdf(app_data)
    if app["application_type"] == "gate":
        return generate_gate_permit_pdf(app_data)
    raise ValueError(f"Unknown application type: {app['application_type']}")


def _build_pdf_filename(app, student):
    app_type = app.get("application_type", "permit")
    student_id = student.get("student_id", "student")
    return f"permit_{app_type}_{student_id}.pdf"


st.set_page_config(
    page_title="학부모 페이지 - 허가서 신청",
    page_icon="👨‍👩‍👧‍👦",
    layout="wide",
)
inject_nav_label_override()


st.title("👨‍👩‍👧‍👦 학부모 페이지")
st.divider()

if "parent_authenticated" not in st.session_state:
    st.session_state.parent_authenticated = False
    st.session_state.student_info = None


if not st.session_state.parent_authenticated:
    st.subheader("학생 인증")
    with st.form("parent_auth_form"):
        c1, c2 = st.columns(2)
        with c1:
            student_id = st.text_input("학번", placeholder="예: 20250101")
        with c2:
            name = st.text_input("이름", placeholder="예: 홍길동")
        submitted = st.form_submit_button("인증하기", use_container_width=True, type="primary")
        if submitted:
            student = authenticate_parent(student_id, name)
            if student:
                st.session_state.parent_authenticated = True
                st.session_state.student_info = student
                st.success(f"{student['name']} 학생 인증 완료")
                st.rerun()
            else:
                st.error("학번 또는 이름이 일치하지 않습니다.")
    st.info("학번과 이름으로 인증 후 신청서를 작성할 수 있습니다.")

else:
    student = st.session_state.student_info

    c1, c2, c3 = st.columns([2, 2, 1])
    with c1:
        st.metric("학년", f"{student['grade']}학년 {student['class_num']}반")
    with c2:
        st.metric("이름", student["name"])
    with c3:
        if st.button("로그아웃", use_container_width=True):
            logout_parent()
            st.rerun()

    st.divider()

    tab1, tab2, tab3, tab4 = st.tabs(
        ["📱 휴대전화", "💻 태블릿PC", "🚪 정문출입", "📋 신청 현황"]
    )

    with tab1:
        form_data = render_phone_application_form(student)
        if form_data:
            success, message = submit_application(
                student["student_id"],
                form_data["type"],
                form_data["reason"],
                form_data["extra_info"],
            )
            if success:
                st.success(message)
                st.rerun()
            else:
                st.warning(message)

    with tab2:
        form_data = render_tablet_application_form(student)
        if form_data:
            success, message = submit_application(
                student["student_id"],
                form_data["type"],
                form_data["reason"],
                form_data["extra_info"],
            )
            if success:
                st.success(message)
                st.rerun()
            else:
                st.warning(message)

    with tab3:
        form_data = render_gate_application_form(student)
        if form_data:
            success, message = submit_application(
                student["student_id"],
                form_data["type"],
                form_data["reason"],
                form_data["extra_info"],
            )
            if success:
                st.success(message)
                st.rerun()
            else:
                st.warning(message)

    with tab4:
        st.subheader("📋 신청 현황")
        applications = get_student_applications(student["student_id"])

        if not applications:
            st.info("아직 신청 내역이 없습니다.")
        else:
            for app in applications:
                with st.container(border=True):
                    left, mid, right = st.columns([2, 2, 1])

                    with left:
                        st.markdown(f"**{get_application_type_name(app['application_type'])}**")
                        st.caption(f"신청 사유: {app['reason']}")
                        if app["application_type"] == "gate" and app.get("extra_info"):
                            st.caption(f"출입 시간: {format_gate_schedule(app['extra_info'])}")

                    with mid:
                        status_icon = {
                            "pending": "🟡",
                            "approved": "🟢",
                            "rejected": "🔴",
                            "auto_approved": "🟢",
                        }
                        st.markdown(f"{status_icon.get(app['status'], '⚪')} {get_status_name(app['status'])}")
                        if app.get("rejection_reason"):
                            st.caption(f"반려 사유: {app['rejection_reason']}")

                    with right:
                        if app["status"] in ("approved", "auto_approved"):
                            try:
                                pdf_data = _generate_pdf(app, student)
                                st.download_button(
                                    label="PDF 출력",
                                    data=pdf_data,
                                    file_name=_build_pdf_filename(app, student),
                                    mime="application/pdf",
                                    use_container_width=True,
                                )
                            except Exception as e:
                                st.error(f"PDF 생성 오류: {e}")
                        if app["status"] in ("pending", "approved", "auto_approved"):
                            if st.button("신청 취소", key=f"cancel_app_{app['id']}", use_container_width=True):
                                success, message = cancel_student_application(app["id"], student["student_id"])
                                if success:
                                    st.success(message)
                                    st.rerun()
                                else:
                                    st.warning(message)
                        else:
                            st.markdown("처리 완료")

                    st.caption(f"신청일: {app['submitted_at'][:10]}")

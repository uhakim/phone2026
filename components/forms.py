import streamlit as st
from utils.validators import validate_reason, validate_time_format

def render_phone_application_form(student_info):
    """휴대전화 신청서 폼"""
    st.subheader("📱 휴대전화 소지 신청서")

    with st.form("phone_form", clear_on_submit=True):
        reason = st.text_area(
            "휴대전화를 소지해야 하는 이유",
            placeholder="예: 부모와의 비상 연락용",
            height=120
        )

        submitted = st.form_submit_button(
            "신청하기",
            use_container_width=True,
            type="primary"
        )

        if submitted:
            if not validate_reason(reason):
                st.error("신청 이유를 입력해주세요")
                return None

            return {
                'type': 'phone',
                'reason': reason.strip(),
                'extra_info': None
            }

    return None

def render_tablet_application_form(student_info):
    """태블릿PC 신청서 폼"""
    st.subheader("💻 태블릿PC 소지 신청서")

    with st.form("tablet_form", clear_on_submit=True):
        reason = st.text_area(
            "수업용 태블릿PC를 소지해야 하는 이유",
            placeholder="예: 온라인 학습용",
            height=120
        )

        submitted = st.form_submit_button(
            "신청하기",
            use_container_width=True,
            type="primary"
        )

        if submitted:
            if not validate_reason(reason):
                st.error("신청 이유를 입력해주세요")
                return None

            return {
                'type': 'tablet',
                'reason': reason.strip(),
                'extra_info': None
            }

    return None

def render_gate_application_form(student_info):
    """정문출입 신청서 폼"""
    st.subheader("🚪 정문출입 허가서 신청서")

    with st.form("gate_form", clear_on_submit=True):
        col1, col2 = st.columns(2)

        with col1:
            reason = st.text_input(
                "정문 출입을 해야 하는 이유",
                placeholder="예: 피아노 학원 다님"
            )

        with col2:
            schedule = st.text_input(
                "출입 요일 및 시간",
                placeholder="예: 월수금 16:00 / 화목 15:30"
            )

        submitted = st.form_submit_button(
            "신청하기",
            use_container_width=True,
            type="primary"
        )

        if submitted:
            if not validate_reason(reason):
                st.error("정문 출입 이유를 입력해주세요")
                return None

            if not validate_reason(schedule):
                st.error("출입 요일 및 시간을 입력해주세요")
                return None

            return {
                'type': 'gate',
                'reason': reason.strip(),
                'extra_info': schedule.strip()
            }

    return None

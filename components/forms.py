import streamlit as st

from utils.gate_schedule import DISMISSAL_OPTIONS, WEEKDAYS, build_gate_schedule
from utils.validators import validate_reason


def render_phone_application_form(student_info):
    st.subheader("📱 휴대전화 소지 신청서")

    with st.form("phone_form", clear_on_submit=True):
        reason = st.text_area(
            "휴대전화를 소지해야 하는 사유",
            placeholder="예: 보호자 비상 연락",
            height=120,
        )
        submitted = st.form_submit_button("신청하기", use_container_width=True, type="primary")
        if submitted:
            if not validate_reason(reason):
                st.error("신청 사유를 입력해주세요.")
                return None
            return {"type": "phone", "reason": reason.strip(), "extra_info": None}
    return None


def render_tablet_application_form(student_info):
    st.subheader("💻 수업용 태블릿PC 소지 신청서")

    with st.form("tablet_form", clear_on_submit=True):
        reason = st.text_area(
            "태블릿PC를 소지해야 하는 사유",
            placeholder="예: 온라인 학습 과제",
            height=120,
        )
        submitted = st.form_submit_button("신청하기", use_container_width=True, type="primary")
        if submitted:
            if not validate_reason(reason):
                st.error("신청 사유를 입력해주세요.")
                return None
            return {"type": "tablet", "reason": reason.strip(), "extra_info": None}
    return None


def render_gate_application_form(student_info):
    st.subheader("🚪 정문 출입 허가 신청서")

    with st.form("gate_form", clear_on_submit=True):
        reason = st.text_input(
            "정문 출입 사유",
            placeholder="예: 학원, 병원, 도보 하교",
        )

        st.markdown("**등교 (요일 체크)**")
        morning_days = []
        morning_cols = st.columns(5)
        for idx, day in enumerate(WEEKDAYS):
            with morning_cols[idx]:
                if st.checkbox(day, key=f"gate_morning_{day}"):
                    morning_days.append(day)

        st.markdown("**하교 (요일 체크 + 시간 선택)**")
        dismissal_by_day = {}
        opt_labels = {
            code: f"{meta['label']} ({meta['time']})"
            for code, meta in DISMISSAL_OPTIONS.items()
        }
        dismissal_options = ["none"] + list(DISMISSAL_OPTIONS.keys())
        opt_labels["none"] = "선택 안함"

        for day in WEEKDAYS:
            col_a, col_b = st.columns([1, 3])
            with col_a:
                checked = st.checkbox(f"{day} 하교", key=f"gate_dismiss_chk_{day}")
            with col_b:
                selected = st.selectbox(
                    f"{day} 하교 시간",
                    options=dismissal_options,
                    format_func=lambda x: opt_labels[x],
                    key=f"gate_dismiss_sel_{day}",
                )
            if checked and selected != "none":
                dismissal_by_day[day] = selected

        submitted = st.form_submit_button("신청하기", use_container_width=True, type="primary")
        if submitted:
            if not validate_reason(reason):
                st.error("정문 출입 사유를 입력해주세요.")
                return None

            for day in WEEKDAYS:
                if (
                    st.session_state.get(f"gate_dismiss_chk_{day}")
                    and st.session_state.get(f"gate_dismiss_sel_{day}") == "none"
                ):
                    st.error(f"{day} 하교 시간을 선택해주세요.")
                    return None

            if not morning_days and not dismissal_by_day:
                st.error("등교 또는 하교 시간 중 최소 1개 이상 선택해주세요.")
                return None

            schedule_json = build_gate_schedule(morning_days, dismissal_by_day)
            return {"type": "gate", "reason": reason.strip(), "extra_info": schedule_json}

    return None

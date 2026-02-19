from datetime import date, datetime
from pathlib import Path

import pandas as pd
import requests
import streamlit as st

from components.auth import authenticate_admin, logout_admin
from components.statistics import render_statistics_dashboard
from database.db_manager import execute_query, execute_update
from services.student_service import (
    add_student,
    add_students,
    delete_student,
    get_all_students,
    clear_all_students_and_applications,
)
from utils.csv_handler import parse_student_csv, validate_csv_format
from utils.gate_schedule import WEEKDAYS, gate_schedule_to_grid
from utils.ui_style import inject_nav_label_override

GOOGLE_SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxdylk68Qe1G-3_Jo5HBaPBiOIrSuGcT_C3DKkgfXZudQ-8mpCX5bcDPVBNW-OsnTcI/exec"


def _student_csv_template_bytes() -> bytes:
    template = "학번,이름,학년,반\n20250101,홍길동,1,1\n20250102,김영희,1,1\n"
    return template.encode("utf-8-sig")


def _get_setting(key: str, default: str) -> str:
    query = "SELECT value FROM settings WHERE key = ?"
    result = execute_query(query, (key,))
    return result[0]["value"] if result else default


def _update_setting(key: str, value: str):
    query = """
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = now()
    """
    execute_update(query, (key, value))


def _parse_date(value: str, fallback: date) -> date:
    if not value:
        return fallback
    for fmt in ("%Y-%m-%d", "%Y.%m.%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except Exception:
            continue
    return fallback


def _save_principal_stamp(uploaded_file) -> str:
    upload_dir = Path("data/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(uploaded_file.name).suffix.lower()
    if ext not in [".png", ".jpg", ".jpeg"]:
        ext = ".png"
    target = upload_dir / f"principal_stamp{ext}"
    with open(target, "wb") as f:
        f.write(uploaded_file.getbuffer())
    return str(target.as_posix())


def _delete_principal_stamp():
    stamp_path = _get_setting("principal_stamp_path", "")
    if stamp_path:
        file_path = Path(stamp_path)
        if file_path.exists():
            file_path.unlink()
    for ext in [".png", ".jpg", ".jpeg"]:
        candidate = Path("data/uploads") / f"principal_stamp{ext}"
        if candidate.exists():
            candidate.unlink()


def _normalize_dismissal(value: str) -> str:
    if not value:
        return ""
    if "(" in value:
        return value.split("(", 1)[0].strip()
    return value


def _to_google_check(value: str):
    return True if value == "✓" else ""


def _get_gate_roster_rows():
    query = """
    SELECT a.student_id, s.name, a.reason, a.extra_info
    FROM applications a
    JOIN students s ON a.student_id = s.student_id
    WHERE a.application_type = 'gate'
      AND a.status IN ('approved', 'auto_approved')
    ORDER BY s.grade, s.class_num, s.name
    """
    rows = execute_query(query)
    result = []
    for row in rows:
        row = dict(row)
        morning_map, dismissal_map = gate_schedule_to_grid(row.get("extra_info"))
        item = {"학번": row["student_id"], "성명": row["name"]}
        for day in WEEKDAYS:
            item[f"등교-{day}"] = morning_map[day]
        for day in WEEKDAYS:
            item[f"하교-{day}"] = dismissal_map[day]
        item["사유"] = row.get("reason", "")
        result.append(item)
    return result


def _to_google_rows(roster_rows):
    rows = []
    for r in roster_rows:
        row = [
            r.get("학번", ""),
            r.get("성명", ""),
            _to_google_check(r.get("등교-월", "")),
            _to_google_check(r.get("등교-화", "")),
            _to_google_check(r.get("등교-수", "")),
            _to_google_check(r.get("등교-목", "")),
            _to_google_check(r.get("등교-금", "")),
            _normalize_dismissal(r.get("하교-월", "")),
            _normalize_dismissal(r.get("하교-화", "")),
            _normalize_dismissal(r.get("하교-수", "")),
            _normalize_dismissal(r.get("하교-목", "")),
            _normalize_dismissal(r.get("하교-금", "")),
            r.get("사유", ""),
        ]
        rows.append(row)
    return rows


def _sync_google_sheet(roster_rows):
    payload = {
        "clear": True,
        "startRow": 4,
        "startCol": 1,
        "rows": _to_google_rows(roster_rows),
    }
    res = requests.post(GOOGLE_SHEET_WEBAPP_URL, json=payload, timeout=20)
    res.raise_for_status()
    data = res.json()
    if not data.get("ok"):
        raise RuntimeError(data.get("error", "unknown error"))
    return int(data.get("count", len(payload["rows"])))


st.set_page_config(page_title="관리 페이지", page_icon="⚙️", layout="wide")
inject_nav_label_override()

st.title("⚙️ 관리 페이지")
st.divider()

if "admin_authenticated" not in st.session_state:
    st.session_state.admin_authenticated = False
    st.session_state.admin_name = None

if not st.session_state.admin_authenticated:
    st.subheader("🔐 관리자 인증")
    with st.form("admin_auth_form"):
        password = st.text_input("비밀번호", type="password", placeholder="관리자 비밀번호")
        submitted = st.form_submit_button("로그인", use_container_width=True, type="primary")
        if submitted:
            if authenticate_admin(password):
                st.session_state.admin_authenticated = True
                st.session_state.admin_name = "관리자"
                st.success("관리자 인증이 완료되었습니다.")
                st.rerun()
            else:
                st.error("비밀번호가 올바르지 않습니다.")
    st.info("관리자 비밀번호를 입력해주세요.")

else:
    c1, c2 = st.columns([4, 1])
    with c1:
        st.markdown(f"**{st.session_state.admin_name} 로그인 상태**")
    with c2:
        if st.button("로그아웃", use_container_width=True):
            logout_admin()
            st.rerun()

    st.divider()
    tab1, tab2, tab3, tab4, tab5 = st.tabs(
        ["👥 학생 명단 관리", "⚙️ 승인 모드/학년도 설정", "📊 통계", "📄 문서 관리", "🚪 정문 출입 명단"]
    )

    with tab1:
        st.subheader("👥 학생 명단 관리")
        sub_tab1, sub_tab2 = st.tabs(["📤 CSV 업로드", "📝 개별 관리"])

        with sub_tab1:
            st.markdown(
                """
                **CSV 파일 형식**
                ```csv
                학번,이름,학년,반
                20250101,홍길동,1,1
                20250102,김영희,1,1
                ```
                """
            )
            st.download_button(
                label="서식파일 다운로드",
                data=_student_csv_template_bytes(),
                file_name="학생명단_업로드_서식.csv",
                mime="text/csv",
                use_container_width=True,
            )
            uploaded_file = st.file_uploader("CSV 파일 선택", type=["csv"], label_visibility="collapsed")
            if uploaded_file is not None:
                file_content = uploaded_file.read()
                is_valid, message = validate_csv_format(file_content)
                if is_valid:
                    st.success(message)
                    students, _ = parse_student_csv(file_content)
                    if st.button("학생 데이터 등록"):
                        count = add_students(students)
                        st.success(f"{count}명의 학생이 등록되었습니다.")
                        st.rerun()
                else:
                    st.error(message)

        with sub_tab2:
            left, right = st.columns(2)
            with left:
                st.markdown("**학생 추가**")
                with st.form("add_student_form"):
                    student_id = st.text_input("학번")
                    name = st.text_input("이름")
                    grade = st.number_input("학년", min_value=1, max_value=6)
                    class_num = st.number_input("반", min_value=1, max_value=10)
                    if st.form_submit_button("추가"):
                        try:
                            add_student(student_id, name, int(grade), int(class_num))
                            st.success("학생이 추가되었습니다.")
                            st.rerun()
                        except Exception as e:
                            st.error(f"오류: {e}")

                st.divider()
                st.markdown("**전체 삭제**")
                st.caption("학생 명단과 해당 신청서가 모두 삭제됩니다.")
                confirm_clear = st.checkbox("전체 삭제를 진행합니다.", key="confirm_clear_all")
                if st.button("학생 명단 전체 삭제", use_container_width=True, type="secondary"):
                    if not confirm_clear:
                        st.warning("체크 후 다시 눌러주세요.")
                    else:
                        deleted_students, deleted_apps = clear_all_students_and_applications()
                        st.success(f"삭제 완료: 학생 {deleted_students}명, 신청서 {deleted_apps}건")
                        st.rerun()
            with right:
                st.markdown("**현재 학생 목록**")
                students = get_all_students()
                if students:
                    df = pd.DataFrame(students)[["student_id", "name", "grade", "class_num"]].copy()
                    df.columns = ["학번", "이름", "학년", "반"]
                    st.dataframe(df, use_container_width=True, hide_index=True)
                    selected = st.selectbox("삭제할 학생", [f"{s['name']} ({s['student_id']})" for s in students])
                    if selected and st.button("선택 학생 삭제", use_container_width=True):
                        target_id = selected.split("(")[1].rstrip(")")
                        delete_student(target_id)
                        st.success("학생이 삭제되었습니다.")
                        st.rerun()
                else:
                    st.info("등록된 학생이 없습니다.")

    with tab2:
        st.subheader("⚙️ 승인 모드 설정")
        st.info("- 자동 발급: 신청 즉시 발급\n- 승인 필요: 관리자 승인 후 발급")
        modes = ["auto", "manual"]
        mode_names = {"auto": "자동 발급", "manual": "승인 필요"}
        cols = st.columns(3)
        items = [
            ("phone_approval_mode", "📱 휴대전화"),
            ("tablet_approval_mode", "💻 태블릿PC"),
            ("gate_approval_mode", "🚪 정문 출입"),
        ]
        for col, (key, title) in zip(cols, items):
            with col:
                st.markdown(f"**{title}**")
                current = _get_setting(key, "manual")
                selected = st.selectbox(
                    "모드",
                    options=modes,
                    format_func=lambda x: mode_names[x],
                    index=modes.index(current),
                    key=f"mode_{key}",
                    label_visibility="collapsed",
                )
                if selected != current and st.button("저장", key=f"save_{key}"):
                    _update_setting(key, selected)
                    st.success("설정이 저장되었습니다.")
                    st.rerun()

        st.divider()
        st.subheader("📅 학년도 설정")
        default_year = int(_get_setting("academic_year", "2025"))
        default_start = _parse_date(_get_setting("academic_year_start", f"{default_year}-03-01"), date(default_year, 3, 1))
        ycol, scol = st.columns(2)
        with ycol:
            selected_year = int(st.number_input("학년도", min_value=2020, max_value=2100, value=default_year, step=1))
        with scol:
            selected_start = st.date_input("학년도 시작일", value=default_start)
        computed_end = date(selected_year + 1, 2, 28)
        st.info(f"학년도 마지막 날(자동): **{computed_end.year}-{computed_end.month:02d}-{computed_end.day:02d}**")
        if st.button("학년도 설정 저장", type="primary"):
            _update_setting("academic_year", str(selected_year))
            _update_setting("academic_year_start", selected_start.isoformat())
            st.success("학년도 설정이 저장되었습니다.")
            st.rerun()

    with tab3:
        render_statistics_dashboard()

    with tab4:
        st.subheader("📄 문서 관리")
        st.markdown("**학교장 확인 도장 이미지**")
        current_stamp_path = _get_setting("principal_stamp_path", "")
        if current_stamp_path and Path(current_stamp_path).exists():
            st.caption(f"현재 파일: `{current_stamp_path}`")
            st.image(str(Path(current_stamp_path)), width=220)
        else:
            st.info("현재 등록된 도장 이미지가 없습니다.")
        stamp_file = st.file_uploader("도장 이미지 업로드", type=["png", "jpg", "jpeg"], help="투명 배경 PNG 권장")
        d1, d2 = st.columns(2)
        with d1:
            if st.button("도장 저장", use_container_width=True, type="primary"):
                if stamp_file is None:
                    st.warning("업로드할 이미지를 먼저 선택해주세요.")
                else:
                    saved_path = _save_principal_stamp(stamp_file)
                    _update_setting("principal_stamp_path", saved_path)
                    st.success("도장 이미지가 저장되었습니다.")
                    st.rerun()
        with d2:
            if st.button("도장 삭제", use_container_width=True):
                _delete_principal_stamp()
                _update_setting("principal_stamp_path", "")
                st.success("도장 이미지가 삭제되었습니다.")
                st.rerun()

    with tab5:
        st.subheader("🚪 정문 출입 명단")
        st.caption("승인 완료된 정문 출입 신청만 표시합니다.")
        roster_rows = _get_gate_roster_rows()
        if not roster_rows:
            st.info("표시할 정문 출입 명단이 없습니다.")
        else:
            df = pd.DataFrame(roster_rows)
            st.dataframe(df, use_container_width=True, hide_index=True, height=620)

            if st.button("구글시트 업로드 (A4:M)"):
                try:
                    count = _sync_google_sheet(roster_rows)
                    st.success(f"구글시트 업로드 완료: {count}행")
                except Exception as e:
                    st.error(f"업로드 실패: {e}")

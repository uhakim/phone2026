import streamlit as st
import pandas as pd
from components.auth import authenticate_admin, logout_admin
from components.statistics import render_statistics_dashboard
from services.student_service import (
    add_students,
    get_all_students,
    delete_student,
    add_student
)
from services.application_service import get_student_applications
from utils.csv_handler import parse_student_csv, validate_csv_format
from database.db_manager import execute_query, execute_update

# 페이지 설정
st.set_page_config(
    page_title="관리 페이지",
    page_icon="⚙️",
    layout="wide"
)

st.title("⚙️ 관리 페이지")
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
                st.session_state.admin_name = "관리자"
                st.success("✓ 인증 완료")
                st.rerun()
            else:
                st.error("❌ 비밀번호가 일치하지 않습니다")

    st.info("교감 선생님 또는 생활부장 선생님 비밀번호를 입력해주세요")

# ============= 인증된 상태 =============
else:
    col1, col2 = st.columns([4, 1])

    with col1:
        st.markdown(f"**{st.session_state.admin_name} 로그인됨**")

    with col2:
        if st.button("🚪 로그아웃"):
            logout_admin()
            st.rerun()

    st.divider()

    # 탭 구성
    tab1, tab2, tab3, tab4 = st.tabs([
        "👥 학생 명단 관리",
        "⚙️ 승인 모드 설정",
        "📊 통계",
        "📄 문서 관리"
    ])

    # ===== TAB 1: 학생 명단 관리 =====
    with tab1:
        st.subheader("👥 학생 명단 관리")

        sub_tab1, sub_tab2 = st.tabs(["📤 CSV 업로드", "📝 개별 관리"])

        # CSV 업로드
        with sub_tab1:
            st.markdown("""
            **CSV 파일 형식:**
            ```
            학번,이름,학년,반
            20250101,홍길동,1,1
            20250102,김영희,1,1
            ```
            """)

            uploaded_file = st.file_uploader(
                "CSV 파일 선택",
                type=['csv'],
                label_visibility="collapsed"
            )

            if uploaded_file is not None:
                file_content = uploaded_file.read()

                # 검증
                is_valid, message = validate_csv_format(file_content)

                if is_valid:
                    st.success(message)

                    # 파싱
                    students, errors = parse_student_csv(file_content)

                    if st.button("학생 데이터 저장"):
                        count = add_students(students)
                        st.success(f"✓ {count}명의 학생이 저장되었습니다")
                        st.rerun()
                else:
                    st.error(message)

        # 개별 관리
        with sub_tab2:
            col1, col2 = st.columns(2)

            with col1:
                st.markdown("**학생 추가**")

                with st.form("add_student_form"):
                    student_id = st.text_input("학번")
                    name = st.text_input("이름")
                    grade = st.number_input("학년", min_value=1, max_value=6)
                    class_num = st.number_input("반", min_value=1, max_value=10)

                    if st.form_submit_button("추가"):
                        try:
                            add_student(student_id, name, int(grade), int(class_num))
                            st.success("✓ 학생이 추가되었습니다")
                            st.rerun()
                        except Exception as e:
                            st.error(f"오류: {e}")

            with col2:
                st.markdown("**현재 학생 목록**")

                students = get_all_students()

                if students:
                    df = pd.DataFrame(students)
                    df = df[['student_id', 'name', 'grade', 'class_num']].copy()
                    df.columns = ['학번', '이름', '학년', '반']

                    st.dataframe(df, use_container_width=True, hide_index=True)

                    # 학생 삭제
                    student_to_delete = st.selectbox(
                        "삭제할 학생",
                        [f"{s['name']} ({s['student_id']})" for s in students]
                    )

                    if student_to_delete:
                        student_id = student_to_delete.split('(')[1].rstrip(')')

                        if st.button("🗑️ 삭제", use_container_width=True):
                            delete_student(student_id)
                            st.success("✓ 학생이 삭제되었습니다")
                            st.rerun()
                else:
                    st.info("등록된 학생이 없습니다")

    # ===== TAB 2: 승인 모드 설정 =====
    with tab2:
        st.subheader("⚙️ 신청서 승인 모드 설정")

        st.info("""
        - **자동 발급**: 학부모가 신청하면 즉시 허가서 발급
        - **승인 필요**: 교감/생활부장 승인 후 허가서 발급
        """)

        col1, col2, col3 = st.columns(3)

        modes = ['auto', 'manual']
        mode_names = ['자동 발급', '승인 필요']

        # 휴대전화
        with col1:
            st.markdown("**📱 휴대전화 승낙서**")

            current_mode = _get_setting('phone_approval_mode', 'manual')
            selected_mode = st.selectbox(
                "모드 선택",
                options=modes,
                format_func=lambda x: mode_names[modes.index(x)],
                index=modes.index(current_mode),
                key='phone_mode',
                label_visibility="collapsed"
            )

            if selected_mode != current_mode:
                if st.button("저장", key="save_phone"):
                    _update_setting('phone_approval_mode', selected_mode)
                    st.success("✓ 저장되었습니다")
                    st.rerun()

        # 태블릿
        with col2:
            st.markdown("**💻 태블릿PC 승낙서**")

            current_mode = _get_setting('tablet_approval_mode', 'manual')
            selected_mode = st.selectbox(
                "모드 선택",
                options=modes,
                format_func=lambda x: mode_names[modes.index(x)],
                index=modes.index(current_mode),
                key='tablet_mode',
                label_visibility="collapsed"
            )

            if selected_mode != current_mode:
                if st.button("저장", key="save_tablet"):
                    _update_setting('tablet_approval_mode', selected_mode)
                    st.success("✓ 저장되었습니다")
                    st.rerun()

        # 정문출입
        with col3:
            st.markdown("**🚪 정문출입 허가서**")

            current_mode = _get_setting('gate_approval_mode', 'manual')
            selected_mode = st.selectbox(
                "모드 선택",
                options=modes,
                format_func=lambda x: mode_names[modes.index(x)],
                index=modes.index(current_mode),
                key='gate_mode',
                label_visibility="collapsed"
            )

            if selected_mode != current_mode:
                if st.button("저장", key="save_gate"):
                    _update_setting('gate_approval_mode', selected_mode)
                    st.success("✓ 저장되었습니다")
                    st.rerun()

    # ===== TAB 3: 통계 =====
    with tab3:
        render_statistics_dashboard()

    # ===== TAB 4: 문서 관리 =====
    with tab4:
        st.subheader("📄 문서 관리")

        st.info("추후 업데이트 예정: 규정, 양식, 가정통신문 등 문서 관리")

# 헬퍼 함수
def _get_setting(key: str, default: str) -> str:
    """설정값 조회"""
    query = "SELECT value FROM settings WHERE key = ?"
    result = execute_query(query, (key,))
    return result[0]['value'] if result else default

def _update_setting(key: str, value: str):
    """설정값 업데이트"""
    query = """
    INSERT OR REPLACE INTO settings (key, value)
    VALUES (?, ?)
    """
    execute_update(query, (key, value))

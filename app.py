import streamlit as st

from config.settings import SCHOOL_NAME
from database.db_manager import init_database
from utils.academic_year import get_academic_year
from utils.ui_style import inject_nav_label_override


st.set_page_config(
    page_title="출입·스마트기기 관리시스템",
    page_icon="🏫",
    layout="wide",
    initial_sidebar_state="expanded",
)


@st.cache_resource
def setup_database():
    init_database()
    return True


setup_database()
inject_nav_label_override()

year = get_academic_year()

st.title(f"🏫 {SCHOOL_NAME} 출입·스마트기기 관리시스템")
st.divider()

st.subheader("시스템 소개")
st.markdown(
    """
학부모 신청과 관리자 승인을 한 곳에서 처리합니다.

- 휴대전화 허가서
- 태블릿PC 허가서
- 정문 출입 허가서
"""
)

st.subheader("메뉴 안내")
st.markdown(
    """
왼쪽 사이드바에서 페이지를 선택하세요.

- `학부모 페이지`: 신청서 작성, 신청 현황 조회, PDF 출력
- `관리자 승인 페이지`: 신청 승인/반려 처리
- `관리 페이지`: 학생 관리, 승인 모드 설정, 통계/문서 관리
"""
)

st.info(f"{year}학년도 운영 중입니다.")

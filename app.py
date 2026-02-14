import streamlit as st
from database.db_manager import init_database
from config.settings import SCHOOL_NAME, SCHOOL_YEAR

# 페이지 설정
st.set_page_config(
    page_title=f"{SCHOOL_NAME} 온라인 승낙서 관리 시스템",
    page_icon="🏫",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 데이터베이스 초기화
@st.cache_resource
def setup_database():
    init_database()
    return True

setup_database()

# 홈페이지 UI
st.title(f"🏫 {SCHOOL_NAME} 온라인 승낙서 관리 시스템")
st.divider()

# 시스템 소개
st.subheader("📋 시스템 소개")
st.markdown("""
학부모님들이 온라인으로 쉽게 신청할 수 있는 통합 승낙서 관리 시스템입니다.
- 휴대전화/태블릿PC 소지 승낙서
- 정문출입 허가서

신청 후 승인되면 PDF로 인쇄하여 사용할 수 있습니다.
""")

# 사용자별 안내
st.divider()
st.subheader("👥 사용자별 안내")

col1, col2, col3 = st.columns(3)

with col1:
    st.markdown("### 👨‍👩‍👧 학부모님")
    st.markdown("""
    **페이지:** 1️⃣ 학부모 페이지

    - 학번과 이름으로 인증
    - 신청서 작성 및 제출
    - 승인된 허가서 다운로드
    - 신청 현황 조회
    """)

with col2:
    st.markdown("### ✅ 교감/생활부장 선생님")
    st.markdown("""
    **페이지:** 2️⃣ 교감 승인 페이지

    - 승인 대기 목록 확인
    - 신청서 승인/반려
    - 승인 현황 모니터링
    """)

with col3:
    st.markdown("### ⚙️ 관리자 (교감/생활부장)")
    st.markdown("""
    **페이지:** 3️⃣ 관리 페이지

    - 학생 명단 관리
    - 승인 모드 설정
    - 통계 및 현황 조회
    - 문서 관리
    """)

st.divider()

# 공지사항
st.subheader("📢 공지사항")
st.info(f"""
{SCHOOL_YEAR}학년도 온라인 승낙서 관리 시스템을 오픈했습니다.
편리한 이용 부탁드립니다.
""")

# 규정 및 양식 다운로드 (추후 구현)
st.divider()
st.subheader("📄 규정 및 양식")
st.markdown("문서 업로드 후 여기서 다운로드 가능합니다. (관리 페이지에서 업로드)")

# 페이지 네비게이션
st.divider()
st.markdown("""
---
### 🔗 페이지 네비게이션

**좌측 사이드바를 확인하세요:**
- 1️⃣ **학부모 페이지** - 신청서 작성 및 조회
- 2️⃣ **교감 승인 페이지** - 신청서 승인
- 3️⃣ **관리 페이지** - 시스템 관리

---
""")

# footer
st.markdown("""
<div style='text-align: center; color: gray; font-size: 12px; margin-top: 50px;'>
🏫 동성초등학교 | 문의: 교감실
</div>
""", unsafe_allow_html=True)

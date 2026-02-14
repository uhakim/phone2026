import streamlit as st


def inject_nav_label_override():
    """사이드바 첫 메뉴의 기본 'app' 라벨을 '안내'로 표시."""
    st.markdown(
        """
        <style>
        div[data-testid="stSidebarNav"] ul li:first-child a {
            position: relative !important;
        }
        div[data-testid="stSidebarNav"] ul li:first-child a p,
        div[data-testid="stSidebarNav"] ul li:first-child a span {
            color: transparent !important;
        }
        div[data-testid="stSidebarNav"] ul li:first-child a::after {
            content: "안내";
            position: absolute;
            left: 0.75rem;
            top: 50%;
            transform: translateY(-50%);
            font-size: 1rem;
            font-weight: 600;
            color: inherit;
            pointer-events: none;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )

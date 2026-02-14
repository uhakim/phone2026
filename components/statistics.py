import streamlit as st
import pandas as pd
from services.application_service import (
    get_statistics,
    get_statistics_by_type,
    get_statistics_by_grade,
    get_application_type_name,
    get_status_name
)

def render_statistics_dashboard():
    """통계 대시보드 렌더링"""
    st.subheader("📊 통계 대시보드")

    # KPI 카드
    stats = get_statistics()

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("📋 전체", stats['total'])
    with col2:
        st.metric("⏳ 대기 중", stats['pending'])
    with col3:
        st.metric("✅ 완료", stats['approved'])
    with col4:
        st.metric("🔴 반려", stats['rejected'])

    st.divider()

    # 타입별 통계
    st.subheader("📝 신청 타입별 현황")

    type_data = get_statistics_by_type()
    if type_data:
        type_df = pd.DataFrame(type_data)

        # 피벗 테이블
        pivot_df = type_df.pivot_table(
            index='application_type',
            columns='status',
            values='count',
            fill_value=0
        )

        # 한글로 표시
        pivot_df.index = [get_application_type_name(idx) for idx in pivot_df.index]
        pivot_df.columns = [get_status_name(col) for col in pivot_df.columns]

        st.dataframe(pivot_df, use_container_width=True)
    else:
        st.info("통계 데이터가 없습니다")

    st.divider()

    # 학년별 통계
    st.subheader("👥 학년별 신청 현황")

    grade_data = get_statistics_by_grade()
    if grade_data:
        grade_df = pd.DataFrame(grade_data)

        col1, col2 = st.columns([2, 1])

        with col1:
            st.bar_chart(
                grade_df.set_index('grade')['count'],
                use_container_width=True
            )

        with col2:
            st.dataframe(grade_df, use_container_width=True, hide_index=True)
    else:
        st.info("통계 데이터가 없습니다")

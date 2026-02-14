import os
import streamlit as st
from database.db_manager import execute_query

def authenticate_parent(student_id: str, name: str):
    """학부모 인증: 학번과 이름 확인"""
    query = """
    SELECT id, student_id, name, grade, class_num
    FROM students
    WHERE student_id = ? AND name = ?
    """
    result = execute_query(query, (student_id, name))

    if result:
        return dict(result[0])
    return None

def authenticate_admin(password: str) -> bool:
    """관리자 인증: 비밀번호 확인"""
    admin_password = os.getenv("ADMIN_PASSWORD")

    if not admin_password:
        st.warning("⚠️ 관리자 비밀번호가 설정되지 않았습니다.")
        return False

    return password == admin_password

def is_user_authenticated(user_type: str) -> bool:
    """현재 사용자 인증 상태 확인"""
    if user_type == "parent":
        return st.session_state.get("parent_authenticated", False)
    elif user_type == "admin":
        return st.session_state.get("admin_authenticated", False)
    return False

def get_current_student():
    """현재 인증된 학생 정보 반환"""
    return st.session_state.get("student_info", None)

def logout_parent():
    """학부모 로그아웃"""
    st.session_state.parent_authenticated = False
    st.session_state.student_info = None

def logout_admin():
    """관리자 로그아웃"""
    st.session_state.admin_authenticated = False
    st.session_state.admin_name = None

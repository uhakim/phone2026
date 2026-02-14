import re

def validate_student_id(student_id: str) -> bool:
    """학번 형식 검증"""
    return bool(student_id and len(student_id.strip()) > 0)

def validate_name(name: str) -> bool:
    """이름 형식 검증"""
    return bool(name and len(name.strip()) > 0)

def validate_reason(reason: str) -> bool:
    """신청 이유 검증"""
    return bool(reason and len(reason.strip()) > 0)

def validate_grade(grade: int) -> bool:
    """학년 검증"""
    return 1 <= grade <= 6

def validate_class(class_num: int) -> bool:
    """반 검증"""
    return 1 <= class_num <= 10

def validate_time_format(time_str: str) -> bool:
    """시간 형식 검증 (HH:MM)"""
    pattern = r'^([01]\d|2[0-3]):([0-5]\d)$'
    return bool(re.match(pattern, time_str))

def validate_email(email: str) -> bool:
    """이메일 검증"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_password(password: str, min_length: int = 4) -> bool:
    """비밀번호 검증"""
    return len(password) >= min_length

def sanitize_input(text: str) -> str:
    """입력값 정제 (XSS 방지)"""
    if not isinstance(text, str):
        return ""

    # 위험한 HTML 문자 이스케이프
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    text = text.replace('"', '&quot;')
    text = text.replace("'", '&#39;')

    return text.strip()

def validate_file_upload(file_name: str, allowed_extensions: list) -> bool:
    """파일 업로드 검증"""
    if not file_name:
        return False

    file_ext = file_name.split('.')[-1].lower()
    return file_ext in allowed_extensions

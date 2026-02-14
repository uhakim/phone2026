from datetime import datetime
from database.db_manager import execute_query

def get_next_sequence(application_type: str) -> int:
    """해당 타입의 다음 시퀀스 번호 조회"""
    year = datetime.now().year

    query = """
    SELECT COUNT(*) as count
    FROM applications
    WHERE application_type = ? AND status IN ('approved', 'auto_approved')
    AND strftime('%Y', approved_at) = ?
    """

    result = execute_query(query, (application_type, str(year)))

    if result:
        return result[0]['count'] + 1

    return 1

def generate_approval_number(application_type: str) -> str:
    """
    승인번호 생성
    형식: DS-{TYPE}-{YEAR}-{SEQUENCE}
    예: DS-GATE-2025-0001
    """
    year = datetime.now().year

    type_code = {
        'gate': 'GATE',
        'phone': 'PHONE',
        'tablet': 'TABLET'
    }

    code = type_code.get(application_type, 'UNKNOWN')
    sequence = get_next_sequence(application_type)

    return f"DS-{code}-{year}-{sequence:04d}"

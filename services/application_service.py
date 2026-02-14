from datetime import datetime
from database.db_manager import execute_query, execute_insert, execute_update
from typing import List, Dict, Optional
from utils.approval_number import generate_approval_number

def submit_application(student_id: str, application_type: str, reason: str, extra_info: str = None) -> tuple[bool, str]:
    """
    신청서 제출
    승인 모드에 따라 자동 발급 또는 승인 대기

    Returns:
        (성공 여부, 메시지)
    """
    try:
        # 승인 모드 확인
        approval_mode = _get_approval_mode(application_type)

        # 상태 결정
        if approval_mode == 'auto':
            status = 'auto_approved'
            approved_at = datetime.now().isoformat()
            # 정문출입은 승인번호 생성
            approval_number = generate_approval_number(application_type) if application_type == 'gate' else None
        else:
            status = 'pending'
            approved_at = None
            approval_number = None

        # 신청서 저장
        query = """
        INSERT INTO applications (
            student_id, application_type, reason, extra_info, status,
            approved_at, approval_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """

        execute_insert(query, (
            student_id, application_type, reason, extra_info, status,
            approved_at, approval_number
        ))

        if status == 'auto_approved':
            return True, "✓ 신청이 완료되었으며 즉시 발급되었습니다"
        else:
            return True, "✓ 신청이 완료되었습니다 (승인 대기 중)"

    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            return False, "⚠️ 이미 신청하셨습니다"
        return False, f"❌ 오류 발생: {e}"

def get_student_applications(student_id: str) -> List[Dict]:
    """학생의 모든 신청서 조회"""
    query = """
    SELECT * FROM applications
    WHERE student_id = ?
    ORDER BY submitted_at DESC
    """
    results = execute_query(query, (student_id,))
    return [dict(row) for row in results]

def get_application(app_id: int) -> Optional[Dict]:
    """신청서 상세 조회"""
    query = "SELECT * FROM applications WHERE id = ?"
    result = execute_query(query, (app_id,))
    return dict(result[0]) if result else None

def get_pending_applications() -> List[Dict]:
    """승인 대기 중인 신청서 조회"""
    query = """
    SELECT a.*, s.grade, s.class_num, s.name
    FROM applications a
    JOIN students s ON a.student_id = s.student_id
    WHERE a.status = 'pending'
    ORDER BY a.submitted_at ASC
    """
    results = execute_query(query)
    return [dict(row) for row in results]

def get_approved_applications(student_id: str) -> List[Dict]:
    """승인된 신청서 조회 (자동 발급 포함)"""
    query = """
    SELECT * FROM applications
    WHERE student_id = ? AND status IN ('approved', 'auto_approved')
    ORDER BY approved_at DESC
    """
    results = execute_query(query, (student_id,))
    return [dict(row) for row in results]

def get_statistics() -> Dict:
    """통계 조회"""
    query_total = "SELECT COUNT(*) as count FROM applications"
    query_pending = "SELECT COUNT(*) as count FROM applications WHERE status = 'pending'"
    query_approved = "SELECT COUNT(*) as count FROM applications WHERE status IN ('approved', 'auto_approved')"
    query_rejected = "SELECT COUNT(*) as count FROM applications WHERE status = 'rejected'"

    total = execute_query(query_total)[0]['count']
    pending = execute_query(query_pending)[0]['count']
    approved = execute_query(query_approved)[0]['count']
    rejected = execute_query(query_rejected)[0]['count']

    return {
        'total': total,
        'pending': pending,
        'approved': approved,
        'rejected': rejected
    }

def get_statistics_by_type() -> List[Dict]:
    """타입별 통계"""
    query = """
    SELECT application_type, status, COUNT(*) as count
    FROM applications
    GROUP BY application_type, status
    ORDER BY application_type, status
    """
    results = execute_query(query)
    return [dict(row) for row in results]

def get_statistics_by_grade() -> List[Dict]:
    """학년별 통계"""
    query = """
    SELECT s.grade, COUNT(*) as count
    FROM applications a
    JOIN students s ON a.student_id = s.student_id
    GROUP BY s.grade
    ORDER BY s.grade
    """
    results = execute_query(query)
    return [dict(row) for row in results]

def get_application_type_name(app_type: str) -> str:
    """신청서 타입 한글명"""
    types = {
        'phone': '휴대전화',
        'tablet': '태블릿PC',
        'gate': '정문출입'
    }
    return types.get(app_type, app_type)

def get_status_name(status: str) -> str:
    """상태 한글명"""
    names = {
        'pending': '승인 대기',
        'approved': '승인 완료',
        'rejected': '반려',
        'auto_approved': '자동 발급'
    }
    return names.get(status, status)

def _get_approval_mode(application_type: str) -> str:
    """승인 모드 조회 (auto 또는 manual)"""
    type_key = f"{application_type}_approval_mode"
    query = "SELECT value FROM settings WHERE key = ?"
    result = execute_query(query, (type_key,))

    if result:
        return result[0]['value']
    return 'manual'  # 기본값

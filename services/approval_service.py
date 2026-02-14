from datetime import datetime
from database.db_manager import execute_update, execute_query
from utils.approval_number import generate_approval_number

def approve_application(app_id: int, approver_name: str) -> tuple[bool, str]:
    """신청서 승인"""
    try:
        # 현재 신청서 조회
        app = _get_application_by_id(app_id)
        if not app:
            return False, "신청서를 찾을 수 없습니다"

        # 승인번호 생성 (정문출입만)
        approval_number = None
        if app['application_type'] == 'gate':
            approval_number = generate_approval_number('gate')

        # 업데이트
        query = """
        UPDATE applications
        SET status = 'approved', approved_at = ?, approved_by = ?, approval_number = ?
        WHERE id = ?
        """

        now = datetime.now().isoformat()
        execute_update(query, (now, approver_name, approval_number, app_id))

        return True, "✓ 신청서가 승인되었습니다"

    except Exception as e:
        return False, f"❌ 승인 실패: {e}"

def reject_application(app_id: int, reason: str) -> tuple[bool, str]:
    """신청서 반려"""
    try:
        query = """
        UPDATE applications
        SET status = 'rejected', rejection_reason = ?
        WHERE id = ?
        """

        execute_update(query, (reason, app_id))
        return True, "✓ 신청서가 반려되었습니다"

    except Exception as e:
        return False, f"❌ 반려 실패: {e}"

def auto_approve_application(app_id: int) -> tuple[bool, str]:
    """신청서 자동 승인"""
    try:
        query = """
        UPDATE applications
        SET status = 'auto_approved', approved_at = ?
        WHERE id = ?
        """

        now = datetime.now().isoformat()
        execute_update(query, (now, app_id))
        return True, "✓ 신청서가 자동 발급되었습니다"

    except Exception as e:
        return False, f"❌ 자동 발급 실패: {e}"

def _get_application_by_id(app_id: int):
    """ID로 신청서 조회 (내부용)"""
    query = "SELECT * FROM applications WHERE id = ?"
    result = execute_query(query, (app_id,))
    return dict(result[0]) if result else None

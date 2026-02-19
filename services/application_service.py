from typing import Dict, List, Optional

from database.db_manager import execute_delete, execute_insert, execute_query, execute_update
from utils.approval_number import generate_approval_number
from utils.google_sync import sync_gate_roster_to_google_sheet


def submit_application(
    student_id: str, application_type: str, reason: str, extra_info: str = None
) -> tuple[bool, str]:
    try:
        _apply_delayed_approvals()
        approval_mode = _normalize_approval_mode(_get_approval_mode(application_type))

        if approval_mode == "instant_auto":
            status = "auto_approved"
            approval_number = generate_approval_number(application_type) if application_type == "gate" else None
            approved_by = "system_auto"
        else:
            status = "pending"
            approval_number = None
            approved_by = None

        query = """
        INSERT INTO applications (
            student_id, application_type, reason, extra_info, status,
            approved_at, approved_by, approval_number
        ) VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'auto_approved' THEN now() ELSE NULL END, ?, ?)
        """
        execute_insert(
            query,
            (
                student_id,
                application_type,
                reason,
                extra_info,
                status,
                status,
                approved_by,
                approval_number,
            ),
        )

        if status == "auto_approved":
            if application_type == "gate":
                ok, sync_msg = sync_gate_roster_to_google_sheet()
                if ok:
                    return True, f"신청이 완료되었습니다. {sync_msg}"
                return True, f"신청이 완료되었습니다. ({sync_msg})"
            return True, "신청이 완료되었습니다. (즉시 자동승인)"

        if approval_mode == "delayed_auto":
            delay_minutes = _get_delay_minutes(application_type)
            return True, f"신청이 완료되었습니다. ({delay_minutes}분 후 자동승인)"

        return True, "신청이 완료되었습니다. (수동 승인 대기)"

    except Exception as e:
        if "UNIQUE" in str(e).upper():
            return False, "이미 같은 유형의 신청서가 있습니다."
        return False, f"오류가 발생했습니다: {e}"


def get_student_applications(student_id: str) -> List[Dict]:
    _apply_delayed_approvals()
    query = """
    SELECT * FROM applications
    WHERE student_id = ?
    ORDER BY submitted_at DESC
    """
    results = execute_query(query, (student_id,))
    return [dict(row) for row in results]


def cancel_student_application(app_id: int, student_id: str) -> tuple[bool, str]:
    try:
        _apply_delayed_approvals()
        app = get_application(app_id)
        query = """
        DELETE FROM applications
        WHERE id = ?
          AND student_id = ?
          AND status IN ('pending', 'approved', 'auto_approved')
        """
        deleted = execute_delete(query, (app_id, student_id))
        if deleted <= 0:
            return False, "취소 가능한 신청서가 없습니다."

        if app and app.get("application_type") == "gate":
            ok, sync_msg = sync_gate_roster_to_google_sheet()
            if ok:
                return True, f"신청이 취소되었습니다. {sync_msg}"
            return True, f"신청이 취소되었습니다. ({sync_msg})"
        return True, "신청이 취소되었습니다."
    except Exception as e:
        return False, f"신청 취소 중 오류가 발생했습니다: {e}"


def get_application(app_id: int) -> Optional[Dict]:
    query = "SELECT * FROM applications WHERE id = ?"
    result = execute_query(query, (app_id,))
    return dict(result[0]) if result else None


def get_pending_applications() -> List[Dict]:
    _apply_delayed_approvals()
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
    _apply_delayed_approvals()
    query = """
    SELECT * FROM applications
    WHERE student_id = ? AND status IN ('approved', 'auto_approved')
    ORDER BY approved_at DESC
    """
    results = execute_query(query, (student_id,))
    return [dict(row) for row in results]


def get_statistics() -> Dict:
    _apply_delayed_approvals()
    total = execute_query("SELECT COUNT(*) as count FROM applications")[0]["count"]
    pending = execute_query("SELECT COUNT(*) as count FROM applications WHERE status = 'pending'")[0]["count"]
    approved = execute_query(
        "SELECT COUNT(*) as count FROM applications WHERE status IN ('approved', 'auto_approved')"
    )[0]["count"]
    rejected = execute_query("SELECT COUNT(*) as count FROM applications WHERE status = 'rejected'")[0]["count"]
    return {"total": total, "pending": pending, "approved": approved, "rejected": rejected}


def get_statistics_by_type() -> List[Dict]:
    _apply_delayed_approvals()
    query = """
    SELECT application_type, status, COUNT(*) as count
    FROM applications
    GROUP BY application_type, status
    ORDER BY application_type, status
    """
    results = execute_query(query)
    return [dict(row) for row in results]


def get_statistics_by_grade() -> List[Dict]:
    _apply_delayed_approvals()
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
    types = {"phone": "휴대전화", "tablet": "태블릿PC", "gate": "정문출입"}
    return types.get(app_type, app_type)


def get_status_name(status: str) -> str:
    names = {
        "pending": "승인 대기",
        "approved": "승인 완료",
        "rejected": "반려",
        "auto_approved": "자동승인",
    }
    return names.get(status, status)


def _get_approval_mode(application_type: str) -> str:
    type_key = f"{application_type}_approval_mode"
    result = execute_query("SELECT value FROM settings WHERE key = ?", (type_key,))
    if result:
        return result[0]["value"]
    return "manual"


def _normalize_approval_mode(mode: str) -> str:
    # Backward compatibility with old values.
    if mode == "auto":
        return "instant_auto"
    if mode == "auto_issue":
        return "instant_auto"
    if mode == "instant_approve":
        return "instant_auto"
    if mode == "delayed_approve":
        return "delayed_auto"
    if mode in ("instant_auto", "delayed_auto", "manual"):
        return mode
    return "manual"


def _get_delay_minutes(application_type: str) -> int:
    key = f"{application_type}_approval_delay_minutes"
    result = execute_query("SELECT value FROM settings WHERE key = ?", (key,))
    if not result:
        return 10

    try:
        value = int(result[0]["value"])
        return max(1, min(1440, value))
    except Exception:
        return 10


def _apply_delayed_approvals():
    delayed_types = []
    for app_type in ("phone", "tablet", "gate"):
        if _normalize_approval_mode(_get_approval_mode(app_type)) == "delayed_auto":
            delayed_types.append(app_type)

    if not delayed_types:
        return

    gate_changed = False
    for app_type in delayed_types:
        delay_minutes = _get_delay_minutes(app_type)
        targets = execute_query(
            """
            SELECT id
            FROM applications
            WHERE status = 'pending'
              AND application_type = ?
              AND submitted_at <= now() - ((? || ' minutes')::interval)
            ORDER BY submitted_at ASC
            """,
            (app_type, str(delay_minutes)),
        )

        for row in targets:
            app_id = row["id"]
            approval_number = generate_approval_number("gate") if app_type == "gate" else None
            execute_update(
                """
                UPDATE applications
                SET status = 'auto_approved',
                    approved_at = now(),
                    approved_by = ?,
                    approval_number = ?
                WHERE id = ?
                  AND status = 'pending'
                """,
                ("system_delay", approval_number, app_id),
            )
            if app_type == "gate":
                gate_changed = True

    if gate_changed:
        sync_gate_roster_to_google_sheet()

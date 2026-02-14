import requests

from database.db_manager import execute_query
from utils.gate_schedule import gate_schedule_to_grid

GOOGLE_SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxdylk68Qe1G-3_Jo5HBaPBiOIrSuGcT_C3DKkgfXZudQ-8mpCX5bcDPVBNW-OsnTcI/exec"


def _normalize_dismissal(value: str) -> str:
    if not value:
        return ""
    text = str(value).strip()
    if text and text[0] in {"1", "2", "3"}:
        return f"{text[0]}하교"
    return ""


def _to_google_check(value: str):
    return True if value == "✓" else ""


def _get_gate_roster_rows_for_google():
    query = """
    SELECT a.student_id, s.name, a.reason, a.extra_info
    FROM applications a
    JOIN students s ON a.student_id = s.student_id
    WHERE a.application_type = 'gate'
      AND a.status IN ('approved', 'auto_approved')
    ORDER BY s.grade, s.class_num, s.name
    """
    rows = execute_query(query)
    result = []
    for row in rows:
        row = dict(row)
        morning_map, dismissal_map = gate_schedule_to_grid(row.get("extra_info"))

        result.append(
            [
                row.get("student_id", ""),
                row.get("name", ""),
                _to_google_check(morning_map.get("월", "")),
                _to_google_check(morning_map.get("화", "")),
                _to_google_check(morning_map.get("수", "")),
                _to_google_check(morning_map.get("목", "")),
                _to_google_check(morning_map.get("금", "")),
                _normalize_dismissal(dismissal_map.get("월", "")),
                _normalize_dismissal(dismissal_map.get("화", "")),
                _normalize_dismissal(dismissal_map.get("수", "")),
                _normalize_dismissal(dismissal_map.get("목", "")),
                _normalize_dismissal(dismissal_map.get("금", "")),
                row.get("reason", ""),
            ]
        )
    return result


def sync_gate_roster_to_google_sheet() -> tuple[bool, str]:
    try:
        rows = _get_gate_roster_rows_for_google()
        payload = {
            "clear": True,
            "startRow": 4,
            "startCol": 1,
            "rows": rows,
        }
        res = requests.post(GOOGLE_SHEET_WEBAPP_URL, json=payload, timeout=20)
        res.raise_for_status()

        content_type = (res.headers.get("content-type") or "").lower()
        if "application/json" not in content_type:
            text = (res.text or "").strip()
            if "TypeError:" in text:
                start = text.find("TypeError:")
                end = text.find("</div>", start)
                detail = text[start:end] if end > start else text[start : start + 200]
                return False, f"구글시트 스크립트 오류: {detail}"
            return False, f"구글시트 응답이 JSON이 아닙니다. ({content_type})"

        data = res.json()
        if not data.get("ok"):
            return False, str(data.get("error", "google sync failed"))
        count = int(data.get("count", len(rows)))
        return True, f"구글시트 동기화 완료({count}행)"
    except Exception as e:
        return False, f"구글시트 동기화 실패: {e}"

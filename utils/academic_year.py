from datetime import date, datetime

from config.settings import SCHOOL_YEAR
from database.db_manager import execute_query


def _safe_parse_date(value: str):
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%Y.%m.%d", "%Y.%m.%-d", "%Y.%-m.%d", "%Y.%-m.%-d"):
        try:
            return datetime.strptime(value, fmt).date()
        except Exception:
            continue
    try:
        return datetime.fromisoformat(value).date()
    except Exception:
        return None


def get_academic_year() -> int:
    result = execute_query("SELECT value FROM settings WHERE key = ?", ("academic_year",))
    if not result:
        return SCHOOL_YEAR
    try:
        return int(result[0]["value"])
    except Exception:
        return SCHOOL_YEAR


def get_academic_year_start() -> date:
    default_value = date(get_academic_year(), 3, 1)
    result = execute_query("SELECT value FROM settings WHERE key = ?", ("academic_year_start",))
    if not result:
        return default_value
    parsed = _safe_parse_date(result[0]["value"])
    return parsed or default_value


def get_academic_year_end() -> date:
    year = get_academic_year()
    return date(year + 1, 2, 28)


def get_gate_period_text() -> str:
    start = get_academic_year_start()
    end = get_academic_year_end()
    return f"{start.year}.{start.month}.{start.day} ~ {end.year}.{end.month}.{end.day}"

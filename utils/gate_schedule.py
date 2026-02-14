import json

WEEKDAYS = ["월", "화", "수", "목", "금"]

DISMISSAL_OPTIONS = {
    "1": {"label": "1하교", "time": "14:00"},
    "2": {"label": "2하교", "time": "14:50"},
    "3": {"label": "3하교", "time": "15:40"},
}


def build_gate_schedule(morning_days, dismissal_by_day):
    payload = {
        "version": 1,
        "morning_days": [d for d in WEEKDAYS if d in (morning_days or [])],
        "dismissal_by_day": {},
    }
    for day in WEEKDAYS:
        value = (dismissal_by_day or {}).get(day)
        if value in DISMISSAL_OPTIONS:
            payload["dismissal_by_day"][day] = value
    return json.dumps(payload, ensure_ascii=False)


def parse_gate_schedule(extra_info):
    if not extra_info or not isinstance(extra_info, str):
        return None
    try:
        data = json.loads(extra_info)
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    if "morning_days" not in data and "dismissal_by_day" not in data:
        return None
    return data


def format_gate_schedule(extra_info):
    data = parse_gate_schedule(extra_info)
    if not data:
        return extra_info or ""

    morning_days = [d for d in WEEKDAYS if d in (data.get("morning_days") or [])]
    dismissal = data.get("dismissal_by_day") or {}

    morning_text = "등교 없음"
    if morning_days:
        morning_text = "등교: " + ",".join(morning_days)

    dismissal_items = []
    for day in WEEKDAYS:
        code = dismissal.get(day)
        if code in DISMISSAL_OPTIONS:
            dismissal_items.append(f"{day}{DISMISSAL_OPTIONS[code]['label']}")
    dismissal_text = "하교 없음"
    if dismissal_items:
        dismissal_text = "하교: " + ", ".join(dismissal_items)

    return f"{morning_text} / {dismissal_text}"


def gate_schedule_to_grid(extra_info):
    data = parse_gate_schedule(extra_info)
    morning_map = {d: "" for d in WEEKDAYS}
    dismissal_map = {d: "" for d in WEEKDAYS}

    if not data:
        return morning_map, dismissal_map

    for day in data.get("morning_days") or []:
        if day in morning_map:
            morning_map[day] = "✓"

    dismissal = data.get("dismissal_by_day") or {}
    for day in WEEKDAYS:
        code = dismissal.get(day)
        if code in DISMISSAL_OPTIONS:
            opt = DISMISSAL_OPTIONS[code]
            dismissal_map[day] = f"{opt['label']}({opt['time']})"

    return morning_map, dismissal_map

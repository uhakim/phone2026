export const WEEKDAYS = ["월", "화", "수", "목", "금"] as const;

export const DISMISSAL_OPTIONS: Record<string, { label: string; time: string }> = {
  "1": { label: "1하교", time: "14:00" },
  "2": { label: "2하교", time: "14:50" },
  "3": { label: "3하교", time: "15:40" },
};

export type GateSchedulePayload = {
  morningDays?: string[];
  dismissalByDay?: Record<string, string>;
};

export function parseGateSchedule(extraInfo?: string | null): GateSchedulePayload | null {
  if (!extraInfo || typeof extraInfo !== "string") return null;
  try {
    const data = JSON.parse(extraInfo) as GateSchedulePayload;
    if (typeof data !== "object" || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function gateScheduleToGrid(extraInfo?: string | null) {
  const morningMap: Record<string, string> = {};
  const dismissalMap: Record<string, string> = {};
  for (const day of WEEKDAYS) {
    morningMap[day] = "";
    dismissalMap[day] = "";
  }

  const parsed = parseGateSchedule(extraInfo);
  if (!parsed) return { morningMap, dismissalMap };

  const morningDays = parsed.morningDays ?? (parsed as { morning_days?: string[] }).morning_days ?? [];
  const dismissalByDay = parsed.dismissalByDay ?? (parsed as { dismissal_by_day?: Record<string, string> }).dismissal_by_day ?? {};

  for (const day of morningDays) {
    if (day in morningMap) morningMap[day] = "등교";
  }
  for (const day of WEEKDAYS) {
    const code = dismissalByDay?.[day];
    if (code && DISMISSAL_OPTIONS[code]) {
      const opt = DISMISSAL_OPTIONS[code];
      dismissalMap[day] = `${opt.label}(${opt.time})`;
    }
  }
  return { morningMap, dismissalMap };
}

export function formatGateSchedule(extraInfo?: string | null) {
  const parsed = parseGateSchedule(extraInfo);
  if (!parsed) return extraInfo ?? "";
  const morningDays = parsed.morningDays ?? (parsed as { morning_days?: string[] }).morning_days ?? [];
  const dismissalByDay = parsed.dismissalByDay ?? (parsed as { dismissal_by_day?: Record<string, string> }).dismissal_by_day ?? {};
  const mornings = WEEKDAYS.filter((day) => morningDays.includes(day)).join(",");
  const dismissals = WEEKDAYS.map((day) => {
    const code = dismissalByDay?.[day];
    if (!code || !DISMISSAL_OPTIONS[code]) return "";
    return `${day}${DISMISSAL_OPTIONS[code].label}`;
  })
    .filter(Boolean)
    .join(", ");
  const morningText = mornings ? `등교: ${mornings}` : "등교 없음";
  const dismissalText = dismissals ? `하교: ${dismissals}` : "하교 없음";
  return `${morningText} / ${dismissalText}`;
}

export function toGoogleDismissal(value: string) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.startsWith("1")) return "1하교";
  if (text.startsWith("2")) return "2하교";
  if (text.startsWith("3")) return "3하교";
  return "";
}

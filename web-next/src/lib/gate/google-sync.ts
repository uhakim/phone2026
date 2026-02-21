import { getSettingsMap } from "@/lib/admin/settings";
import { WEEKDAYS, gateScheduleToGrid, toGoogleDismissal } from "@/lib/gate/schedule";
import type { SupabaseClient } from "@supabase/supabase-js";

function toGoogleCheck(value: string) {
  return String(value ?? "").trim() ? true : "";
}

function toStudentNumber(studentId: string) {
  const localPart = String(studentId ?? "").split("@")[0] ?? "";
  const digitsOnly = localPart.replace(/\D/g, "");
  return digitsOnly || localPart;
}

export function isGateApplicationType(applicationType: string) {
  const normalized = (applicationType ?? "").toLowerCase();
  return (
    normalized === "gate" ||
    normalized.includes("pass") ||
    normalized.includes("gate") ||
    applicationType.includes("정문") ||
    applicationType.includes("출입")
  );
}

export async function syncGateRosterToGoogleSheet(serviceClient: SupabaseClient) {
  const { data, error } = await serviceClient
    .from("applications")
    .select("student_id, reason, extra_info, students!inner(name, grade, class_num)")
    .or("application_type.eq.gate,application_type.ilike.%gate%,application_type.ilike.%pass%,application_type.ilike.%정문%,application_type.ilike.%출입%")
    .in("status", ["approved", "auto_approved"])
    .order("student_id", { ascending: true });

  if (error) {
    return { ok: false as const, error: `정문 출입 명단 조회 실패: ${error.message}` };
  }

  let webAppUrl = process.env.GOOGLE_SHEET_WEBAPP_URL ?? "";
  try {
    const settings = await getSettingsMap(serviceClient);
    if (settings.google_sheet_webapp_url) {
      webAppUrl = settings.google_sheet_webapp_url;
    }
  } catch {
    // Fallback to environment variable when settings table read fails.
  }

  if (!webAppUrl) {
    return { ok: false as const, error: "Google Sheet WebApp URL이 설정되지 않았습니다." };
  }

  const rows = (data ?? []).map((row) => {
    const student = Array.isArray(row.students) ? row.students[0] : row.students;
    const { morningMap, dismissalMap } = gateScheduleToGrid(row.extra_info);

    return [
      toStudentNumber(row.student_id),
      student?.name ?? "",
      toGoogleCheck(morningMap[WEEKDAYS[0]] ?? ""),
      toGoogleCheck(morningMap[WEEKDAYS[1]] ?? ""),
      toGoogleCheck(morningMap[WEEKDAYS[2]] ?? ""),
      toGoogleCheck(morningMap[WEEKDAYS[3]] ?? ""),
      toGoogleCheck(morningMap[WEEKDAYS[4]] ?? ""),
      toGoogleDismissal(dismissalMap[WEEKDAYS[0]] ?? ""),
      toGoogleDismissal(dismissalMap[WEEKDAYS[1]] ?? ""),
      toGoogleDismissal(dismissalMap[WEEKDAYS[2]] ?? ""),
      toGoogleDismissal(dismissalMap[WEEKDAYS[3]] ?? ""),
      toGoogleDismissal(dismissalMap[WEEKDAYS[4]] ?? ""),
      row.reason ?? "",
    ];
  });

  const payload = {
    clear: true,
    startRow: 4,
    startCol: 1,
    rows,
  };

  try {
    const response = await fetch(webAppUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!response.ok) {
      const text = await response.text();
      return { ok: false as const, error: `Google 동기화 실패: ${text || response.status}` };
    }
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      return { ok: false as const, error: `Google 응답 형식 오류: ${text.slice(0, 200)}` };
    }

    const result = (await response.json()) as { ok?: boolean; error?: string; count?: number };
    if (!result.ok) {
      return { ok: false as const, error: result.error ?? "Google 시트 쓰기 실패" };
    }
    return { ok: true as const, count: Number(result.count ?? rows.length) };
  } catch (fetchError) {
    const message = fetchError instanceof Error ? fetchError.message : "Google 동기화 요청 실패";
    return { ok: false as const, error: message };
  }
}

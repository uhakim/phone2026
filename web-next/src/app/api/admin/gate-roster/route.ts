import { getSettingsMap } from "@/lib/admin/settings";
import { validateAdminRequest } from "@/lib/auth/request-auth";
import { WEEKDAYS, gateScheduleToGrid } from "@/lib/gate/schedule";
import { NextResponse } from "next/server";

type GateRosterRow = {
  student_id: string;
  name: string;
  grade: number | null;
  class_num: number | null;
  reason: string;
  morning: Record<string, string>;
  dismissal: Record<string, string>;
};

function toStudentNumber(studentId: string) {
  const localPart = String(studentId ?? "").split("@")[0] ?? "";
  const digitsOnly = localPart.replace(/\D/g, "");
  return digitsOnly || localPart;
}

export async function GET(request: Request) {
  const auth = await validateAdminRequest(request);
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.serviceClient
    .from("applications")
    .select("student_id, reason, extra_info, students!inner(name, grade, class_num)")
    .or("application_type.eq.gate,application_type.ilike.%gate%,application_type.ilike.%pass%,application_type.ilike.%정문%,application_type.ilike.%출입%")
    .in("status", ["approved", "auto_approved"])
    .order("student_id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: `정문 출입 명단 조회 실패: ${error.message}` }, { status: 500 });
  }

  const rows: GateRosterRow[] = (data ?? []).map((row) => {
    const student = Array.isArray(row.students) ? row.students[0] : row.students;
    const { morningMap, dismissalMap } = gateScheduleToGrid(row.extra_info);
    return {
      student_id: toStudentNumber(row.student_id),
      name: student?.name ?? "",
      grade: student?.grade ?? null,
      class_num: student?.class_num ?? null,
      reason: row.reason ?? "",
      morning: Object.fromEntries(WEEKDAYS.map((day) => [day, morningMap[day] ?? ""])),
      dismissal: Object.fromEntries(WEEKDAYS.map((day) => [day, dismissalMap[day] ?? ""])),
    };
  });

  let gateSheetUrl = "";
  try {
    const settings = await getSettingsMap(auth.serviceClient);
    gateSheetUrl = settings.gate_sheet_url;
  } catch {
    // 설정 테이블이 아직 없더라도 명단 조회는 계속 동작한다.
  }

  return NextResponse.json({ items: rows, gate_sheet_url: gateSheetUrl });
}

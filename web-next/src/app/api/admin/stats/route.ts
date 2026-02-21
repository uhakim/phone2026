import { validateAdminRequest } from "@/lib/auth/request-auth";
import { NextResponse } from "next/server";

type TypeKey = "phone" | "tablet" | "gate" | "other";

function normalizeApplicationType(value: unknown): TypeKey {
  const text = String(value ?? "").toLowerCase();
  if (text === "phone" || text.includes("phone") || text.includes("휴대")) return "phone";
  if (text === "tablet" || text.includes("tablet") || text.includes("태블")) return "tablet";
  if (text === "gate" || text.includes("pass") || text.includes("정문") || text.includes("출입")) return "gate";
  return "other";
}

export async function GET(request: Request) {
  const auth = await validateAdminRequest(request);
  if ("error" in auth) return auth.error;

  const { data: studentsData, error: studentsError } = await auth.serviceClient
    .from("students")
    .select("student_id, grade");

  if (studentsError) {
    return NextResponse.json({ error: `학생 통계 조회 실패: ${studentsError.message}` }, { status: 500 });
  }

  const { data: applicationsData, error: appsError } = await auth.serviceClient
    .from("applications")
    .select("application_type, status, student_id");

  if (appsError) {
    return NextResponse.json({ error: `신청 통계 조회 실패: ${appsError.message}` }, { status: 500 });
  }

  const gradeCounts: Record<string, number> = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
    "6": 0,
    other: 0,
  };

  for (const row of studentsData ?? []) {
    const grade = Number(row.grade ?? 0);
    if (grade >= 1 && grade <= 6) gradeCounts[String(grade)] += 1;
    else gradeCounts.other += 1;
  }

  const typeCounts: Record<TypeKey, number> = { phone: 0, tablet: 0, gate: 0, other: 0 };
  const statusCounts: Record<"pending" | "approved" | "rejected" | "other", number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    other: 0,
  };

  const uniqueApplicantsByType = {
    phone: new Set<string>(),
    tablet: new Set<string>(),
    gate: new Set<string>(),
    other: new Set<string>(),
  };

  for (const row of applicationsData ?? []) {
    const type = normalizeApplicationType(row.application_type);
    typeCounts[type] += 1;
    uniqueApplicantsByType[type].add(row.student_id);

    const status = String(row.status ?? "");
    if (status === "pending") statusCounts.pending += 1;
    else if (status === "approved" || status === "auto_approved") statusCounts.approved += 1;
    else if (status === "rejected") statusCounts.rejected += 1;
    else statusCounts.other += 1;
  }

  const totalStudents = (studentsData ?? []).length;
  const totalApplications = (applicationsData ?? []).length;
  const uniqueApplicants = new Set((applicationsData ?? []).map((row) => row.student_id)).size;

  return NextResponse.json({
    summary: {
      total_students: totalStudents,
      total_applications: totalApplications,
      unique_applicants: uniqueApplicants,
    },
    students: {
      grades: gradeCounts,
    },
    applications: {
      by_type: typeCounts,
      by_status: statusCounts,
      unique_applicants_by_type: {
        phone: uniqueApplicantsByType.phone.size,
        tablet: uniqueApplicantsByType.tablet.size,
        gate: uniqueApplicantsByType.gate.size,
        other: uniqueApplicantsByType.other.size,
      },
    },
  });
}

import { validateStudentRequest } from "@/lib/auth/request-auth";
import { ensureLatestConsentAgreed } from "@/lib/consent";
import { NextResponse } from "next/server";

type PostBody = {
  applicationType?: "phone" | "tablet" | "gate";
  reason?: string;
  extraInfo?: string | null;
};

export async function GET(request: Request) {
  const auth = await validateStudentRequest(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { data, error } = await auth.serviceClient
    .from("applications")
    .select(
      "id, student_id, application_type, reason, extra_info, status, approval_mode, auto_approve_at, approval_number, submitted_at, approved_at, approved_by, approved_source, rejection_reason",
    )
    .eq("student_id", auth.studentId)
    .order("submitted_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: `신청 내역 조회 실패: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await validateStudentRequest(request);
  if ("error" in auth) {
    return auth.error;
  }

  const consentError = await ensureLatestConsentAgreed(auth.serviceClient, auth.studentId);
  if (consentError) {
    return NextResponse.json({ error: consentError }, { status: 403 });
  }

  const body = (await request.json()) as PostBody;
  const applicationType = body.applicationType;
  const reason = body.reason?.trim() ?? "";
  const extraInfo = body.extraInfo?.trim() ?? null;

  if (!applicationType || !["phone", "tablet", "gate"].includes(applicationType)) {
    return NextResponse.json({ error: "applicationType 값이 유효하지 않습니다." }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "신청 사유를 입력해주세요." }, { status: 400 });
  }

  const { data: student, error: studentError } = await auth.serviceClient
    .from("students")
    .select("student_id")
    .eq("student_id", auth.studentId)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json({ error: `학생 조회 실패: ${studentError.message}` }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json({ error: "학생 명단에 등록되지 않은 계정입니다." }, { status: 403 });
  }

  const { data, error } = await auth.serviceClient
    .from("applications")
    .insert({
      student_id: auth.studentId,
      application_type: applicationType,
      reason,
      extra_info: extraInfo,
      status: "pending",
    })
    .select(
      "id, student_id, application_type, reason, extra_info, status, approval_mode, auto_approve_at, approval_number, submitted_at, approved_at, approved_by, approved_source, rejection_reason",
    )
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 같은 유형의 신청이 있습니다." }, { status: 409 });
    }
    return NextResponse.json({ error: `신청 생성 실패: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

import { isAdminUser } from "@/lib/auth/roles";
import { isGateApplicationType, syncGateRosterToGoogleSheet } from "@/lib/gate/google-sync";
import { createSupabaseAnonServerClient, createSupabaseServiceRoleServerClient, getBearerToken } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type PatchAction = "approve" | "reject" | "reset";

type PatchBody = {
  action?: PatchAction;
  rejectionReason?: string;
  approvalNumber?: string;
};

type Params = {
  params: Promise<{ applicationId: string }>;
};

function approvalPrefixByType(applicationType: string) {
  const normalized = applicationType.toLowerCase();
  if (normalized.includes("phone") || applicationType.includes("휴대")) {
    return "ds-phone";
  }
  if (normalized.includes("tablet") || applicationType.includes("태블")) {
    return "ds-tablet";
  }
  if (normalized.includes("pass") || normalized.includes("gate") || applicationType.includes("정문") || applicationType.includes("출입")) {
    return "ds-pass";
  }
  return "ds-doc";
}

function nextApprovalNumber(prefix: string, existing: Array<{ approval_number: string | null }>) {
  let max = 0;
  for (const row of existing) {
    const value = row.approval_number ?? "";
    const match = value.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (!match) continue;
    const seq = Number.parseInt(match[1], 10);
    if (Number.isFinite(seq) && seq > max) {
      max = seq;
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export async function PATCH(request: Request, { params }: Params) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "인증 토큰이 없습니다." }, { status: 401 });
  }

  const anonClient = createSupabaseAnonServerClient();
  const serviceClient = createSupabaseServiceRoleServerClient();
  if (!anonClient || !serviceClient) {
    return NextResponse.json({ error: "Supabase 서버 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { data: userData, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "유효하지 않은 인증 토큰입니다." }, { status: 401 });
  }

  if (!isAdminUser(userData.user, process.env.NEXT_PUBLIC_ADMIN_EMAILS)) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = (await request.json()) as PatchBody;
  if (!body.action || !["approve", "reject", "reset"].includes(body.action)) {
    return NextResponse.json({ error: "action 값은 approve, reject, reset 중 하나여야 합니다." }, { status: 400 });
  }

  const { applicationId } = await params;
  if (!applicationId) {
    return NextResponse.json({ error: "신청서 ID가 없습니다." }, { status: 400 });
  }

  const { data: target, error: targetError } = await serviceClient
    .from("applications")
    .select("id, application_type")
    .eq("id", applicationId)
    .maybeSingle();

  if (targetError) {
    return NextResponse.json({ error: `대상 조회 실패: ${targetError.message}` }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: "대상 신청서를 찾지 못했습니다." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const approvedBy = userData.user.email ?? "admin";
  const patch: Record<string, unknown> = {};

  if (body.action === "approve") {
    let approvalNumber = body.approvalNumber?.trim() ?? "";
    if (!approvalNumber) {
      const prefix = approvalPrefixByType(target.application_type);
      const { data: existing, error: existingError } = await serviceClient
        .from("applications")
        .select("approval_number")
        .ilike("approval_number", `${prefix}-%`)
        .limit(1000);

      if (existingError) {
        return NextResponse.json({ error: `승인번호 생성 실패: ${existingError.message}` }, { status: 500 });
      }

      approvalNumber = nextApprovalNumber(prefix, existing ?? []);
    }

    patch.status = "approved";
    patch.approval_number = approvalNumber;
    patch.approved_at = now;
    patch.approved_by = approvedBy;
    patch.approved_source = "admin";
    patch.rejection_reason = null;
  }

  if (body.action === "reject") {
    patch.status = "rejected";
    patch.approved_at = now;
    patch.approved_by = approvedBy;
    patch.approved_source = "admin";
    patch.approval_number = null;
    patch.rejection_reason = body.rejectionReason?.trim() || "사유 미입력";
  }

  if (body.action === "reset") {
    patch.status = "pending";
    patch.approval_number = null;
    patch.approved_at = null;
    patch.approved_by = null;
    patch.approved_source = null;
    patch.rejection_reason = null;
  }

  const { data, error } = await serviceClient
    .from("applications")
    .update(patch)
    .eq("id", applicationId)
    .select("id, student_id, application_type, status, approval_number, approved_at, approved_by, rejection_reason")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: `상태 변경 실패: ${error.message}` }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "대상 신청서를 찾지 못했습니다." }, { status: 404 });
  }

  let syncError: string | null = null;
  if ((body.action === "approve" || body.action === "reject") && isGateApplicationType(target.application_type)) {
    const syncResult = await syncGateRosterToGoogleSheet(serviceClient);
    if (!syncResult.ok) {
      syncError = syncResult.error;
    }
  }

  return NextResponse.json({ item: data, sync_error: syncError });
}

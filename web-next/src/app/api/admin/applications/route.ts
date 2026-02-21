import { isAdminUser } from "@/lib/auth/roles";
import { createSupabaseAnonServerClient, createSupabaseServiceRoleServerClient, getBearerToken } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = serviceClient
    .from("applications")
    .select(
      "id, student_id, application_type, reason, extra_info, status, approval_number, submitted_at, approved_at, approved_by, rejection_reason",
    )
    .order("submitted_at", { ascending: false })
    .limit(200);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: `신청서 조회 실패: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}


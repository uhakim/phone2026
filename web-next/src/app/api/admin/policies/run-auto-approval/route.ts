import { isAdminUser } from "@/lib/auth/roles";
import { createSupabaseAnonServerClient, createSupabaseServiceRoleServerClient, getBearerToken } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
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

  const { data, error } = await serviceClient.rpc("run_auto_approval");
  if (error) {
    return NextResponse.json({ error: `자동승인 실행 실패: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ updated_count: data ?? 0 });
}


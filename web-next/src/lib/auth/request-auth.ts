import { createSupabaseAnonServerClient, createSupabaseServiceRoleServerClient, getBearerToken } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/roles";
import { NextResponse } from "next/server";

export async function validateStudentRequest(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return { error: NextResponse.json({ error: "인증 토큰이 없습니다." }, { status: 401 }) };
  }

  const anonClient = createSupabaseAnonServerClient();
  const serviceClient = createSupabaseServiceRoleServerClient();
  if (!anonClient || !serviceClient) {
    return { error: NextResponse.json({ error: "Supabase 서버 환경변수가 설정되지 않았습니다." }, { status: 500 }) };
  }

  const { data: userData, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !userData.user?.email) {
    return { error: NextResponse.json({ error: "유효하지 않은 인증 토큰입니다." }, { status: 401 }) };
  }

  return {
    serviceClient,
    studentId: userData.user.email,
    user: userData.user,
  };
}

export async function validateAdminRequest(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return { error: NextResponse.json({ error: "인증 토큰이 없습니다." }, { status: 401 }) };
  }

  const anonClient = createSupabaseAnonServerClient();
  const serviceClient = createSupabaseServiceRoleServerClient();
  if (!anonClient || !serviceClient) {
    return { error: NextResponse.json({ error: "Supabase 서버 환경변수가 설정되지 않았습니다." }, { status: 500 }) };
  }

  const { data: userData, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !userData.user) {
    return { error: NextResponse.json({ error: "유효하지 않은 인증 토큰입니다." }, { status: 401 }) };
  }

  if (!isAdminUser(userData.user, process.env.NEXT_PUBLIC_ADMIN_EMAILS)) {
    return { error: NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 }) };
  }

  return { serviceClient, user: userData.user };
}

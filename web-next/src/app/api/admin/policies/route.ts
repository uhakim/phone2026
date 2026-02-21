import { isAdminUser } from "@/lib/auth/roles";
import { createSupabaseAnonServerClient, createSupabaseServiceRoleServerClient, getBearerToken } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type PolicyMode = "manual" | "immediate" | "delayed";

type PatchBody = {
  policy_key?: "phone" | "tablet" | "pass";
  mode?: PolicyMode;
  delay_minutes?: number;
};

async function validateAdmin(request: Request) {
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

  return { serviceClient };
}

export async function GET(request: Request) {
  const auth = await validateAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { data, error } = await auth.serviceClient
    .from("approval_policies")
    .select("policy_key, mode, delay_minutes, updated_at")
    .in("policy_key", ["phone", "tablet", "pass"])
    .order("policy_key", { ascending: true });

  if (error) {
    return NextResponse.json({ error: `정책 조회 실패: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await validateAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json()) as PatchBody;
  if (!body.policy_key || !["phone", "tablet", "pass"].includes(body.policy_key)) {
    return NextResponse.json({ error: "policy_key는 phone/tablet/pass 중 하나여야 합니다." }, { status: 400 });
  }
  if (!body.mode || !["manual", "immediate", "delayed"].includes(body.mode)) {
    return NextResponse.json({ error: "mode는 manual/immediate/delayed 중 하나여야 합니다." }, { status: 400 });
  }

  const delayMinutes = Number(body.delay_minutes ?? 10);
  if (!Number.isFinite(delayMinutes) || delayMinutes < 0 || delayMinutes > 1440) {
    return NextResponse.json({ error: "delay_minutes는 0~1440 범위여야 합니다." }, { status: 400 });
  }

  const { data, error } = await auth.serviceClient
    .from("approval_policies")
    .upsert(
      {
        policy_key: body.policy_key,
        mode: body.mode,
        delay_minutes: Math.floor(delayMinutes),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "policy_key" },
    )
    .select("policy_key, mode, delay_minutes, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: `정책 저장 실패: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}


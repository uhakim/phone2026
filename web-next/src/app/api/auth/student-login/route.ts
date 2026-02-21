import { mapLoginIdToEmail } from "@/lib/auth/student-login";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type LoginBody = {
  loginId?: string;
  password?: string;
};

export async function POST(request: Request) {
  const { loginId, password } = (await request.json()) as LoginBody;

  if (!loginId || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력해주세요." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const email = mapLoginIdToEmail(loginId);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { error: "로그인에 실패했습니다. 아이디/비밀번호를 확인해주세요." },
      { status: 401 },
    );
  }

  return NextResponse.json({
    user: data.user,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  });
}


import { getConsentStatus } from "@/lib/consent";
import { validateStudentRequest } from "@/lib/auth/request-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await validateStudentRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const status = await getConsentStatus(auth.serviceClient, auth.studentId);
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "동의 상태 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


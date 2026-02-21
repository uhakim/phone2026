import { getLatestRequiredConsentDocument } from "@/lib/consent";
import { validateStudentRequest } from "@/lib/auth/request-auth";
import { NextResponse } from "next/server";

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return "";
  return forwarded.split(",")[0]?.trim() ?? "";
}

export async function POST(request: Request) {
  const auth = await validateStudentRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const latest = await getLatestRequiredConsentDocument(auth.serviceClient);
    if (!latest) {
      return NextResponse.json({ ok: true, required: false });
    }

    const { error } = await auth.serviceClient.from("user_consents").upsert(
      {
        user_id: auth.studentId,
        document_id: latest.id,
        agreed_at: new Date().toISOString(),
        ip_address: clientIp(request),
        user_agent: request.headers.get("user-agent") ?? "",
      },
      { onConflict: "user_id,document_id" },
    );

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, required: true, document_id: latest.id, version: latest.version });
  } catch (error) {
    const message = error instanceof Error ? error.message : "동의 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


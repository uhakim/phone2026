import { validateStudentRequest } from "@/lib/auth/request-auth";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function DELETE(request: Request, { params }: Params) {
  const auth = await validateStudentRequest(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { applicationId } = await params;
  if (!applicationId) {
    return NextResponse.json({ error: "신청서 ID가 없습니다." }, { status: 400 });
  }

  const { data, error } = await auth.serviceClient
    .from("applications")
    .delete()
    .eq("id", applicationId)
    .eq("student_id", auth.studentId)
    .in("status", ["pending", "approved"])
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: `신청 취소 실패: ${error.message}` }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "취소 가능한 신청을 찾지 못했습니다." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}


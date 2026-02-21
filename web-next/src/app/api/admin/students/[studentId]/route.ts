import { validateAdminRequest } from "@/lib/auth/request-auth";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ studentId: string }>;
};

export async function DELETE(request: Request, { params }: Params) {
  const auth = await validateAdminRequest(request);
  if ("error" in auth) return auth.error;

  const { studentId } = await params;
  if (!studentId) {
    return NextResponse.json({ error: "studentId가 없습니다." }, { status: 400 });
  }

  const { error: appError } = await auth.serviceClient.from("applications").delete().eq("student_id", studentId);
  if (appError) {
    return NextResponse.json({ error: `학생 신청서 삭제 실패: ${appError.message}` }, { status: 500 });
  }

  const { data, error } = await auth.serviceClient.from("students").delete().eq("student_id", studentId).select("student_id").maybeSingle();
  if (error) {
    return NextResponse.json({ error: `학생 삭제 실패: ${error.message}` }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "학생을 찾지 못했습니다." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}


import { validateAdminRequest } from "@/lib/auth/request-auth";
import { mapLoginIdToEmail } from "@/lib/auth/student-login";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ studentId: string }>;
};

async function deleteStudentAuthUser(serviceClient: any, studentId: string) {
  const email = mapLoginIdToEmail(studentId);
  const { data: usersData, error: listError } = await serviceClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    throw new Error(`${studentId} 기존 계정 조회 실패: ${listError.message}`);
  }

  const targetUser = (usersData?.users ?? []).find((user: any) => (user.email || "").toLowerCase() === email.toLowerCase());
  if (!targetUser?.id) return;

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(targetUser.id);
  if (deleteError) {
    throw new Error(`${studentId} Auth 계정 삭제 실패: ${deleteError.message}`);
  }
}

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

  const { error: consentError } = await auth.serviceClient.from("user_consents").delete().eq("user_id", studentId);
  if (consentError) {
    return NextResponse.json({ error: `학생 동의 이력 삭제 실패: ${consentError.message}` }, { status: 500 });
  }

  const { data, error } = await auth.serviceClient
    .from("students")
    .delete()
    .eq("student_id", studentId)
    .select("student_id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: `학생 삭제 실패: ${error.message}` }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "학생을 찾지 못했습니다." }, { status: 404 });
  }

  try {
    await deleteStudentAuthUser(auth.serviceClient, studentId);
  } catch (authError) {
    const message = authError instanceof Error ? authError.message : "학생 Auth 계정 삭제 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

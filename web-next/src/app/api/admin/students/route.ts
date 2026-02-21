import { validateAdminRequest } from "@/lib/auth/request-auth";
import { mapLoginIdToEmail } from "@/lib/auth/student-login";
import { NextResponse } from "next/server";

type StudentBody = {
  student_id?: string;
  name?: string;
  grade?: number;
  class_num?: number;
};

type BulkBody = {
  students?: Array<{
    student_id: string;
    name: string;
    grade: number;
    class_num: number;
  }>;
};

const STUDENT_INITIAL_PASSWORD = "123456";

async function ensureStudentAuthUser(serviceClient: any, studentId: string) {
  const email = mapLoginIdToEmail(studentId);
  const { error } = await serviceClient.auth.admin.createUser({
    email,
    password: STUDENT_INITIAL_PASSWORD,
    email_confirm: true,
    user_metadata: {
      role: "student",
      student_id: studentId,
    },
  });

  if (!error) return;

  const message = (error.message || "").toLowerCase();
  const isAlreadyExists =
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("duplicate key value");

  if (!isAlreadyExists) {
    throw new Error(`${studentId} 계정 생성 실패: ${error.message}`);
  }

  const { data: usersData, error: listError } = await serviceClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    throw new Error(`${studentId} 기존 계정 조회 실패: ${listError.message}`);
  }

  const targetUser = (usersData?.users ?? []).find((user: any) => (user.email || "").toLowerCase() === email.toLowerCase());
  if (!targetUser?.id) {
    throw new Error(`${studentId} 기존 계정을 찾을 수 없습니다.`);
  }

  const { error: updateError } = await serviceClient.auth.admin.updateUserById(targetUser.id, {
    password: STUDENT_INITIAL_PASSWORD,
    email_confirm: true,
    user_metadata: {
      ...(targetUser.user_metadata ?? {}),
      role: "student",
      student_id: studentId,
    },
  });
  if (updateError) {
    throw new Error(`${studentId} 비밀번호 초기화 실패: ${updateError.message}`);
  }
}

export async function GET(request: Request) {
  const auth = await validateAdminRequest(request);
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.serviceClient
    .from("students")
    .select("id, student_id, name, grade, class_num, created_at, updated_at")
    .order("grade", { ascending: true })
    .order("class_num", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: `학생 목록 조회 실패: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await validateAdminRequest(request);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");

  if (mode === "bulk") {
    const body = (await request.json()) as BulkBody;
    const students = body.students ?? [];
    if (students.length === 0) {
      return NextResponse.json({ error: "업로드할 학생 데이터가 없습니다." }, { status: 400 });
    }

    const normalized = students.map((s) => ({
      student_id: s.student_id.trim(),
      name: s.name.trim(),
      grade: Number(s.grade),
      class_num: Number(s.class_num),
    }));

    const invalid = normalized.find(
      (s) => !s.student_id || !s.name || !Number.isFinite(s.grade) || !Number.isFinite(s.class_num) || s.grade < 1 || s.class_num < 1,
    );
    if (invalid) {
      return NextResponse.json({ error: "CSV 형식이 올바르지 않습니다. (student_id,name,grade,class_num)" }, { status: 400 });
    }

    const { error } = await auth.serviceClient.from("students").upsert(normalized, { onConflict: "student_id" });
    if (error) {
      return NextResponse.json({ error: `학생 일괄 저장 실패: ${error.message}` }, { status: 500 });
    }

    try {
      for (const student of normalized) {
        await ensureStudentAuthUser(auth.serviceClient, student.student_id);
      }
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "학생 Auth 계정 생성 중 오류가 발생했습니다.";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ count: normalized.length });
  }

  const body = (await request.json()) as StudentBody;
  const payload = {
    student_id: body.student_id?.trim() ?? "",
    name: body.name?.trim() ?? "",
    grade: Number(body.grade),
    class_num: Number(body.class_num),
  };
  if (!payload.student_id || !payload.name || !Number.isFinite(payload.grade) || !Number.isFinite(payload.class_num)) {
    return NextResponse.json({ error: "필수 값을 모두 입력해주세요." }, { status: 400 });
  }

  const { data, error } = await auth.serviceClient
    .from("students")
    .upsert(payload, { onConflict: "student_id" })
    .select("id, student_id, name, grade, class_num")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: `학생 저장 실패: ${error.message}` }, { status: 500 });
  }

  try {
    await ensureStudentAuthUser(auth.serviceClient, payload.student_id);
  } catch (authError) {
    const message = authError instanceof Error ? authError.message : "학생 Auth 계정 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

export async function DELETE(request: Request) {
  const auth = await validateAdminRequest(request);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const clearAll = url.searchParams.get("all") === "true";
  if (!clearAll) {
    return NextResponse.json({ error: "all=true 쿼리가 필요합니다." }, { status: 400 });
  }

  const { error: appError } = await auth.serviceClient.from("applications").delete().neq("id", 0);
  if (appError) {
    return NextResponse.json({ error: `신청서 전체 삭제 실패: ${appError.message}` }, { status: 500 });
  }
  const { error: studentError } = await auth.serviceClient.from("students").delete().neq("id", 0);
  if (studentError) {
    return NextResponse.json({ error: `학생 전체 삭제 실패: ${studentError.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

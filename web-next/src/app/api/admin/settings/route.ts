import { SETTINGS_DEFAULTS, type SettingsKey, getSettingsMap, setSettingValue } from "@/lib/admin/settings";
import { validateAdminRequest } from "@/lib/auth/request-auth";
import { NextResponse } from "next/server";

type PatchBody = {
  key?: SettingsKey;
  value?: string;
};

export async function GET(request: Request) {
  const auth = await validateAdminRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const settings = await getSettingsMap(auth.serviceClient);
    return NextResponse.json({ item: settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "설정 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await validateAdminRequest(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as PatchBody;
  const key = body.key;
  if (!key || !(key in SETTINGS_DEFAULTS)) {
    return NextResponse.json({ error: "유효한 설정 키가 아닙니다." }, { status: 400 });
  }

  const value = String(body.value ?? "").trim();
  if (key === "academic_year" && !/^\d{4}$/.test(value)) {
    return NextResponse.json({ error: "학년도는 4자리 숫자여야 합니다." }, { status: 400 });
  }
  if (key === "academic_year_start" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return NextResponse.json({ error: "학년도 시작일 형식은 YYYY-MM-DD 입니다." }, { status: 400 });
  }

  try {
    await setSettingValue(auth.serviceClient, key, value);
    const settings = await getSettingsMap(auth.serviceClient);
    return NextResponse.json({ item: settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "설정 저장 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

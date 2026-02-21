import { setSettingValue } from "@/lib/admin/settings";
import { validateAdminRequest } from "@/lib/auth/request-auth";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const BASE_NAME = "principal-stamp";

function fileExt(filename: string) {
  const lowered = filename.toLowerCase();
  if (lowered.endsWith(".png")) return ".png";
  if (lowered.endsWith(".jpg") || lowered.endsWith(".jpeg")) return ".jpg";
  return ".png";
}

export async function POST(request: Request) {
  const auth = await validateAdminRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "업로드 파일이 없습니다." }, { status: 400 });
    }

    const ext = fileExt(file.name);
    const filename = `${BASE_NAME}${ext}`;
    const relativePath = `/uploads/${filename}`;
    const absolutePath = path.join(UPLOAD_DIR, filename);

    await mkdir(UPLOAD_DIR, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, bytes);

    await setSettingValue(auth.serviceClient, "principal_stamp_path", relativePath);
    return NextResponse.json({ path: relativePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : "직인 업로드 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await validateAdminRequest(request);
  if ("error" in auth) return auth.error;

  try {
    await rm(path.join(UPLOAD_DIR, `${BASE_NAME}.png`), { force: true });
    await rm(path.join(UPLOAD_DIR, `${BASE_NAME}.jpg`), { force: true });
    await setSettingValue(auth.serviceClient, "principal_stamp_path", "");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "직인 삭제 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

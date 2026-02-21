import { getSettingsMap } from "@/lib/admin/settings";
import { validateStudentRequest } from "@/lib/auth/request-auth";
import { formatGateSchedule } from "@/lib/gate/schedule";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, type PDFFont, type PDFForm, type PDFPage, type PDFTextField } from "pdf-lib";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ applicationId: string }>;
};

type NormalizedType = "phone" | "tablet" | "gate";

const FIELD_GATE_GRADE = "\uD14D\uC2A4\uD2B82";
const FIELD_GATE_NAME = "\uD14D\uC2A4\uD2B83";
const FIELD_GATE_CLASS = "\uD14D\uC2A4\uD2B84";

const KOREAN_FILES = {
  phone: "\uD734\uB300\uC804\uD654_\uD5C8\uAC00\uC11C\uC591\uC2DD.pdf",
  tablet: "\uC218\uC5C5\uC6A9 \uD0DC\uBE14\uB9BFPC_\uD5C8\uAC00\uC11C\uC591\uC2DD.pdf",
  gate: "\uC815\uBB38 \uCD9C\uC785 \uD5C8\uAC00\uC11C.pdf",
} as const;

const STAMP_RECT: Record<NormalizedType, [number, number, number, number]> = {
  phone: [199.855, 196.855, 271.855, 241.946],
  tablet: [199.855, 196.855, 271.855, 241.946],
  gate: [498.185, 54.2279, 533.97, 94.5085],
};

function normalizeApplicationType(value: string): NormalizedType {
  const v = (value ?? "").toLowerCase();
  if (v === "phone" || value.includes("\uD734\uB300")) return "phone";
  if (v === "tablet" || value.includes("\uD0DC\uBE14")) return "tablet";
  if (v === "gate" || value.includes("\uC815\uBB38") || value.includes("\uCD9C\uC785")) return "gate";
  return "phone";
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveTemplatePath(type: NormalizedType) {
  const rootDir = path.resolve(process.cwd(), "..");
  const candidatesByType: Record<NormalizedType, string[]> = {
    phone: [
      path.join(rootDir, KOREAN_FILES.phone),
      path.join(rootDir, "assets", "forms", "phone_form_template.pdf"),
    ],
    tablet: [
      path.join(rootDir, KOREAN_FILES.tablet),
      path.join(rootDir, "assets", "forms", "phone_form_template.pdf"),
    ],
    gate: [
      path.join(rootDir, KOREAN_FILES.gate),
      path.join(rootDir, "assets", "forms", "gate_form_template.pdf"),
    ],
  };

  for (const candidate of candidatesByType[type]) {
    if (await fileExists(candidate)) return candidate;
  }
  return null;
}

async function resolveKoreanFontPath() {
  const candidates = [
    path.resolve(process.cwd(), "assets", "fonts", "NotoSansKR-Regular.otf"),
    path.resolve(process.cwd(), "..", "assets", "fonts", "NotoSansKR-Regular.otf"),
    "C:/Windows/Fonts/malgun.ttf",
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }
  return null;
}

function toSafeWinAnsiText(value: unknown) {
  return String(value ?? "-").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function normalizeStudentName(name: string) {
  return name.replace(/^[\s\-–—]+/, "").trim();
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getGatePeriodText(settings: { academic_year: string; academic_year_start: string }) {
  const start = parseDate(settings.academic_year_start);
  if (start) {
    return `${start.getFullYear()}.${start.getMonth() + 1}.${start.getDate()} ~ ${start.getFullYear() + 1}.2.28`;
  }
  const year = Number(settings.academic_year || "2026");
  const safeYear = Number.isFinite(year) ? year : 2026;
  return `${safeYear}.3.1 ~ ${safeYear + 1}.2.28`;
}

function setTextField(
  form: PDFForm,
  name: string,
  value: string,
  font: PDFFont,
  useSafeAnsi: boolean,
  options?: { fontSize?: number },
) {
  try {
    const field: PDFTextField = form.getTextField(name);
    field.setText(useSafeAnsi ? toSafeWinAnsiText(value) : value);
    if (typeof options?.fontSize === "number") {
      field.setFontSize(options.fontSize);
    }
    field.updateAppearances(font);
  } catch {
    // 템플릿별 필드 차이를 허용한다.
  }
}

async function drawPrincipalStamp(pdf: PDFDocument, page: PDFPage, normalizedType: NormalizedType, publicPath: string) {
  const absolutePath = await resolveStampAbsolutePath(publicPath);
  if (!absolutePath) return;

  const bytes = await readFile(absolutePath);
  const lower = absolutePath.toLowerCase();
  const image = lower.endsWith(".png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  const [x1, y1, x2, y2] = STAMP_RECT[normalizedType];
  const width = x2 - x1;
  const height = y2 - y1;
  page.drawImage(image, { x: x1, y: y1, width, height });
}

async function resolveStampAbsolutePath(rawPath: string) {
  const normalized = String(rawPath ?? "").trim().replace(/\\/g, "/");
  if (!normalized) return null;

  const urlMatch = normalized.match(/^https?:\/\/[^/]+(\/.*)$/i);
  const pathnameOnly = urlMatch ? urlMatch[1] : normalized;

  const cwd = process.cwd();
  const appRoot = path.resolve(cwd, "..");
  const withoutLeadingSlash = pathnameOnly.startsWith("/") ? pathnameOnly.slice(1) : pathnameOnly;

  const candidates = [
    path.isAbsolute(pathnameOnly) ? pathnameOnly : "",
    path.join(cwd, "public", withoutLeadingSlash),
    path.join(cwd, "public", pathnameOnly.replace(/^\/+/, "")),
    path.join(cwd, pathnameOnly),
    path.join(appRoot, pathnameOnly),
    path.join(appRoot, withoutLeadingSlash),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }

  return null;
}

export async function GET(request: Request, { params }: Params) {
  const auth = await validateStudentRequest(request);
  if ("error" in auth) return auth.error;

  const { applicationId } = await params;
  if (!applicationId) {
    return NextResponse.json({ error: "신청서 ID가 없습니다." }, { status: 400 });
  }

  const { data: app, error: appError } = await auth.serviceClient
    .from("applications")
    .select(
      "id, student_id, application_type, reason, extra_info, status, approval_number, submitted_at, approved_at, approved_by, rejection_reason",
    )
    .eq("id", applicationId)
    .eq("student_id", auth.studentId)
    .maybeSingle();

  if (appError) {
    return NextResponse.json({ error: `신청서 조회 실패: ${appError.message}` }, { status: 500 });
  }
  if (!app) {
    return NextResponse.json({ error: "신청서를 찾지 못했습니다." }, { status: 404 });
  }
  if (app.status !== "approved") {
    return NextResponse.json({ error: "승인 완료된 신청서만 PDF 출력할 수 있습니다." }, { status: 400 });
  }

  const { data: student, error: studentError } = await auth.serviceClient
    .from("students")
    .select("student_id, name, grade, class_num")
    .eq("student_id", auth.studentId)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json({ error: `학생 조회 실패: ${studentError.message}` }, { status: 500 });
  }

  const settings = await getSettingsMap(auth.serviceClient).catch(() => ({
    academic_year: "2026",
    academic_year_start: "2026-03-01",
    principal_stamp_path: "",
    google_sheet_webapp_url: "",
    gate_sheet_url: "",
  }));

  const normalizedType = normalizeApplicationType(app.application_type);
  const templatePath = await resolveTemplatePath(normalizedType);
  if (!templatePath) {
    return NextResponse.json({ error: "PDF 양식 파일을 찾지 못했습니다." }, { status: 500 });
  }

  const templateBytes = await readFile(templatePath);
  const pdf = await PDFDocument.load(templateBytes);
  const page = pdf.getPages()[0];
  const form = pdf.getForm();

  const fontPath = await resolveKoreanFontPath();
  let font: PDFFont;
  let useSafeAnsi = false;

  if (fontPath) {
    const fontBytes = await readFile(fontPath);
    pdf.registerFontkit(fontkit);
    font = await pdf.embedFont(fontBytes, { subset: true });
  } else {
    font = await pdf.embedFont(StandardFonts.Helvetica);
    useSafeAnsi = true;
  }

  const now = new Date();
  const normalizedName = normalizeStudentName(String(student?.name ?? ""));
  const nameFontSize = normalizedName.length >= 9 ? 10 : 12;
  const commonFields = {
    grade: String(student?.grade ?? ""),
    classNum: String(student?.class_num ?? ""),
    name: normalizedName,
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    date: String(now.getDate()),
  };

  if (normalizedType === "phone" || normalizedType === "tablet") {
    setTextField(form, "grade", commonFields.grade, font, useSafeAnsi);
    setTextField(form, "class", commonFields.classNum, font, useSafeAnsi);
    setTextField(form, "name", commonFields.name, font, useSafeAnsi, { fontSize: nameFontSize });
    setTextField(form, "year", commonFields.year, font, useSafeAnsi);
    setTextField(form, "month", commonFields.month, font, useSafeAnsi);
    setTextField(form, "date", commonFields.date, font, useSafeAnsi);
  } else {
    setTextField(form, FIELD_GATE_GRADE, commonFields.grade, font, useSafeAnsi);
    setTextField(form, FIELD_GATE_CLASS, commonFields.classNum, font, useSafeAnsi);
    setTextField(form, FIELD_GATE_NAME, commonFields.name, font, useSafeAnsi, { fontSize: nameFontSize });
    setTextField(form, "fill_1", String(app.reason ?? ""), font, useSafeAnsi);
    setTextField(form, "fill_2", formatGateSchedule(app.extra_info), font, useSafeAnsi);
    setTextField(form, "fill_3", getGatePeriodText(settings), font, useSafeAnsi);
  }

  form.flatten();
  if (settings.principal_stamp_path) {
    await drawPrincipalStamp(pdf, page, normalizedType, settings.principal_stamp_path).catch(() => undefined);
  }

  const pdfBytes = await pdf.save();
  const filename = `permit-${normalizedType}-${auth.studentId}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

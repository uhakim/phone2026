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

const REQUIRED_FIELDS: Record<NormalizedType, string[]> = {
  phone: ["grade", "class", "name", "year", "month", "date"],
  tablet: ["grade", "class", "name", "year", "month", "date"],
  gate: [FIELD_GATE_GRADE, FIELD_GATE_NAME, FIELD_GATE_CLASS, "fill_1", "fill_2", "fill_3"],
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
  const cwd = process.cwd();
  const parentDir = path.resolve(cwd, "..");
  const rootDir = path.resolve(cwd, "..", "..");
  const candidatesByType: Record<NormalizedType, string[]> = {
    phone: [
      path.join(cwd, KOREAN_FILES.phone),
      path.join(parentDir, KOREAN_FILES.phone),
      path.join(rootDir, KOREAN_FILES.phone),
      path.join(cwd, "assets", "forms", "phone_form_template.pdf"),
      path.join(parentDir, "assets", "forms", "phone_form_template.pdf"),
      path.join(rootDir, "assets", "forms", "phone_form_template.pdf"),
    ],
    tablet: [
      path.join(cwd, KOREAN_FILES.tablet),
      path.join(parentDir, KOREAN_FILES.tablet),
      path.join(rootDir, KOREAN_FILES.tablet),
      path.join(cwd, "assets", "forms", "phone_form_template.pdf"),
      path.join(parentDir, "assets", "forms", "phone_form_template.pdf"),
      path.join(rootDir, "assets", "forms", "phone_form_template.pdf"),
    ],
    gate: [
      path.join(cwd, KOREAN_FILES.gate),
      path.join(parentDir, KOREAN_FILES.gate),
      path.join(rootDir, KOREAN_FILES.gate),
      path.join(cwd, "assets", "forms", "gate_form_template.pdf"),
      path.join(parentDir, "assets", "forms", "gate_form_template.pdf"),
      path.join(rootDir, "assets", "forms", "gate_form_template.pdf"),
    ],
  };

  const required = REQUIRED_FIELDS[type];
  for (const candidate of Array.from(new Set(candidatesByType[type]))) {
    if (!(await fileExists(candidate))) continue;
    try {
      const bytes = await readFile(candidate);
      const pdf = await PDFDocument.load(bytes);
      const fieldNames = pdf.getForm().getFields().map((field) => field.getName());
      const hasAllRequired = required.every((name) => fieldNames.includes(name));
      if (hasAllRequired) return candidate;
    } catch {
      // Ignore invalid candidates and try next.
    }
  }
  return null;
}

async function resolveKoreanFontPath() {
  const candidates = [
    path.resolve(process.cwd(), "public", "fonts", "NotoSansCJKkr-Regular.otf"),
    path.resolve(process.cwd(), "..", "web-next", "public", "fonts", "NotoSansCJKkr-Regular.otf"),
    path.resolve(process.cwd(), "public", "fonts", "NotoSansKR-Variable.ttf"),
    path.resolve(process.cwd(), "..", "web-next", "public", "fonts", "NotoSansKR-Variable.ttf"),
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
  return String(name ?? "").replace(/^[\s-]+/, "").trim();
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
    // ?쒗뵆由용퀎 ?꾨뱶 李⑥씠瑜??덉슜?쒕떎.
  }
}

async function drawPrincipalStamp(pdf: PDFDocument, page: PDFPage, normalizedType: NormalizedType, publicPath: string) {
  let bytes: Buffer | null = null;
  let isPng = false;

  const normalized = String(publicPath ?? "").trim();
  if (normalized.startsWith("data:image/")) {
    const parts = normalized.split(",", 2);
    if (parts.length === 2) {
      const header = parts[0].toLowerCase();
      bytes = Buffer.from(parts[1], "base64");
      isPng = header.includes("image/png");
    }
  } else {
    const absolutePath = await resolveStampAbsolutePath(publicPath);
    if (!absolutePath) return;
    bytes = await readFile(absolutePath);
    isPng =
      bytes.length > 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47;
  }

  if (!bytes) return;
  const image = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
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
    return NextResponse.json({ error: "?좎껌??ID媛 ?놁뒿?덈떎." }, { status: 400 });
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
    return NextResponse.json({ error: `?좎껌??議고쉶 ?ㅽ뙣: ${appError.message}` }, { status: 500 });
  }
  if (!app) {
    return NextResponse.json({ error: "?좎껌?쒕? 李얠? 紐삵뻽?듬땲??" }, { status: 404 });
  }
  if (app.status !== "approved") {
    return NextResponse.json({ error: "?뱀씤 ?꾨즺???좎껌?쒕쭔 PDF 異쒕젰?????덉뒿?덈떎." }, { status: 400 });
  }

  const { data: student, error: studentError } = await auth.serviceClient
    .from("students")
    .select("student_id, name, grade, class_num")
    .eq("student_id", auth.studentId)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json({ error: `?숈깮 議고쉶 ?ㅽ뙣: ${studentError.message}` }, { status: 500 });
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
    return NextResponse.json({ error: "PDF ?묒떇 ?뚯씪??李얠? 紐삵뻽?듬땲??" }, { status: 500 });
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

  const stampDate = parseDate(app.approved_at) ?? parseDate(app.submitted_at) ?? new Date();
  const normalizedName = normalizeStudentName(String(student?.name ?? ""));
  const nameFontSize = normalizedName.length >= 9 ? 10 : 12;
  const commonFields = {
    grade: String(student?.grade ?? ""),
    classNum: String(student?.class_num ?? ""),
    name: normalizedName,
    year: String(stampDate.getFullYear()),
    month: String(stampDate.getMonth() + 1).padStart(2, "0"),
    date: String(stampDate.getDate()).padStart(2, "0"),
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


import io
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from PyPDF2 import PdfReader, PdfWriter
from PyPDF2.generic import NameObject
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from config.settings import SCHOOL_NAME
from database.db_manager import execute_query
from utils.academic_year import get_gate_period_text
from utils.gate_schedule import format_gate_schedule

ROOT_PATH = Path(__file__).resolve().parent.parent
FORM_FIELDS_PHONE_TABLET = {"grade", "class", "name", "year", "month", "date"}
FORM_FIELDS_GATE = {"fill_1", "fill_2", "fill_3", "텍스트2", "텍스트3", "텍스트4"}


def generate_phone_permit_pdf(application_data):
    """휴대전화 허가서 PDF 생성 (양식 기반)."""
    try:
        return _fill_template_pdf("phone", application_data)
    except Exception:
        return _create_permit_with_image("phone", "School Phone Permit", application_data)


def generate_tablet_permit_pdf(application_data):
    """태블릿 허가서 PDF 생성 (양식 기반)."""
    try:
        return _fill_template_pdf("tablet", application_data)
    except Exception:
        return _create_permit_with_image("tablet", "School Tablet Permit", application_data)


def generate_gate_permit_pdf(application_data):
    """정문 출입 허가서 PDF 생성 (양식 기반)."""
    try:
        return _fill_template_pdf("gate", application_data)
    except Exception:
        return _create_gate_permit(application_data)


def _fill_template_pdf(template_kind, application_data):
    template_path = _find_template_path(template_kind)
    if not template_path:
        raise FileNotFoundError(f"Template not found: {template_kind}")

    reader = PdfReader(str(template_path))
    page = reader.pages[0]
    width = float(page.mediabox.width)
    height = float(page.mediabox.height)
    rect_map = _extract_rect_map(page)

    overlay_buffer = io.BytesIO()
    overlay = canvas.Canvas(overlay_buffer, pagesize=(width, height))
    font_name = _register_korean_font()

    if template_kind in ("phone", "tablet"):
        _draw_phone_tablet_values(overlay, rect_map, application_data, font_name)
    elif template_kind == "gate":
        _draw_gate_values(overlay, rect_map, application_data, font_name)
    else:
        raise ValueError(f"Unknown template kind: {template_kind}")

    _draw_principal_stamp(overlay, rect_map)

    overlay.save()
    overlay_buffer.seek(0)
    overlay_page = PdfReader(overlay_buffer).pages[0]
    page.merge_page(overlay_page)

    # 입력 폼 제거: 뷰어의 하늘색 입력 필드 표시 방지
    if "/Annots" in page:
        del page[NameObject("/Annots")]

    writer = PdfWriter()
    writer.add_page(page)
    if "/AcroForm" in writer._root_object:
        del writer._root_object[NameObject("/AcroForm")]

    out = io.BytesIO()
    writer.write(out)
    out.seek(0)
    return out.getvalue()


def _draw_phone_tablet_values(pdf_canvas, rect_map, application_data, font_name):
    today = datetime.now()
    values = {
        "year": str(today.year),
        "month": str(today.month),
        "date": str(today.day),
        "grade": str(application_data.get("grade", "")),
        "class": str(application_data.get("class_num", "")),
        "name": str(application_data.get("name", "")),
    }
    _draw_text_in_rect(pdf_canvas, rect_map.get("grade"), values["grade"], font_name, 12, align="center")
    _draw_text_in_rect(pdf_canvas, rect_map.get("class"), values["class"], font_name, 12, align="center")
    _draw_text_in_rect(pdf_canvas, rect_map.get("name"), values["name"], font_name, 12, align="center")
    _draw_text_in_rect(pdf_canvas, rect_map.get("year"), values["year"], font_name, 11, align="center")
    _draw_text_in_rect(pdf_canvas, rect_map.get("month"), values["month"], font_name, 11, align="center")
    _draw_text_in_rect(pdf_canvas, rect_map.get("date"), values["date"], font_name, 11, align="center")


def _draw_gate_values(pdf_canvas, rect_map, application_data, font_name):
    name = str(application_data.get("name", ""))
    grade = str(application_data.get("grade", ""))
    class_num = str(application_data.get("class_num", ""))
    reason = str(application_data.get("reason", ""))
    schedule = format_gate_schedule(application_data.get("extra_info", ""))
    period = get_gate_period_text()

    _draw_text_in_rect(pdf_canvas, rect_map.get("텍스트2"), grade, font_name, 12, align="center")
    _draw_text_in_rect(pdf_canvas, rect_map.get("텍스트4"), class_num, font_name, 12, align="center")
    _draw_text_in_rect(pdf_canvas, rect_map.get("텍스트3"), name, font_name, 12, align="center")
    _draw_text_in_rect(pdf_canvas, rect_map.get("fill_1"), reason, font_name, 11, align="left")
    _draw_text_in_rect(pdf_canvas, rect_map.get("fill_2"), schedule, font_name, 11, align="left")
    _draw_text_in_rect(pdf_canvas, rect_map.get("fill_3"), period, font_name, 11, align="left")


def _extract_rect_map(page):
    rect_map = {}
    annots = page.get("/Annots")
    if not annots:
        return rect_map
    for annot_ref in annots.get_object():
        annot = annot_ref.get_object()
        field_name = annot.get("/T")
        field_rect = annot.get("/Rect")
        if field_name and field_rect:
            rect_map[str(field_name)] = [float(v) for v in field_rect]
    return rect_map


def _find_template_path(template_kind):
    templates = []
    for pdf in ROOT_PATH.glob("*.pdf"):
        if pdf.name.startswith("_check_"):
            continue
        try:
            fields = _get_template_fields(pdf)
            templates.append((pdf, fields))
        except Exception:
            continue

    if template_kind == "phone":
        for pdf, fields in templates:
            if FORM_FIELDS_PHONE_TABLET.issubset(fields) and "휴대전화" in pdf.stem:
                return pdf
        for pdf, fields in templates:
            if FORM_FIELDS_PHONE_TABLET.issubset(fields):
                return pdf

    if template_kind == "tablet":
        for pdf, fields in templates:
            if FORM_FIELDS_PHONE_TABLET.issubset(fields) and "태블릿" in pdf.stem:
                return pdf
        for pdf, fields in templates:
            if FORM_FIELDS_PHONE_TABLET.issubset(fields):
                return pdf

    if template_kind == "gate":
        for pdf, fields in templates:
            if FORM_FIELDS_GATE.issubset(fields):
                return pdf
        for pdf, fields in templates:
            if {"fill_1", "fill_2", "fill_3"}.issubset(fields):
                return pdf

    return None


def _get_template_fields(pdf_path):
    reader = PdfReader(str(pdf_path))
    page = reader.pages[0]
    names = set()
    annots = page.get("/Annots")
    if annots:
        for annot_ref in annots.get_object():
            annot = annot_ref.get_object()
            field_name = annot.get("/T")
            if field_name:
                names.add(str(field_name))
    return names


def _register_korean_font():
    font_name = "KoreanForm"
    if font_name in pdfmetrics.getRegisteredFontNames():
        return font_name
    font_path = Path("C:/Windows/Fonts/malgun.ttf")
    if font_path.exists():
        pdfmetrics.registerFont(TTFont(font_name, str(font_path)))
        return font_name
    return "Helvetica"


def _draw_text_in_rect(pdf_canvas, rect, text, font_name, font_size, align="center"):
    if not rect or text is None:
        return
    text_value = str(text).strip()
    if not text_value:
        return

    x1, y1, x2, y2 = rect
    pdf_canvas.setFont(font_name, font_size)
    text_width = pdf_canvas.stringWidth(text_value, font_name, font_size)

    if align == "left":
        x = x1 + 4
    else:
        x = x1 + max((x2 - x1 - text_width) / 2, 0)
    y = y1 + max((y2 - y1 - font_size) / 2, 0)
    pdf_canvas.drawString(x, y, text_value)


def _draw_principal_stamp(pdf_canvas, rect_map):
    stamp_rect = None
    for key, rect in rect_map.items():
        key_text = str(key)
        if key_text.endswith("_af_image"):
            stamp_rect = rect
            break
    if not stamp_rect:
        return

    stamp_path = _get_principal_stamp_path()
    if not stamp_path or not stamp_path.exists():
        return

    x1, y1, x2, y2 = stamp_rect
    area_w = max(x2 - x1, 1)
    area_h = max(y2 - y1, 1)
    image_obj = Image.open(stamp_path).convert("RGBA")
    img_w, img_h = image_obj.size
    if img_w <= 0 or img_h <= 0:
        return

    scale = min(area_w / img_w, area_h / img_h)
    draw_w = img_w * scale
    draw_h = img_h * scale
    draw_x = x1 + (area_w - draw_w) / 2
    draw_y = y1 + (area_h - draw_h) / 2
    pdf_canvas.drawImage(
        ImageReader(image_obj),
        draw_x,
        draw_y,
        width=draw_w,
        height=draw_h,
        mask="auto",
    )


def _get_principal_stamp_path():
    result = execute_query(
        "SELECT value FROM settings WHERE key = ?",
        ("principal_stamp_path",),
    )
    if not result:
        return None
    value = result[0]["value"]
    if not value:
        return None
    return ROOT_PATH / value


def _create_permit_with_image(permit_type, title, application_data):
    """템플릿 로딩 실패 시 이미지 기반 간단 백업 출력."""
    width_px = int(210 * 3.78)
    height_px = int(297 * 3.78)
    img = Image.new("RGB", (width_px, height_px), "white")
    draw = ImageDraw.Draw(img)

    try:
        font_title = ImageFont.truetype("C:\\Windows\\Fonts\\malgun.ttf", 36)
        font_normal = ImageFont.truetype("C:\\Windows\\Fonts\\malgun.ttf", 14)
    except Exception:
        font_title = ImageFont.load_default()
        font_normal = ImageFont.load_default()

    y_pos = 80
    draw.text((120, y_pos), title, fill="black", font=font_title)
    y_pos += 80

    info_lines = [
        f"Grade: {application_data.get('grade', '')}",
        f"Class: {application_data.get('class_num', '')}",
        f"Name: {application_data.get('name', '')}",
        f"Reason: {application_data.get('reason', '')}",
    ]
    if permit_type == "gate":
        info_lines.append(f"Schedule: {application_data.get('extra_info', '')}")
    for line in info_lines:
        draw.text((80, y_pos), line, fill="black", font=font_normal)
        y_pos += 32

    out = io.BytesIO()
    img.convert("RGB").save(out, format="PDF")
    out.seek(0)
    return out.getvalue()


def _create_gate_permit(application_data):
    """정문 템플릿 실패 시 ReportLab 백업 출력."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(width / 2, height - 30 * mm, SCHOOL_NAME)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, height - 45 * mm, "Gate Exit Permit")

    y = height - 70 * mm
    c.setFont("Helvetica", 11)
    c.drawString(40 * mm, y, f"Grade: {application_data.get('grade', '')}")
    y -= 8 * mm
    c.drawString(40 * mm, y, f"Class: {application_data.get('class_num', '')}")
    y -= 8 * mm
    c.drawString(40 * mm, y, f"Name: {application_data.get('name', '')}")
    y -= 15 * mm

    c.setFont("Helvetica-Bold", 11)
    c.drawString(40 * mm, y, "Permission granted for gate exit.")
    y -= 18 * mm

    row_height = 12 * mm
    col1_x = 40 * mm
    col1_width = 45 * mm
    col2_x = col1_x + col1_width
    col2_width = 90 * mm

    c.setLineWidth(1)
    c.setFont("Helvetica-Bold", 10)
    c.rect(col1_x, y - row_height, col1_width, row_height)
    c.rect(col2_x, y - row_height, col2_width, row_height)
    c.drawString(col1_x + 3 * mm, y - 7 * mm, "Reason")
    c.setFont("Helvetica", 9)
    c.drawString(col2_x + 3 * mm, y - 7 * mm, application_data.get("reason", "")[:25])
    y -= row_height

    c.setFont("Helvetica-Bold", 10)
    c.rect(col1_x, y - row_height, col1_width, row_height)
    c.rect(col2_x, y - row_height, col2_width, row_height)
    c.drawString(col1_x + 3 * mm, y - 7 * mm, "Schedule")
    c.setFont("Helvetica", 9)
    c.drawString(col2_x + 3 * mm, y - 7 * mm, application_data.get("extra_info", "")[:25])
    y -= row_height

    c.setFont("Helvetica-Bold", 10)
    c.rect(col1_x, y - row_height, col1_width, row_height)
    c.rect(col2_x, y - row_height, col2_width, row_height)
    c.drawString(col1_x + 3 * mm, y - 7 * mm, "Valid Until")
    c.setFont("Helvetica", 9)
    c.drawString(col2_x + 3 * mm, y - 7 * mm, get_gate_period_text())

    c.save()
    buffer.seek(0)
    return buffer.getvalue()

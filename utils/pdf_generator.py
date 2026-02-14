import io
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from config.settings import SCHOOL_NAME, GATE_PERMIT_START, GATE_PERMIT_END

def _get_canvas_and_setup(filename=None):
    """캔버스 생성 및 기본 설정"""
    if filename:
        c = canvas.Canvas(filename, pagesize=A4)
    else:
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)

    width, height = A4
    return c, width, height, buffer if not filename else None

def generate_gate_permit_pdf(application_data):
    """정문출입 허가서 PDF 생성"""
    c, width, height, buffer = _get_canvas_and_setup()

    # 제목
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(width / 2, height - 40 * mm, SCHOOL_NAME)

    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, height - 55 * mm, "정문 출입 허가서")

    # 학생 정보
    c.setFont("Helvetica", 11)
    y = height - 80 * mm

    c.drawString(50 * mm, y, f"학년: {application_data['grade']}")
    y -= 8 * mm

    c.drawString(50 * mm, y, f"반: {application_data['class_num']}")
    y -= 8 * mm

    c.drawString(50 * mm, y, f"이름: {application_data['name']}")
    y -= 15 * mm

    # 허가 정보 제목
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50 * mm, y, "위 어린이의 정문 출입을 허가합니다.")

    # 표 그리기
    y -= 15 * mm
    row_height = 10 * mm
    col1_width = 40 * mm
    col2_width = 80 * mm

    # 표 헤더
    c.setLineWidth(1)

    # 허가사유
    c.rect(30 * mm, y - row_height, col1_width, row_height)
    c.rect(30 * mm + col1_width, y - row_height, col2_width, row_height)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(35 * mm, y - 6 * mm, "허가사유")
    c.setFont("Helvetica", 9)
    c.drawString(75 * mm, y - 6 * mm, application_data['reason'][:30])

    y -= row_height

    # 허가요일(시간)
    c.rect(30 * mm, y - row_height, col1_width, row_height)
    c.rect(30 * mm + col1_width, y - row_height, col2_width, row_height)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(35 * mm, y - 6 * mm, "허가요일(시간)")
    c.setFont("Helvetica", 9)
    c.drawString(75 * mm, y - 6 * mm, application_data.get('extra_info', '')[:30])

    y -= row_height

    # 유효기간
    c.rect(30 * mm, y - row_height, col1_width, row_height)
    c.rect(30 * mm + col1_width, y - row_height, col2_width, row_height)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(35 * mm, y - 6 * mm, "유효기간")
    c.setFont("Helvetica", 9)
    c.drawString(
        75 * mm,
        y - 6 * mm,
        f"{GATE_PERMIT_START} ~ {GATE_PERMIT_END}"
    )

    y -= row_height + 5 * mm

    # 담임선생님 확인란
    c.setFont("Helvetica", 10)
    c.drawString(110 * mm, y, "담임선생님: (인)")

    y -= 15 * mm

    # 승인번호
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50 * mm, y, f"승인번호: {application_data.get('approval_number', 'N/A')}")

    # 하단
    c.setFont("Helvetica-BoldOblique", 9)
    c.drawString(50 * mm, 20 * mm, "이 허가서는 항상 지참하여야 합니다")

    c.save()

    if buffer:
        buffer.seek(0)
        return buffer.getvalue()

def generate_phone_permit_pdf(application_data):
    """휴대전화 허가서 PDF 생성"""
    c, width, height, buffer = _get_canvas_and_setup()

    # === 상단: 신청서 ===
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, height - 30 * mm, "교내 휴대전화 소지 신청 및 서약서")

    c.setFont("Helvetica", 10)
    y = height - 50 * mm

    c.drawString(50 * mm, y, f"학년: {application_data['grade']}")
    y -= 8 * mm

    c.drawString(50 * mm, y, f"반: {application_data['class_num']}")
    y -= 8 * mm

    c.drawString(50 * mm, y, f"이름: {application_data['name']}")
    y -= 15 * mm

    c.drawString(50 * mm, y, "☎ 휴대전화를 소지해야 하는 이유")
    y -= 8 * mm

    # 이유 텍스트 (텍스트 랩핑)
    reason_text = application_data['reason'][:100]
    c.drawString(55 * mm, y, reason_text)

    y -= 20 * mm
    c.setFont("Helvetica", 9)
    c.drawString(50 * mm, y, "위 어린이는 상기와 같은 이유로 휴대전화를 꼭 소지하여야 하기 때문에")
    y -= 6 * mm
    c.drawString(50 * mm, y, "보호자 연서로서 승낙을 희망하며 어린이의 휴대전화 사용으로")
    y -= 6 * mm
    c.drawString(50 * mm, y, "발생하는 모든 문제에 학부모로서 책임질 것을 서약합니다.")

    y -= 20 * mm
    c.setFont("Helvetica", 10)
    c.drawString(50 * mm, y, "20__ 년 __ 월 __ 일")

    y -= 15 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50 * mm, y, "절 ---- 취 ---- 선")

    y -= 20 * mm

    # === 하단: 허가서 ===
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, y, "교내 휴대전화 소지")
    y -= 8 * mm
    c.drawCentredString(width / 2, y, "학교장 허가서")

    y -= 15 * mm
    c.setFont("Helvetica", 10)
    c.drawString(50 * mm, y, f"학년: {application_data['grade']}")
    y -= 8 * mm

    c.drawString(50 * mm, y, f"반: {application_data['class_num']}")
    y -= 8 * mm

    c.drawString(50 * mm, y, f"이름: {application_data['name']}")

    y -= 15 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50 * mm, y, "학교장 확인")

    y -= 8 * mm
    c.setFont("Helvetica", 9)
    c.drawString(50 * mm, y, "위 어린이의 교내 휴대전화 소지를 허가합니다.")

    y -= 12 * mm
    c.drawString(50 * mm, y, "20__ 년 __ 월 __ 일")

    y -= 12 * mm
    c.setFont("Helvetica-BoldOblique", 8)
    c.drawString(50 * mm, y, "주의사항: 교내와 학교차(주차장 포함)에서는 전원을 끄고")
    y -= 6 * mm
    c.drawString(50 * mm, y, "사용하지 않습니다. 친구들에게 보여주지 않습니다.")

    c.save()

    if buffer:
        buffer.seek(0)
        return buffer.getvalue()

def generate_tablet_permit_pdf(application_data):
    """태블릿PC 허가서 PDF 생성"""
    c, width, height, buffer = _get_canvas_and_setup()

    # === 상단: 신청서 ===
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, height - 30 * mm, "(교내, 학원) 수업용 태블릿PC")
    c.drawCentredString(width / 2, height - 38 * mm, "휴대 신청 및 서약서")

    c.setFont("Helvetica", 10)
    y = height - 55 * mm

    c.drawString(50 * mm, y, f"학년: {application_data['grade']}")
    y -= 8 * mm

    c.drawString(50 * mm, y, f"반: {application_data['class_num']}")
    y -= 8 * mm

    c.drawString(50 * mm, y, f"이름: {application_data['name']}")
    y -= 15 * mm

    c.drawString(50 * mm, y, "☎ 수업용 태블릿PC를 소지해야 하는 이유")
    y -= 8 * mm

    reason_text = application_data['reason'][:100]
    c.drawString(55 * mm, y, reason_text)

    y -= 20 * mm
    c.setFont("Helvetica", 9)
    c.drawString(50 * mm, y, "위 어린이는 상기와 같은 이유로 수업용 태블릿PC를 꼭")
    y -= 6 * mm
    c.drawString(50 * mm, y, "소지하여야 하기 때문에 보호자 연서로서 승낙을 희망하며")
    y -= 6 * mm
    c.drawString(50 * mm, y, "어린이의 수업용 태블릿PC 사용으로 발생하는 모든 문제에")
    y -= 6 * mm
    c.drawString(50 * mm, y, "학부모로서 책임질 것을 서약합니다.")

    y -= 15 * mm
    c.setFont("Helvetica", 10)
    c.drawString(50 * mm, y, "20__ 년 __ 월 __ 일")

    y -= 15 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50 * mm, y, "절 ---- 취 ---- 선")

    y -= 20 * mm

    # === 하단: 허가서 ===
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, y, "교내 수업용 태블릿PC")
    y -= 8 * mm
    c.drawCentredString(width / 2, y, "소지 담임교사 허가서")

    y -= 15 * mm
    c.setFont("Helvetica", 10)
    c.drawString(50 * mm, y, f"학년: {application_data['grade']}")
    y -= 8 * mm

    c.drawString(50 * mm, y, f"반: {application_data['class_num']}")
    y -= 8 * mm

    c.drawString(50 * mm, y, f"이름: {application_data['name']}")

    y -= 15 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50 * mm, y, "학교장 확인")

    y -= 8 * mm
    c.setFont("Helvetica", 9)
    c.drawString(50 * mm, y, "위 어린이의 교내 수업용 태블릿PC 소지를 허가합니다.")

    y -= 12 * mm
    c.drawString(50 * mm, y, "20__ 년 __ 월 __ 일")

    y -= 12 * mm
    c.setFont("Helvetica-BoldOblique", 8)
    c.drawString(50 * mm, y, "주의사항: 교내와 학교차(주차장 포함)에서는 전원을 끄고")
    y -= 6 * mm
    c.drawString(50 * mm, y, "사용하지 않습니다. 친구들에게 보여주지 않습니다.")

    c.save()

    if buffer:
        buffer.seek(0)
        return buffer.getvalue()

"""
PDF 양식 생성 스크립트
3가지 허가서 양식 생성 및 샘플 데이터로 채우기
"""

import io
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# 한글 폰트 설정
try:
    font_path = "C:\\Windows\\Fonts\\malgun.ttf"
    pdfmetrics.registerFont(TTFont('Korean', font_path))
    pdfmetrics.registerFont(TTFont('Korean-Bold', font_path))
    FONT = 'Korean'
except:
    FONT = 'Helvetica'

OUTPUT_DIR = Path(__file__).parent.parent / "assets" / "forms"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def create_phone_tablet_form():
    """휴대전화/태블릿 허가서 양식 생성"""
    filename = OUTPUT_DIR / "phone_form_template.pdf"

    c = canvas.Canvas(str(filename), pagesize=A4)
    width, height = A4

    # 상단: 신청서 부분
    c.setFont(f"{FONT}-Bold", 14)
    c.drawCentredString(width / 2, height - 30 * mm, "교내 휴대전화 소지 신청 및 서약서")

    y = height - 55 * mm
    c.setFont(FONT, 11)

    # 학생 정보 입력 필드
    c.drawString(40 * mm, y, "학년:")
    c.rect(60 * mm, y - 3 * mm, 20 * mm, 6 * mm)  # 입력 필드

    y -= 12 * mm
    c.drawString(40 * mm, y, "반:")
    c.rect(60 * mm, y - 3 * mm, 20 * mm, 6 * mm)

    y -= 12 * mm
    c.drawString(40 * mm, y, "이름:")
    c.rect(60 * mm, y - 3 * mm, 40 * mm, 6 * mm)

    y -= 20 * mm
    c.drawString(40 * mm, y, "휴대전화를 소지해야 하는 이유:")
    y -= 8 * mm
    c.rect(40 * mm, y - 20 * mm, 120 * mm, 20 * mm)  # 이유 입력 필드

    y -= 30 * mm
    c.setFont(FONT, 9)
    c.drawString(40 * mm, y, "위 어린이는 상기와 같은 이유로 휴대전화를 꼭 소지하여야 하기 때문에")
    y -= 6 * mm
    c.drawString(40 * mm, y, "보호자 연서로서 승낙을 희망하며 어린이의 휴대전화 사용으로")
    y -= 6 * mm
    c.drawString(40 * mm, y, "발생하는 모든 문제에 학부모로서 책임질 것을 서약합니다.")

    y -= 15 * mm
    c.setFont(FONT, 10)
    c.drawString(40 * mm, y, "학생서명:")
    c.rect(70 * mm, y - 3 * mm, 40 * mm, 6 * mm)

    y -= 10 * mm
    c.drawString(40 * mm, y, "보호자서명:")
    c.rect(70 * mm, y - 3 * mm, 40 * mm, 6 * mm)

    # 절취선
    y -= 20 * mm
    c.setLineWidth(1)
    c.line(30 * mm, y, width - 30 * mm, y)

    # 하단: 허가서 부분
    y -= 20 * mm
    c.setFont(f"{FONT}-Bold", 14)
    c.drawCentredString(width / 2, y, "교내 휴대전화 소지")
    y -= 10 * mm
    c.drawCentredString(width / 2, y, "학교장 허가서")

    y -= 20 * mm
    c.setFont(FONT, 11)

    # 허가서 정보 필드 (읽기 전용 또는 채워지는 필드)
    c.drawString(40 * mm, y, "학년:")
    c.rect(60 * mm, y - 3 * mm, 20 * mm, 6 * mm)

    y -= 10 * mm
    c.drawString(40 * mm, y, "반:")
    c.rect(60 * mm, y - 3 * mm, 20 * mm, 6 * mm)

    y -= 10 * mm
    c.drawString(40 * mm, y, "이름:")
    c.rect(60 * mm, y - 3 * mm, 40 * mm, 6 * mm)

    y -= 15 * mm
    c.setFont(f"{FONT}-Bold", 11)
    c.drawString(40 * mm, y, "학교장 확인")

    y -= 12 * mm
    c.setFont(FONT, 10)
    c.drawString(40 * mm, y, "위 어린이의 교내 휴대전화 소지를 허가합니다.")

    y -= 12 * mm
    c.drawString(40 * mm, y, "20__ 년 __ 월 __ 일")

    y -= 15 * mm
    c.setFont(FONT, 8)
    c.drawString(40 * mm, y, "주의사항:")
    y -= 8 * mm
    c.drawString(45 * mm, y, "• 교내와 학교차(주차장 포함)에서는 전원을 끄고 사용하지 않습니다.")
    y -= 8 * mm
    c.drawString(45 * mm, y, "• 친구들에게 보여주지 않습니다.")

    c.save()
    return filename

def create_gate_form():
    """정문출입 허가서 양식 생성"""
    filename = OUTPUT_DIR / "gate_form_template.pdf"

    c = canvas.Canvas(str(filename), pagesize=A4)
    width, height = A4

    # 제목
    c.setFont(f"{FONT}-Bold", 16)
    c.drawCentredString(width / 2, height - 30 * mm, "학교 정문 출입 신청 및 서약서")

    y = height - 55 * mm
    c.setFont(FONT, 11)

    # 신청서 부분
    c.drawString(40 * mm, y, "학년:")
    c.rect(60 * mm, y - 3 * mm, 20 * mm, 6 * mm)

    y -= 12 * mm
    c.drawString(40 * mm, y, "반:")
    c.rect(60 * mm, y - 3 * mm, 20 * mm, 6 * mm)

    y -= 12 * mm
    c.drawString(40 * mm, y, "이름:")
    c.rect(60 * mm, y - 3 * mm, 40 * mm, 6 * mm)

    y -= 20 * mm
    c.drawString(40 * mm, y, "정문 출입을 해야 하는 이유:")
    y -= 8 * mm
    c.rect(40 * mm, y - 15 * mm, 120 * mm, 15 * mm)

    y -= 25 * mm
    c.drawString(40 * mm, y, "정문 출입을 원하는 요일과 시간:")
    y -= 8 * mm
    c.rect(40 * mm, y - 10 * mm, 120 * mm, 10 * mm)

    y -= 20 * mm
    c.setFont(FONT, 9)
    c.drawString(40 * mm, y, "위 어린이는 상기와 같은 이유로 학교 정문 출입을 하기를 보호자 연서로서")
    y -= 6 * mm
    c.drawString(40 * mm, y, "승낙을 희망하며 어린이의 정문 출입으로 발생하는 모든 문제에")
    y -= 6 * mm
    c.drawString(40 * mm, y, "학부모로서 책임질 것을 서약합니다.")

    y -= 15 * mm
    c.setFont(FONT, 10)
    c.drawString(40 * mm, y, "학생서명:")
    c.rect(70 * mm, y - 3 * mm, 40 * mm, 6 * mm)

    y -= 10 * mm
    c.drawString(40 * mm, y, "보호자서명:")
    c.rect(70 * mm, y - 3 * mm, 40 * mm, 6 * mm)

    # 절취선
    y -= 20 * mm
    c.setLineWidth(1)
    c.line(30 * mm, y, width - 30 * mm, y)

    # 하단: 허가서
    y -= 20 * mm
    c.setFont(f"{FONT}-Bold", 14)
    c.drawCentredString(width / 2, y, "동성초등학교 정문 출입 허가서")

    y -= 20 * mm
    c.setFont(FONT, 11)

    # 표 그리기
    row_height = 10 * mm
    col1_x = 40 * mm
    col1_width = 40 * mm
    col2_x = col1_x + col1_width
    col2_width = 100 * mm

    c.setLineWidth(1)

    # 학년/반/이름
    c.rect(col1_x, y - row_height, col1_width, row_height)
    c.rect(col2_x, y - row_height, col2_width, row_height)
    c.drawString(col1_x + 3 * mm, y - 6 * mm, "학년/반/이름")
    c.rect(col2_x + 3 * mm, y - 6 * mm, 80 * mm, 4 * mm)

    y -= row_height

    # 허가사유
    c.rect(col1_x, y - row_height, col1_width, row_height)
    c.rect(col2_x, y - row_height, col2_width, row_height)
    c.drawString(col1_x + 3 * mm, y - 6 * mm, "허가사유")
    c.rect(col2_x + 3 * mm, y - 6 * mm, 80 * mm, 4 * mm)

    y -= row_height

    # 허가요일(시간)
    c.rect(col1_x, y - row_height, col1_width, row_height)
    c.rect(col2_x, y - row_height, col2_width, row_height)
    c.drawString(col1_x + 3 * mm, y - 6 * mm, "허가요일(시간)")
    c.rect(col2_x + 3 * mm, y - 6 * mm, 80 * mm, 4 * mm)

    y -= row_height

    # 유효기간
    c.rect(col1_x, y - row_height, col1_width, row_height)
    c.rect(col2_x, y - row_height, col2_width, row_height)
    c.drawString(col1_x + 3 * mm, y - 6 * mm, "유효기간")
    c.drawString(col2_x + 3 * mm, y - 6 * mm, "2025.3.4 ~ 2026.2.28")

    y -= row_height + 10 * mm

    # 담임선생님
    c.drawString(100 * mm, y, "담임선생님: (  인  )")

    y -= 15 * mm

    # 승인번호
    c.setFont(f"{FONT}-Bold", 10)
    c.drawString(40 * mm, y, "승인번호:")
    c.rect(70 * mm, y - 3 * mm, 60 * mm, 6 * mm)

    c.save()
    return filename

if __name__ == "__main__":
    phone_file = create_phone_tablet_form()
    gate_file = create_gate_form()

    print("[OK] Phone/Tablet Form: {}".format(phone_file))
    print("[OK] Gate Form: {}".format(gate_file))
    print("\nForms created successfully!")
    print("Check here: {}".format(OUTPUT_DIR))

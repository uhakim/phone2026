"""
원본 PDF 양식과 동일한 형식으로 생성
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
    FONT = 'Korean'
except:
    FONT = 'Helvetica'

OUTPUT_DIR = Path(__file__).parent.parent / "assets" / "forms"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def create_phone_form():
    """휴대전화 승낙서 양식 (원본과 동일)"""
    filename = OUTPUT_DIR / "phone_permit_form.pdf"

    c = canvas.Canvas(str(filename), pagesize=A4)
    width, height = A4

    # === 상단: 신청서 ===
    y = height - 30 * mm

    # 제목
    c.setFont(FONT, 14)
    c.drawCentredString(width / 2, y, "교내 휴대전화 소지 신청 및 서약서")

    y -= 25 * mm

    # 학년/반/이름
    c.setFont(FONT, 11)
    c.drawString(130 * mm, y, "제     학년     반     이름 : ")

    y -= 15 * mm

    # ☎ 아이콘과 이유
    c.setFont(FONT, 11)
    c.drawString(40 * mm, y, "☎ 휴대전화를 소지해야 하는 이유")

    y -= 50 * mm

    # 서약 문구
    c.setFont(FONT, 10)
    text_lines = [
        " 위 어린이는 상기와 같은 이유로 휴대전화를 꼭 소지하여야 하기 때문에 보호",
        "자 연서로서 승낙을 희망하며 어린이의 휴대전화 사용으로 발생하는 모든 문제에",
        "학부모로서 책임질 것을 서약합니다."
    ]
    for line in text_lines:
        c.drawString(40 * mm, y, line)
        y -= 6 * mm

    y -= 10 * mm

    # 날짜
    c.setFont(FONT, 11)
    c.drawCentredString(width / 2, y, "20        년        월        일")

    y -= 15 * mm

    # 서명란
    c.drawString(width / 2 + 20 * mm, y, "학  생        (인/사인)")
    y -= 8 * mm
    c.drawString(width / 2 + 20 * mm, y, "보호자        (인/사인)")

    y -= 15 * mm

    # 동성초등학교장 (점선 위)
    c.setFont(FONT, 12)
    c.drawCentredString(width / 2, y, "동성초등학교장")

    # 점선
    y -= 5 * mm
    c.setLineWidth(0.5)
    x_start = 40 * mm
    x_end = width - 40 * mm
    dash_width = 3
    gap_width = 3
    x = x_start
    while x < x_end:
        c.line(x, y, min(x + dash_width, x_end), y)
        x += dash_width + gap_width

    y -= 3 * mm
    c.setFont(FONT, 10)
    c.drawCentredString(width / 2, y, "절              취              선")

    # === 하단: 허가서 (2단 레이아웃) ===
    y -= 20 * mm

    # 왼쪽 박스
    box_left_x = 40 * mm
    box_width = 60 * mm
    box_height = 85 * mm

    c.setLineWidth(1)
    c.rect(box_left_x, y - box_height, box_width, box_height)

    # 왼쪽 박스 내용
    box_y = y - 15 * mm
    c.setFont(FONT, 13)
    c.drawCentredString(box_left_x + box_width/2, box_y, "교내 휴대전화 소지")
    box_y -= 8 * mm
    c.drawCentredString(box_left_x + box_width/2, box_y, "학교장 허가서")

    box_y -= 20 * mm

    # 학교장 확인 박스
    confirm_box_width = 30 * mm
    confirm_box_height = 30 * mm
    confirm_box_x = box_left_x + box_width - confirm_box_width - 5 * mm
    c.rect(confirm_box_x, box_y - confirm_box_height, confirm_box_width, confirm_box_height)
    c.setFont(FONT, 10)
    c.drawCentredString(confirm_box_x + confirm_box_width/2, box_y - 15 * mm, "학교장 확인")

    # 학년/반/이름
    c.setFont(FONT, 10)
    c.drawString(box_left_x + 5 * mm, box_y, "제     학년     반")
    box_y -= 6 * mm
    c.drawString(box_left_x + 5 * mm, box_y, "이름 :")

    box_y -= 40 * mm

    # 허가 문구
    c.setFont(FONT, 9)
    c.drawString(box_left_x + 5 * mm, box_y, "위 어린이의 교내 휴대전화 소지")
    box_y -= 5 * mm
    c.drawString(box_left_x + 5 * mm, box_y, "를 허가합니다.")

    box_y -= 10 * mm
    c.setFont(FONT, 10)
    c.drawCentredString(box_left_x + box_width/2, box_y, "20    년    월    일")

    box_y -= 10 * mm
    c.setFont(FONT, 11)
    c.drawCentredString(box_left_x + box_width/2, box_y, "동성초등학교장")

    # 오른쪽 박스
    box_right_x = box_left_x + box_width + 10 * mm
    box_right_width = 60 * mm

    c.rect(box_right_x, y - box_height, box_right_width, box_height)

    # 오른쪽 박스 내용
    box_y = y - 15 * mm
    c.setFont(FONT, 13)
    c.drawCentredString(box_right_x + box_right_width/2, box_y, "주의사항")

    box_y -= 15 * mm
    c.setFont(FONT, 8)
    notice_lines = [
        "이 허가서는 항상 가지고 다녀야",
        "하며, 학년이 바뀔 때는 이 허가",
        "서를 담임선생님께 확인받고 재발",
        "급을 받아야 합니다. 그리고 다음",
        "사항을 위반할 시 허가를 취소합",
        "니다.",
        "",
        "1.교내와 학교차(학교주차장 포함)",
        "에서는 전원을 끄고 사용하지 않",
        "습니다.",
        "2.친구들에게 보여주지 않습니다."
    ]

    for line in notice_lines:
        c.drawString(box_right_x + 5 * mm, box_y, line)
        box_y -= 5 * mm

    c.save()
    return filename

def create_tablet_form():
    """태블릿PC 승낙서 양식 (원본과 동일)"""
    filename = OUTPUT_DIR / "tablet_permit_form.pdf"

    c = canvas.Canvas(str(filename), pagesize=A4)
    width, height = A4

    # === 상단: 신청서 ===
    y = height - 30 * mm

    # 제목
    c.setFont(FONT, 14)
    c.drawCentredString(width / 2, y, "(교내, 학원) 수업용 태블릿PC 휴대 신청 및 서약서")

    y -= 25 * mm

    # 학년/반/이름
    c.setFont(FONT, 11)
    c.drawString(130 * mm, y, "제     학년     반     이름 : ")

    y -= 15 * mm

    # ☎ 아이콘과 이유
    c.setFont(FONT, 11)
    c.drawString(40 * mm, y, "☎ 수업용 태블릿PC를 소지해야 하는 이유")

    y -= 50 * mm

    # 서약 문구
    c.setFont(FONT, 10)
    text_lines = [
        " 위 어린이는 상기와 같은 이유로 수업용 태블릿PC를 꼭 소지하여야 하기 때문",
        "에 보호자 연서로서 승낙을 희망하며 어린이의 수업용 태블릿PC 사용으로 발생하",
        "는 모든 문제에 학부모로서 책임질 것을 서약합니다."
    ]
    for line in text_lines:
        c.drawString(40 * mm, y, line)
        y -= 6 * mm

    y -= 10 * mm

    # 날짜
    c.setFont(FONT, 11)
    c.drawCentredString(width / 2, y, "20        년        월        일")

    y -= 15 * mm

    # 서명란
    c.drawString(width / 2 + 20 * mm, y, "학  생        (인/사인)")
    y -= 8 * mm
    c.drawString(width / 2 + 20 * mm, y, "보호자        (인/사인)")

    y -= 15 * mm

    # 동성초등학교장 (점선 위)
    c.setFont(FONT, 12)
    c.drawCentredString(width / 2, y, "동성초등학교장")

    # 점선
    y -= 5 * mm
    c.setLineWidth(0.5)
    x_start = 40 * mm
    x_end = width - 40 * mm
    dash_width = 3
    gap_width = 3
    x = x_start
    while x < x_end:
        c.line(x, y, min(x + dash_width, x_end), y)
        x += dash_width + gap_width

    y -= 3 * mm
    c.setFont(FONT, 10)
    c.drawCentredString(width / 2, y, "절              취              선")

    # === 하단: 허가서 (2단 레이아웃) ===
    y -= 20 * mm

    # 왼쪽 박스
    box_left_x = 40 * mm
    box_width = 60 * mm
    box_height = 85 * mm

    c.setLineWidth(1)
    c.rect(box_left_x, y - box_height, box_width, box_height)

    # 왼쪽 박스 내용
    box_y = y - 12 * mm
    c.setFont(FONT, 12)
    c.drawCentredString(box_left_x + box_width/2, box_y, "교내 수업용 태블릿PC")
    box_y -= 8 * mm
    c.drawCentredString(box_left_x + box_width/2, box_y, "소지 담임교사 허가서")

    box_y -= 20 * mm

    # 학교장 확인 박스
    confirm_box_width = 30 * mm
    confirm_box_height = 30 * mm
    confirm_box_x = box_left_x + box_width - confirm_box_width - 5 * mm
    c.rect(confirm_box_x, box_y - confirm_box_height, confirm_box_width, confirm_box_height)
    c.setFont(FONT, 10)
    c.drawCentredString(confirm_box_x + confirm_box_width/2, box_y - 15 * mm, "학교장")

    # 학년/반/이름
    c.setFont(FONT, 10)
    c.drawString(box_left_x + 5 * mm, box_y, "제     학년     반")
    box_y -= 6 * mm
    c.drawString(box_left_x + 5 * mm, box_y, "이름 :")

    box_y -= 40 * mm

    # 허가 문구
    c.setFont(FONT, 9)
    c.drawString(box_left_x + 5 * mm, box_y, "위 어린이의 교내 수업용 태블릿")
    box_y -= 5 * mm
    c.drawString(box_left_x + 5 * mm, box_y, "PC 소지를 허가합니다.")

    box_y -= 10 * mm
    c.setFont(FONT, 10)
    c.drawCentredString(box_left_x + box_width/2, box_y, "20    년    월    일")

    box_y -= 10 * mm
    c.setFont(FONT, 11)
    c.drawCentredString(box_left_x + box_width/2, box_y, "동성초등학교장")

    # 오른쪽 박스
    box_right_x = box_left_x + box_width + 10 * mm
    box_right_width = 60 * mm

    c.rect(box_right_x, y - box_height, box_right_width, box_height)

    # 오른쪽 박스 내용
    box_y = y - 15 * mm
    c.setFont(FONT, 13)
    c.drawCentredString(box_right_x + box_right_width/2, box_y, "주의사항")

    box_y -= 15 * mm
    c.setFont(FONT, 8)
    notice_lines = [
        "이 허가서는 항상 가지고 다녀야",
        "하며, 학년이 바뀔 때는 이 허가",
        "서를 담임선생님께 확인받고 재발",
        "급을 받아야 합니다. 그리고 다음",
        "사항을 위반할 시 허가를 취소합",
        "니다.",
        "",
        "1.교내와 학교차(학교주차장 포함)",
        "에서는 전원을 끄고 사용하지 않",
        "습니다.",
        "2.친구들에게 보여주지 않습니다."
    ]

    for line in notice_lines:
        c.drawString(box_right_x + 5 * mm, box_y, line)
        box_y -= 5 * mm

    c.save()
    return filename

def create_gate_form():
    """정문출입 허가서 양식 (원본과 동일)"""
    filename = OUTPUT_DIR / "gate_permit_form.pdf"

    c = canvas.Canvas(str(filename), pagesize=A4)
    width, height = A4

    # === 상단: 신청서 ===
    y = height - 30 * mm

    # 제목
    c.setFont(FONT, 14)
    c.drawCentredString(width / 2, y, "학교 정문 출입 신청 및 서약서")

    y -= 25 * mm

    # 학년/반/이름
    c.setFont(FONT, 11)
    c.drawString(130 * mm, y, "제     학년     반     이름 : ")

    y -= 15 * mm

    # ♣ 아이콘과 이유
    c.setFont(FONT, 11)
    c.drawString(40 * mm, y, "♣ 정문 출입을 해야 하는 이유 :")

    y -= 20 * mm

    # ♣ 아이콘과 요일/시간
    c.drawString(40 * mm, y, "♣ 정문 출입을 원하는 요일과 시간 :")

    y -= 35 * mm

    # 서약 문구
    c.setFont(FONT, 10)
    text_lines = [
        " 위 어린이는 상기와 같은 이유로 학교 정문 출입을 하기를 보호자 연서로서 승",
        "낙을 희망하며 어린이의 정문 출입으로 발생하는 모든 문제에 학부모로서 책임질",
        "것을 서약합니다."
    ]
    for line in text_lines:
        c.drawString(40 * mm, y, line)
        y -= 6 * mm

    y -= 10 * mm

    # 날짜
    c.setFont(FONT, 11)
    c.drawCentredString(width / 2, y, "2025        년        월        일")

    y -= 15 * mm

    # 서명란
    c.drawString(width / 2 + 20 * mm, y, "학  생        (인/사인)")
    y -= 8 * mm
    c.drawString(width / 2 + 20 * mm, y, "보호자        (인/사인)")

    y -= 15 * mm

    # 동성초등학교장 (점선 위)
    c.setFont(FONT, 12)
    c.drawCentredString(width / 2, y, "동성초등학교장")

    # 점선
    y -= 5 * mm
    c.setLineWidth(0.5)
    x_start = 40 * mm
    x_end = width - 40 * mm
    dash_width = 3
    gap_width = 3
    x = x_start
    while x < x_end:
        c.line(x, y, min(x + dash_width, x_end), y)
        x += dash_width + gap_width

    y -= 3 * mm
    c.setFont(FONT, 10)
    c.drawCentredString(width / 2, y, "절              취              선")

    # === 하단: 허가서 ===
    y -= 20 * mm

    # 학교 로고 박스 (간단히 사각형으로)
    logo_size = 25 * mm
    c.setLineWidth(1)
    c.rect(40 * mm, y - logo_size, logo_size, logo_size)
    c.setFont(FONT, 8)
    c.drawCentredString(40 * mm + logo_size/2, y - logo_size/2, "학교로고")

    # 제목 박스
    title_box_x = 40 * mm + logo_size
    title_box_width = width - 80 * mm - logo_size
    c.rect(title_box_x, y - logo_size, title_box_width, logo_size)
    c.setFont(FONT, 16)
    c.drawCentredString(title_box_x + title_box_width/2, y - logo_size/2, "동성초등학교 정문 출입 허가서")

    y -= logo_size + 15 * mm

    # 학년/반/이름
    c.setFont(FONT, 11)
    c.drawString(60 * mm, y, "(        )학년   (        )반      이름:")

    y -= 12 * mm

    # 허가 문구
    c.setFont(FONT, 11)
    c.drawCentredString(width / 2, y, "위 어린이의 정문 출입을 허가합니다.")

    y -= 18 * mm

    # 표 그리기
    table_x = 50 * mm
    table_width = width - 100 * mm
    col1_width = 40 * mm
    col2_width = table_width - col1_width
    row_height = 12 * mm

    c.setLineWidth(1)

    # 허가사유 행
    c.rect(table_x, y - row_height, col1_width, row_height)
    c.rect(table_x + col1_width, y - row_height, col2_width, row_height)
    c.setFont(FONT, 11)
    c.drawString(table_x + 5 * mm, y - 7 * mm, "허가사유")

    y -= row_height

    # 허가요일(시간) 행
    c.rect(table_x, y - row_height, col1_width, row_height)
    c.rect(table_x + col1_width, y - row_height, col2_width, row_height)
    c.drawString(table_x + 5 * mm, y - 7 * mm, "허가요일")
    c.setFont(FONT, 9)
    c.drawString(table_x + 5 * mm, y - 10 * mm, "(시간)")

    y -= row_height

    # 유효기간 행
    c.setFont(FONT, 11)
    c.rect(table_x, y - row_height, col1_width, row_height)
    c.rect(table_x + col1_width, y - row_height, col2_width, row_height)
    c.drawString(table_x + 5 * mm, y - 7 * mm, "유효기간")
    c.drawString(table_x + col1_width + 5 * mm, y - 7 * mm, "2025. 3. 4 ~  2026. 2.28")

    y -= row_height + 15 * mm

    # 담임선생님
    c.setFont(FONT, 11)
    c.drawString(width - 80 * mm, y, "담임선생님 :          (인)")

    c.save()
    return filename

if __name__ == "__main__":
    phone_file = create_phone_form()
    tablet_file = create_tablet_form()
    gate_file = create_gate_form()

    print("[OK] Phone Form: {}".format(phone_file))
    print("[OK] Tablet Form: {}".format(tablet_file))
    print("[OK] Gate Form: {}".format(gate_file))
    print("\nExact forms created successfully!")
    print("Check here: {}".format(OUTPUT_DIR))

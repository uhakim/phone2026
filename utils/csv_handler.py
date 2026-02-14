import csv
import io
from typing import List, Dict, Tuple

HEADER_ALIASES = {
    "학번": "student_id",
    "student_id": "student_id",
    "이름": "name",
    "name": "name",
    "학년": "grade",
    "grade": "grade",
    "반": "class_num",
    "class": "class_num",
    "class_num": "class_num",
}


def _normalize_header(value: str) -> str:
    return (value or "").strip().lower().replace(" ", "").replace("\ufeff", "")


def _is_header_row(row_values: List[str]) -> bool:
    normalized = [_normalize_header(v) for v in row_values[:4]]
    mapped = [HEADER_ALIASES.get(v) for v in normalized]
    return mapped == ["student_id", "name", "grade", "class_num"]


def parse_student_csv(file_content: bytes) -> Tuple[List[Dict], List[str]]:
    """
    CSV 파일 파싱
    형식: 학번, 이름, 학년, 반

    Returns:
        (학생 데이터 리스트, 에러 메시지 리스트)
    """
    errors = []
    students = []

    try:
        # 인코딩 시도
        text = file_content.decode('utf-8')
    except UnicodeDecodeError:
        try:
            text = file_content.decode('cp949')
        except UnicodeDecodeError:
            text = file_content.decode('euc-kr')

    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        return [], []

    start_idx = 0
    if _is_header_row(rows[0]):
        start_idx = 1

    seen_ids = set()

    for idx, row in enumerate(rows[start_idx:], start=start_idx):
        row_num = idx + 1
        try:
            if not row or all(not str(v).strip() for v in row):
                continue

            values = [str(v).strip() for v in row]
            if _is_header_row(values):
                # 중간에 헤더 행이 섞여 있어도 무시
                continue

            if len(values) < 4:
                errors.append(f"행 {row_num}: 열 개수가 부족합니다(최소 4열 필요)")
                continue

            student_id, name, grade_text, class_text = values[:4]
            grade = int(grade_text)
            class_num = int(class_text)

            # 검증
            if not student_id or not name:
                errors.append(f"행 {row_num}: 학번 또는 이름이 비어있습니다")
                continue

            if grade < 1 or grade > 6:
                errors.append(f"행 {row_num}: 학년은 1~6 사이여야 합니다")
                continue

            if class_num < 1 or class_num > 10:
                errors.append(f"행 {row_num}: 반은 1~10 사이여야 합니다")
                continue

            if student_id in seen_ids:
                errors.append(f"행 {row_num}: 중복된 학번입니다")
                continue

            seen_ids.add(student_id)

            students.append({
                'student_id': student_id,
                'name': name,
                'grade': grade,
                'class_num': class_num
            })

        except ValueError as e:
            errors.append(f"행 {row_num}: 숫자 변환 오류 - {e}")
        except Exception as e:
            errors.append(f"행 {row_num}: 오류 - {e}")

    return students, errors

def validate_csv_format(file_content: bytes) -> Tuple[bool, str]:
    """CSV 파일 형식 검증"""
    try:
        students, errors = parse_student_csv(file_content)

        if not students:
            if errors:
                return False, f"파싱 오류가 있습니다:\n" + "\n".join(errors[:5])
            else:
                return False, "파일에 데이터가 없습니다"

        if errors:
            return False, f"일부 행에 오류가 있습니다:\n" + "\n".join(errors[:5])

        return True, f"✓ {len(students)}명의 학생 데이터 검증됨"

    except Exception as e:
        return False, f"파일 처리 오류: {e}"

from database.db_manager import execute_query, execute_insert, execute_delete, execute_update
from typing import List, Dict

def add_students(students: List[Dict]) -> int:
    """
    학생 여러 명 추가

    Returns:
        추가된 학생 수
    """
    count = 0

    for student in students:
        try:
            query = """
            INSERT OR REPLACE INTO students (student_id, name, grade, class_num)
            VALUES (?, ?, ?, ?)
            """
            execute_insert(
                query,
                (
                    student['student_id'],
                    student['name'],
                    student['grade'],
                    student['class_num']
                )
            )
            count += 1
        except Exception as e:
            print(f"학생 추가 오류: {e}")
            continue

    return count

def add_student(student_id: str, name: str, grade: int, class_num: int) -> int:
    """학생 개별 추가"""
    query = """
    INSERT INTO students (student_id, name, grade, class_num)
    VALUES (?, ?, ?, ?)
    """
    return execute_insert(query, (student_id, name, grade, class_num))

def get_all_students() -> List[Dict]:
    """모든 학생 조회"""
    query = "SELECT * FROM students ORDER BY grade, class_num, name"
    results = execute_query(query)
    return [dict(row) for row in results]

def get_student(student_id: str) -> Dict:
    """학생 조회"""
    query = """
    SELECT * FROM students
    WHERE student_id = ?
    """
    result = execute_query(query, (student_id,))
    return dict(result[0]) if result else None

def update_student(student_id: str, name: str, grade: int, class_num: int) -> int:
    """학생 정보 수정"""
    query = """
    UPDATE students
    SET name = ?, grade = ?, class_num = ?
    WHERE student_id = ?
    """
    return execute_update(query, (name, grade, class_num, student_id))

def delete_student(student_id: str) -> int:
    """학생 삭제"""
    query = "DELETE FROM students WHERE student_id = ?"
    return execute_delete(query, (student_id,))

def get_students_by_grade(grade: int) -> List[Dict]:
    """학년별 학생 조회"""
    query = """
    SELECT * FROM students
    WHERE grade = ?
    ORDER BY class_num, name
    """
    results = execute_query(query, (grade,))
    return [dict(row) for row in results]

def get_students_by_class(grade: int, class_num: int) -> List[Dict]:
    """반별 학생 조회"""
    query = """
    SELECT * FROM students
    WHERE grade = ? AND class_num = ?
    ORDER BY name
    """
    results = execute_query(query, (grade, class_num))
    return [dict(row) for row in results]

def get_total_student_count() -> int:
    """전체 학생 수"""
    query = "SELECT COUNT(*) as count FROM students"
    result = execute_query(query)
    return result[0]['count'] if result else 0

def clear_all_students() -> int:
    """모든 학생 삭제"""
    query = "DELETE FROM students"
    return execute_delete(query, ())


def clear_all_students_and_applications() -> tuple[int, int]:
    """모든 학생 및 신청서 삭제"""
    deleted_applications = execute_delete("DELETE FROM applications", ())
    deleted_students = execute_delete("DELETE FROM students", ())
    return deleted_students, deleted_applications

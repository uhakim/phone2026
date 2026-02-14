import sqlite3
import os
from pathlib import Path
from config.settings import SCHOOL_YEAR

DB_PATH = Path(__file__).parent.parent / "data" / "database.db"

def get_db_connection():
    """데이터베이스 연결 반환"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    """데이터베이스 초기화"""
    schema_path = Path(__file__).parent / "schema.sql"

    # data 디렉토리 생성
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # schema.sql 파일 읽고 실행
        with open(schema_path, 'r', encoding='utf-8') as f:
            schema = f.read()
            cursor.executescript(schema)

        # 기본 설정 초기화
        cursor.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            ("phone_approval_mode", "manual")
        )
        cursor.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            ("tablet_approval_mode", "manual")
        )
        cursor.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            ("gate_approval_mode", "manual")
        )
        cursor.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            ("principal_stamp_path", "")
        )
        cursor.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            ("academic_year", str(SCHOOL_YEAR))
        )
        cursor.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            ("academic_year_start", f"{SCHOOL_YEAR}-03-01")
        )

        conn.commit()
        print(f"[OK] Database initialized successfully at {DB_PATH}")
    except Exception as e:
        print(f"[ERROR] Database initialization error: {e}")
        conn.rollback()
    finally:
        conn.close()

def close_all_connections():
    """모든 데이터베이스 연결 종료"""
    pass

def execute_query(query, params=None):
    """단순 쿼리 실행 (SELECT)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        return cursor.fetchall()
    finally:
        conn.close()

def execute_insert(query, params):
    """INSERT 쿼리 실행"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(query, params)
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()

def execute_update(query, params):
    """UPDATE 쿼리 실행"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(query, params)
        conn.commit()
        return cursor.rowcount
    finally:
        conn.close()

def execute_delete(query, params):
    """DELETE 쿼리 실행"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(query, params)
        conn.commit()
        return cursor.rowcount
    finally:
        conn.close()

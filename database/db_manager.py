import os
from urllib.parse import parse_qs, urlparse

import psycopg
from psycopg import OperationalError
from psycopg.rows import dict_row

from config.settings import SCHOOL_YEAR


def _get_database_url() -> str:
    db_url = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL")
    if db_url:
        return db_url

    try:
        import streamlit as st

        db_url = st.secrets.get("SUPABASE_DB_URL") or st.secrets.get("DATABASE_URL")
        if db_url:
            return db_url
    except Exception:
        pass

    raise RuntimeError(
        "Database URL not found. Set SUPABASE_DB_URL (or DATABASE_URL) in environment or Streamlit secrets."
    )


def _validate_database_url(db_url: str):
    if "<" in db_url or ">" in db_url:
        raise RuntimeError("SUPABASE_DB_URL still contains placeholders like <DB_PASSWORD>.")

    parsed = urlparse(db_url)
    if parsed.scheme not in ("postgresql", "postgres"):
        raise RuntimeError("SUPABASE_DB_URL must start with postgresql://")

    if not parsed.hostname:
        raise RuntimeError("SUPABASE_DB_URL is missing host.")
    if not parsed.username:
        raise RuntimeError("SUPABASE_DB_URL is missing username.")
    if not parsed.path or parsed.path == "/":
        raise RuntimeError("SUPABASE_DB_URL is missing database name (usually /postgres).")

    query = parse_qs(parsed.query)
    if parsed.hostname.endswith("supabase.co") and query.get("sslmode", [None])[0] != "require":
        raise RuntimeError("SUPABASE_DB_URL must include sslmode=require for Supabase.")

    # Supabase transaction pooler commonly uses port 6543 and user like postgres.<project_ref>.
    if parsed.port == 6543 and "." not in parsed.username:
        raise RuntimeError(
            "Pooler URL detected (port 6543). Use pooler username format like postgres.<project_ref>."
        )


def _normalize_query(query: str) -> str:
    # Keep existing sqlite-style placeholders working with psycopg.
    return query.replace("?", "%s")


def get_db_connection():
    db_url = _get_database_url()
    _validate_database_url(db_url)

    try:
        return psycopg.connect(
            db_url,
            row_factory=dict_row,
            connect_timeout=10,
        )
    except OperationalError as e:
        parsed = urlparse(db_url)
        raise RuntimeError(
            f"Failed to connect to Postgres ({parsed.hostname}:{parsed.port or 5432}, user={parsed.username}). "
            "Check SUPABASE_DB_URL host/port/user/password and sslmode=require."
        ) from e


def init_database():
    """Initialize phone2026 schema/tables/settings in Postgres."""
    create_sql = """
    CREATE SCHEMA IF NOT EXISTS phone2026;

    CREATE TABLE IF NOT EXISTS phone2026.students (
        id BIGSERIAL PRIMARY KEY,
        student_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        grade INTEGER NOT NULL,
        class_num INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS phone2026.applications (
        id BIGSERIAL PRIMARY KEY,
        student_id TEXT NOT NULL,
        application_type TEXT NOT NULL,
        reason TEXT NOT NULL,
        extra_info TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        approval_number TEXT,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        approved_at TIMESTAMPTZ,
        approved_by TEXT,
        rejection_reason TEXT,
        CONSTRAINT applications_student_fk
            FOREIGN KEY (student_id) REFERENCES phone2026.students(student_id),
        CONSTRAINT applications_unique_student_type UNIQUE (student_id, application_type)
    );

    CREATE TABLE IF NOT EXISTS phone2026.settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS phone2026.documents (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT NOT NULL,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS phone2026.activity_logs (
        id BIGSERIAL PRIMARY KEY,
        user_type TEXT NOT NULL,
        user_id TEXT,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id BIGINT,
        details TEXT,
        ip_address TEXT,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_student_id ON phone2026.applications(student_id);
    CREATE INDEX IF NOT EXISTS idx_status ON phone2026.applications(status);
    CREATE INDEX IF NOT EXISTS idx_application_type ON phone2026.applications(application_type);
    CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON phone2026.activity_logs(timestamp);
    """

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SET search_path TO phone2026,public")
            cursor.execute(create_sql)
            cursor.execute(
                """
                INSERT INTO phone2026.settings (key, value) VALUES
                    ('phone_approval_mode', 'manual'),
                    ('tablet_approval_mode', 'manual'),
                    ('gate_approval_mode', 'manual'),
                    ('principal_stamp_path', ''),
                    ('academic_year', %s),
                    ('academic_year_start', %s)
                ON CONFLICT (key) DO NOTHING
                """,
                (str(SCHOOL_YEAR), f"{SCHOOL_YEAR}-03-01"),
            )


def close_all_connections():
    pass


def execute_query(query, params=None):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SET search_path TO phone2026,public")
            cursor.execute(_normalize_query(query), params if params is not None else ())
            return cursor.fetchall()


def execute_insert(query, params):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SET search_path TO phone2026,public")
            cursor.execute(_normalize_query(query), params)
            return cursor.rowcount


def execute_update(query, params):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SET search_path TO phone2026,public")
            cursor.execute(_normalize_query(query), params)
            return cursor.rowcount


def execute_delete(query, params):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SET search_path TO phone2026,public")
            cursor.execute(_normalize_query(query), params)
            return cursor.rowcount

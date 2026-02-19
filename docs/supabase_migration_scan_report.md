# Supabase Migration Safety Scan (phone2026)

Date: 2026-02-19  
Workspace: `c:\Users\win\Desktop\2026_phone`

## 1) Scan method
- Searched all code for DB/storage touch points (`sqlite3`, `database.db`, `INSERT/UPDATE/DELETE`, `file_uploader`, `data/uploads`).
- Read DB core files and service/page handlers.
- Classified paths into:
  - `Do not touch` (existing Supabase app risk zone)
  - `Safe to add` (new schema/tables only)

## 2) Current app DB profile (local repo)
- This repo is currently **SQLite-only**.
- Main DB file path: `database/db_manager.py:6` -> `data/database.db`
- DB init on app boot: `app.py:19` -> `init_database()`
- Schema file: `database/schema.sql`

Tables found in `database/schema.sql`:
- `students`
- `applications`
- `settings`
- `documents`
- `activity_logs`

## 3) Write-path inventory (must be migrated)
- `services/student_service.py:16` `INSERT OR REPLACE INTO students`
- `services/student_service.py:69` `DELETE FROM students WHERE ...`
- `services/student_service.py:100` `DELETE FROM students` (full delete)
- `services/student_service.py:106` `DELETE FROM applications` (full delete)
- `services/student_service.py:107` `DELETE FROM students` (full delete)
- `services/application_service.py:25` `INSERT INTO applications`
- `services/application_service.py:72` `DELETE FROM applications WHERE ...`
- `services/approval_service.py:19` `UPDATE applications ... status='approved'`
- `services/approval_service.py:40` `UPDATE applications ... status='rejected'`
- `services/approval_service.py:53` `UPDATE applications ... status='auto_approved'`
- `pages/3_관리_페이지.py:38` `INSERT OR REPLACE INTO settings`

## 4) Local file persistence risk points (sleep/restart sensitive)
- `database/db_manager.py:6` local SQLite file (`data/database.db`)
- `pages/3_관리_페이지.py:56` principal stamp saved to `data/uploads`
- `pages/3_관리_페이지.py:213` CSV upload handled in-memory (safe if immediately persisted)
- `pages/3_관리_페이지.py:328` stamp image upload (currently persisted to local filesystem)
- `config/settings.py:32` `UPLOAD_FOLDER = "data/uploads"`

## 5) Safety boundary for existing Supabase project
Recommended hard rule:
- **No changes to existing schema/tables/policies/functions.**
- Create only new namespace:
  - Schema: `phone2026`
  - New tables inside `phone2026.*`
  - If student master must be shared, use read-only view or explicit FK contract.

## 6) Read-only audit SQL
Use `docs/supabase_readonly_audit.sql` first.
- This script only runs `SELECT`.
- It inventories schemas, tables, columns, PK/FK, indexes, RLS, policies, triggers, functions, and row counts.

## 7) Next safe execution order
1. Run read-only audit SQL and snapshot result.
2. Confirm shared student key contract (e.g., `student_id`).
3. Create `phone2026` schema and new tables only.
4. Migrate SQLite data into `phone2026` tables.
5. Switch Streamlit DB layer from SQLite to Supabase/Postgres.


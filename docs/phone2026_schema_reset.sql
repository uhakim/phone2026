-- Run this once in Supabase SQL Editor.
-- It resets only phone2026 schema objects to match the current app code.
-- Do NOT run if you already have production data in phone2026 tables.

begin;

create schema if not exists phone2026;

drop table if exists phone2026.applications;
drop table if exists phone2026.activity_logs;
drop table if exists phone2026.documents;
drop table if exists phone2026.settings;
drop table if exists phone2026.students;

create table phone2026.students (
  id bigserial primary key,
  student_id text unique not null,
  name text not null,
  grade integer not null,
  class_num integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table phone2026.applications (
  id bigserial primary key,
  student_id text not null references phone2026.students(student_id),
  application_type text not null,
  reason text not null,
  extra_info text,
  status text not null default 'pending',
  approval_number text,
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text,
  rejection_reason text,
  unique (student_id, application_type)
);

create table phone2026.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table phone2026.documents (
  id bigserial primary key,
  title text not null,
  file_name text not null,
  file_path text not null,
  file_type text not null,
  uploaded_at timestamptz not null default now()
);

create table phone2026.activity_logs (
  id bigserial primary key,
  user_type text not null,
  user_id text,
  action text not null,
  target_type text,
  target_id bigint,
  details text,
  ip_address text,
  timestamp timestamptz not null default now()
);

create index idx_phone2026_app_student on phone2026.applications(student_id);
create index idx_phone2026_app_status on phone2026.applications(status);
create index idx_phone2026_app_type on phone2026.applications(application_type);
create index idx_phone2026_activity_ts on phone2026.activity_logs(timestamp);

insert into phone2026.settings (key, value) values
  ('phone_approval_mode', 'instant_approve'),
  ('tablet_approval_mode', 'instant_approve'),
  ('gate_approval_mode', 'instant_approve'),
  ('phone_approval_delay_minutes', '10'),
  ('tablet_approval_delay_minutes', '10'),
  ('gate_approval_delay_minutes', '10'),
  ('principal_stamp_path', ''),
  ('academic_year', '2026'),
  ('academic_year_start', '2026-03-01')
on conflict (key) do nothing;

commit;

-- phone2026 (web-next) initial schema for a fresh Supabase project
-- Run in Supabase SQL Editor (new project)

begin;

create table if not exists public.students (
  id bigserial primary key,
  student_id text unique not null,
  name text not null,
  grade integer not null,
  class_num integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id bigserial primary key,
  student_id text not null references public.students(student_id),
  application_type text not null,
  reason text not null,
  extra_info text,
  status text not null default 'pending',
  approval_mode text not null default 'manual',
  auto_approve_at timestamptz,
  approved_source text,
  approval_number text,
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text,
  rejection_reason text,
  unique (student_id, application_type)
);

create table if not exists public.approval_policies (
  policy_key text primary key,
  mode text not null default 'manual',
  delay_minutes integer not null default 10,
  updated_at timestamptz not null default now(),
  check (mode in ('manual', 'immediate', 'delayed')),
  check (delay_minutes between 0 and 1440)
);

create table if not exists public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.consent_documents (
  id bigserial primary key,
  consent_type text not null default 'privacy',
  title text not null,
  content text not null,
  version integer not null default 1,
  is_required boolean not null default true,
  is_active boolean not null default true,
  effective_from date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (consent_type, version)
);

create table if not exists public.user_consents (
  id bigserial primary key,
  user_id text not null,
  document_id bigint not null references public.consent_documents(id) on delete cascade,
  agreed_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  unique (user_id, document_id)
);

create index if not exists idx_applications_student_id on public.applications(student_id);
create index if not exists idx_applications_status on public.applications(status);
create index if not exists idx_applications_type on public.applications(application_type);
create index if not exists idx_applications_submitted_at on public.applications(submitted_at desc);
create index if not exists idx_applications_auto_approve_at on public.applications(auto_approve_at);
create index if not exists idx_user_consents_user_id on public.user_consents(user_id);
create index if not exists idx_user_consents_document_id on public.user_consents(document_id);

insert into public.approval_policies (policy_key, mode, delay_minutes)
values
  ('phone', 'manual', 10),
  ('tablet', 'manual', 10),
  ('pass', 'manual', 10)
on conflict (policy_key) do nothing;

insert into public.settings (key, value)
values
  ('academic_year', '2026'),
  ('academic_year_start', '2026-03-01'),
  ('principal_stamp_path', ''),
  ('google_sheet_webapp_url', ''),
  ('gate_sheet_url', '')
on conflict (key) do nothing;

insert into public.consent_documents (consent_type, title, content, version, is_required, is_active, effective_from)
values (
  'privacy',
  '개인정보 수집·이용 동의(필수)',
  E'동성초등학교 출입/기기 허가 신청 서비스 이용을 위해 아래와 같이 개인정보를 수집·이용합니다.\n\n1) 수집 항목\n- 학생 아이디(이메일), 학생 이름, 학년/반, 신청 정보(신청 종류, 사유, 신청/승인/반려 이력)\n\n2) 수집·이용 목적\n- 학부모 본인 확인 및 신청서 접수/처리\n- 승인번호 발급, 허가서(PDF) 발급, 정문 출입 명단 관리\n- 서비스 운영 및 민원 대응\n\n3) 보유·이용 기간\n- 서비스 운영 기간 동안 보관 후, 관련 법령 또는 내부 규정에 따라 파기\n\n4) 동의 거부 권리 및 불이익\n- 귀하는 개인정보 수집·이용 동의를 거부할 권리가 있습니다.\n- 단, 필수 항목 동의 거부 시 본 서비스 신청 기능을 이용할 수 없습니다.',
  1,
  true,
  true,
  '2026-03-01'
)
on conflict (consent_type, version) do nothing;

create or replace function public.approval_prefix_by_type(application_type_value text)
returns text
language plpgsql
as $$
declare
  v text := lower(coalesce(application_type_value, ''));
begin
  if v like '%phone%' or position('휴대' in coalesce(application_type_value, '')) > 0 then
    return 'ds-phone';
  elsif v like '%tablet%' or position('태블' in coalesce(application_type_value, '')) > 0 then
    return 'ds-tablet';
  elsif v like '%pass%' or v like '%gate%' or position('정문' in coalesce(application_type_value, '')) > 0 or position('출입' in coalesce(application_type_value, '')) > 0 then
    return 'ds-pass';
  end if;
  return 'ds-doc';
end;
$$;

create or replace function public.next_approval_number(prefix_value text)
returns text
language plpgsql
as $$
declare
  max_seq integer := 0;
  next_seq integer;
begin
  select coalesce(
    max(
      nullif(regexp_replace(approval_number, ('^' || prefix_value || '-'), ''), '')::integer
    ),
    0
  )
  into max_seq
  from public.applications
  where approval_number ~ ('^' || prefix_value || '-[0-9]+$');

  next_seq := max_seq + 1;
  return prefix_value || '-' || lpad(next_seq::text, 3, '0');
end;
$$;

create or replace function public.resolve_policy_key(application_type_value text)
returns text
language plpgsql
as $$
declare
  v text := lower(coalesce(application_type_value, ''));
begin
  if v like '%phone%' or position('휴대' in coalesce(application_type_value, '')) > 0 then
    return 'phone';
  elsif v like '%tablet%' or position('태블' in coalesce(application_type_value, '')) > 0 then
    return 'tablet';
  elsif v like '%pass%' or v like '%gate%' or position('정문' in coalesce(application_type_value, '')) > 0 or position('출입' in coalesce(application_type_value, '')) > 0 then
    return 'pass';
  end if;
  return 'phone';
end;
$$;

create or replace function public.apply_approval_policy_on_insert()
returns trigger
language plpgsql
as $$
declare
  v_policy_key text;
  v_mode text := 'manual';
  v_delay integer := 10;
  v_prefix text;
begin
  v_policy_key := public.resolve_policy_key(new.application_type);

  select mode, delay_minutes
  into v_mode, v_delay
  from public.approval_policies
  where policy_key = v_policy_key;

  if v_mode = 'immediate' then
    v_prefix := public.approval_prefix_by_type(new.application_type);
    new.status := 'approved';
    new.approval_mode := 'immediate';
    new.approved_source := 'auto';
    new.approved_at := now();
    new.approved_by := 'system:auto';
    new.auto_approve_at := null;
    if new.approval_number is null or btrim(new.approval_number) = '' then
      new.approval_number := public.next_approval_number(v_prefix);
    end if;
    new.rejection_reason := null;
  elsif v_mode = 'delayed' then
    new.status := 'pending';
    new.approval_mode := 'delayed';
    new.approved_source := null;
    new.approved_at := null;
    new.approved_by := null;
    new.approval_number := null;
    new.rejection_reason := null;
    new.auto_approve_at := now() + make_interval(mins => coalesce(v_delay, 10));
  else
    new.status := 'pending';
    new.approval_mode := 'manual';
    new.approved_source := null;
    new.approved_at := null;
    new.approved_by := null;
    new.approval_number := null;
    new.rejection_reason := null;
    new.auto_approve_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_approval_policy_on_insert on public.applications;
create trigger trg_apply_approval_policy_on_insert
before insert on public.applications
for each row
execute function public.apply_approval_policy_on_insert();

create or replace function public.run_auto_approval()
returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
begin
  with target as (
    select id
    from public.applications
    where status = 'pending'
      and approval_mode = 'delayed'
      and auto_approve_at is not null
      and auto_approve_at <= now()
  ),
  patched as (
    update public.applications a
    set status = 'approved',
        approval_number = coalesce(a.approval_number, public.next_approval_number(public.approval_prefix_by_type(a.application_type))),
        approved_at = now(),
        approved_by = 'system:auto',
        approved_source = 'auto',
        rejection_reason = null
    from target t
    where a.id = t.id
    returning a.id
  )
  select count(*) into v_count from patched;

  return v_count;
end;
$$;

commit;

-- Optional test seed
insert into public.students (student_id, name, grade, class_num)
values ('10101@ds.es.kr', 'test-student', 6, 1)
on conflict (student_id) do nothing;

insert into public.applications (student_id, application_type, reason, extra_info, status)
values ('10101@ds.es.kr', '휴대전화', '테스트 신청', null, 'pending')
on conflict (student_id, application_type) do update
set reason = excluded.reason,
    status = 'pending',
    approval_mode = 'manual',
    auto_approve_at = null,
    approved_source = null,
    approval_number = null,
    approved_at = null,
    approved_by = null,
    rejection_reason = null;

insert into public.applications (student_id, application_type, reason, extra_info, status)
values ('10101@ds.es.kr', '태블릿', '태블릿 사용 신청 테스트', null, 'pending')
on conflict (student_id, application_type) do update
set reason = excluded.reason,
    status = 'pending',
    approval_mode = 'manual',
    auto_approve_at = null,
    approved_source = null,
    approval_number = null,
    approved_at = null,
    approved_by = null,
    rejection_reason = null;

-- --------------------------------------------------------------------
-- Policy examples (run manually when needed)
-- 1) 즉시승인: 휴대전화
-- update public.approval_policies set mode = 'immediate' where policy_key = 'phone';
--
-- 2) n분 후 자동승인: 태블릿 5분
-- update public.approval_policies set mode = 'delayed', delay_minutes = 5 where policy_key = 'tablet';
--
-- 3) 수동승인: 정문 출입
-- update public.approval_policies set mode = 'manual' where policy_key = 'pass';
--
-- 4) 수동 실행(크론 없을 때 테스트)
-- select public.run_auto_approval();
--
-- 5) pg_cron 사용 가능 시 1분마다 실행 (선택)
-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'phone2026-auto-approve-every-minute',
--   '* * * * *',
--   $$select public.run_auto_approval();$$
-- );
-- --------------------------------------------------------------------

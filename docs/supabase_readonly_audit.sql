-- Supabase Read-Only Audit for safe integration
-- Purpose: inventory existing project structure without modifying anything.
-- Safety: SELECT statements only.

-- 1) Schemas
select nspname as schema_name
from pg_namespace
where nspname not like 'pg_%'
  and nspname <> 'information_schema'
order by 1;

-- 2) Tables and views
select table_schema, table_name, table_type
from information_schema.tables
where table_schema not in ('pg_catalog', 'information_schema')
order by table_schema, table_name;

-- 3) Columns
select table_schema, table_name, ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema not in ('pg_catalog', 'information_schema')
order by table_schema, table_name, ordinal_position;

-- 4) Primary keys
select
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
where tc.constraint_type = 'PRIMARY KEY'
  and tc.table_schema not in ('pg_catalog', 'information_schema')
order by 1, 2, 3;

-- 5) Foreign keys
select
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema as ref_schema,
  ccu.table_name as ref_table,
  ccu.column_name as ref_column,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema not in ('pg_catalog', 'information_schema')
order by 1, 2, 3;

-- 6) Indexes
select schemaname as table_schema, tablename as table_name, indexname, indexdef
from pg_indexes
where schemaname not in ('pg_catalog', 'information_schema')
order by 1, 2, 3;

-- 7) RLS enabled tables
select schemaname as table_schema, tablename as table_name, rowsecurity as rls_enabled
from pg_tables
where schemaname not in ('pg_catalog', 'information_schema')
order by 1, 2;

-- 8) Policies
select schemaname as table_schema, tablename as table_name, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
order by 1, 2, 3;

-- 9) Triggers
select trigger_schema, event_object_table as table_name, trigger_name, event_manipulation, action_timing, action_statement
from information_schema.triggers
where trigger_schema not in ('pg_catalog', 'information_schema')
order by 1, 2, 3;

-- 10) User-defined functions (non-extension)
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  pg_get_function_result(p.oid) as returns
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname not in ('pg_catalog', 'information_schema')
order by 1, 2;

-- 11) Quick row counts per table (approx from stats)
select
  schemaname as table_schema,
  relname as table_name,
  n_live_tup as approx_rows
from pg_stat_user_tables
order by schemaname, relname;


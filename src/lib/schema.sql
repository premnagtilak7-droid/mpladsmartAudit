-- ============================================================================
-- MPLAD Radar — Production Supabase / PostgreSQL Schema
-- ----------------------------------------------------------------------------
-- Purpose : Live production tables for the MPLAD vigilance & anomaly-audit
--           platform. Safe to run repeatedly (idempotent).
-- Apply   : Supabase Dashboard → SQL Editor → paste & run, OR
--           psql "$SUPABASE_DB_URL" -f src/lib/schema.sql
--
-- Tables  : projects, anomaly_signals, officer_audit_logs, statutory_reports
-- Extras  : purge_audit_tables() RPC (used by /api/admin/reset-db)
--
-- NOTE ON MONEY: all currency columns are NUMERIC. The ingestion pipeline
-- (/api/ingest) strips "₹", spaces and Indian comma-grouping before insert.
-- ============================================================================

begin;

-- Required for gen_random_uuid() on older Postgres images.
create extension if not exists pgcrypto;

-- ============================================================================
-- 1. projects — one row per sanctioned / recommended MoSPI work
-- ============================================================================
create table if not exists public.projects (
    id                uuid primary key default gen_random_uuid(),
    work_id           text unique not null,
    work_title        text,
    category          text,
    district          text,
    state             text,
    constituency      text,
    sanctioned_amount numeric(20, 2),
    spent_amount      numeric(20, 2),
    vendor_name       text,
    status            text,
    risk_score        integer default 0,
    latitude          numeric(10, 7),
    longitude         numeric(10, 7),
    -- General / SC / ST statutory target area
    target_area       text default 'General',
    sanction_date     timestamp,
    completion_date   timestamp,
    created_at        timestamptz not null default now()
);

create index if not exists projects_state_idx          on public.projects (state);
create index if not exists projects_district_idx       on public.projects (district);
create index if not exists projects_constituency_idx   on public.projects (constituency);
create index if not exists projects_vendor_idx         on public.projects (vendor_name);
create index if not exists projects_risk_score_idx     on public.projects (risk_score desc);
create index if not exists projects_target_area_idx    on public.projects (target_area);

-- ============================================================================
-- 2. anomaly_signals — per-project 4-signal risk decomposition
-- ============================================================================
create table if not exists public.anomaly_signals (
    id               uuid primary key default gen_random_uuid(),
    project_id       uuid not null references public.projects (id) on delete cascade,
    rule_score       integer default 0,
    spatial_score    integer default 0,
    nlp_score        integer default 0,
    ml_score         integer default 0,
    total_risk_score integer default 0,
    primary_flag     text,
    flag_details     jsonb default '{}'::jsonb,
    created_at       timestamptz not null default now()
);

create index if not exists anomaly_signals_project_idx on public.anomaly_signals (project_id);
create index if not exists anomaly_signals_total_idx   on public.anomaly_signals (total_risk_score desc);
create index if not exists anomaly_signals_flag_idx    on public.anomaly_signals (primary_flag);

-- ============================================================================
-- 3. officer_audit_logs — APPEND-ONLY governance ledger
--    Rows may be inserted; UPDATE / DELETE are blocked by trigger so the
--    trail is tamper-evident (sha256_hash chains the officer action).
-- ============================================================================
create table if not exists public.officer_audit_logs (
    id           uuid primary key default gen_random_uuid(),
    project_id   uuid references public.projects (id) on delete cascade,
    officer_name text,
    officer_role text,
    action_taken text,
    notes        text,
    sha256_hash  text,
    created_at   timestamptz not null default now()
);

create index if not exists officer_audit_logs_project_idx on public.officer_audit_logs (project_id);
create index if not exists officer_audit_logs_created_idx on public.officer_audit_logs (created_at desc);

-- Enforce append-only semantics for every role except the service role.
create or replace function public.enforce_append_only()
returns trigger
language plpgsql
as $$
begin
    raise exception 'officer_audit_logs is an append-only ledger (blocked %)', tg_op;
end;
$$;

drop trigger if exists officer_audit_logs_append_only on public.officer_audit_logs;
create trigger officer_audit_logs_append_only
    before update or delete on public.officer_audit_logs
    for each row execute function public.enforce_append_only();

-- ============================================================================
-- 4. statutory_reports — SC/ST target compliance snapshots per FY
-- ============================================================================
create table if not exists public.statutory_reports (
    id               uuid primary key default gen_random_uuid(),
    title            text,
    constituency     text,
    financial_year   text,
    sc_target_met    boolean default false,
    st_target_met    boolean default false,
    utilization_rate numeric(6, 2),
    created_at       timestamptz not null default now()
);

create index if not exists statutory_reports_constituency_idx on public.statutory_reports (constituency);
create index if not exists statutory_reports_fy_idx           on public.statutory_reports (financial_year);

-- ============================================================================
-- 5. Row Level Security
--    Read access is granted for the citizen transparency view; all writes go
--    through the service-role key (server-side API routes only), which
--    bypasses RLS.
-- ============================================================================
alter table public.projects          enable row level security;
alter table public.anomaly_signals   enable row level security;
alter table public.officer_audit_logs enable row level security;
alter table public.statutory_reports enable row level security;

-- projects: public read
drop policy if exists "public_read_projects" on public.projects;
create policy "public_read_projects"
    on public.projects for select to anon, authenticated using (true);

-- anomaly_signals: public read
drop policy if exists "public_read_anomaly_signals" on public.anomaly_signals;
create policy "public_read_anomaly_signals"
    on public.anomaly_signals for select to anon, authenticated using (true);

-- officer_audit_logs: authenticated may append; nobody may mutate (trigger).
drop policy if exists "authenticated_insert_audit_logs" on public.officer_audit_logs;
create policy "authenticated_insert_audit_logs"
    on public.officer_audit_logs for insert to authenticated with check (true);

drop policy if exists "public_read_audit_logs" on public.officer_audit_logs;
create policy "public_read_audit_logs"
    on public.officer_audit_logs for select to authenticated using (true);

-- statutory_reports: public read
drop policy if exists "public_read_statutory_reports" on public.statutory_reports;
create policy "public_read_statutory_reports"
    on public.statutory_reports for select to anon, authenticated using (true);

grant usage on schema public to anon, authenticated;
grant select on public.projects, public.anomaly_signals, public.statutory_reports to anon, authenticated;
grant select, insert on public.officer_audit_logs to authenticated;

-- ============================================================================
-- 6. purge_audit_tables() — admin truncation RPC
--    Executed by /api/admin/reset-db. Runs the exact statement:
--      TRUNCATE TABLE officer_audit_logs, anomaly_signals, projects CASCADE;
--    SECURITY DEFINER so the service-role call never needs table ownership.
-- ============================================================================
create or replace function public.purge_audit_tables()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    truncate table
        public.officer_audit_logs,
        public.anomaly_signals,
        public.projects
    cascade;
end;
$$;

revoke all on function public.purge_audit_tables() from public;
revoke all on function public.purge_audit_tables() from anon, authenticated;

-- ============================================================================
-- 7. purge_all_tables() — FULL reset RPC
--    Executed by /api/admin/purge-db. Differs from purge_audit_tables():
--      • covers ALL FOUR tables (adds statutory_reports)
--      • uses RESTART IDENTITY so any serial/identity sequences owned by these
--        tables are reset back to their start value
--    UUID primary keys (gen_random_uuid()) have no sequence to reset; the
--    RESTART IDENTITY clause makes this function equally correct if any table
--    is later migrated to a serial/bigserial key.
-- ============================================================================
create or replace function public.purge_all_tables()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    truncate table
        public.officer_audit_logs,
        public.anomaly_signals,
        public.projects,
        public.statutory_reports
    restart identity
    cascade;
end;
$$;

revoke all on function public.purge_all_tables() from public;
revoke all on function public.purge_all_tables() from anon, authenticated;

commit;

-- ============================================================================
-- Optional: seed a single roll-up statutory report so the table is non-empty
-- on a fresh install. Comment out if you prefer a clean slate.
-- ============================================================================
-- insert into public.statutory_reports
--     (title, constituency, financial_year, sc_target_met, st_target_met, utilization_rate)
-- values
--     ('MPLADS SC/ST Target Compliance — FY 2025-26', 'All Constituencies', '2025-2026', false, false, 0.00);

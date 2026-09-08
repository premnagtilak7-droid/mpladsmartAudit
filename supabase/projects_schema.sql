-- ============================================================================
-- Supabase / PostgreSQL schema for MoSPI expenditure data
-- Source: "Expenditure on Completed and On-going Works as on Date.csv"
-- Generated from the raw CSV header (11 columns, 11,001 rows).
--
-- This script:
--   1. Creates the `projects` table using EXACT raw column names (double-quoted).
--   2. Types the "Fund Disbursed Amount ( ₹ )" column as NUMERIC (currency string
--      is converted at load time, see helper functions below).
--   3. Types the "Expenditure Date" column as DATE (DD-Mon-YYYY, padded/nbsp -> NULL).
--   4. Adds a surrogate PRIMARY KEY for safe upserts (raw CSV has no unique id).
--   5. Enables Row Level Security with a PUBLIC read (SELECT) policy.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Drop any previous version (idempotent re-runs)
-- ----------------------------------------------------------------------------
drop table if exists public.projects;

-- ----------------------------------------------------------------------------
-- 2. Create the table
--    - Every column is double-quoted to preserve the exact CSV header name.
--    - `id` is an auto-increment surrogate PK: the raw file has NO unique column,
--      and some rows may repeat (same Work ID / vendor / amount), so we need a
--      stable key for later upserts and de-duplication.
-- ----------------------------------------------------------------------------
create table public.projects (
    id                                              bigint generated always as identity primary key,

    "Sr. No."                                       integer,
    "State"                                         text,
    "Work"                                          text,
    "Work ID"                                       text,
    "IDA"                                           text,
    "Hon'ble Members of Parliament"                 text,
    "Constituency"                                  text,
    "Expenditure Date"                              date,
    "Vendor Name"                                   text,
    "Payment Status"                                text,
    "Fund Disbursed Amount ( ₹ )"                   numeric(20, 2),

    -- Optional index columns (not in source, handy for analytics). Comment out
    -- if you want a byte-for-byte raw column set.
    created_at                                      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. Useful indexes for the most common query patterns
-- ----------------------------------------------------------------------------
create index projects_state_idx            on public.projects ("State");
create index projects_work_id_idx          on public.projects ("Work ID");
create index projects_expenditure_date_idx on public.projects ("Expenditure Date");
create index projects_constituency_idx     on public.projects ("Constituency");

-- ----------------------------------------------------------------------------
-- 4. Row Level Security — PUBLIC READ
-- ----------------------------------------------------------------------------
alter table public.projects enable row level security;

-- Allows the `anon` (public) and `authenticated` roles to SELECT all rows.
create policy "public_read_projects"
    on public.projects
    for select
    to anon, authenticated
    using (true);

-- Grant access at the schema/table level (Supabase roles).
grant usage          on schema public to anon, authenticated;
grant select         on public.projects to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Helper functions to convert the RAW strings safely
--    These are optional, but they turn the messy source text into clean,
--    queryable values. They are NOT stored columns — you apply them in your
--    INSERT/SELECT or a data-loading script.
-- ----------------------------------------------------------------------------

-- 5a. Currency -> NUMERIC
--     Handles: comma thousands separators (27,91,37,44,688.45),
--              the ₹ symbol, stray spaces, and empty/NULL input.
create or replace function public.parse_fund_amount(t text)
returns numeric
language sql immutable
as $$
    select case
        when t is null or trim(t) = '' or trim(t) = E'\xa0' then null
        else regexp_replace(
                 regexp_replace(trim(t), '₹', '', 'g'),
                 ',', '', 'g'
             )::numeric
    end;
$$;

-- 5b. Date (DD-Mon-YYYY) -> DATE
--     Handles the trailing non-breaking space (E'\xa0') and blank values -> NULL.
create or replace function public.parse_expenditure_date(t text)
returns date
language sql immutable
as $$
    select case
        when t is null or trim(t) = '' or trim(t) = E'\xa0' then null
        else to_date(trim(t), 'DD-Mon-YYYY')
    end;
$$;

-- ----------------------------------------------------------------------------
-- 6. EXAMPLES
-- ----------------------------------------------------------------------------

-- Example: a single raw row (values straight from the CSV) inserted cleanly:
insert into public.projects (
    "Sr. No.",
    "State",
    "Work",
    "Work ID",
    "IDA",
    "Hon'ble Members of Parliament",
    "Constituency",
    "Expenditure Date",
    "Vendor Name",
    "Payment Status",
    "Fund Disbursed Amount ( ₹ )"
) values (
    1,
    'Uttar Pradesh',
    'Construction of roads, link roads, pathways or any other road with or without drainage system',
    'WS/MP18218/2025-2026/233777',
    'GHAZIABAD(DISTRICT MAGISTRAE GHAZIABAD_IDA)',
    'ATUL GARG',
    'GHAZIABAD',
    public.parse_expenditure_date('21-Aug-2026'),
    'DARSH BUILDCON',
    'Payment In-Progress',
    public.parse_fund_amount('799146')
);

-- Example: an Indian-grouped amount with commas + decimal:
select public.parse_fund_amount('27,91,37,44,688.45');  -- -> 27913744688.45

-- Example: SELECT with converted values (if you loaded raw text into text cols):
select
    "State",
    "Constituency",
    public.parse_expenditure_date("Expenditure Date") as expenditure_date,
    public.parse_fund_amount("Fund Disbursed Amount ( ₹ )") as amount
from public.projects;

commit;

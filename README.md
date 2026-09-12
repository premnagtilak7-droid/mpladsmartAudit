# MPLAD Radar (SIH26102)

## Project Overview
- **Name**: MPLAD Radar (SIH26102)
- **Goal**: Production-grade MoSPI/MPLAD vigilance dashboard for monitoring recommended, sanctioned, ongoing, and completed works with AI-backed anomaly audit actions.
- **Core Stack**: Next.js 14, React, TypeScript, Supabase, Recharts, Framer Motion, Leaflet / React Leaflet, Gemini 1.5 Flash API

## Currently Completed Features
1. **Official MoSPI KPI Header (6-card national baseline)**
   - Allocated Limit for Hon'ble MPs — ₹8,333.67 Cr
   - Amount consented for Calamity — ₹4.06 Cr
   - Works Recommended — 107,596 works | ₹5,769.94 Cr
   - Works Sanctioned — 79,932 works | ₹4,210.73 Cr
   - Works Completed — 35,000 works | ₹1,714.11 Cr
   - Scheme Expenditure — ₹2,797.83 Cr
   - Active AI Vigilance Batch banner — 11,005 ingested works, ₹383.74 Cr disbursed, 5 high-risk cases

2. **Dynamic CSV / JSON Import Engine**
   - "Import New MoSPI Dataset" action in top nav next to Refresh
   - Upload modal with drag-drop CSV and JSON paste mode
   - Client-side parsing with PapaParse
   - Auto column mapping (supports legacy raw headers and normalized schema)
   - Auto risk score + anomaly enrichment during import
   - Supabase upsert into `projects` table
   - Downloadable sample template CSV and JSON

3. **AI Audit Integration (Gemini 1.5 Flash)**
   - `/api/audit` uses `gemini-1.5-flash` with `temperature: 0.2`
   - System prompt enforces MoSPI senior vigilance context with:
     - Section 3 (Prohibited Works)
     - Section 4 (SC/ST Mandate)
   - Structured JSON output:
     - `violation_category`
     - `risk_score`
     - `audit_summary` (3 bullets)
     - `recommended_action`

4. **Full Sidebar Tab Navigation (activeTab state switcher)**
   - Audit overview
   - Anomaly queue (dynamic count)
   - Fund intelligence
   - Official notes

5. **Audit Overview Enhancements**
   - 6 official MoSPI national KPI cards + SC/ST compliance widget
   - GIS Map toggle and table toggle
   - Main paginated table with conditional high-risk freeze actions

6. **Dual Public / Authority Portal Architecture**
   - Header role switcher for Central Auditor, Public Citizen, and MP & District Authority views
   - English, Hindi, and Marathi UI language selector wired to portal and central labels
   - Theme toggle with CSS variables for dark command-center and light accessibility modes
   - Citizen near-me Leaflet/OpenStreetMap + CARTO dark tile map, live project markers, browser location activation, asset detail drawer, public QR verification, feedback form, satisfaction rating, and open-data CSV/PDF export controls
   - Authority pre-submission AI validator routed through `/api/audit`, with synthetic prohibited-asset and threshold warnings
   - Authority recommendation pipeline, entitlement/tranche tracker, constituency report card print modal, and field-proof upload drawer

7. **Anomaly Queue (risk_score >= 80)**
   - High-risk-only queue
   - Row quick actions:
     - Freeze Disbursement
     - Generate DM Memo PDF
     - Inspect AI Evidence

8. **Fund Intelligence**
   - State-wise analytics table
   - Bar chart by state disbursement
   - State + constituency filters
   - Includes total works, disbursed amount, SC/ST compliance %, flagged count

9. **Official Notes**
   - Timeline log for disbursement locks, imports, and legal memo exports

10. **Pagination + Controls**
   - **50 records per page**
   - Previous/Next controls
   - Footer: `Page X of Y (N records)`

11. **Freeze + Memo Workflow**
   - Freeze action marks records as:
     - **DISBURSEMENT LOCKED BY AUDITOR**
   - AI inspection drawer supports **Export DM Legal Memo**
   - Printable legal memo modal available (Print / Save PDF)

## Functional Entry URIs (Paths & Parameters)
- `/`
  Main MPLAD Radar dashboard UI. Use the header role switcher for the three portal modes.
- `/?portal=citizen`
  Opens the Public Citizen Portal directly.
- `/?portal=authority`
  Opens the MP & District Authority Workspace directly.
- `/?portal=citizen&verify=<work-id>`
  Opens public verification details for a matching work ID or project ID.

### Admin & ingestion APIs
- `/api/admin/purge-db` (POST)
  Complete reset: deletes all rows from `projects`, `anomaly_signals`, `officer_audit_logs`
  and `statutory_reports`, and resets identity sequences
  (`TRUNCATE ... RESTART IDENTITY CASCADE`).
  Responds `{ success: true, message: "All database tables successfully purged. 0 records remaining." }`.
  Requires the `x-admin-token` header. Fails **closed** (503) when `ADMIN_API_TOKEN` is unset.
- `/api/ingest-mospi` (POST) — dual-mode MoSPI ingestion
  - **Mode A** `multipart/form-data` with a `file` part containing the official CSV export
    (columns: `work_id, work_title, category, district, state, constituency, sanctioned_amount,
    spent_amount, vendor_name, status, latitude, longitude, target_area, sanction_date`).
  - **Mode B** `application/json` with a raw records array (e-SAKSHI / MoSPI endpoint payload),
    or `{ records: [...] }`.
  - Add `?stream=1` (or `Accept: application/x-ndjson`) for newline-delimited progress events
    (`parsed` → `batch` → `summary`) that drive the UI progress bar.
  - Computes Rule / Spatial-overlap / Peer-cost-IQR scores on insert and bulk-writes both
    `projects` and `anomaly_signals`.
- `/api/ingest` (POST) — legacy ingestion route (parse + 4-signal scoring)
- `/api/admin/reset-db` (POST) — legacy purge route (`TRUNCATE ... CASCADE`)

- `/api/audit` (POST)  
  Request body:
  ```json
  {
    "project": {
      "id": 1,
      "work": "...",
      "work_id": "...",
      "state": "...",
      "constituency": "...",
      "vendor_name": "...",
      "payment_status": "...",
      "amount": 100000,
      "risk_score": 82,
      "anomaly_type": "Split Tendering"
    }
  }
  ```
  Response body:
  ```json
  {
    "violation_category": "Split Tendering",
    "risk_score": 84,
    "audit_summary": ["...", "...", "..."],
    "recommended_action": "Issue Section 3 Show-Cause Notice & Freeze Account",
    "generated_at": "2026-09-09T00:00:00.000Z"
  }
  ```

## Data Architecture
- **Primary tables** (see `src/lib/schema.sql`):
  - `projects` — one row per sanctioned MoSPI work (uuid PK, `work_id` unique)
  - `anomaly_signals` — per-project 4-signal risk decomposition (FK → `projects.id`)
  - `officer_audit_logs` — append-only governance ledger (SHA-256 chained)
  - `statutory_reports` — SC/ST target compliance snapshots per financial year
- **Admin RPCs**:
  - `purge_audit_tables()` — truncates the three core tables
  - `purge_all_tables()` — truncates all four + `RESTART IDENTITY`
- **Supported schemas**:
  - normalized (`work_id`, `state`, `amount`, etc.)
  - legacy raw headers (`Work ID`, `State`, `Fund Disbursed Amount ( ₹ )`, etc.)
- **Derived fields**:
  - `risk_score`, `anomaly_type`, `risk_drivers`
  - workflow fields (`approval_status`, `completion_percent`)

### Anomaly scoring engine (`src/lib/mospiScoring.ts`)
Each ingested work receives a 0-100 composite from four engines
(rule 0.30 · spatial 0.25 · nlp 0.20 · ml 0.25):

| Signal | Method |
|---|---|
| `rule_score` | Prohibited-item keywords, split tendering, stalled status, data-integrity faults |
| `spatial_score` | Works sharing the same ~110 m lat/lng grid cell |
| `nlp_score` | Jaccard token similarity of work titles within a district |
| `ml_score` | Tukey IQR / median-ratio peer-cost deviation within a category |

**Escalation rule:** because a weighted *average* caps a single engine at its own
weight, a lone critical finding (score ≥ 75) sets a floor of
`severity × 0.9` so hard statutory breaches still reach the ≥80 scrutiny
threshold. `primary_flag` names the dominant anomaly.

## User Guide (Quick)
1. Open dashboard `/` and choose a role from the top switcher.
2. Central Auditor: review official KPIs, anomalies, state intelligence, and notes.
3. Open **Data Ingestion & Audit** in the sidebar and paste the officer
   `ADMIN_API_TOKEN` to unlock privileged actions:
   - **Panel 1 — Database Control & Hard Reset**: *Purge All Database Records*
     empties all four tables, resets sequences and clears the local cache.
   - **Panel 2 — MoSPI Official Dataset Importer**: drag-and-drop the official CSV
     and press *Ingest Dataset*; the progress bar streams live batch writes.
4. Public Citizen: search/inspect nearby works, open a QR verification card, submit Gram Sabha feedback, or download open data.
5. MP & District Authority: enter a proposal and run the Gemini-backed pre-submission validator; use the report card, tranche tracker, and field-proof drawer.
6. Change `EN`, `हिन्दी`, or `मराठी` to update portal headings and labels.
7. All portal views read the live Supabase `projects` dataset; the authority validator posts proposal context to `/api/audit`.

## Features Not Yet Implemented
- Persistent citizen feedback, QR registry, tranche proof, and official notes tables
- Persistent latitude/longitude enrichment for rows that do not yet contain coordinates (the Leaflet map uses deterministic India-region fallback coordinates until source GPS columns are populated)
- Automated server-side PDF file persistence/export pipeline (current exports use browser CSV download and print workflows)
- Consolidation of the legacy `/api/ingest` and `/api/admin/reset-db` routes into the newer `/api/ingest-mospi` and `/api/admin/purge-db` pipelines

## Recommended Next Steps
1. Apply `src/lib/schema.sql` in the Supabase SQL editor to install the four tables and both purge RPCs
2. Add true geocoding pipeline to map exact work coordinates
3. Add scheduled integrity checks for duplicate works and split-tender detection
4. Persist `officer_audit_logs` rows from the dashboard's governance ledger
5. Add automated tests around the MoSPI scoring engine (a smoke suite exists at `scripts/score-smoke.test.ts`)

## Deployment Status
- **Platform**: Next.js app (current local sandbox build)
- **Status**: ✅ Build verified locally
- **Build Command**: `npm run build`
- **Last Updated**: 2026-09-12
- **Portal modes**: Central Auditor, Public Citizen, MP & District Authority
- **Languages**: English, Hindi, Marathi

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL` (server-side; falls back to `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only — required for purge & ingestion)
- `ADMIN_API_TOKEN` (server-only — guards privileged admin routes; routes fail closed when unset)
- `GEMINI_API_KEY` (required for production Gemini audit responses)


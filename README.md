# MPLAD Radar (SIH26102)

## Project Overview
- **Name**: MPLAD Radar (SIH26102)
- **Goal**: Production-grade MoSPI/MPLAD vigilance dashboard for monitoring recommended, sanctioned, ongoing, and completed works with AI-backed anomaly audit actions.
- **Core Stack**: Next.js 14, React, TypeScript, Supabase, Recharts, Framer Motion, Gemini 1.5 Flash API

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
   - English, Hindi, and Marathi UI language selector
   - Citizen near-me asset map, completed/in-progress markers, asset detail drawer, public QR verification, feedback form, satisfaction rating, and open-data CSV/PDF export controls
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
- **Primary table**: `projects` (Supabase/Postgres)
- **Supported schemas**:
  - normalized (`work_id`, `state`, `amount`, etc.)
  - legacy raw headers (`Work ID`, `State`, `Fund Disbursed Amount ( ₹ )`, etc.)
- **Derived fields**:
  - `risk_score`
  - `anomaly_type`
  - `risk_drivers`
  - workflow fields (`approval_status`, `completion_percent`)

## User Guide (Quick)
1. Open dashboard `/` and choose a role from the top switcher.
2. Central Auditor: review official KPIs, anomalies, state intelligence, and notes.
3. Public Citizen: search/inspect nearby works, open a QR verification card, submit Gram Sabha feedback, or download open data.
4. MP & District Authority: enter a proposal and run the Gemini-backed pre-submission validator; use the report card, tranche tracker, and field-proof drawer.
5. Change `EN`, `हिन्दी`, or `मराठी` to update portal headings and labels.
6. All portal views read the live Supabase `projects` dataset; the authority validator posts proposal context to `/api/audit`.

## Features Not Yet Implemented
- Server-side authenticated import, feedback, and field-proof endpoints with service-role key isolation
- Persistent citizen feedback, QR registry, tranche proof, and official notes tables
- Real latitude/longitude geospatial rendering (current portal map uses live records with deterministic visual placement and browser geolocation status)
- Automated server-side PDF file persistence/export pipeline (current exports use browser CSV download and print workflows)

## Recommended Next Steps
1. Add secure backend ingestion API with schema validation and signed import batches
2. Add database tables for `audit_logs`, `freeze_orders`, `memo_exports`
3. Add true geocoding pipeline to map exact work coordinates
4. Add role-based access control and immutable audit trail signatures
5. Add scheduled integrity checks for duplicate works and split-tender detection

## Deployment Status
- **Platform**: Next.js app (current local sandbox build)
- **Status**: ✅ Build verified locally
- **Build Command**: `npm run build`
- **Last Updated**: 2026-09-09
- **Portal modes**: Central Auditor, Public Citizen, MP & District Authority
- **Languages**: English, Hindi, Marathi

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY` (required for production Gemini audit responses)

# MPLAD Radar (SIH26102)

## Project Overview
- **Name**: MPLAD Radar (SIH26102)
- **Goal**: Production-grade MoSPI/MPLAD vigilance dashboard for monitoring recommended, sanctioned, ongoing, and completed works with AI-backed anomaly audit actions.
- **Core Stack**: Next.js 14, React, TypeScript, Supabase, Recharts, Framer Motion, Gemini 1.5 Flash API

## Currently Completed Features
1. **Official MoSPI KPI Header (5-card status structure)**
   - Works Recommended (count + value)
   - Works Sanctioned (status != Pending)
   - Works Ongoing (In-Progress / Ongoing)
   - Works Completed (Completed / Payment Success)
   - Expenditure Disbursed (total disbursed value)
   - Top policy banner: **Official MoSPI Scheme Expenditure Baseline: ₹2,797.83 Cr (National Coverage)**

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
   - 5 KPI cards + SC/ST compliance widget
   - GIS Map toggle and table toggle
   - Main paginated table with row-level actions

6. **Anomaly Queue (risk_score >= 80)**
   - High-risk-only queue
   - Row quick actions:
     - Freeze Disbursement
     - Generate DM Memo PDF
     - Inspect AI Evidence

7. **Fund Intelligence**
   - State-wise analytics table
   - Bar chart by state disbursement
   - State + constituency filters
   - Includes total works, disbursed amount, SC/ST compliance %, flagged count

8. **Official Notes**
   - Timeline log for disbursement locks, imports, and legal memo exports

9. **Pagination + Controls**
   - **50 records per page**
   - Previous/Next controls
   - Footer: `Page X of Y (N records)`

10. **Freeze + Memo Workflow**
   - Freeze action marks records as:
     - **DISBURSEMENT LOCKED BY AUDITOR**
   - AI inspection drawer supports **Export DM Legal Memo**
   - Printable legal memo modal available (Print / Save PDF)

## Functional Entry URIs (Paths & Parameters)
- `/`  
  Main MPLAD Radar dashboard UI.

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
1. Open dashboard `/`
2. Click **Refresh data** to reload current Supabase projects
3. Click **Import New MoSPI Dataset** to upload CSV or paste JSON
4. Review top 5 MoSPI status cards
5. Use **Anomaly queue** for high-risk records
6. Open **Inspect AI Evidence** on any record
7. Run **Freeze Disbursement** and **Export DM Legal Memo** when escalation is required
8. Use **Fund intelligence** tab for state/constituency-level planning

## Features Not Yet Implemented
- Server-side authenticated import endpoint with service-role key isolation (current import is client-driven and depends on Supabase permissions)
- Persistent official notes storage in database (currently session-side UI logs)
- Real GIS coordinates from source data (current map plotting is visual cluster simulation)
- Automated PDF file persistence/export pipeline (current legal memo is printable modal workflow)

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

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY` (required for production Gemini audit responses)

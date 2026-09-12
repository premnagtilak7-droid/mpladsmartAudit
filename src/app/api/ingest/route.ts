import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_CHUNK_SIZE,
  MAX_INGEST_ROWS,
  REQUIRED_FIELDS,
  buildIngestPayload,
  chunk,
  parseDataset,
  validateColumns,
  type RawRecord,
} from '@/lib/ingest';
import { ADMIN_TOKEN_HEADER, assertOfficer, getAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Reject oversized uploads early (defensive; the CSV MoSPI export is ~11k rows).
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * POST /api/ingest
 *
 * Bulk MoSPI dataset ingestion pipeline.
 *
 * Accepts EITHER:
 *   • multipart/form-data with one or more `file` / `files` parts (CSV or JSON)
 *   • application/json body: { records: [...] } | [...]
 *
 * Pipeline:
 *   1. Authorize the officer (admin token).
 *   2. Parse CSV/JSON -> raw records.
 *   3. Validate required columns exist.
 *   4. Normalise + compute the 4-signal anomaly risk score per row.
 *   5. Upsert rows into `projects`, then bulk insert into `anomaly_signals`.
 *
 * Response includes per-step counts plus skipped-row diagnostics.
 */
export async function POST(req: NextRequest) {
  // ---- 1. Authorize -------------------------------------------------------
  const auth = assertOfficer(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Server is missing SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL). Configure it to enable ingestion.',
      },
      { status: 503 },
    );
  }

  // ---- 2. Parse the request body into raw records -------------------------
  let records: RawRecord[] = [];
  let format: 'csv' | 'json' = 'csv';
  const sources: string[] = [];

  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const parts = [...form.getAll('file'), ...form.getAll('files'), ...form.getAll('dataset')];
      const files = parts.filter((part): part is File => typeof part === 'object' && part !== null && 'text' in part);

      if (files.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'No file part found. Attach a CSV or JSON under the "file" field.' },
          { status: 400 },
        );
      }

      for (const file of files) {
        if (file.size > MAX_UPLOAD_BYTES) {
          return NextResponse.json(
            {
              ok: false,
              error: `File "${file.name}" exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit.`,
            },
            { status: 413 },
          );
        }
        const text = await file.text();
        const parsed = parseDataset(text, file.name);
        records = records.concat(parsed.records);
        format = parsed.format;
        sources.push(file.name || 'upload');
      }
    } else if (
      contentType.includes('application/json') ||
      contentType.includes('text/json')
    ) {
      const body = await req.json().catch(() => null);
      if (body === null) {
        return NextResponse.json({ ok: false, error: 'Malformed JSON body.' }, { status: 400 });
      }
      const rows = Array.isArray(body)
        ? body
        : (body as { records?: unknown; data?: unknown })?.records ??
          (body as { data?: unknown })?.data;
      if (!Array.isArray(rows)) {
        return NextResponse.json(
          { ok: false, error: 'JSON body must be an array, or { records: [...] }.' },
          { status: 400 },
        );
      }
      records = rows as RawRecord[];
      format = 'json';
      sources.push('request-body');
    } else {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Unsupported content type. Send multipart/form-data with a CSV/JSON file, or application/json.',
        },
        { status: 415 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to parse upload.' },
      { status: 400 },
    );
  }

  if (records.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'The uploaded dataset contained no data rows.' },
      { status: 400 },
    );
  }

  // ---- 3. Validate required columns --------------------------------------
  const validation = validateColumns(records);
  if (!validation.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Missing required column(s): ${validation.missing.join(', ')}. Expected headers such as "Work ID" and "Work".`,
        required_fields: REQUIRED_FIELDS,
        detected_columns: validation.detected,
        detected_headers: Object.keys(records[0] || {}),
      },
      { status: 422 },
    );
  }

  // ---- 4. Normalise + score ----------------------------------------------
  const payload = buildIngestPayload(records, { maxRows: MAX_INGEST_ROWS });

  if (payload.projects.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'No valid rows remained after validation.',
        skipped: payload.skipped,
      },
      { status: 422 },
    );
  }

  // ---- 5a. Bulk upsert projects ------------------------------------------
  const insertErrors: string[] = [];
  let projectsWritten = 0;

  for (const batch of chunk(payload.projects, DEFAULT_CHUNK_SIZE)) {
    const res = await admin
      .from('projects')
      .upsert(batch, { onConflict: 'work_id', ignoreDuplicates: false });

    if (res.error) {
      insertErrors.push(`projects: ${res.error.message}`);
      break;
    }
    projectsWritten += batch.length;
  }

  if (insertErrors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to write projects.',
        details: insertErrors,
        hint: 'Apply src/lib/schema.sql in Supabase so the production tables exist.',
      },
      { status: 500 },
    );
  }

  // ---- 5b. Resolve project ids + bulk insert anomaly_signals -------------
  const workIds = payload.projects.map((p) => p.work_id);
  const idByWorkId = new Map<string, string>();

  for (const batch of chunk(workIds, DEFAULT_CHUNK_SIZE)) {
    const res = await admin.from('projects').select('id, work_id').in('work_id', batch);
    if (res.error) {
      insertErrors.push(`project-id lookup: ${res.error.message}`);
      break;
    }
    for (const row of (res.data || []) as Array<{ id: string; work_id: string }>) {
      idByWorkId.set(row.work_id, row.id);
    }
  }

  let signalsWritten = 0;
  if (insertErrors.length === 0) {
    const signalRows = payload.signals
      .map((signal) => {
        const projectId = idByWorkId.get(signal.work_id);
        if (!projectId) return null;
        return {
          project_id: projectId,
          rule_score: signal.rule_score,
          spatial_score: signal.spatial_score,
          nlp_score: signal.nlp_score,
          ml_score: signal.ml_score,
          total_risk_score: signal.total_risk_score,
          primary_flag: signal.primary_flag,
          flag_details: signal.flag_details,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    for (const batch of chunk(signalRows, DEFAULT_CHUNK_SIZE)) {
      const res = await admin.from('anomaly_signals').insert(batch);
      if (res.error) {
        insertErrors.push(`anomaly_signals: ${res.error.message}`);
        break;
      }
      signalsWritten += batch.length;
    }
  }

  // ---- 6. Summarise -------------------------------------------------------
  const flags = payload.signals.reduce<Record<string, number>>((acc, signal) => {
    acc[signal.primary_flag] = (acc[signal.primary_flag] || 0) + 1;
    return acc;
  }, {});

  const highRisk = payload.signals.filter((s) => s.total_risk_score >= 80).length;

  const ok = insertErrors.length === 0;

  return NextResponse.json(
    {
      ok,
      format,
      sources,
      rows_received: records.length,
      projects_written: projectsWritten,
      signals_written: signalsWritten,
      skipped: payload.skipped.slice(0, 100),
      skipped_count: payload.skipped.length,
      warnings: payload.warnings,
      summary: {
        high_risk_projects: highRisk,
        avg_risk_score:
          payload.signals.length > 0
            ? Math.round(
                payload.signals.reduce((sum, s) => sum + s.total_risk_score, 0) /
                  payload.signals.length,
              )
            : 0,
        flag_distribution: flags,
      },
      errors: insertErrors,
      at: new Date().toISOString(),
    },
    { status: ok ? 200 : 500 },
  );
}

/** OPTIONS handler for the browser preflight (admin header + multipart). */
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': `Content-Type, ${ADMIN_TOKEN_HEADER}, Authorization`,
    },
  });
}

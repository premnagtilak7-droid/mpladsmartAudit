import { NextRequest, NextResponse } from 'next/server';
import { parseCsv, parseDataset, type RawRecord } from '@/lib/ingest';
import {
  MOSPI_COLUMNS,
  normalizeAndScore,
  validateMospiHeaders,
  type MospiProject,
  type MospiSignal,
} from '@/lib/mospiScoring';
import { ADMIN_TOKEN_HEADER, assertOfficer, getAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The official MoSPI export is ~11k rows; reject anything obviously oversized.
const MAX_UPLOAD_BYTES = 40 * 1024 * 1024; // 40 MB

/** Rows written per PostgREST round-trip. Smaller = smoother progress events. */
const BATCH_SIZE = 250;

/** Hard ceiling so a malformed file cannot exhaust the function's memory. */
const MAX_ROWS = 50_000;

// ---------------------------------------------------------------------------
// Progress event contract (NDJSON stream)
// ---------------------------------------------------------------------------

type ProgressEvent =
  | { type: 'parsed'; rows_received: number; valid_rows: number; skipped_count: number; format: 'csv' | 'json'; sources: string[] }
  | { type: 'batch'; batch: number; batches: number; projects_written: number; signals_written: number; total: number; percent: number }
  | { type: 'skipped'; skipped: Array<{ row: number; reason: string }> }
  | { type: 'summary'; summary: IngestSummary }
  | { type: 'error'; error: string; details?: unknown };

interface IngestSummary {
  ok: boolean;
  format: 'csv' | 'json';
  sources: string[];
  rows_received: number;
  projects_written: number;
  signals_written: number;
  skipped_count: number;
  skipped: Array<{ row: number; reason: string }>;
  warnings: string[];
  batches: number;
  summary: {
    high_risk_projects: number;
    avg_risk_score: number;
    flag_distribution: Record<string, number>;
    mode: 'csv' | 'json';
  };
  errors: string[];
  at: string;
}

// ---------------------------------------------------------------------------
// Request parsing (Mode A: multipart CSV · Mode B: raw JSON array)
// ---------------------------------------------------------------------------

interface LoadedPayload {
  records: RawRecord[];
  format: 'csv' | 'json';
  sources: string[];
  warnings: string[];
}

async function loadPayload(req: NextRequest): Promise<LoadedPayload> {
  const contentType = req.headers.get('content-type') || '';
  const warnings: string[] = [];

  // ---- Mode A — multipart CSV / JSON file upload --------------------------
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const parts = [...form.getAll('file'), ...form.getAll('files'), ...form.getAll('dataset')];
    const files = parts.filter(
      (part): part is File => typeof part === 'object' && part !== null && 'text' in part,
    );

    if (files.length === 0) {
      throw new BadRequest('No file part found. Attach a CSV under the "file" field.');
    }

    const records: RawRecord[] = [];
    const sources: string[] = [];
    let format: 'csv' | 'json' = 'csv';

    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new PayloadTooLarge(
          `File "${file.name}" exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit.`,
        );
      }

      const text = await file.text();

      // Prefer the CSV path so we retain the header row for column validation.
      const isCsv = file.name.toLowerCase().endsWith('.csv') || !text.trim().startsWith('[');
      if (isCsv) {
        const { headers, records: parsed } = parseCsv(text);
        const check = validateMospiHeaders(headers);
        if (!check.ok) {
          throw new UnprocessableEntity(
            `Missing required MoSPI column(s): ${check.missing.join(', ')}.`,
            { required_columns: MOSPI_COLUMNS, detected_headers: headers },
          );
        }
        if (check.absent_optional.length > 0) {
          warnings.push(
            `Optional columns not present and left blank: ${check.absent_optional.join(', ')}.`,
          );
        }
        records.push(...parsed);
        format = 'csv';
      } else {
        const parsed = parseDataset(text, file.name);
        records.push(...parsed.records);
        format = 'json';
      }

      sources.push(file.name || 'upload');
    }

    return { records, format, sources, warnings };
  }

  // ---- Mode B — raw JSON array from e-SAKSHI / MoSPI endpoints ------------
  if (contentType.includes('application/json') || contentType.includes('text/json') || contentType === '') {
    const body = await req.json().catch(() => null);
    if (body === null) throw new BadRequest('Malformed JSON body.');

    const rows = Array.isArray(body)
      ? body
      : (body as { records?: unknown; data?: unknown })?.records ??
        (body as { data?: unknown })?.data;

    if (!Array.isArray(rows)) {
      throw new BadRequest('JSON body must be an array of MoSPI records, or { records: [...] }.');
    }
    if (rows.length === 0) throw new BadRequest('The JSON payload contained no records.');

    return { records: rows as RawRecord[], format: 'json', sources: ['request-body'], warnings };
  }

  throw new UnsupportedMedia(
    'Unsupported content type. Send multipart/form-data with a CSV, or application/json.',
  );
}

// ---------------------------------------------------------------------------
// Small typed HTTP errors so validation failures return clean status codes
// ---------------------------------------------------------------------------

class BadRequest extends Error {
  status = 400;
}
class UnsupportedMedia extends Error {
  status = 415;
}
class PayloadTooLarge extends Error {
  status = 413;
}
class UnprocessableEntity extends Error {
  status = 422;
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Normalises + scores the whole batch, then writes it to Supabase in chunks.
 * `emit` is called after each chunk so a streaming caller gets live progress.
 */
async function runPipeline(
  payload: LoadedPayload,
  emit: (event: ProgressEvent) => void,
): Promise<IngestSummary> {
  const errors: string[] = [];
  const warnings = [...payload.warnings];

  if (payload.records.length > MAX_ROWS) {
    throw new UnprocessableEntity(
      `Dataset contains ${payload.records.length.toLocaleString('en-IN')} rows, exceeding the ${MAX_ROWS.toLocaleString('en-IN')} row ceiling. Split the export and retry.`,
    );
  }

  // ---- 1. Normalise + score the entire batch (peer-relative signals) ------
  const scored = normalizeAndScore(payload.records);
  const projects: MospiProject[] = scored.projects;
  const signals: MospiSignal[] = scored.signals;

  emit({
    type: 'parsed',
    rows_received: payload.records.length,
    valid_rows: projects.length,
    skipped_count: scored.skipped.length,
    format: payload.format,
    sources: payload.sources,
  });

  if (scored.skipped.length > 0) {
    emit({ type: 'skipped', skipped: scored.skipped.slice(0, 200) });
  }

  if (projects.length === 0) {
    throw new UnprocessableEntity('No valid rows remained after validation.', {
      skipped: scored.skipped.slice(0, 50),
    });
  }

  const admin = getAdminClient();
  if (!admin) {
    throw new Error(
      'Server is missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_URL). Configure it to enable ingestion.',
    );
  }

  // ---- 2. Write projects + their signals, chunk by chunk ------------------
  const batches = Math.ceil(projects.length / BATCH_SIZE);
  let projectsWritten = 0;
  let signalsWritten = 0;

  // Index signals by work_id so each chunk can pair them with its projects.
  const signalByWorkId = new Map<string, MospiSignal>();
  for (const signal of signals) signalByWorkId.set(signal.work_id, signal);

  for (let index = 0; index < batches; index += 1) {
    const start = index * BATCH_SIZE;
    const projectChunk = projects.slice(start, start + BATCH_SIZE);

    // Upsert and return the generated ids in one round-trip.
    const upsert = await admin
      .from('projects')
      .upsert(projectChunk, { onConflict: 'work_id', ignoreDuplicates: false })
      .select('id, work_id');

    if (upsert.error) {
      errors.push(`projects (batch ${index + 1}): ${upsert.error.message}`);
      break;
    }

    const written = (upsert.data || []) as Array<{ id: string; work_id: string }>;
    projectsWritten += written.length;

    // Build this chunk's anomaly_signals rows from the returned ids.
    const signalRows = written
      .map((row) => {
        const signal = signalByWorkId.get(row.work_id);
        if (!signal) return null;
        return {
          project_id: row.id,
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

    if (signalRows.length > 0) {
      // Replace any prior signals for these projects (re-ingest is idempotent).
      const ids = written.map((row) => row.id);
      await admin.from('anomaly_signals').delete().in('project_id', ids);

      const insert = await admin.from('anomaly_signals').insert(signalRows);
      if (insert.error) {
        errors.push(`anomaly_signals (batch ${index + 1}): ${insert.error.message}`);
        break;
      }
      signalsWritten += signalRows.length;
    }

    emit({
      type: 'batch',
      batch: index + 1,
      batches,
      projects_written: projectsWritten,
      signals_written: signalsWritten,
      total: projects.length,
      percent: Math.round(((index + 1) / batches) * 100),
    });
  }

  // ---- 3. Summarise -------------------------------------------------------
  const flagDistribution = signals.reduce<Record<string, number>>((acc, signal) => {
    acc[signal.primary_flag] = (acc[signal.primary_flag] || 0) + 1;
    return acc;
  }, {});

  const highRisk = signals.filter((s) => s.total_risk_score >= 80).length;

  if (errors.length > 0) {
    warnings.push('Some batches failed — see the errors array for details.');
  }

  return {
    ok: errors.length === 0,
    format: payload.format,
    sources: payload.sources,
    rows_received: payload.records.length,
    projects_written: projectsWritten,
    signals_written: signalsWritten,
    skipped_count: scored.skipped.length,
    skipped: scored.skipped.slice(0, 200),
    warnings,
    batches,
    summary: {
      high_risk_projects: highRisk,
      avg_risk_score:
        signals.length > 0
          ? Math.round(signals.reduce((sum, s) => sum + s.total_risk_score, 0) / signals.length)
          : 0,
      flag_distribution: flagDistribution,
      mode: payload.format,
    },
    errors,
    at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// POST /api/ingest-mospi
// ---------------------------------------------------------------------------

/**
 * Dual-mode MoSPI ingestion endpoint.
 *
 *   Mode A — multipart/form-data with a CSV file (official MoSPI export).
 *   Mode B — application/json with a raw records array (e-SAKSHI / MoSPI API).
 *
 * Pass `?stream=1` (or `Accept: application/x-ndjson`) to receive newline-
 * delimited progress events as each batch is written, which powers the UI
 * progress bar. Without it, the endpoint returns a single JSON summary.
 */
export async function POST(req: NextRequest) {
  // ---- Authorize ----------------------------------------------------------
  const auth = assertOfficer(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  // ---- Parse the payload before committing to a stream --------------------
  let payload: LoadedPayload;
  try {
    payload = await loadPayload(req);
  } catch (err) {
    const status = err instanceof Error && 'status' in err ? (err as { status: number }).status : 400;
    const details = err instanceof UnprocessableEntity ? err.details : undefined;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to parse upload.', details },
      { status },
    );
  }

  if (payload.records.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'The uploaded dataset contained no data rows.' },
      { status: 400 },
    );
  }

  const wantsStream =
    req.nextUrl.searchParams.get('stream') === '1' ||
    (req.headers.get('accept') || '').includes('application/x-ndjson');

  // ---- Non-streaming: run to completion and return one JSON summary -------
  if (!wantsStream) {
    try {
      const summary = await runPipeline(payload, () => {});
      return NextResponse.json(summary, { status: summary.ok ? 200 : 500 });
    } catch (err) {
      const status = err instanceof Error && 'status' in err ? (err as { status: number }).status : 500;
      const details = err instanceof UnprocessableEntity ? err.details : undefined;
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : 'Ingestion failed.', details },
        { status },
      );
    }
  }

  // ---- Streaming: emit NDJSON progress events as batches are written ------
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: ProgressEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        const summary = await runPipeline(payload, emit);
        emit({ type: 'summary', summary });
      } catch (err) {
        emit({
          type: 'error',
          error: err instanceof Error ? err.message : 'Ingestion failed.',
          details: err instanceof UnprocessableEntity ? err.details : undefined,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Accel-Buffering': 'no',
    },
  });
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

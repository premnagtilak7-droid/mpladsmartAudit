'use client';

// Browser-side helper for the privileged admin APIs.
//
// The officer admin token is NEVER baked into the bundle. A vigilance officer
// (DPO / CVO) enters it once in the Data Ingestion & Audit panel; it is held in
// sessionStorage for the tab session only, then sent as the `x-admin-token`
// header on privileged calls.

const TOKEN_KEY = 'mplad_admin_token';

export function getAdminToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAdminToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sessionStorage unavailable (private mode) — token stays in memory only */
  }
}

export function hasAdminToken(): boolean {
  return getAdminToken().length > 0;
}

export interface IngestSummary {
  rows_received: number;
  projects_written: number;
  signals_written: number;
  skipped_count: number;
  skipped: Array<{ row: number; reason: string }>;
  warnings: string[];
  format: 'csv' | 'json';
  sources: string[];
  summary?: {
    high_risk_projects: number;
    avg_risk_score: number;
    flag_distribution: Record<string, number>;
  };
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
}

/**
 * Uploads a MoSPI dataset to the server ingestion pipeline.
 * `payload` is either a File (CSV/JSON) or raw JSON records.
 */
export async function ingestDataset(
  payload: File | { records: unknown[] },
): Promise<ApiResult<IngestSummary>> {
  const headers: Record<string, string> = { 'x-admin-token': getAdminToken() };

  let body: BodyInit;
  if (payload instanceof File) {
    const form = new FormData();
    form.append('file', payload, payload.name);
    body = form;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ records: payload.records });
  }

  try {
    const res = await fetch('/api/ingest', { method: 'POST', headers, body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      return {
        ok: false,
        status: res.status,
        error: json?.error || `Ingestion failed (HTTP ${res.status}).`,
        data: json,
      };
    }
    return { ok: true, status: res.status, data: json as IngestSummary };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'Network error during ingestion.',
    };
  }
}

export interface ScoreDatasetSummary {
  projects_scanned: number;
  projects_updated: number;
  high_risk: number;
  anomaly_signals_written: number;
}

/** Recomputes risk scores for the complete Supabase dataset. */
export async function scoreDataset(): Promise<ApiResult<ScoreDatasetSummary>> {
  try {
    const res = await fetch('/api/score-dataset', {
      method: 'POST',
      headers: { 'x-admin-token': getAdminToken() },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      return { ok: false, status: res.status, error: json?.error || `Scoring failed (HTTP ${res.status}).`, data: json };
    }
    return { ok: true, status: res.status, data: json as ScoreDatasetSummary };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : 'Network error during scoring.' };
  }
}

export interface PurgeSummary {
  strategy: string;
  statement: string;
  purged: string[];
}

/** Purges the audit tables via /api/admin/reset-db. */
export async function purgeDatabase(): Promise<ApiResult<PurgeSummary>> {
  try {
    const res = await fetch('/api/admin/reset-db', {
      method: 'POST',
      headers: { 'x-admin-token': getAdminToken() },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      return {
        ok: false,
        status: res.status,
        error: json?.error || `Purge failed (HTTP ${res.status}).`,
      };
    }
    return { ok: true, status: res.status, data: json as PurgeSummary };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'Network error during purge.',
    };
  }
}

// ---------------------------------------------------------------------------
// Full database purge — /api/admin/purge-db
// ---------------------------------------------------------------------------

export interface FullPurgeSummary {
  success: boolean;
  message: string;
  strategy: string;
  purged: string[];
  remaining_records: number;
  sequences_reset: boolean;
  note?: string;
  at?: string;
}

/**
 * Empties all four tables and resets identity sequences.
 * On success the response message reads:
 *   "All database tables successfully purged. N records remaining."
 */
export async function purgeAllDatabase(): Promise<ApiResult<FullPurgeSummary>> {
  try {
    const res = await fetch('/api/admin/purge-db', {
      method: 'POST',
      headers: { 'x-admin-token': getAdminToken() },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) {
      return {
        ok: false,
        status: res.status,
        error: json?.error || `Purge failed (HTTP ${res.status}).`,
        data: json,
      };
    }
    return { ok: true, status: res.status, data: json as FullPurgeSummary };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'Network error during purge.',
    };
  }
}

// ---------------------------------------------------------------------------
// Streaming MoSPI ingestion — /api/ingest-mospi?stream=1
// ---------------------------------------------------------------------------

/** Progress phases surfaced to the UI progress bar. */
export type MospiPhase = 'uploading' | 'parsed' | 'batch' | 'complete' | 'error';

export interface MospiProgress {
  phase: MospiPhase;
  /** 0-100 completion estimate. */
  percent: number;
  projectsWritten: number;
  signalsWritten: number;
  total: number;
  message: string;
}

export interface MospiSummary {
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

interface StreamEvent {
  type: 'parsed' | 'batch' | 'skipped' | 'summary' | 'error';
  rows_received?: number;
  valid_rows?: number;
  skipped_count?: number;
  format?: 'csv' | 'json';
  sources?: string[];
  batch?: number;
  batches?: number;
  projects_written?: number;
  signals_written?: number;
  total?: number;
  percent?: number;
  summary?: MospiSummary;
  error?: string;
}

/**
 * Uploads a MoSPI dataset to /api/ingest-mospi and streams NDJSON progress
 * events back to `onProgress` as each batch is written to Supabase.
 */
// Stay well below Vercel's request and execution limits. Smaller chunks also
// make each scoring request finish quickly instead of appearing stuck at 0%.
const MAX_VERCEL_UPLOAD_BYTES = 750_000;

export async function ingestMospiStream(
  payload: File | { records: unknown[] },
  onProgress: (progress: MospiProgress) => void,
): Promise<ApiResult<MospiSummary>> {
  if (typeof File !== 'undefined' && payload instanceof File && payload.size > MAX_VERCEL_UPLOAD_BYTES) {
    return ingestMospiCsvInChunks(payload, onProgress);
  }

  const headers: Record<string, string> = { 'x-admin-token': getAdminToken() };

  let body: BodyInit;
  if (payload instanceof File) {
    const form = new FormData();
    form.append('file', payload, payload.name);
    body = form;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ records: payload.records });
  }

  onProgress({
    phase: 'uploading',
    percent: 2,
    projectsWritten: 0,
    signalsWritten: 0,
    total: 0,
    message: payload instanceof File ? `Uploading ${payload.name}…` : 'Uploading JSON payload…',
  });

  try {
    const res = await fetch('/api/ingest-mospi?stream=1', {
      method: 'POST',
      headers: { ...headers, Accept: 'application/x-ndjson' },
      body,
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(55_000) : undefined,
    });

    // Non-streaming error responses (auth / validation) arrive as plain JSON.
    if (!res.ok || !res.body) {
      const json = await res.json().catch(() => ({}));
      onProgress({
        phase: 'error',
        percent: 0,
        projectsWritten: 0,
        signalsWritten: 0,
        total: 0,
        message: json?.error || `Ingestion failed (HTTP ${res.status}).`,
      });
      return {
        ok: false,
        status: res.status,
        error: json?.error || `Ingestion failed (HTTP ${res.status}).`,
      };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let summary: MospiSummary | null = null;
    let streamError: string | null = null;

    // Read NDJSON: one JSON event per line.
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');

        if (!line) continue;
        let event: StreamEvent;
        try {
          event = JSON.parse(line) as StreamEvent;
        } catch {
          continue; // ignore an unparseable partial line
        }

        if (event.type === 'parsed') {
          onProgress({
            phase: 'parsed',
            percent: 8,
            projectsWritten: 0,
            signalsWritten: 0,
            total: event.valid_rows ?? 0,
            message: `Parsed ${(event.rows_received ?? 0).toLocaleString('en-IN')} rows — scoring anomalies…`,
          });
        } else if (event.type === 'batch') {
          const percent = 8 + Math.round(((event.percent ?? 0) / 100) * 88);
          onProgress({
            phase: 'batch',
            percent: Math.min(97, percent),
            projectsWritten: event.projects_written ?? 0,
            signalsWritten: event.signals_written ?? 0,
            total: event.total ?? 0,
            message: `Batch ${event.batch} of ${event.batches} committed…`,
          });
        } else if (event.type === 'summary' && event.summary) {
          summary = event.summary;
        } else if (event.type === 'error') {
          streamError = event.error || 'Ingestion failed.';
        }
      }
    }

    if (streamError) {
      onProgress({
        phase: 'error',
        percent: 0,
        projectsWritten: 0,
        signalsWritten: 0,
        total: 0,
        message: streamError,
      });
      return { ok: false, status: 500, error: streamError };
    }

    if (!summary) {
      const message = 'The ingestion stream ended without a summary.';
      onProgress({ phase: 'error', percent: 0, projectsWritten: 0, signalsWritten: 0, total: 0, message });
      return { ok: false, status: 500, error: message };
    }

    const finalSummary = summary;
    onProgress({
      phase: finalSummary.ok ? 'complete' : 'error',
      percent: finalSummary.ok ? 100 : 0,
      projectsWritten: finalSummary.projects_written,
      signalsWritten: finalSummary.signals_written,
      total: finalSummary.rows_received,
      message: finalSummary.ok
        ? `Committed ${finalSummary.projects_written.toLocaleString('en-IN')} projects and ${finalSummary.signals_written.toLocaleString('en-IN')} anomaly signals.`
        : 'Ingestion finished with errors — see details.',
    });

    return { ok: finalSummary.ok, status: 200, data: finalSummary };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error during ingestion.';
    onProgress({ phase: 'error', percent: 0, projectsWritten: 0, signalsWritten: 0, total: 0, message });
    return { ok: false, status: 0, error: message };
  }
}

/** Keep large CSV requests below Vercel's serverless body limit. */
async function ingestMospiCsvInChunks(
  file: File,
  onProgress: (progress: MospiProgress) => void,
): Promise<ApiResult<MospiSummary>> {
  try {
    const text = await file.text();
    const firstBreak = text.indexOf('\n');
    if (firstBreak < 0) return { ok: false, status: 422, error: 'The CSV has no data rows.' };

    const header = text.slice(0, firstBreak + 1);
    const rows = text.slice(firstBreak + 1).split(/\r?\n/).filter((row) => row.trim());
    const chunks: string[] = [];
    let current = header;

    for (const row of rows) {
      const candidate = `${current}${row}\n`;
      if (current !== header && new Blob([candidate]).size > MAX_VERCEL_UPLOAD_BYTES) {
        chunks.push(current);
        current = `${header}${row}\n`;
      } else {
        current = candidate;
      }
    }
    if (current !== header) chunks.push(current);
    if (chunks.length === 0) return { ok: false, status: 422, error: 'The CSV has no importable rows.' };

    const aggregate: MospiSummary = {
      ok: true, format: 'csv', sources: [file.name], rows_received: 0,
      projects_written: 0, signals_written: 0, skipped_count: 0, skipped: [],
      warnings: [`Uploaded in ${chunks.length} secure chunks to avoid HTTP 413.`],
      batches: 0, summary: { high_risk_projects: 0, avg_risk_score: 0, flag_distribution: {}, mode: 'csv' },
      errors: [], at: new Date().toISOString(),
    };
    let weightedRiskTotal = 0;

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = new File([chunks[index]], file.name, { type: 'text/csv' });
      const result = await ingestMospiStream(chunk, (progress) => onProgress({
        ...progress,
        percent: Math.min(99, Math.round(((index + progress.percent / 100) / chunks.length) * 100)),
        message: `Chunk ${index + 1} of ${chunks.length}: ${progress.message}`,
      }));
      if (!result.ok || !result.data) return { ok: false, status: result.status, error: result.error || `Chunk ${index + 1} failed.` };

      const part = result.data;
      aggregate.rows_received += part.rows_received;
      aggregate.projects_written += part.projects_written;
      aggregate.signals_written += part.signals_written;
      aggregate.skipped_count += part.skipped_count;
      aggregate.skipped.push(...part.skipped);
      aggregate.warnings.push(...part.warnings);
      aggregate.errors.push(...part.errors);
      aggregate.batches += part.batches;
      aggregate.summary.high_risk_projects += part.summary.high_risk_projects;
      weightedRiskTotal += part.summary.avg_risk_score * part.projects_written;
      for (const [flag, count] of Object.entries(part.summary.flag_distribution)) {
        aggregate.summary.flag_distribution[flag] = (aggregate.summary.flag_distribution[flag] || 0) + count;
      }
    }

    aggregate.summary.avg_risk_score = aggregate.projects_written
      ? Math.round((weightedRiskTotal / aggregate.projects_written) * 100) / 100
      : 0;
    onProgress({ phase: 'complete', percent: 100, projectsWritten: aggregate.projects_written, signalsWritten: aggregate.signals_written, total: aggregate.rows_received, message: `Committed ${aggregate.projects_written.toLocaleString('en-IN')} projects in ${chunks.length} chunks.` });
    return { ok: true, status: 200, data: aggregate };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Large CSV upload failed.';
    onProgress({ phase: 'error', percent: 0, projectsWritten: 0, signalsWritten: 0, total: 0, message });
    return { ok: false, status: 0, error: message };
  }
}

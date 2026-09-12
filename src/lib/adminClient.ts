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

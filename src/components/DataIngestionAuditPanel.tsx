'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Eraser,
  FileJson,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  Lock,
  UploadCloud,
} from 'lucide-react';
import {
  getAdminToken,
  ingestDataset,
  purgeDatabase,
  setAdminToken,
  type IngestSummary,
} from '@/lib/adminClient';

interface DataIngestionAuditPanelProps {
  /** Called after a successful ingest so the dashboard can reload live data. */
  onIngested?: (summary: IngestSummary) => void;
  /** Called after a successful purge so the dashboard can clear local state. */
  onPurged?: () => void;
  /** Whether the signed-in officer is allowed to run destructive admin actions. */
  canPurge: boolean;
  /** Live record count shown in the pipeline status strip. */
  recordCount: number;
  live: boolean;
}

type UploadMode = 'csv' | 'json';

export function DataIngestionAuditPanel({
  onIngested,
  onPurged,
  canPurge,
  recordCount,
  live,
}: DataIngestionAuditPanelProps) {
  const [token, setToken] = useState<string>(() => getAdminToken());
  const [mode, setMode] = useState<UploadMode>('csv');
  const [file, setFile] = useState<File | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [purging, setPurging] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [summary, setSummary] = useState<IngestSummary | null>(null);

  const tokenReady = token.trim().length > 0;

  const requiredHeaders = useMemo(
    () => ['Work ID', 'Work', 'State', 'Constituency', 'Vendor Name', 'Fund Disbursed Amount ( ₹ )'],
    [],
  );

  const persistToken = (value: string) => {
    setToken(value);
    setAdminToken(value.trim());
  };

  const runIngestFile = async () => {
    if (!file) {
      setMessage({ kind: 'err', text: 'Select a CSV or JSON file to ingest.' });
      return;
    }
    if (!tokenReady) {
      setMessage({ kind: 'err', text: 'Enter the officer admin token before ingesting.' });
      return;
    }
    setIngesting(true);
    setMessage(null);
    setSummary(null);

    const result = await ingestDataset(file);
    setIngesting(false);

    if (result.ok && result.data) {
      setSummary(result.data);
      setMessage({
        kind: 'ok',
        text: `Ingested ${result.data.projects_written.toLocaleString('en-IN')} projects and ${result.data.signals_written.toLocaleString('en-IN')} anomaly signals.`,
      });
      onIngested?.(result.data);
    } else {
      setMessage({ kind: 'err', text: result.error || 'Ingestion failed.' });
    }
  };

  const runIngestJson = async () => {
    if (!jsonInput.trim()) {
      setMessage({ kind: 'err', text: 'Paste a JSON array of MoSPI records.' });
      return;
    }
    if (!tokenReady) {
      setMessage({ kind: 'err', text: 'Enter the officer admin token before ingesting.' });
      return;
    }
    setIngesting(true);
    setMessage(null);
    setSummary(null);

    let records: unknown[];
    try {
      const parsed = JSON.parse(jsonInput);
      const rows = Array.isArray(parsed) ? parsed : parsed?.records;
      if (!Array.isArray(rows)) throw new Error('JSON must be an array or { records: [] }.');
      records = rows;
    } catch (err) {
      setIngesting(false);
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Invalid JSON.' });
      return;
    }

    const result = await ingestDataset({ records });
    setIngesting(false);

    if (result.ok && result.data) {
      setSummary(result.data);
      setMessage({
        kind: 'ok',
        text: `Ingested ${result.data.projects_written.toLocaleString('en-IN')} projects and ${result.data.signals_written.toLocaleString('en-IN')} anomaly signals.`,
      });
      onIngested?.(result.data);
    } else {
      setMessage({ kind: 'err', text: result.error || 'Ingestion failed.' });
    }
  };

  const runPurge = async () => {
    if (!tokenReady) {
      setMessage({ kind: 'err', text: 'Enter the officer admin token before purging.' });
      return;
    }
    setPurging(true);
    setMessage(null);
    setSummary(null);

    const result = await purgeDatabase();
    setPurging(false);
    setConfirmPurge(false);

    if (result.ok) {
      setMessage({
        kind: 'ok',
        text: 'Database purged: officer_audit_logs, anomaly_signals and projects are now empty.',
      });
      onPurged?.();
    } else {
      setMessage({ kind: 'err', text: result.error || 'Purge failed.' });
    }
  };

  return (
    <section id="data-ingestion-audit" className="space-y-5">
      <header className="rounded-2xl border border-slate-700/80 bg-gradient-to-r from-[#111e38] via-[#0f172a] to-[#162033] p-5 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-300">
              <Database size={13} />
              <span>STEP 01 · Data Ingestion &amp; Audit</span>
            </div>
            <h2 className="mt-1 text-lg font-black text-white">
              MoSPI Bulk Ingestion Pipeline &amp; Schema Control
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300">
              Upload the official MoSPI expenditure export (CSV or JSON). The server validates
              required columns, computes the 4-signal anomaly decomposition
              (rule · spatial · nlp · ml) and bulk-writes into the production{' '}
              <code className="rounded bg-slate-800 px-1 py-0.5 text-[11px] text-emerald-200">projects</code>{' '}
              and{' '}
              <code className="rounded bg-slate-800 px-1 py-0.5 text-[11px] text-emerald-200">anomaly_signals</code>{' '}
              tables.
            </p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-[#070d1e]/80 px-4 py-3 text-right">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Live Dataset
            </div>
            <div className="text-lg font-black text-emerald-300">
              {live ? recordCount.toLocaleString('en-IN') : '—'}
            </div>
            <div className="text-[10px] font-semibold text-slate-400">
              {live ? 'records loaded' : 'Supabase offline'}
            </div>
          </div>
        </div>
      </header>

      {/* Officer admin token */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 shadow-xl">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
          <KeyRound size={14} />
          Officer Admin Token
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
          Privileged ingest and purge calls require the server&apos;s{' '}
          <code className="rounded bg-slate-800 px-1 py-0.5 text-amber-200">ADMIN_API_TOKEN</code>.
          It is stored in this browser tab only and never embedded in the build.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="password"
            value={token}
            onChange={(e) => persistToken(e.target.value)}
            placeholder="Paste officer admin token"
            autoComplete="off"
            className="min-w-64 flex-1 rounded-xl border border-slate-700 bg-[#0b1224] px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-400"
          />
          <button
            type="button"
            onClick={() => persistToken('')}
            className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
          >
            Clear
          </button>
          <span
            className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold ${
              tokenReady
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border border-slate-700 bg-slate-800/60 text-slate-400'
            }`}
          >
            {tokenReady ? <CheckCircle2 size={13} /> : <Lock size={13} />}
            {tokenReady ? 'Token set' : 'No token'}
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Ingestion card */}
        <article className="rounded-2xl border border-slate-700/80 bg-[#1e293b]/70 p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white">Bulk MoSPI Ingestion</h3>
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-700">
              {(['csv', 'json'] as UploadMode[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${
                    mode === option
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#0f172a] text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {mode === 'csv' ? (
            <label
              className="mt-4 grid min-h-44 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-indigo-500/40 bg-indigo-500/5 p-4 text-center"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const dropped = event.dataTransfer.files?.[0];
                if (dropped) setFile(dropped);
              }}
            >
              <input
                type="file"
                accept=".csv,.json,text/csv,application/json"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div>
                <UploadCloud className="mx-auto mb-2 text-indigo-400" size={22} />
                <div className="text-xs font-bold text-slate-100">
                  {file ? file.name : 'Drop CSV / JSON here or click to select'}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Server-side parsing · 4-signal scoring · bulk upsert
                </div>
              </div>
            </label>
          ) : (
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='Paste JSON records, e.g. [{ "Work ID": "WS/1", "Work": "Construction of road" }]'
              className="mt-4 h-44 w-full rounded-xl border border-slate-700 bg-[#0b1224] p-3 text-xs text-slate-100 outline-none focus:border-indigo-400"
            />
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={ingesting || !tokenReady}
              onClick={() => void (mode === 'csv' ? runIngestFile() : runIngestJson())}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-lg transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {ingesting ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
              {ingesting ? 'Running pipeline…' : 'Run Ingestion Pipeline'}
            </button>
            <span className="text-[11px] text-slate-400">
              Accepts legacy MoSPI headers and normalized column names.
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-[#070d1e]/70 p-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Required columns
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {requiredHeaders.map((header) => (
                <span
                  key={header}
                  className="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] font-semibold text-slate-300"
                >
                  {header}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              Minimum required: <strong className="text-slate-300">Work ID</strong> and{' '}
              <strong className="text-slate-300">Work</strong>. All other columns are optional and
              auto-enriched.
            </p>
          </div>
        </article>

        {/* Purge + results card */}
        <div className="space-y-5">
          <article className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-sm font-black text-rose-200">
              <Eraser size={15} />
              Purge Database &amp; Reset Schema
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
              Truncates{' '}
              <code className="rounded bg-slate-800 px-1 py-0.5 text-rose-200">officer_audit_logs</code>,{' '}
              <code className="rounded bg-slate-800 px-1 py-0.5 text-rose-200">anomaly_signals</code>{' '}
              and <code className="rounded bg-slate-800 px-1 py-0.5 text-rose-200">projects</code>{' '}
              <span className="font-bold">with CASCADE</span>. This is irreversible — take a backup
              of the live schema before running it in production.
            </p>

            {!confirmPurge ? (
              <button
                type="button"
                disabled={!canPurge || purging}
                onClick={() => setConfirmPurge(true)}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-600/20 px-4 py-2.5 text-xs font-black text-rose-100 transition hover:bg-rose-600/35 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Eraser size={14} />
                {canPurge ? 'Purge Database & Reset Schema' : 'Restricted to Central Admin'}
              </button>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-rose-500/50 bg-rose-950/40 p-3">
                <AlertTriangle size={15} className="text-rose-300" />
                <span className="text-[11px] font-bold text-rose-100">
                  Confirm irreversible truncation of all audit tables?
                </span>
                <button
                  type="button"
                  disabled={purging}
                  onClick={() => void runPurge()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-black text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {purging ? <Loader2 size={13} className="animate-spin" /> : <Eraser size={13} />}
                  {purging ? 'Purging…' : 'Yes, purge now'}
                </button>
                <button
                  type="button"
                  disabled={purging}
                  onClick={() => setConfirmPurge(false)}
                  className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-slate-700/80 bg-[#1e293b]/70 p-5 shadow-2xl">
            <h3 className="text-sm font-black text-white">Pipeline Result</h3>

            {message && (
              <div
                className={`mt-3 flex items-start gap-2 rounded-xl border p-3 text-[11px] ${
                  message.kind === 'ok'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                }`}
              >
                {message.kind === 'ok' ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            {!message && (
              <p className="mt-3 text-[11px] text-slate-400">
                Run an ingestion or a purge to see the pipeline summary here.
              </p>
            )}

            {summary && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Metric label="Rows received" value={summary.rows_received} />
                  <Metric label="Projects written" value={summary.projects_written} />
                  <Metric label="Signals written" value={summary.signals_written} />
                  <Metric label="High risk ≥80" value={summary.summary?.high_risk_projects ?? 0} />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-0.5">
                    {summary.format === 'json' ? <FileJson size={11} /> : <FileSpreadsheet size={11} />}
                    {summary.format.toUpperCase()}
                  </span>
                  <span>avg risk {summary.summary?.avg_risk_score ?? 0}/100</span>
                  <span>skipped {summary.skipped_count}</span>
                  {summary.warnings.map((warning) => (
                    <span key={warning} className="text-amber-300">
                      {warning}
                    </span>
                  ))}
                </div>

                {summary.summary?.flag_distribution && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(summary.summary.flag_distribution).map(([flag, count]) => (
                      <span
                        key={flag}
                        className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-200"
                      >
                        {flag}: {count}
                      </span>
                    ))}
                  </div>
                )}

                {summary.skipped.length > 0 && (
                  <details className="rounded-xl border border-slate-800 bg-[#070d1e]/70 p-3">
                    <summary className="cursor-pointer text-[11px] font-bold text-slate-300">
                      Skipped rows ({summary.skipped_count})
                    </summary>
                    <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-[10px] text-slate-400">
                      {summary.skipped.map((row) => (
                        <li key={`${row.row}-${row.reason}`}>
                          Row {row.row}: {row.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#070d1e]/80 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-base font-black text-slate-100">{value.toLocaleString('en-IN')}</div>
    </div>
  );
}

export default DataIngestionAuditPanel;

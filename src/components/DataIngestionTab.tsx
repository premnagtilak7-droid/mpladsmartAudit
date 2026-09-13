'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Eraser,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  ShieldAlert,
  UploadCloud,
  X,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { playIfEnabled } from '@/lib/soundFX';
import {
  getAdminToken,
  ingestMospiStream,
  purgeAllDatabase,
  setAdminToken,
  type MospiProgress,
  type MospiSummary,
} from '@/lib/adminClient';

/** The canonical column set of an official MoSPI / e-SAKSHI export. */
const MOSPI_COLUMNS = [
  'work_id',
  'work_title',
  'category',
  'district',
  'state',
  'constituency',
  'sanctioned_amount',
  'spent_amount',
  'vendor_name',
  'status',
  'latitude',
  'longitude',
  'target_area',
  'sanction_date',
];

interface DataIngestionTabProps {
  /** Whether the signed-in officer may run destructive admin actions. */
  canPurge: boolean;
  /** Live record count shown in the status strip. */
  recordCount: number;
  live: boolean;
  /** Fired after a successful ingest so the dashboard can reload live data. */
  onIngested?: (summary: MospiSummary) => void;
  /** Fired after a successful purge so the dashboard can clear local state. */
  onPurged?: (remaining: number) => void;
}

type Notice = { kind: 'ok' | 'err'; text: string } | null;

const IDLE_PROGRESS: MospiProgress = {
  phase: 'uploading',
  percent: 0,
  projectsWritten: 0,
  signalsWritten: 0,
  total: 0,
  message: '',
};

export function DataIngestionTab({
  canPurge,
  recordCount,
  live,
  onIngested,
  onPurged,
}: DataIngestionTabProps) {
  const { isMuted } = useTheme();
  const [token, setToken] = useState<string>(() => getAdminToken());

  // --- Local cache invalidation state -------------------------------------
  const [localCount, setLocalCount] = useState<number | null>(null);

  // --- Panel 1: purge state ------------------------------------------------
  const [purging, setPurging] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [purgeNotice, setPurgeNotice] = useState<Notice>(null);

  // --- Panel 2: ingest state ----------------------------------------------
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [progress, setProgress] = useState<MospiProgress>(IDLE_PROGRESS);
  const [summary, setSummary] = useState<MospiSummary | null>(null);
  const [ingestNotice, setIngestNotice] = useState<Notice>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const tokenReady = token.trim().length > 0;
  const effectiveCount = localCount ?? recordCount;
  const databaseEmpty = effectiveCount === 0;

  /**
   * Persists the officer admin token for the tab session. Kept in sessionStorage
   * (never the bundle) so privileged calls can carry it as `x-admin-token`.
   */
  const commitToken = useCallback((value: string) => {
    setToken(value);
    setAdminToken(value.trim());
  }, []);

  // ------------------------------------------------------------------------
  // Panel 1 — Purge All Database Records
  // ------------------------------------------------------------------------
  const handlePurge = useCallback(async () => {
    if (!canPurge) return;
    playIfEnabled(isMuted, 'playClick');
    setPurging(true);
    setPurgeNotice(null);

    const result = await purgeAllDatabase();
    setPurging(false);

    if (!result.ok || !result.data) {
      setPurgeNotice({ kind: 'err', text: result.error || 'Purge failed.' });
      return;
    }

    const remaining = result.data.remaining_records ?? 0;

    // Clear the local cache: drop the staged file and reset the count so the
    // UI immediately reflects an emptied database without a full reload.
    setLocalCount(remaining);
    setFile(null);
    setSummary(null);
    setProgress(IDLE_PROGRESS);
    setIngestNotice(null);
    setConfirmPurge(false);
    setPurgeNotice({ kind: 'ok', text: result.data.message });

    onPurged?.(remaining);
  }, [canPurge, isMuted, onPurged]);

  // ------------------------------------------------------------------------
  // Panel 2 — MoSPI dataset ingestion
  // ------------------------------------------------------------------------
  const acceptFile = useCallback((candidate: File | null | undefined) => {
    if (!candidate) return;
    const isCsv =
      candidate.name.toLowerCase().endsWith('.csv') ||
      candidate.type === 'text/csv' ||
      candidate.type === 'application/vnd.ms-excel';

    if (!isCsv) {
      setIngestNotice({ kind: 'err', text: 'Only CSV files are accepted. Export the MoSPI dataset as CSV.' });
      return;
    }
    if (candidate.size > 40 * 1024 * 1024) {
      setIngestNotice({ kind: 'err', text: 'File exceeds the 40 MB limit.' });
      return;
    }

    setFile(candidate);
    setSummary(null);
    setProgress(IDLE_PROGRESS);
    setIngestNotice(null);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      acceptFile(event.dataTransfer.files?.[0]);
    },
    [acceptFile],
  );

  const handleIngest = useCallback(async () => {
    if (!file || ingesting) return;
    playIfEnabled(isMuted, 'playClick');
    setIngesting(true);
    setIngestNotice(null);
    setSummary(null);

    const result = await ingestMospiStream(file, setProgress);
    setIngesting(false);

    if (result.data) {
      setSummary(result.data);
      if (result.ok) playIfEnabled(isMuted, 'playSuccess');
    }

    if (!result.ok) {
      setIngestNotice({ kind: 'err', text: result.error || 'Ingestion failed.' });
      return;
    }

    const wrote = result.data?.projects_written ?? 0;
    const signals = result.data?.signals_written ?? 0;
    setLocalCount((prev) => (prev ?? 0) + wrote);
    setIngestNotice({
      kind: 'ok',
      text: `Ingested ${wrote.toLocaleString('en-IN')} projects and ${signals.toLocaleString('en-IN')} anomaly signals.`,
    });

    if (result.data) onIngested?.(result.data);
  }, [file, ingesting, isMuted, onIngested]);

  const progressLabel = useMemo(() => {
    if (progress.phase === 'parsed') return 'Validating & scoring';
    if (progress.phase === 'batch') return 'Writing to Supabase';
    if (progress.phase === 'complete') return 'Complete';
    if (progress.phase === 'error') return 'Failed';
    return 'Uploading';
  }, [progress.phase]);

  return (
    <div id="data-ingestion-tab" className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Officer credential strip                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-2xl border border-slate-700/70 bg-[#0f172a]/80 p-4 shadow-xl shadow-black/20 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            <KeyRound size={14} className="text-amber-300" />
            Officer Admin Credential
          </div>
          <div className="relative min-w-[260px] flex-1">
            <input
              type="password"
              value={token}
              onChange={(event) => commitToken(event.target.value)}
              placeholder="Enter ADMIN_API_TOKEN to unlock privileged actions"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none dark:border-slate-600/80 dark:bg-[#0b132b] dark:text-slate-100 dark:placeholder:text-slate-400"
            />
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
              tokenReady
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                : 'border-amber-400/40 bg-amber-500/15 text-amber-200'
            }`}
          >
            {tokenReady ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            {tokenReady ? 'Credential staged' : 'Credential required'}
          </span>
        </div>
        <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-800 dark:text-slate-200">
          Held in session storage for this tab only — never written into the bundle. Purge and ingest
          endpoints fail closed on the server when no admin token is configured.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ================================================================ */}
        {/* PANEL 1 — Database Control & Hard Reset                          */}
        {/* ================================================================ */}
        <section
          id="panel-database-control"
          className="flex flex-col rounded-2xl border border-rose-300 bg-slate-100 p-5 shadow-2xl shadow-rose-950/10 backdrop-blur-xl dark:border-rose-500/30 dark:bg-slate-900/90 dark:shadow-rose-950/25"
        >
          <header className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/40 bg-rose-500/15 text-rose-200">
              <Eraser size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.12em] text-red-700 dark:text-rose-100">
                Database Control &amp; Hard Reset
              </h2>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-red-700 dark:text-red-400">
                Empties <code className="text-rose-100">projects</code>,{' '}
                <code className="text-rose-100">anomaly_signals</code>,{' '}
                <code className="text-rose-100">officer_audit_logs</code> and{' '}
                <code className="text-rose-100">statutory_reports</code>, then resets identity
                sequences. This cannot be undone.
              </p>
            </div>
          </header>

          {/* Live record counter */}
          <div
            className={`mb-4 flex items-center justify-between rounded-xl border px-4 py-3 ${
              databaseEmpty
                ? 'border-slate-600/60 bg-slate-800/40'
                : 'border-rose-400/30 bg-rose-500/10'
            }`}
          >
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
              <Database size={14} />
              {databaseEmpty ? 'Database Emptied' : 'Live Records'}
            </div>
            <div
              className={`font-mono text-lg font-black tabular-nums ${
                databaseEmpty ? 'text-slate-400' : 'text-rose-200'
              }`}
            >
              {databaseEmpty
                ? 'Database Emptied (0 Records)'
                : `${effectiveCount.toLocaleString('en-IN')} records`}
            </div>
          </div>

          {!canPurge && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-200">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              <span>
                Your role is not authorised for destructive database actions. Sign in as a Central
                Vigilance Officer to enable the purge.
              </span>
            </div>
          )}

          <div className="mt-auto space-y-3">
            {confirmPurge ? (
              <div className="rounded-xl border border-rose-400/50 bg-rose-500/15 p-3">
                <p className="mb-3 text-[11px] font-bold leading-relaxed text-rose-100">
                  Confirm hard reset — every record in all four tables will be permanently deleted
                  and identity sequences reset to their start value.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePurge}
                    disabled={purging || !tokenReady}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-black text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {purging ? <Loader2 size={13} className="animate-spin" /> : <Eraser size={13} />}
                    {purging ? 'Purging…' : 'Yes, purge everything'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmPurge(false)}
                    disabled={purging}
                    className="rounded-lg border border-slate-600/70 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmPurge(true)}
                disabled={!canPurge || purging || !tokenReady}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-rose-950/50 transition hover:from-rose-500 hover:to-red-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Eraser size={14} />
                Purge All Database Records
              </button>
            )}

            {purgeNotice && (
              <div
                className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-semibold ${
                  purgeNotice.kind === 'ok'
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-rose-400/40 bg-rose-500/10 text-rose-200'
                }`}
                role="status"
              >
                {purgeNotice.kind === 'ok' ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                )}
                <span className="leading-relaxed">{purgeNotice.text}</span>
              </div>
            )}
          </div>
        </section>

        {/* ================================================================ */}
        {/* PANEL 2 — MoSPI Official Dataset Importer                        */}
        {/* ================================================================ */}
        <section
          id="panel-mospi-importer"
          className="flex flex-col rounded-2xl border border-cyan-300 bg-slate-100 p-5 shadow-2xl shadow-cyan-950/10 backdrop-blur-xl dark:border-cyan-500/30 dark:bg-slate-900/90 dark:shadow-cyan-950/25"
        >
          <header className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/15 text-cyan-200">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.12em] text-cyan-800 dark:text-cyan-100">
                MoSPI Official Dataset Importer
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-cyan-200/70">
                Drop the official CSV export. Each row is scored for Rule, Spatial overlap and
                Peer-cost IQR deviation, then bulk-inserted into{' '}
                <code className="text-cyan-100">projects</code> and{' '}
                <code className="text-cyan-100">anomaly_signals</code>.
              </p>
            </div>
          </header>

          {/* Expected schema chips */}
          <div className="mb-4">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-800 dark:text-slate-200">
              Expected MoSPI Columns
            </div>
            <div className="flex flex-wrap gap-1">
              {MOSPI_COLUMNS.map((column) => (
                <span
                  key={column}
                  className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${
                    column === 'work_id' || column === 'work_title'
                      ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                      : 'border-slate-600/60 bg-slate-800/50 text-slate-400'
                  }`}
                  title={column === 'work_id' || column === 'work_title' ? 'Required' : 'Optional'}
                >
                  {column}
                </span>
              ))}
            </div>
          </div>

          {/* Drag-and-drop zone */}
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
              dragging
                ? 'border-cyan-400 bg-cyan-500/15'
                : file
                  ? 'border-emerald-400/50 bg-emerald-500/5'
                  : 'border-slate-600/70 bg-[#0b132b]/60 hover:border-cyan-400/60 hover:bg-cyan-500/5'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => acceptFile(event.target.files?.[0])}
            />
            {file ? (
              <>
                <CheckCircle2 size={26} className="mb-2 text-emerald-300" />
                <div className="text-xs font-bold text-emerald-100">{file.name}</div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {(file.size / 1024).toFixed(1)} KB — click to replace
                </div>
              </>
            ) : (
              <>
                <UploadCloud
                  size={26}
                  className={`mb-2 ${dragging ? 'text-cyan-300' : 'text-slate-500'}`}
                />
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Drag &amp; drop the MoSPI CSV here
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  or click to browse — CSV only, up to 40 MB
                </div>
              </>
            )}
          </div>

          {file && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setFile(null);
                setProgress(IDLE_PROGRESS);
              }}
              disabled={ingesting}
              className="mt-2 inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-400 transition hover:bg-white/5 hover:text-slate-200 disabled:opacity-50"
            >
              <X size={12} /> Clear selection
            </button>
          )}

          {/* Real-time batch progress bar */}
          {(ingesting || progress.percent > 0) && (
            <div className="mt-4" id="ingest-progress">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold">
                <span
                  className={
                    progress.phase === 'error' ? 'text-rose-300' : 'text-cyan-200'
                  }
                >
                  {progressLabel}
                </span>
                <span className="font-mono tabular-nums text-slate-400">
                  {progress.percent}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${
                    progress.phase === 'error'
                      ? 'bg-rose-500'
                      : progress.phase === 'complete'
                        ? 'bg-emerald-500'
                        : 'bg-gradient-to-r from-cyan-500 to-indigo-500'
                  }`}
                  style={{ width: `${progress.phase === 'error' ? 100 : progress.percent}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-slate-400">
                <span>{progress.message}</span>
                <span className="font-mono tabular-nums">
                  {progress.projectsWritten.toLocaleString('en-IN')} projects ·{' '}
                  {progress.signalsWritten.toLocaleString('en-IN')} signals
                </span>
              </div>
            </div>
          )}

          <div className="mt-auto space-y-3 pt-4">
            <button
              type="button"
              onClick={handleIngest}
              disabled={!file || ingesting || !tokenReady}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-cyan-950/50 transition hover:from-cyan-500 hover:to-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {ingesting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <UploadCloud size={14} />
              )}
              {ingesting ? 'Ingesting…' : 'Ingest Dataset'}
            </button>

            {ingestNotice && (
              <div
                className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-semibold ${
                  ingestNotice.kind === 'ok'
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-rose-400/40 bg-rose-500/10 text-rose-200'
                }`}
                role="status"
              >
                {ingestNotice.kind === 'ok' ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                )}
                <span className="leading-relaxed">{ingestNotice.text}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Pipeline result — scoring decomposition for the last ingest        */}
      {/* ------------------------------------------------------------------ */}
      {summary && (
        <section className="rounded-2xl border border-slate-700/70 bg-[#0f172a]/80 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
          <header className="mb-4 flex items-center gap-2">
            <Database size={15} className="text-indigo-300" />
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">
              Ingestion Result — {summary.format.toUpperCase()} · {summary.sources.join(', ')}
            </h3>
          </header>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Rows received" value={summary.rows_received} />
            <Metric label="Projects written" value={summary.projects_written} accent="emerald" />
            <Metric label="Signals written" value={summary.signals_written} accent="emerald" />
            <Metric label="High risk" value={summary.summary.high_risk_projects} accent="rose" />
            <Metric label="Avg risk score" value={summary.summary.avg_risk_score} accent="indigo" />
            <Metric label="Skipped" value={summary.skipped_count} accent="amber" />
          </div>

          {Object.keys(summary.summary.flag_distribution).length > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-800 dark:text-slate-200">
                Primary Flag Distribution
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(summary.summary.flag_distribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([flag, count]) => (
                    <span
                      key={flag}
                      className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-2 py-1 text-[11px] font-semibold text-indigo-200"
                    >
                      {flag}: <span className="font-mono tabular-nums">{count}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}

          {summary.warnings.length > 0 && (
            <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-200">
              {summary.warnings.map((warning) => (
                <div key={warning}>• {warning}</div>
              ))}
            </div>
          )}

          {summary.errors.length > 0 && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-[11px] text-rose-200">
              {summary.errors.map((error) => (
                <div key={error}>• {error}</div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Connection footer */}
      <footer className="flex items-center gap-2 text-[11px] text-slate-500">
        <span
          className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-400' : 'bg-amber-400'}`}
          aria-hidden
        />
        {live
          ? `Connected to Supabase — ${effectiveCount.toLocaleString('en-IN')} records live in projects.`
          : 'Supabase connection required. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'}
      </footer>
    </div>
  );
}

/** Compact metric tile used in the ingestion result grid. */
function Metric({
  label,
  value,
  accent = 'slate',
}: {
  label: string;
  value: number;
  accent?: 'slate' | 'emerald' | 'rose' | 'indigo' | 'amber';
}) {
  const tone: Record<string, string> = {
    slate: 'text-slate-200',
    emerald: 'text-emerald-300',
    rose: 'text-rose-300',
    indigo: 'text-indigo-300',
    amber: 'text-amber-300',
  };

  return (
    <div className="rounded-xl border border-slate-700/60 bg-[#0b132b]/60 px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-lg font-black tabular-nums ${tone[accent]}`}>
        {value.toLocaleString('en-IN')}
      </div>
    </div>
  );
}

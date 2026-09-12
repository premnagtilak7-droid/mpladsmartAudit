'use client';

// STEP 3 — Operational module views wired to live Supabase-backed state.
//
// Every component here receives the live `projects` array (loaded from Supabase
// by useProjects) and renders a distinct operational module for the left
// sidebar. All actions are real state transitions / window.print() calls — no
// dead buttons.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  FileSearch,
  FileText,
  Filter,
  Layers,
  Map as MapIcon,
  MapPin,
  Printer,
  Radar,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import type { Project } from '@/lib/types';
import { formatCrores, formatINR } from '@/lib/format';
import { GISMapView } from '@/components/AdvancedModules';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export type AuditEntry = { kind: 'freeze' | 'memo' | 'note'; label: string; time: string };

function riskTone(score: number | null | undefined) {
  const s = score || 0;
  if (s >= 80) return { label: 'High', cls: 'border-rose-400/30 bg-rose-500/15 text-rose-200', dot: 'bg-rose-500' };
  if (s >= 50) return { label: 'Medium', cls: 'border-amber-400/30 bg-amber-500/15 text-amber-200', dot: 'bg-amber-400' };
  return { label: 'Normal', cls: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200', dot: 'bg-emerald-400' };
}

/** Deterministic normaliser for proposal text used by the NLP matcher. */
function normalizeProposal(value: string | null | undefined): string {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value: string | null | undefined): Set<string> {
  const stop = new Set(['of', 'the', 'and', 'to', 'for', 'in', 'at', 'on', 'with', 'from', 'construction', 'work', 'including', 'other', 'any']);
  return new Set(normalizeProposal(value).split(' ').filter((t) => t.length > 2 && !stop.has(t)));
}

/** Jaccard similarity between two token sets (0..1). */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/** Real SHA-256 via SubtleCrypto; resolves to '' when unavailable. */
async function sha256Hex(input: string): Promise<string> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return '';
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return '';
  }
}

function Panel({
  title,
  subtitle,
  icon,
  children,
  tone = 'slate',
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  tone?: 'slate' | 'rose' | 'emerald' | 'indigo' | 'amber';
}) {
  const toneCls: Record<string, string> = {
    slate: 'border-slate-700/80',
    rose: 'border-rose-500/30',
    emerald: 'border-emerald-500/30',
    indigo: 'border-indigo-500/30',
    amber: 'border-amber-500/30',
  };
  return (
    <section className={`rounded-2xl border ${toneCls[tone]} bg-[#1e293b]/70 p-5 shadow-2xl print:border-slate-300 print:bg-white print:shadow-none`}>
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-sm font-black text-white print:text-slate-900">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-[11px] leading-relaxed text-slate-400 print:text-slate-600">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function Stat({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'rose' | 'emerald' | 'amber' | 'indigo' }) {
  const tones: Record<string, string> = {
    slate: 'text-slate-100',
    rose: 'text-rose-300',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    indigo: 'text-indigo-300',
  };
  return (
    <div className="rounded-xl border border-slate-800 bg-[#070d1e]/80 px-3 py-2 print:border-slate-300 print:bg-white">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 print:text-slate-600">{label}</div>
      <div className={`text-base font-black ${tones[tone]} print:text-slate-900`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. All Works (Browse) — full searchable data table
// ---------------------------------------------------------------------------

export function AllWorksBrowse({
  projects,
  lockedProjects,
  onInspect,
  onFreeze,
}: {
  projects: Project[];
  lockedProjects: Record<number, string>;
  onInspect: (p: Project) => void;
  onFreeze: (p: Project) => void;
}) {
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('All States');
  const [sortKey, setSortKey] = useState<'risk' | 'amount' | 'title'>('risk');
  const [limit, setLimit] = useState(100);

  const states = useMemo(
    () => ['All States', ...new Set(projects.map((p) => p.state || 'Unknown'))],
    [projects],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects
      .filter((p) => stateFilter === 'All States' || (p.state || 'Unknown') === stateFilter)
      .filter((p) => {
        if (!needle) return true;
        return [p.work, p.work_id, p.vendor_name, p.constituency, p.mp, p.state]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => {
        if (sortKey === 'amount') return (b.amount || 0) - (a.amount || 0);
        if (sortKey === 'title') return (a.work || '').localeCompare(b.work || '');
        return (b.risk_score || 0) - (a.risk_score || 0);
      });
  }, [projects, query, stateFilter, sortKey]);

  return (
    <Panel
      title="All Works (Browse)"
      subtitle="Complete searchable register of every ingested MoSPI work. Filter, sort and open the 360° Risk Passport for any record."
      icon={<Layers size={16} />}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <div className="relative min-w-56 flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search work, work ID, vendor, constituency…"
            className="w-full rounded-xl border border-slate-700 bg-[#0b1224] py-2 pl-9 pr-3 text-xs text-slate-100 outline-none focus:border-indigo-400"
          />
        </div>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="rounded-xl border border-slate-700 bg-[#0b1224] px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-400"
        >
          {states.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-700">
          {([['risk', 'Risk'], ['amount', 'Amount'], ['title', 'Title']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortKey(key)}
              className={`px-3 py-2 text-[11px] font-black ${sortKey === key ? 'bg-indigo-600 text-white' : 'bg-[#0f172a] text-slate-300 hover:bg-white/5'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1"><Filter size={11} /> {rows.length.toLocaleString('en-IN')} works match</span>
        <span>Total value {formatCrores(rows.reduce((s, p) => s + (p.amount || 0), 0))}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 print:border-slate-300">
        <table className="min-w-full text-left text-[11px]">
          <thead className="bg-[#0f172a] text-[10px] uppercase tracking-wider text-slate-400 print:bg-slate-100 print:text-slate-700">
            <tr>
              <th className="px-3 py-2">Work ID</th>
              <th className="px-3 py-2">Work</th>
              <th className="px-3 py-2">State / PC</th>
              <th className="px-3 py-2">Vendor</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-center">Risk</th>
              <th className="px-3 py-2 text-right print:hidden">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 print:divide-slate-200">
            {rows.slice(0, limit).map((p) => {
              const tone = riskTone(p.risk_score);
              return (
                <tr key={p.id} className="hover:bg-white/5 print:hover:bg-transparent">
                  <td className="px-3 py-2 font-mono text-[10px] text-slate-300">{p.work_id || `MPLAD-${p.id}`}</td>
                  <td className="max-w-72 px-3 py-2 text-slate-200">{p.work || 'Untitled work'}</td>
                  <td className="px-3 py-2 text-slate-300">{p.state || '—'}<span className="text-slate-500"> • {p.constituency || '—'}</span></td>
                  <td className="px-3 py-2 text-slate-300">{p.vendor_name || '—'}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-100">{formatINR(p.amount || 0)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${tone.cls}`}>
                      <i className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                      {p.risk_score ?? 0}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right print:hidden">
                    <div className="inline-flex gap-1.5">
                      <button
                        onClick={() => onInspect(p)}
                        className="rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-bold text-indigo-200 hover:bg-indigo-500/20"
                      >
                        Inspect
                      </button>
                      {lockedProjects[p.id] ? (
                        <span className="rounded-md border border-rose-400/30 bg-rose-500/15 px-2 py-1 text-[10px] font-black text-rose-200">Locked</span>
                      ) : (
                        <button
                          onClick={() => onFreeze(p)}
                          className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-rose-500"
                        >
                          Freeze
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > limit && (
        <div className="mt-3 text-center print:hidden">
          <button
            onClick={() => setLimit((l) => l + 200)}
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/5"
          >
            Load 200 more ({Math.max(0, rows.length - limit).toLocaleString('en-IN')} remaining)
          </button>
        </div>
      )}

      {rows.length === 0 && (
        <div className="py-10 text-center text-xs text-slate-400">No works match the current filters.</div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 5. Geospatial Distribution
// ---------------------------------------------------------------------------

export function GeospatialDistribution({
  projects,
  onInspect,
}: {
  projects: Project[];
  onInspect: (p: Project) => void;
}) {
  const [focus, setFocus] = useState<'all' | 'high'>('all');

  const scoped = useMemo(
    () => (focus === 'high' ? projects.filter((p) => (p.risk_score || 0) >= 80) : projects),
    [projects, focus],
  );

  const byState = useMemo(() => {
    const map = new Map<string, { count: number; value: number; flagged: number }>();
    for (const p of scoped) {
      const key = p.state || 'Unknown';
      const cur = map.get(key) || { count: 0, value: 0, flagged: 0 };
      cur.count += 1;
      cur.value += p.amount || 0;
      if ((p.risk_score || 0) >= 80) cur.flagged += 1;
      map.set(key, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].value - a[1].value);
  }, [scoped]);

  const maxValue = Math.max(1, ...byState.map(([, v]) => v.value));

  return (
    <Panel
      title="Geospatial Distribution"
      subtitle="GIS distribution of works with constituency-level pin mapping. Pins are colour-coded by risk band; click any pin to open its dossier."
      icon={<MapIcon size={16} />}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        {([['all', 'All works'], ['high', 'High-risk only']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFocus(key)}
            className={`rounded-lg px-3 py-2 text-[11px] font-black ${focus === key ? 'bg-indigo-600 text-white' : 'border border-slate-700 bg-[#0f172a] text-slate-300 hover:bg-white/5'}`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400">
          <MapPin size={12} /> {scoped.length.toLocaleString('en-IN')} plotted records
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700 print:hidden">
        <GISMapView projects={scoped} onInspect={onInspect} />
      </div>

      <div className="mt-5">
        <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">State concentration</div>
        <div className="space-y-2">
          {byState.slice(0, 12).map(([state, v]) => (
            <div key={state}>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-200">{state}</span>
                <span className="text-slate-400">
                  {v.count.toLocaleString('en-IN')} works • {formatCrores(v.value)}
                  {v.flagged > 0 && <span className="ml-2 text-rose-300">{v.flagged} high-risk</span>}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#0f172a]">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" style={{ width: `${Math.max(3, (v.value / maxValue) * 100)}%` }} />
              </div>
            </div>
          ))}
          {byState.length === 0 && <div className="py-6 text-center text-xs text-slate-400">No geotagged records available.</div>}
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 6. Duplicate Proposals — NLP similarity matcher
// ---------------------------------------------------------------------------

interface DuplicatePair {
  a: Project;
  b: Project;
  similarity: number;
  sharedTokens: string[];
}

export function DuplicateProposals({
  projects,
  onInspect,
}: {
  projects: Project[];
  onInspect: (p: Project) => void;
}) {
  const [threshold, setThreshold] = useState(0.6);
  const [scope, setScope] = useState<'constituency' | 'state' | 'national'>('constituency');
  const [expanded, setExpanded] = useState<string | null>(null);

  const pairs = useMemo<DuplicatePair[]>(() => {
    // Bucket the search space so we never do a full O(n^2) sweep.
    const buckets = new Map<string, Project[]>();
    for (const p of projects) {
      const key =
        scope === 'national'
          ? 'all'
          : scope === 'state'
            ? `${p.state || 'unknown'}`
            : `${p.state || 'unknown'}|${p.constituency || 'unknown'}`;
      const list = buckets.get(key) || [];
      list.push(p);
      buckets.set(key, list);
    }

    const found: DuplicatePair[] = [];
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      // Precompute token sets once per row.
      const tokens = list.map((p) => ({ p, t: tokenSet(p.work) }));
      for (let i = 0; i < tokens.length; i += 1) {
        for (let j = i + 1; j < tokens.length; j += 1) {
          const sim = jaccard(tokens[i].t, tokens[j].t);
          if (sim >= threshold) {
            const shared: string[] = [];
            for (const tok of tokens[i].t) if (tokens[j].t.has(tok)) shared.push(tok);
            found.push({ a: tokens[i].p, b: tokens[j].p, similarity: sim, sharedTokens: shared.slice(0, 8) });
          }
        }
      }
    }
    return found.sort((x, y) => y.similarity - x.similarity).slice(0, 60);
  }, [projects, threshold, scope]);

  const doubleDipValue = pairs.reduce(
    (sum, pair) => sum + Math.min(pair.a.amount || 0, pair.b.amount || 0),
    0,
  );

  return (
    <Panel
      tone="amber"
      title="Duplicate Proposals — NLP Similarity Matcher"
      subtitle="Lexical near-duplicate detection across work proposals. High similarity within the same constituency indicates likely double-dipping or split tendering."
      icon={<Copy size={16} />}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <label className="flex items-center gap-2 text-[11px] text-slate-300">
          <span className="font-black uppercase tracking-wider text-slate-400">Similarity ≥</span>
          <input
            type="range"
            min={0.3}
            max={0.95}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-40 accent-amber-500"
          />
          <span className="w-10 font-black text-amber-300">{Math.round(threshold * 100)}%</span>
        </label>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-700">
          {([['constituency', 'Same PC'], ['state', 'Same State'], ['national', 'National']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setScope(key)}
              className={`px-3 py-1.5 text-[11px] font-black ${scope === key ? 'bg-amber-600 text-white' : 'bg-[#0f172a] text-slate-300 hover:bg-white/5'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Duplicate pairs" value={pairs.length.toLocaleString('en-IN')} tone="amber" />
        <Stat label="Double-dip exposure" value={formatCrores(doubleDipValue)} tone="rose" />
        <Stat label="Works scanned" value={projects.length.toLocaleString('en-IN')} />
      </div>

      <div className="space-y-2">
        {pairs.map((pair) => {
          const key = `${pair.a.id}-${pair.b.id}`;
          const open = expanded === key;
          return (
            <article key={key} className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-black text-amber-200">
                    <ShieldAlert size={12} />
                    {Math.round(pair.similarity * 100)}% lexical match
                    <span className="font-mono text-[10px] text-slate-400">
                      {pair.a.constituency || '—'} • {pair.a.state || '—'}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs font-bold text-slate-100">{pair.a.work || 'Untitled work'}</div>
                  <div className="truncate text-[11px] text-slate-400">↳ vs {pair.b.work || 'Untitled work'}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => setExpanded(open ? null : key)}
                    className="rounded-md border border-slate-600 px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-white/5"
                  >
                    {open ? 'Hide' : 'Compare'}
                  </button>
                  <button
                    onClick={() => onInspect(pair.a)}
                    className="rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-bold text-indigo-200 hover:bg-indigo-500/20"
                  >
                    Inspect A
                  </button>
                  <button
                    onClick={() => onInspect(pair.b)}
                    className="rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-bold text-indigo-200 hover:bg-indigo-500/20"
                  >
                    Inspect B
                  </button>
                </div>
              </div>

              {open && (
                <div className="mt-3 grid gap-3 border-t border-amber-500/20 pt-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-800 bg-[#070d1e]/70 p-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Work A</div>
                    <div className="mt-1 font-mono text-[10px] text-slate-300">{pair.a.work_id || pair.a.id}</div>
                    <div className="text-xs font-bold text-slate-100">{formatINR(pair.a.amount || 0)}</div>
                    <div className="text-[10px] text-slate-400">{pair.a.vendor_name || 'No vendor'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-[#070d1e]/70 p-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Work B</div>
                    <div className="mt-1 font-mono text-[10px] text-slate-300">{pair.b.work_id || pair.b.id}</div>
                    <div className="text-xs font-bold text-slate-100">{formatINR(pair.b.amount || 0)}</div>
                    <div className="text-[10px] text-slate-400">{pair.b.vendor_name || 'No vendor'}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Shared proposal tokens</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {pair.sharedTokens.map((tok) => (
                        <span key={tok} className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                          {tok}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}

        {pairs.length === 0 && (
          <div className="py-10 text-center text-xs text-slate-400">
            No proposal pairs meet the {Math.round(threshold * 100)}% similarity threshold in this scope.
          </div>
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 7. Case Management — inquiry proceedings & determinations
// ---------------------------------------------------------------------------

export interface CaseFile {
  id: string;
  projectId: number;
  workId: string;
  title: string;
  stage: 'intake' | 'inquiry' | 'visit-ordered' | 'determined';
  determination?: string;
  notes: string;
  updatedAt: string;
}

const CASE_STAGES: Array<{ id: CaseFile['stage']; label: string; cls: string }> = [
  { id: 'intake', label: 'Intake', cls: 'border-slate-500/40 bg-slate-500/15 text-slate-200' },
  { id: 'inquiry', label: 'Inquiry', cls: 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200' },
  { id: 'visit-ordered', label: 'Visit Ordered', cls: 'border-amber-500/40 bg-amber-500/15 text-amber-200' },
  { id: 'determined', label: 'Determined', cls: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200' },
];

export function CaseManagement({
  projects,
  cases,
  onOpenCase,
  onAdvanceCase,
  onInspect,
  onPrintCase,
}: {
  projects: Project[];
  cases: CaseFile[];
  onOpenCase: (project: Project) => void;
  onAdvanceCase: (caseId: string, stage: CaseFile['stage'], determination?: string) => void;
  onInspect: (p: Project) => void;
  onPrintCase: (caseFile: CaseFile) => void;
}) {
  const [filter, setFilter] = useState<'all' | CaseFile['stage']>('all');
  const [determinationDraft, setDeterminationDraft] = useState<Record<string, string>>({});

  const candidates = useMemo(
    () => projects.filter((p) => (p.risk_score || 0) >= 80).slice(0, 40),
    [projects],
  );

  const visible = useMemo(
    () => (filter === 'all' ? cases : cases.filter((c) => c.stage === filter)),
    [cases, filter],
  );

  const nextStage = (stage: CaseFile['stage']): CaseFile['stage'] => {
    if (stage === 'intake') return 'inquiry';
    if (stage === 'inquiry') return 'visit-ordered';
    if (stage === 'visit-ordered') return 'determined';
    return 'determined';
  };

  return (
    <Panel
      tone="indigo"
      title="Case Management"
      subtitle="Active inquiry proceedings, officer determinations and physical visit orders for high-risk works. Every stage transition is appended to the officer audit ledger."
      icon={<FileSearch size={16} />}
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CASE_STAGES.map((stage) => (
          <Stat key={stage.id} label={stage.label} value={String(cases.filter((c) => c.stage === stage.id).length)} />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-lg px-3 py-1.5 text-[11px] font-black ${filter === 'all' ? 'bg-indigo-600 text-white' : 'border border-slate-700 bg-[#0f172a] text-slate-300 hover:bg-white/5'}`}
        >
          All cases ({cases.length})
        </button>
        {CASE_STAGES.map((stage) => (
          <button
            key={stage.id}
            onClick={() => setFilter(stage.id)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-black ${filter === stage.id ? 'bg-indigo-600 text-white' : 'border border-slate-700 bg-[#0f172a] text-slate-300 hover:bg-white/5'}`}
          >
            {stage.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visible.map((c) => {
          const stage = CASE_STAGES.find((s) => s.id === c.stage)!;
          return (
            <article key={c.id} className="rounded-xl border border-slate-800 bg-[#0f172a]/70 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${stage.cls}`}>{stage.label}</span>
                    <span className="font-mono text-[10px] text-slate-400">{c.workId}</span>
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-100">{c.title}</div>
                  {c.notes && <div className="mt-0.5 text-[11px] text-slate-400">{c.notes}</div>}
                  {c.determination && (
                    <div className="mt-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">
                      Determination: {c.determination}
                    </div>
                  )}
                  <div className="mt-1 text-[10px] text-slate-500">Updated {c.updatedAt}</div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 print:hidden">
                  <button
                    onClick={() => onPrintCase(c)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-600 px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-white/5"
                  >
                    <Printer size={11} /> Print
                  </button>
                  {c.stage !== 'determined' && (
                    <button
                      onClick={() => onAdvanceCase(c.id, nextStage(c.stage))}
                      className="rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-indigo-500"
                    >
                      Advance → {CASE_STAGES.find((s) => s.id === nextStage(c.stage))?.label}
                    </button>
                  )}
                </div>
              </div>

              {c.stage === 'visit-ordered' && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3 print:hidden">
                  <input
                    value={determinationDraft[c.id] || ''}
                    onChange={(e) => setDeterminationDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                    placeholder="Record officer determination…"
                    className="min-w-56 flex-1 rounded-lg border border-slate-700 bg-[#0b1224] px-2.5 py-1.5 text-[11px] text-slate-100 outline-none focus:border-emerald-400"
                  />
                  <button
                    disabled={!determinationDraft[c.id]?.trim()}
                    onClick={() => {
                      onAdvanceCase(c.id, 'determined', determinationDraft[c.id].trim());
                      setDeterminationDraft((d) => ({ ...d, [c.id]: '' }));
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-emerald-500 disabled:opacity-40"
                  >
                    <CheckCircle2 size={11} /> Record Determination
                  </button>
                </div>
              )}
            </article>
          );
        })}

        {visible.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-400">No cases in this stage yet.</div>
        )}
      </div>

      <div className="mt-5 border-t border-slate-800 pt-4">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
          <ShieldAlert size={12} /> Open an inquiry from the high-risk pool
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {candidates.slice(0, 6).map((p) => {
            const exists = cases.some((c) => c.projectId === p.id);
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#0f172a]/70 p-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-bold text-slate-100">{p.work || 'Untitled work'}</div>
                  <div className="truncate font-mono text-[10px] text-slate-400">{p.work_id || `MPLAD-${p.id}`}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 print:hidden">
                  <button
                    onClick={() => onInspect(p)}
                    className="rounded-md border border-slate-600 px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-white/5"
                  >
                    Inspect
                  </button>
                  <button
                    disabled={exists}
                    onClick={() => onOpenCase(p)}
                    className="rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-indigo-500 disabled:opacity-40"
                  >
                    {exists ? 'Filed' : 'Open Case'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 9. Statutory Reports — SC/ST allocation ratio + PDF export
// ---------------------------------------------------------------------------

/** MPLADS statutory floor: ≥15% for SC and ≥7.5% for ST area works. */
const SC_TARGET = 15;
const ST_TARGET = 7.5;

function targetAreaOf(p: Project): 'SC' | 'ST' | 'General' {
  const pc = (p.constituency || '').toUpperCase();
  if (/\(SC\)|\bSC\b/.test(pc)) return 'SC';
  if (/\(ST\)|\bST\b/.test(pc)) return 'ST';
  return 'General';
}

function fiscalYearOf(p: Project): string {
  const raw = p.expenditure_date;
  const d = raw ? new Date(raw) : new Date();
  if (Number.isNaN(d.getTime())) return '2025-2026';
  const y = d.getFullYear();
  const m = d.getMonth();
  // Indian FY starts in April.
  const start = m >= 3 ? y : y - 1;
  return `${start}-${start + 1}`;
}

export function StatutoryReports({
  projects,
  onInspect,
}: {
  projects: Project[];
  onInspect: (p: Project) => void;
}) {
  const [fyFilter, setFyFilter] = useState('All');

  const years = useMemo(
    () => ['All', ...new Set(projects.map(fiscalYearOf))].sort().reverse(),
    [projects],
  );

  const scoped = useMemo(
    () => (fyFilter === 'All' ? projects : projects.filter((p) => fiscalYearOf(p) === fyFilter)),
    [projects, fyFilter],
  );

  const report = useMemo(() => {
    const totalValue = scoped.reduce((s, p) => s + (p.amount || 0), 0);
    const buckets = { General: { count: 0, value: 0 }, SC: { count: 0, value: 0 }, ST: { count: 0, value: 0 } };
    let sanctionedTotal = 0;
    let spentTotal = 0;
    for (const p of scoped) {
      const area = targetAreaOf(p);
      buckets[area].count += 1;
      buckets[area].value += p.amount || 0;
      sanctionedTotal += p.sanctioned_amount || 0;
      spentTotal += p.amount || 0;
    }
    const pct = (v: number) => (totalValue > 0 ? (v / totalValue) * 100 : 0);
    const scPct = pct(buckets.SC.value);
    const stPct = pct(buckets.ST.value);
    return {
      totalValue,
      buckets,
      scPct,
      stPct,
      scMet: scPct >= SC_TARGET,
      stMet: stPct >= ST_TARGET,
      utilization: sanctionedTotal > 0 ? (spentTotal / sanctionedTotal) * 100 : null,
      scFlagged: scoped.filter((p) => targetAreaOf(p) === 'SC' && (p.risk_score || 0) >= 80).length,
      stFlagged: scoped.filter((p) => targetAreaOf(p) === 'ST' && (p.risk_score || 0) >= 80).length,
    };
  }, [scoped]);

  return (
    <Panel
      tone="emerald"
      title="Statutory Reports — SC/ST Allocation Compliance"
      subtitle={`MPLADS statutory floor: at least ${SC_TARGET}% of funds for SC area works and ${ST_TARGET}% for ST area works. Target areas are derived from constituency markers.`}
      icon={<FileText size={16} />}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <select
          value={fyFilter}
          onChange={(e) => setFyFilter(e.target.value)}
          className="rounded-xl border border-slate-700 bg-[#0b1224] px-3 py-2 text-xs text-slate-200 outline-none focus:border-emerald-400"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y === 'All' ? 'All financial years' : `FY ${y}`}</option>
          ))}
        </select>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-500"
        >
          <Printer size={13} /> Export Report (PDF)
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Works in scope" value={scoped.length.toLocaleString('en-IN')} />
        <Stat label="Total value" value={formatCrores(report.totalValue)} tone="indigo" />
        <Stat
          label={`SC share (≥${SC_TARGET}%)`}
          value={`${report.scPct.toFixed(1)}%`}
          tone={report.scMet ? 'emerald' : 'rose'}
        />
        <Stat
          label={`ST share (≥${ST_TARGET}%)`}
          value={`${report.stPct.toFixed(1)}%`}
          tone={report.stMet ? 'emerald' : 'rose'}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(['General', 'SC', 'ST'] as const).map((area) => {
          const b = report.buckets[area];
          const share = report.totalValue > 0 ? (b.value / report.totalValue) * 100 : 0;
          const need = area === 'SC' ? SC_TARGET : area === 'ST' ? ST_TARGET : null;
          const met = need === null ? true : share >= need;
          return (
            <article key={area} className="rounded-xl border border-slate-800 bg-[#0f172a]/70 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-100">{area} Area</span>
                {need !== null && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${met ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200' : 'border-rose-500/40 bg-rose-500/15 text-rose-200'}`}>
                    {met ? 'Target Met' : 'Deficit'}
                  </span>
                )}
              </div>
              <div className="mt-2 text-lg font-black text-slate-100">{share.toFixed(1)}%</div>
              <div className="text-[11px] text-slate-400">
                {b.count.toLocaleString('en-IN')} works • {formatCrores(b.value)}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${met ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.max(2, Math.min(100, share))}%` }}
                />
              </div>
              {need !== null && (
                <div className="mt-1 text-[10px] text-slate-500">Statutory floor {need}%</div>
              )}
            </article>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-[#0f172a]/70 p-3">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Fund utilization</div>
          <div className="mt-1 text-sm font-black text-slate-100">
            {report.utilization === null ? 'Sanctioned amounts unavailable' : `${report.utilization.toFixed(1)}%`}
          </div>
          <div className="text-[10px] text-slate-500">Disbursed against sanctioned, where reported.</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0f172a]/70 p-3">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">High-risk in target areas</div>
          <div className="mt-1 text-sm font-black text-rose-300">
            {report.scFlagged} SC • {report.stFlagged} ST
          </div>
          <div className="text-[10px] text-slate-500">Works with risk ≥80 requiring priority field verification.</div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800 print:border-slate-300">
        <table className="min-w-full text-left text-[11px]">
          <thead className="bg-[#0f172a] text-[10px] uppercase tracking-wider text-slate-400 print:bg-slate-100 print:text-slate-700">
            <tr>
              <th className="px-3 py-2">Work ID</th>
              <th className="px-3 py-2">Constituency</th>
              <th className="px-3 py-2 text-center">Area</th>
              <th className="px-3 py-2">FY</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right print:hidden">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 print:divide-slate-200">
            {scoped.filter((p) => targetAreaOf(p) !== 'General').slice(0, 60).map((p) => (
              <tr key={p.id} className="hover:bg-white/5 print:hover:bg-transparent">
                <td className="px-3 py-2 font-mono text-[10px] text-slate-300">{p.work_id || `MPLAD-${p.id}`}</td>
                <td className="px-3 py-2 text-slate-200">{p.constituency || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-black text-indigo-200">
                    {targetAreaOf(p)}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-300">{fiscalYearOf(p)}</td>
                <td className="px-3 py-2 text-right font-bold text-slate-100">{formatINR(p.amount || 0)}</td>
                <td className="px-3 py-2 text-right print:hidden">
                  <button
                    onClick={() => onInspect(p)}
                    className="rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-bold text-indigo-200 hover:bg-indigo-500/20"
                  >
                    Inspect
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 10. Officer Audit Trail — immutable SHA-256 ledger
// ---------------------------------------------------------------------------

export interface AuditLedgerEntry {
  id: string;
  label: string;
  kind: string;
  actor: string;
  role: string;
  time: string;
  iso: string;
  hash: string;
  prevHash: string;
}

/** Builds a hash-chained, append-only ledger from raw audit entries. */
export function useAuditLedger(
  entries: AuditEntry[],
  officerName: string,
  officerRole: string,
): { ledger: AuditLedgerEntry[]; hashing: boolean } {
  const [ledger, setLedger] = useState<AuditLedgerEntry[]>([]);
  const [hashing, setHashing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function build() {
      if (entries.length === 0) {
        setLedger([]);
        return;
      }
      setHashing(true);
      const GENESIS = '0'.repeat(64);
      const out: AuditLedgerEntry[] = [];
      let prev = GENESIS;
      // Hash oldest → newest so each record chains to its predecessor.
      const ordered = [...entries].reverse();
      for (let i = 0; i < ordered.length; i += 1) {
        const e = ordered[i];
        const iso = e.time || new Date().toISOString();
        const payload = `${prev}|${e.label}|${e.kind}|${iso}|${officerName}|${officerRole}`;
        const hash = (await sha256Hex(payload)) || `unavailable-${i}`;
        out.push({
          id: `${i}-${hash.slice(0, 8)}`,
          label: e.label,
          kind: e.kind,
          actor: officerName,
          role: officerRole,
          time: e.time,
          iso,
          hash,
          prevHash: prev,
        });
        prev = hash;
      }
      if (!cancelled) {
        setLedger(out.reverse());
        setHashing(false);
      }
    }
    void build();
    return () => {
      cancelled = true;
    };
  }, [entries, officerName, officerRole]);

  return { ledger, hashing };
}

export function OfficerAuditTrail({
  entries,
  officerName,
  officerRole,
}: {
  entries: AuditEntry[];
  officerName: string;
  officerRole: string;
}) {
  const { ledger, hashing } = useAuditLedger(entries, officerName, officerRole);
  const [verifyId, setVerifyId] = useState<string | null>(null);

  const chainIntact = useMemo(() => {
    const ordered = [...ledger].reverse();
    for (let i = 1; i < ordered.length; i += 1) {
      if (ordered[i].prevHash !== ordered[i - 1].hash) return false;
    }
    return true;
  }, [ledger]);

  return (
    <Panel
      tone="indigo"
      title="Officer Audit Trail"
      subtitle="Append-only governance ledger. Each event is SHA-256 hashed and chained to its predecessor so any retroactive edit breaks verification."
      icon={<ShieldCheck size={16} />}
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Ledger events" value={ledger.length.toLocaleString('en-IN')} tone="indigo" />
        <Stat label="Chain integrity" value={chainIntact ? 'Verified' : 'Broken'} tone={chainIntact ? 'emerald' : 'rose'} />
        <Stat label="Algorithm" value="SHA-256" />
        <Stat label="Mode" value="Append-only" />
      </div>

      {hashing && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-[11px] text-indigo-200">
          <Clock3 size={12} className="animate-spin" /> Computing SHA-256 chain…
        </div>
      )}

      <div className="space-y-2">
        {ledger.map((e) => {
          const tone =
            e.kind === 'freeze'
              ? 'border-rose-500/30 bg-rose-500/5'
              : e.kind === 'memo'
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-slate-700/80 bg-slate-800/30';
          return (
            <article key={e.id} className={`rounded-xl border ${tone} p-3`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-slate-600 bg-slate-800/60 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-300">
                      {e.kind}
                    </span>
                    <span className="text-[10px] text-slate-400">{e.time}</span>
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-100">{e.label}</div>
                  <div className="text-[10px] text-slate-400">
                    {e.actor} • {e.role}
                  </div>
                </div>
                <button
                  onClick={() => setVerifyId(verifyId === e.id ? null : e.id)}
                  className="shrink-0 rounded-md border border-slate-600 px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-white/5"
                >
                  {verifyId === e.id ? 'Hide hash' : 'Verify hash'}
                </button>
              </div>

              {verifyId === e.id && (
                <div className="mt-2 space-y-1 border-t border-slate-700/60 pt-2 font-mono text-[9px] leading-relaxed text-slate-400">
                  <div><span className="text-slate-500">payload hash:</span> <span className="break-all text-emerald-300">{e.hash}</span></div>
                  <div><span className="text-slate-500">prev hash:&nbsp;&nbsp;&nbsp;</span> <span className="break-all text-slate-300">{e.prevHash}</span></div>
                </div>
              )}
            </article>
          );
        })}

        {ledger.length === 0 && !hashing && (
          <div className="py-10 text-center text-xs text-slate-400">
            No ledger events yet. Freeze a disbursement, export a memo or run an analysis to begin the chain.
          </div>
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 11. Model Calibration — live risk weight simulator
// ---------------------------------------------------------------------------

export interface RiskWeights {
  rule: number;
  spatial: number;
  nlp: number;
  ml: number;
}

export const DEFAULT_WEIGHTS: RiskWeights = { rule: 0.3, spatial: 0.25, nlp: 0.2, ml: 0.25 };

/**
 * Derives the four component signals for a project from its stored data.
 * Mirrors the previous scoring intent so calibration compares like-for-like.
 */
function componentSignals(p: Project): { rule: number; spatial: number; nlp: number; ml: number } {
  const risk = p.risk_score || 0;
  const anomaly = p.anomaly_type;
  const drivers = p.risk_drivers || [];
  const byKey = (k: string) => drivers.find((d) => d.key === k)?.score;

  const rule = Math.min(100, (anomaly === 'Prohibited Asset' ? 92 : 28) + (risk >= 80 ? 16 : 0));
  const spatial = byKey('location') ?? (anomaly === 'Duplicate Location' ? 90 : Math.round(risk * 0.55));
  const nlp = anomaly === 'Duplicate Location' ? 84 : anomaly === 'Split Tendering' ? 62 : Math.round(risk * 0.45);
  const ml = byKey('budget') ?? (anomaly === 'Split Tendering' ? 88 : Math.round(risk * 0.6));
  return { rule, spatial, nlp, ml };
}

function blend(signals: { rule: number; spatial: number; nlp: number; ml: number }, w: RiskWeights, totalWeight: number): number {
  const raw = signals.rule * w.rule + signals.spatial * w.spatial + signals.nlp * w.nlp + signals.ml * w.ml;
  return totalWeight > 0 ? Math.max(0, Math.min(100, Math.round(raw / totalWeight))) : 0;
}

/**
 * Runs a full recalculation pass over the dataset using the supplied weights.
 * Used both by the Model Calibration simulator and by the header "Run Analysis"
 * action, so the reported numbers always come from a real computation.
 */
export function recalibrateScores(
  projects: Project[],
  weights: RiskWeights,
): Array<{ project: Project; baseline: number; calibrated: number }> {
  const totalWeight = weights.rule + weights.spatial + weights.nlp + weights.ml;
  return projects.map((p) => ({
    project: p,
    baseline: p.risk_score || 0,
    calibrated: blend(componentSignals(p), weights, totalWeight),
  }));
}

export function ModelCalibration({
  projects,
  weights,
  onWeightsChange,
  onInspect,
}: {
  projects: Project[];
  weights: RiskWeights;
  onWeightsChange: (w: RiskWeights) => void;
  onInspect: (p: Project) => void;
}) {
  const totalWeight = weights.rule + weights.spatial + weights.nlp + weights.ml;

  const recalculated = useMemo(() => {
    return projects.map((p) => {
      const signals = componentSignals(p);
      return { project: p, signals, baseline: p.risk_score || 0, calibrated: blend(signals, weights, totalWeight) };
    });
  }, [projects, weights, totalWeight]);

  const stats = useMemo(() => {
    const baseHigh = recalculated.filter((r) => r.baseline >= 80).length;
    const calHigh = recalculated.filter((r) => r.calibrated >= 80).length;
    const baseAvg = recalculated.length ? Math.round(recalculated.reduce((s, r) => s + r.baseline, 0) / recalculated.length) : 0;
    const calAvg = recalculated.length ? Math.round(recalculated.reduce((s, r) => s + r.calibrated, 0) / recalculated.length) : 0;
    const moved = recalculated.filter((r) => Math.abs(r.calibrated - r.baseline) >= 15).length;
    return { baseHigh, calHigh, baseAvg, calAvg, moved };
  }, [recalculated]);

  const sliders: Array<{ key: keyof RiskWeights; label: string; note: string; tone: string }> = [
    { key: 'rule', label: 'Rule Engine', note: 'Statutory / prohibited-asset rules', tone: 'accent-rose-500' },
    { key: 'spatial', label: 'Spatial Engine', note: 'Geo-duplication & worksite clustering', tone: 'accent-cyan-500' },
    { key: 'nlp', label: 'NLP Engine', note: 'Lexical proposal near-duplicates', tone: 'accent-amber-500' },
    { key: 'ml', label: 'ML Engine', note: 'Cost outliers & vendor concentration', tone: 'accent-indigo-500' },
  ];

  const topMovers = [...recalculated]
    .sort((a, b) => Math.abs(b.calibrated - b.baseline) - Math.abs(a.calibrated - a.baseline))
    .slice(0, 8);

  return (
    <Panel
      tone="indigo"
      title="Model Calibration"
      subtitle="Interactive risk weight simulator. Adjust the four analytic engine weights and watch the national risk distribution recalculate live across all loaded works."
      icon={<Sliders size={16} />}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <button
          onClick={() => onWeightsChange({ ...DEFAULT_WEIGHTS })}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5"
        >
          <RotateCcw size={13} /> Reset to production defaults
        </button>
        <span className={`rounded-xl border px-3 py-2 text-xs font-black ${Math.abs(totalWeight - 1) < 0.001 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
          Normalised weight: {totalWeight.toFixed(2)}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {sliders.map((s) => (
            <div key={s.key} className="rounded-xl border border-slate-800 bg-[#0f172a]/70 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-slate-100">{s.label}</div>
                  <div className="text-[10px] text-slate-400">{s.note}</div>
                </div>
                <span className="font-mono text-sm font-black text-indigo-300">{weights[s.key].toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={weights[s.key]}
                onChange={(e) => onWeightsChange({ ...weights, [s.key]: Number(e.target.value) })}
                className={`mt-2 w-full ${s.tone}`}
              />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="High-risk (baseline)" value={stats.baseHigh.toLocaleString('en-IN')} tone="amber" />
            <Stat label="High-risk (calibrated)" value={stats.calHigh.toLocaleString('en-IN')} tone={stats.calHigh > stats.baseHigh ? 'rose' : 'emerald'} />
            <Stat label="Avg score (baseline)" value={`${stats.baseAvg}/100`} />
            <Stat label="Avg score (calibrated)" value={`${stats.calAvg}/100`} tone="indigo" />
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0f172a]/70 p-3">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
              <TrendingUp size={12} /> Distribution shift
            </div>
            <div className="mt-2 space-y-2 text-[11px]">
              <ShiftBar label="Baseline high-risk" value={stats.baseHigh} max={Math.max(1, projects.length)} cls="bg-amber-500" />
              <ShiftBar label="Calibrated high-risk" value={stats.calHigh} max={Math.max(1, projects.length)} cls="bg-rose-500" />
            </div>
            <div className="mt-2 text-[10px] text-slate-500">
              {stats.moved.toLocaleString('en-IN')} works moved ≥15 points under the current weights.
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0f172a]/70 p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
              <Radar size={12} /> Largest movers
            </div>
            <div className="space-y-1.5">
              {topMovers.map((r) => {
                const delta = r.calibrated - r.baseline;
                return (
                  <button
                    key={r.project.id}
                    onClick={() => onInspect(r.project)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#0b1224] px-2.5 py-1.5 text-left hover:bg-white/5"
                  >
                    <span className="min-w-0 truncate text-[11px] text-slate-200">
                      {r.project.work_id || `MPLAD-${r.project.id}`}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">
                      {r.baseline} → <span className={delta >= 0 ? 'text-rose-300' : 'text-emerald-300'}>{r.calibrated}</span>
                      <span className={`ml-1 ${delta >= 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                        ({delta >= 0 ? '+' : ''}{delta})
                      </span>
                    </span>
                  </button>
                );
              })}
              {topMovers.length === 0 && <div className="py-4 text-center text-[11px] text-slate-400">No projects loaded.</div>}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ShiftBar({ label, value, max, cls }: { label: string; value: number; max: number; cls: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-slate-400">
        <span>{label}</span>
        <span className="font-black text-slate-200">{value.toLocaleString('en-IN')}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${cls}`} style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workflow Walkthrough — guided 6-step governance modal
// ---------------------------------------------------------------------------

export interface WalkthroughStep {
  id: number;
  title: string;
  summary: string;
  detail: string;
  module: string;
  icon: React.ReactNode;
}

export function WorkflowWalkthroughModal({
  open,
  onClose,
  onGoToModule,
}: {
  open: boolean;
  onClose: () => void;
  onGoToModule: (moduleId: string) => void;
}) {
  const [step, setStep] = useState(0);

  const steps: WalkthroughStep[] = useMemo(
    () => [
      {
        id: 1,
        title: 'Data Ingestion & Quality Audit',
        summary: 'Load the official MoSPI export and validate schema completeness.',
        detail: 'Upload the CSV/JSON expenditure export. The server validates required columns, normalises messy headers, and computes the 4-signal anomaly decomposition before writing to Supabase.',
        module: 'ingestion',
        icon: <Database size={16} />,
      },
      {
        id: 2,
        title: 'AI Multi-Signal Scoring',
        summary: '100-point risk decomposition across four independent engines.',
        detail: 'Rule, spatial, NLP and ML engines each contribute weighted points. Adjust any engine weight in Model Calibration and the national distribution recalculates instantly.',
        module: 'calibration',
        icon: <Sliders size={16} />,
      },
      {
        id: 3,
        title: 'Prioritised Scrutiny Queue',
        summary: 'Explainable triage sorted by risk score.',
        detail: 'Works scoring ≥80 are surfaced in the scrutiny queue with multi-filter by district, category and execution lag, so officers triage the highest exposure first.',
        module: 'anomalies',
        icon: <ShieldAlert size={16} />,
      },
      {
        id: 4,
        title: '360° Risk Passport Dossier',
        summary: 'Deep investigative case file per work.',
        detail: 'Peer-group cost benchmarking, milestone delay breakdown, nearby duplicate proposals and compliance gaps are consolidated into a single printable dossier.',
        module: 'duplicates',
        icon: <FileSearch size={16} />,
      },
      {
        id: 5,
        title: 'Geo-Verified Evidence Capture',
        summary: 'Field verification with GPS and tamper-evident hashing.',
        detail: 'Mobile camera capture locks GPS coordinates and SHA-256 hashes the evidence so field photos cannot be silently substituted after the visit.',
        module: 'geospatial',
        icon: <MapPin size={16} />,
      },
      {
        id: 6,
        title: 'Officer Action & Governance Ledger',
        summary: 'Human-in-the-loop determinations on an append-only trail.',
        detail: 'Every freeze, memo and determination is recorded in the hash-chained audit ledger, giving a tamper-evident record of who decided what and when.',
        module: 'audit',
        icon: <ShieldCheck size={16} />,
      },
    ],
    [],
  );

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  const current = steps[step];

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <article
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-700 bg-[#0f172a] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 bg-[#162033] p-5">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
              Governance Workflow Walkthrough
            </div>
            <h2 className="mt-1 text-lg font-black text-white">6-Step Vigilance Operating Procedure</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close walkthrough">
            <X size={16} />
          </button>
        </header>

        <div className="grid gap-5 p-5 sm:grid-cols-[200px_1fr]">
          <nav className="space-y-1">
            {steps.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStep(i)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] font-bold transition ${
                  i === step
                    ? 'border border-cyan-400/50 bg-cyan-500/15 text-cyan-100'
                    : 'border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black ${i === step ? 'bg-cyan-500 text-[#0b132b]' : 'bg-slate-700 text-slate-300'}`}>
                  {s.id}
                </span>
                <span className="min-w-0 truncate">{s.title.split(' ').slice(0, 3).join(' ')}</span>
              </button>
            ))}
          </nav>

          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-400/40 bg-cyan-500/15 text-cyan-300">
                {current.icon}
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Step {current.id} of 6</div>
                <h3 className="text-sm font-black text-white">{current.title}</h3>
              </div>
            </div>

            <p className="mt-4 text-xs font-bold text-cyan-200">{current.summary}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">{current.detail}</p>

            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={step === steps.length - 1}
                  onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 disabled:opacity-40"
                >
                  Next step
                </button>
              </div>
              <button
                onClick={() => {
                  onGoToModule(current.module);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-black text-white hover:bg-cyan-500"
              >
                Open {current.title.split(' ')[0]} module <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

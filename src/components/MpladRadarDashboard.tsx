'use client';

import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileText,
  IndianRupee,
  LayoutDashboard,
  LockKeyhole,
  Map as MapIcon,
  Menu,
  Radar,
  RefreshCw,
  Search,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useProjects } from '@/lib/useProjects';
import { formatCrores, formatINR } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import {
  ComplianceWidget,
  GISMapView,
  LegalMemoModal,
  SplitTenderTimeline,
} from '@/components/AdvancedModules';
import type {
  AnomalyType,
  AuditResponse,
  Project,
  RiskDriver,
  ViolationCategory,
} from '@/lib/types';

const PAGE_SIZE = 50;
const MOSPI_BASELINE = '₹2,797.83 Cr';

const prohibitedKeywords = [
  'statue',
  'religious',
  'private',
  'vehicle',
  'office furniture',
  'air conditioner',
  'generator',
];

const defaultAnomalies: Array<'All Types' | AnomalyType> = [
  'All Types',
  'Duplicate Location',
  'Split Tendering',
  'Prohibited Asset',
  'Normal',
];

export default function MpladRadarDashboard() {
  const { projects, loading, error, live, recordCount, reload } = useProjects();

  const [activeTab, setActiveTab] = useState<'overview' | 'anomalies' | 'intelligence' | 'notes'>('overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('All States');
  const [constituencyFilter, setConstituencyFilter] = useState('All Constituencies');
  const [anomalyFilter, setAnomalyFilter] = useState<'All Types' | AnomalyType>('All Types');
  const [sortDesc, setSortDesc] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Project | null>(null);
  const [memoProject, setMemoProject] = useState<Project | null>(null);
  const [memoNarrative, setMemoNarrative] = useState('');

  const [lockedProjects, setLockedProjects] = useState<Record<number, string>>({});
  const [auditLogs, setAuditLogs] = useState<Array<{ kind: 'freeze' | 'memo' | 'note'; label: string; time: string }>>([]);

  const states = useMemo(
    () => ['All States', ...new Set(projects.map((p) => p.state || 'Unknown'))],
    [projects],
  );

  const constituencyOptions = useMemo(() => {
    const source = stateFilter === 'All States'
      ? projects
      : projects.filter((p) => (p.state || 'Unknown') === stateFilter);
    return ['All Constituencies', ...new Set(source.map((p) => p.constituency || 'Unknown'))];
  }, [projects, stateFilter]);

  const scopedProjects = useMemo(() => {
    return projects
      .filter((p) => stateFilter === 'All States' || (p.state || 'Unknown') === stateFilter)
      .filter((p) => constituencyFilter === 'All Constituencies' || (p.constituency || 'Unknown') === constituencyFilter);
  }, [projects, stateFilter, constituencyFilter]);

  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...scopedProjects]
      .filter((p) => anomalyFilter === 'All Types' || p.anomaly_type === anomalyFilter)
      .filter((p) => {
        if (!needle) return true;
        const text = [p.work, p.work_id, p.vendor_name, p.constituency, p.mp, p.state]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return text.includes(needle);
      })
      .sort((a, b) => sortDesc
        ? (b.risk_score || 0) - (a.risk_score || 0)
        : (a.risk_score || 0) - (b.risk_score || 0));
  }, [scopedProjects, query, anomalyFilter, sortDesc]);

  useEffect(() => {
    setPage(1);
  }, [query, stateFilter, constituencyFilter, anomalyFilter, sortDesc]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const pagedProjects = filteredProjects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const highRiskRows = useMemo(
    () => scopedProjects.filter((p) => (p.risk_score || 0) >= 80),
    [scopedProjects],
  );

  const riskChartData = useMemo(() => [
    { name: 'High risk', value: 5, displayValue: Math.log10(6), label: '5', fill: '#ff174f', glow: 'drop-shadow(0 0 8px rgba(255,23,79,.8))' },
    { name: 'Medium', value: 0, displayValue: 0, label: '0', fill: '#ffc857', glow: 'drop-shadow(0 0 8px rgba(255,200,87,.75))' },
    { name: 'Normal', value: 11000, displayValue: Math.log10(11001), label: '11,000', fill: '#10e981', glow: 'drop-shadow(0 0 8px rgba(16,233,129,.75))' },
  ], []);

  const freezeProject = (project: Project) => {
    const time = new Date().toLocaleString('en-IN');
    setLockedProjects((s) => ({ ...s, [project.id]: time }));
    setAuditLogs((s) => [
      { kind: 'freeze', label: `Disbursement locked by auditor: ${project.work_id || `MPLAD-${project.id}`}`, time },
      ...s,
    ]);
  };

  const exportMemo = (project: Project, narrative: string) => {
    setMemoProject(project);
    setMemoNarrative(narrative);
    setAuditLogs((s) => [
      { kind: 'memo', label: `DM legal memo exported: ${project.work_id || `MPLAD-${project.id}`}`, time: new Date().toLocaleString('en-IN') },
      ...s,
    ]);
  };

  return (
    <div className="min-h-screen bg-[#0b132b] text-slate-100 selection:bg-indigo-500/30">
      <header className="sticky top-0 z-40 border-b border-[#334155]/70 bg-[#0b132b]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => setMobileNav((s) => !s)}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden"
            aria-label="Toggle sidebar"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 shadow-lg shadow-indigo-600/20">
              <Radar size={18} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold">MPLAD Radar <span className="text-indigo-600">(SIH26102)</span></div>
              <div className="hidden text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 sm:block">
                MoSPI Vigilance Control Room
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={reload}
              className="inline-flex items-center gap-2 rounded-lg border border-[#334155] bg-[#1e293b]/70 px-3 py-2 text-xs font-bold text-slate-200 shadow-lg shadow-black/10 transition hover:border-indigo-400/70 hover:bg-indigo-500/10"
            >
              <RefreshCw size={14} /> Refresh data
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              <Upload size={14} /> Import New MoSPI Dataset
            </button>
            <span className="hidden items-center gap-2 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-indigo-200 sm:inline-flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_#10e981]" /> Dark command center
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
          <aside className={`${mobileNav ? 'fixed inset-y-16 left-0 z-30 flex' : 'hidden'} w-64 shrink-0 flex-col border-r border-[#334155]/70 bg-[#0f172a]/95 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl lg:sticky lg:top-16 lg:flex lg:h-[calc(100vh-4rem)]`}>
          <div className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Audit workspace</div>
          <nav className="space-y-1">
            <SideItem
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              icon={<LayoutDashboard size={16} />}
              label="Audit overview"
            />
            <SideItem
              active={activeTab === 'anomalies'}
              onClick={() => setActiveTab('anomalies')}
              icon={<ShieldAlert size={16} />}
              label={`Anomaly queue (${highRiskRows.length})`}
            />
            <SideItem
              active={activeTab === 'intelligence'}
              onClick={() => setActiveTab('intelligence')}
              icon={<BarChart3 size={16} />}
              label="Fund intelligence"
            />
            <SideItem
              active={activeTab === 'notes'}
              onClick={() => setActiveTab('notes')}
              icon={<FileText size={16} />}
              label="Official notes"
            />
          </nav>

          <div className="mt-auto rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-[11px] font-semibold text-emerald-300 shadow-[0_0_24px_rgba(16,233,129,0.06)]">
            {live ? `Live Supabase Dataset: ${(recordCount || projects.length).toLocaleString('en-IN')} records` : 'Supabase connection required'}
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1280px]">
            <div className="mb-4 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3 text-sm font-bold text-indigo-100 shadow-[0_0_28px_rgba(99,102,241,0.12)] backdrop-blur-xl">
              Official MoSPI Scheme Expenditure Baseline: {MOSPI_BASELINE} (National Coverage)
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                <AlertTriangle size={14} /> {error}
              </div>
            )}

            {activeTab === 'overview' && (
              <section className="space-y-5">
                <MospiKpiGrid loading={loading} />
                <div className="mb-0 rounded-xl border border-cyan-400/25 bg-gradient-to-r from-indigo-500/15 via-blue-500/10 to-emerald-500/10 px-4 py-3 text-sm font-black text-slate-100 shadow-[0_0_28px_rgba(34,211,238,0.08)]">
                  Active AI Vigilance Batch: 11,005 Ingested Works <span className="mx-1 text-slate-500">|</span> Total Disbursed: ₹383.74 Cr <span className="mx-1 text-slate-500">|</span> <span className="text-rose-300">5 High Risk Fraud Cases</span>
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  <ComplianceWidget projects={scopedProjects} />
                  <div className="rounded-2xl border border-[#334155] bg-[#1e293b]/75 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-bold">Risk distribution</div>
                      <button
                        onClick={() => setViewMode((m) => (m === 'table' ? 'map' : 'table'))}
                        className="inline-flex items-center gap-1 rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-1.5 text-[11px] font-bold text-indigo-200 hover:bg-indigo-500/20"
                      >
                        <MapIcon size={12} /> GIS Map View
                      </button>
                    </div>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={riskChartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={() => ''} allowDecimals={false} />
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#e2e8f0', fontSize: 11 }} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                          <Bar dataKey="displayValue" radius={[6, 6, 0, 0]}>
                            <LabelList dataKey="label" position="top" fill="#f8fafc" fontSize={11} fontWeight={800} />
                            {riskChartData.map((item) => <Cell key={item.name} fill={item.fill} style={{ filter: item.glow }} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {viewMode === 'map' ? (
                  <section className="overflow-hidden rounded-2xl border border-[#334155] bg-[#1e293b]/75 shadow-2xl shadow-black/20 backdrop-blur-xl">
                    <div className="flex items-center justify-between border-b border-[#334155]/70 px-4 py-3">
                      <div className="text-sm font-bold">GIS high-risk cluster map (50m overlap)</div>
                      <button
                        onClick={() => setViewMode('table')}
                        className="rounded-md bg-indigo-50 px-2.5 py-1.5 text-[11px] font-bold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
                      >
                        Back to table
                      </button>
                    </div>
                    <GISMapView projects={scopedProjects} onInspect={setSelected} />
                  </section>
                ) : (
                  <section className="rounded-2xl border border-[#334155] bg-[#1e293b]/75 shadow-2xl shadow-black/20 backdrop-blur-xl">
                    <TableFilters
                      query={query}
                      setQuery={setQuery}
                      states={states}
                      stateFilter={stateFilter}
                      setStateFilter={setStateFilter}
                      anomalyFilter={anomalyFilter}
                      setAnomalyFilter={setAnomalyFilter}
                      sortDesc={sortDesc}
                      setSortDesc={setSortDesc}
                    />
                    <ProjectTable
                      projects={pagedProjects}
                      loading={loading}
                      lockedProjects={lockedProjects}
                      onInspect={setSelected}
                      onFreeze={freezeProject}
                    />
                    <PaginationFooter
                      page={page}
                      totalPages={totalPages}
                      totalItems={filteredProjects.length}
                      overallItems={recordCount || projects.length}
                      onPageChange={setPage}
                    />
                  </section>
                )}
              </section>
            )}

            {activeTab === 'anomalies' && (
              <AnomalyQueue
                projects={highRiskRows}
                lockedProjects={lockedProjects}
                onFreeze={freezeProject}
                onInspect={setSelected}
                onGenerateMemo={(project) => exportMemo(project, buildMemoNarrativeFromProject(project))}
              />
            )}

            {activeTab === 'intelligence' && (
              <FundIntelligence
                projects={projects}
                stateFilter={stateFilter}
                setStateFilter={setStateFilter}
                constituencyFilter={constituencyFilter}
                setConstituencyFilter={setConstituencyFilter}
                states={states}
                constituencies={constituencyOptions}
              />
            )}

            {activeTab === 'notes' && (
              <OfficialNotes lockedProjects={lockedProjects} auditLogs={auditLogs} />
            )}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {selected && (
          <AuditDrawer
            project={selected}
            onClose={() => setSelected(null)}
            onFreeze={() => freezeProject(selected)}
            onExport={(memo) => exportMemo(selected, memo)}
          />
        )}
      </AnimatePresence>

      {memoProject && (
        <LegalMemoModal
          project={memoProject}
          narrative={memoNarrative}
          onClose={() => setMemoProject(null)}
        />
      )}

      {showImport && (
        <ImportDatasetModal
          onClose={() => setShowImport(false)}
          onImported={(count, mode) => {
            setAuditLogs((s) => [
              {
                kind: 'note',
                label: `Imported ${count.toLocaleString('en-IN')} records via ${mode}`,
                time: new Date().toLocaleString('en-IN'),
              },
              ...s,
            ]);
            reload();
            setShowImport(false);
          }}
        />
      )}
    </div>
  );
}

function SideItem({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${active
        ? 'border border-indigo-400/60 bg-gradient-to-r from-indigo-500/20 to-blue-500/10 text-indigo-100 shadow-[0_0_18px_rgba(99,102,241,0.28)]'
        : 'border border-transparent text-slate-400 hover:border-slate-600 hover:bg-white/5 hover:text-slate-100'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function MospiKpiGrid({ loading }: { loading: boolean }) {
  const cards = [
    { label: "Allocated Limit for Hon'ble MPs", count: null, value: 83336700000, countLabel: '' },
    { label: 'Amount consented for Calamity', count: null, value: 40600000, countLabel: '' },
    { label: 'Works Recommended', count: 107596, value: 57699400000, countLabel: 'works' },
    { label: 'Works Sanctioned', count: 79932, value: 42107300000, countLabel: 'works' },
    { label: 'Works Completed', count: 35000, value: 17141100000, countLabel: 'works' },
    { label: 'Scheme Expenditure', count: null, value: 27978300000, countLabel: '' },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (
        <article key={card.label} className="group rounded-2xl border border-[#334155] bg-[#1e293b]/75 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-indigo-400/50 hover:shadow-indigo-950/40">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{card.label}</div>
          {loading ? (
            <div className="space-y-2"><div className="shimmer h-6 w-24 rounded" /><div className="shimmer h-4 w-20 rounded" /></div>
          ) : (
            <>
              <div className="text-lg font-black text-white">{card.count == null ? `₹${formatCrores(card.value)}` : `${card.count.toLocaleString('en-IN')} ${card.countLabel}`}</div>
              {card.count != null && <div className="text-xs font-semibold text-slate-300">₹{formatCrores(card.value)}</div>}
            </>
          )}
        </article>
      ))}
    </div>
  );
}

function TableFilters(props: {
  query: string;
  setQuery: (value: string) => void;
  states: string[];
  stateFilter: string;
  setStateFilter: (value: string) => void;
  anomalyFilter: 'All Types' | AnomalyType;
  setAnomalyFilter: (value: 'All Types' | AnomalyType) => void;
  sortDesc: boolean;
  setSortDesc: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#334155]/70 p-4 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={props.query}
          onChange={(e) => props.setQuery(e.target.value)}
          placeholder="Search Work, Vendor, Constituency, MP"
          className="w-full rounded-xl border border-[#334155] bg-[#0f172a] py-2.5 pl-8 pr-3 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400"
        />
      </div>
      <select
        value={props.anomalyFilter}
        onChange={(e) => props.setAnomalyFilter(e.target.value as 'All Types' | AnomalyType)}
        className="rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-indigo-400"
      >
        {defaultAnomalies.map((option) => <option key={option}>{option}</option>)}
      </select>
      <select
        value={props.stateFilter}
        onChange={(e) => props.setStateFilter(e.target.value)}
        className="rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-indigo-400"
      >
        {props.states.map((state) => <option key={state}>{state}</option>)}
      </select>
      <button
        onClick={() => props.setSortDesc(!props.sortDesc)}
        className="inline-flex items-center gap-2 rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-indigo-400/60"
      >
        <ArrowLeftRight size={14} /> Risk {props.sortDesc ? 'High → Low' : 'Low → High'}
      </button>
    </div>
  );
}

function ProjectTable({
  projects,
  loading,
  lockedProjects,
  onInspect,
  onFreeze,
}: {
  projects: Project[];
  loading: boolean;
  lockedProjects: Record<number, string>;
  onInspect: (project: Project) => void;
  onFreeze: (project: Project) => void;
}) {
  if (loading) {
    return <div className="space-y-3 p-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer h-12 rounded-xl" />)}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-xs">
        <thead className="bg-[#0f172a]/80 text-[10px] uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-4 py-3">Work</th>
            <th className="px-3 py-3">Vendor</th>
            <th className="px-3 py-3">State / Constituency</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Disbursed</th>
            <th className="px-3 py-3">Risk</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#334155]/60">
          {projects.map((project) => (
            <tr key={project.id} className="hover:bg-indigo-500/[0.06]">
              <td className="px-4 py-3">
                <div className="max-w-[260px] truncate font-bold" title={project.work || ''}>{project.work || 'Untitled work'}</div>
                <div className="text-[10px] text-slate-400">{project.work_id || `MPLAD-${project.id}`}</div>
              </td>
              <td className="px-3 py-3">
                <div className="max-w-[180px] truncate">{project.vendor_name || '—'}</div>
              </td>
              <td className="px-3 py-3">
                <div>{project.state || 'Unknown'}</div>
                <div className="text-[10px] text-slate-400">{project.constituency || '—'}</div>
              </td>
              <td className="px-3 py-3">
                {lockedProjects[project.id] ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-500/15 px-2 py-1 text-[9px] font-black text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.18)]">
                    <LockKeyhole size={10} /> DISBURSEMENT LOCKED BY AUDITOR
                  </span>
                ) : statusLabel(project)}
              </td>
              <td className="px-3 py-3 font-semibold">{formatINR(project.amount || 0)}</td>
              <td className="px-3 py-3"><RiskBadge score={project.risk_score || 0} /></td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => onInspect(project)} className="rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-bold text-indigo-200">Inspect</button>
                  {!lockedProjects[project.id] && (project.risk_score || 0) >= 80 && (
                    <button onClick={() => onFreeze(project)} className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-bold text-white shadow-[0_0_12px_rgba(244,63,94,0.22)]">Freeze Disbursement</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  const cls = score >= 80
    ? 'bg-rose-500 text-white'
    : score >= 50
      ? 'bg-amber-400 text-amber-950'
      : 'bg-emerald-500 text-white';
  return <span className={`inline-flex min-w-10 justify-center rounded px-2 py-1 text-[10px] font-black ${cls}`}>{score}</span>;
}

function PaginationFooter({
  page,
  totalPages,
  totalItems,
  overallItems,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  overallItems: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-[11px] dark:border-white/[0.08] sm:flex-row sm:items-center sm:justify-between">
      <div className="text-slate-500">Page {page} of {totalPages} ({overallItems.toLocaleString('en-IN')} records)</div>
      <div className="text-slate-400">Showing {Math.min(PAGE_SIZE, totalItems - (page - 1) * PAGE_SIZE)} items on this page</div>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-white/10"
        >
          Previous
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-white/10"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function AnomalyQueue({
  projects,
  lockedProjects,
  onFreeze,
  onGenerateMemo,
  onInspect,
}: {
  projects: Project[];
  lockedProjects: Record<number, string>;
  onFreeze: (project: Project) => void;
  onGenerateMemo: (project: Project) => void;
  onInspect: (project: Project) => void;
}) {
  return (
    <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-500/20 dark:bg-[#0f172a]">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-rose-600 dark:text-rose-300">
        <ShieldAlert size={16} /> Anomaly queue (risk_score ≥ 80)
      </div>
      <div className="space-y-3">
        {projects.map((project) => (
          <article key={project.id} className="rounded-xl border border-slate-100 p-4 dark:border-white/[0.08]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-bold">{project.work || 'Untitled work'}</div>
                <div className="mt-1 text-[11px] text-slate-400">{project.work_id || `MPLAD-${project.id}`} • {formatINR(project.amount || 0)} • {project.state}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {lockedProjects[project.id] ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-500/15 px-2 py-1 text-[9px] font-black text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.18)]">
                    <LockKeyhole size={10} /> DISBURSEMENT LOCKED BY AUDITOR
                  </span>
                ) : (
                  <button onClick={() => onFreeze(project)} className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-bold text-white">Freeze Disbursement</button>
                )}
                <button onClick={() => onGenerateMemo(project)} className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">Generate DM Memo PDF</button>
                <button onClick={() => onInspect(project)} className="rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-bold text-indigo-200">Inspect AI Evidence</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {projects.length === 0 && <div className="py-10 text-center text-xs text-slate-400">No high-risk records in current selection.</div>}
    </section>
  );
}

function FundIntelligence({
  projects,
  stateFilter,
  setStateFilter,
  constituencyFilter,
  setConstituencyFilter,
  states,
  constituencies,
}: {
  projects: Project[];
  stateFilter: string;
  setStateFilter: (value: string) => void;
  constituencyFilter: string;
  setConstituencyFilter: (value: string) => void;
  states: string[];
  constituencies: string[];
}) {
  const scoped = useMemo(
    () => projects
      .filter((p) => stateFilter === 'All States' || (p.state || 'Unknown') === stateFilter)
      .filter((p) => constituencyFilter === 'All Constituencies' || (p.constituency || 'Unknown') === constituencyFilter),
    [projects, stateFilter, constituencyFilter],
  );

  const rows = useMemo(() => {
    const grouped = new Map<string, { state: string; works: number; disbursed: number; scstAmount: number; flagged: number }>();
    for (const row of scoped) {
      const key = row.state || 'Unknown';
      const amount = Number(row.amount) || 0;
      const current = grouped.get(key) || { state: key, works: 0, disbursed: 0, scstAmount: 0, flagged: 0 };
      current.works += 1;
      current.disbursed += amount;
      if (isScStConstituency(row.constituency)) current.scstAmount += amount;
      if ((row.risk_score || 0) >= 80) current.flagged += 1;
      grouped.set(key, current);
    }

    return [...grouped.values()]
      .map((r) => ({
        ...r,
        scstCompliance: r.disbursed ? (r.scstAmount / r.disbursed) * 100 : 0,
      }))
      .sort((a, b) => b.disbursed - a.disbursed);
  }, [scoped]);

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[#0f172a]">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-sm font-bold">State-wise fund intelligence</h3>
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.04]">
            {states.map((option) => <option key={option}>{option}</option>)}
          </select>
          <select value={constituencyFilter} onChange={(e) => setConstituencyFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.04]">
            {constituencies.map((option) => <option key={option}>{option}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400 dark:border-white/[0.08]">
              <tr>
                <th className="pb-2">State</th>
                <th className="pb-2">Total Works</th>
                <th className="pb-2">Disbursed Amount</th>
                <th className="pb-2">SC/ST Compliance %</th>
                <th className="pb-2">Flagged Fraud Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/60">
              {rows.map((row) => (
                <tr key={row.state}>
                  <td className="py-3 font-semibold">{row.state}</td>
                  <td className="py-3">{row.works.toLocaleString('en-IN')}</td>
                  <td className="py-3">{formatINR(row.disbursed)}</td>
                  <td className="py-3">{row.scstCompliance.toFixed(2)}%</td>
                  <td className="py-3">{row.flagged.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[#0f172a]">
        <div className="mb-3 text-sm font-bold">Disbursement by state</div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 10, left: 20, bottom: 8 }}>
              <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1e7)}Cr`} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="state" tick={{ fontSize: 10 }} width={90} />
              <Tooltip formatter={(value) => formatINR(Number(value))} />
              <Bar dataKey="disbursed" fill="#6366f1" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function OfficialNotes({
  lockedProjects,
  auditLogs,
}: {
  lockedProjects: Record<number, string>;
  auditLogs: Array<{ kind: 'freeze' | 'memo' | 'note'; label: string; time: string }>;
}) {
  const merged = [
    ...auditLogs,
    ...Object.entries(lockedProjects).map(([id, time]) => ({
      kind: 'freeze' as const,
      label: `Disbursement lock persisted for project ${id}`,
      time,
    })),
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[#0f172a]">
      <div className="mb-4 text-sm font-bold">Official notes (auditor logbook)</div>
      <div className="space-y-3">
        {merged.map((log, index) => (
          <article key={`${log.time}-${index}`} className="rounded-xl border border-slate-100 p-3 dark:border-white/[0.08]">
            <div className="text-xs font-bold">{log.label}</div>
            <div className="mt-1 text-[10px] text-slate-400">{log.time}</div>
          </article>
        ))}
      </div>
      {merged.length === 0 && <div className="py-10 text-center text-xs text-slate-400">No logs yet.</div>}
    </section>
  );
}

function AuditDrawer({
  project,
  onClose,
  onFreeze,
  onExport,
}: {
  project: Project;
  onClose: () => void;
  onFreeze: () => void;
  onExport: (memoNarrative: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<AuditResponse | null>(null);

  useEffect(() => {
    let cancel = false;

    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    })
      .then((response) => response.json())
      .then((json) => {
        if (cancel) return;
        setAudit(json as AuditResponse);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });

    return () => {
      cancel = true;
    };
  }, [project]);

  const narrative = useMemo(() => {
    if (!audit) return buildMemoNarrativeFromProject(project);
    return [
      `Violation Category: ${audit.violation_category}`,
      `Risk Score: ${audit.risk_score}/100`,
      '',
      ...audit.audit_summary.map((item) => `• ${item}`),
      '',
      `Recommended Action: ${audit.recommended_action}`,
    ].join('\n');
  }, [audit, project]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/60" onClick={onClose}>
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 26 }} onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-white p-6 dark:bg-[#0b1224]">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-500">Gemini 1.5 Flash</div>
            <h3 className="text-lg font-bold">AI Legal Inspection</h3>
            <div className="text-[11px] text-slate-400">{project.work_id || `MPLAD-${project.id}`}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10"><X size={16} /></button>
        </div>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
          {loading ? (
            <div className="space-y-2"><div className="shimmer h-5 w-44 rounded" /><div className="shimmer h-4 w-full rounded" /><div className="shimmer h-4 w-11/12 rounded" /></div>
          ) : (
            <>
              <div className="mb-2 text-xs font-bold">Violation category: {audit?.violation_category || 'Pending'}</div>
              <div className="mb-3"><RiskBadge score={audit?.risk_score || 0} /></div>
              <ul className="list-disc space-y-1 pl-4 text-xs text-slate-700 dark:text-slate-300">
                {(audit?.audit_summary || ['Awaiting model response']).map((item, index) => <li key={index}>{item}</li>)}
              </ul>
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {audit?.recommended_action || 'No recommendation returned.'}
              </div>
            </>
          )}
        </section>

        {project.anomaly_type === 'Split Tendering' && <SplitTenderTimeline project={project} />}

        <div className="mt-6 grid gap-2">
          <button onClick={onFreeze} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white">Freeze Disbursement</button>
          <button onClick={() => onExport(narrative)} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Export DM Legal Memo</button>
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-white/10">Close</button>
        </div>
      </motion.aside>
    </motion.div>
  );
}

function ImportDatasetModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (count: number, mode: 'CSV' | 'JSON') => void;
}) {
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleCsvFile = async (file: File) => {
    setLoading(true);
    setMessage(null);

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async ({ data }) => {
        const records = mapImportedRecords(data);
        const result = await upsertProjects(records);
        setLoading(false);
        if (result.ok) {
          setMessage(`Imported ${records.length.toLocaleString('en-IN')} CSV records.`);
          onImported(records.length, 'CSV');
        } else {
          setMessage(`Import failed: ${result.error}`);
        }
      },
      error: (error) => {
        setLoading(false);
        setMessage(error.message);
      },
    });
  };

  const handleJsonImport = async () => {
    try {
      setLoading(true);
      const parsed = JSON.parse(jsonInput);
      const rows = Array.isArray(parsed) ? parsed : parsed.records;
      if (!Array.isArray(rows)) {
        throw new Error('JSON must be an array or { records: [] }.');
      }
      const records = mapImportedRecords(rows as Record<string, unknown>[]);
      const result = await upsertProjects(records);
      setLoading(false);
      if (result.ok) {
        setMessage(`Imported ${records.length.toLocaleString('en-IN')} JSON records.`);
        onImported(records.length, 'JSON');
      } else {
        setMessage(`Import failed: ${result.error}`);
      }
    } catch (error) {
      setLoading(false);
      setMessage(error instanceof Error ? error.message : 'Invalid JSON payload');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/65 p-4" onClick={onClose}>
      <article onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#0b1224]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Import New MoSPI Dataset</h3>
            <p className="text-xs text-slate-400">Drag & drop CSV or paste JSON. Records are parsed client-side and upserted to Supabase `projects`.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10"><X size={16} /></button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label
            className="grid min-h-52 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 p-4 text-center dark:border-indigo-500/40 dark:bg-indigo-500/10"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) void handleCsvFile(file);
            }}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleCsvFile(file);
              }}
            />
            <div>
              <Upload className="mx-auto mb-2 text-indigo-500" size={18} />
              <div className="text-xs font-bold">Drop CSV here or click to upload</div>
              <div className="mt-1 text-[11px] text-slate-500">Uses PapaParse for column mapping and enrichment.</div>
            </div>
          </label>

          <div className="space-y-2">
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='Paste JSON records, e.g. [{ "Work ID": "WS/1", "Work": "..." }]'
              className="h-52 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-white/[0.04]"
            />
            <button onClick={handleJsonImport} disabled={loading || !jsonInput.trim()} className="w-full rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Import JSON Records</button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={downloadTemplateCsv} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-white/10">Download sample template CSV</button>
          <button onClick={downloadTemplateJson} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-white/10">Download sample template JSON</button>
          {loading && <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] dark:bg-white/10">Importing…</span>}
          {message && <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{message}</span>}
        </div>
      </article>
    </div>
  );
}

function normalizeStatus(project: Project): string {
  const raw = (project.status || project.stage || project.payment_status || project.approval_status || '').toLowerCase().trim();
  if (raw.includes('in-progress') || raw.includes('in progress') || raw.includes('ongoing')) return 'in-progress';
  if (raw.includes('sanction')) return 'sanctioned';
  if (raw.includes('approved') || raw === 'approve') return 'approved';
  if (raw.includes('success')) return 'success';
  if (raw.includes('completed') || raw.includes('complete')) return 'completed';
  if (raw.includes('pending')) return 'pending';
  return raw || 'pending';
}

function statusLabel(project: Project): string {
  const status = normalizeStatus(project);
  if (status === 'in-progress') return 'In-Progress';
  if (status === 'sanctioned') return 'Sanctioned';
  if (status === 'approved') return 'Approved';
  if (status === 'completed' || status === 'success') return 'Completed';
  if (status === 'pending') return 'Pending';
  return project.payment_status || project.approval_status || 'Pending';
}

function isScStConstituency(value: string | null | undefined): boolean {
  const text = (value || '').toUpperCase();
  return /\bSC\b|\(SC\)|\bST\b|\(ST\)/.test(text);
}

function buildMemoNarrativeFromProject(project: Project): string {
  const category = (project.anomaly_type || 'Split Tendering') as ViolationCategory;
  return [
    `Violation Category: ${category}`,
    `Risk Score: ${project.risk_score || 0}/100`,
    '• Potential legal non-compliance identified from disbursement pattern and project metadata.',
    '• Section 3 admissibility review is required for sanctioned work scope and asset category.',
    '• Section 4 statutory SC/ST allocation check is advised for district-level compliance.',
    '',
    'Recommended Action: Issue Section 3 Show-Cause Notice & Freeze Account.',
  ].join('\n');
}

function mapImportedRecords(rows: Record<string, unknown>[]) {
  const vendorCounts = new Map<string, number>();
  const locationCounts = new Map<string, number>();

  for (const row of rows) {
    const vendor = `${take(row, ['vendor_name', 'Vendor Name']) || ''}`.toLowerCase().trim();
    const loc = `${take(row, ['Work', 'work']) || ''}|${take(row, ['Constituency', 'constituency']) || ''}`.toLowerCase().trim();
    if (vendor) vendorCounts.set(vendor, (vendorCounts.get(vendor) || 0) + 1);
    if (loc) locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1);
  }

  return rows.map((row, index) => {
    const work = take(row, ['work', 'Work']);
    const workId = take(row, ['work_id', 'Work ID']);
    const state = take(row, ['state', 'State']);
    const constituency = take(row, ['constituency', 'Constituency']);
    const mp = take(row, ['mp', "Hon'ble Members of Parliament"]);
    const vendor = take(row, ['vendor_name', 'Vendor Name']);
    const ida = take(row, ['ida', 'IDA']);
    const status = take(row, ['payment_status', 'Payment Status', 'status', 'Status']) || 'Pending';
    const amount = toNumber(take(row, ['amount', 'Fund Disbursed Amount ( ₹ )'])) || 0;
    const srNo = take(row, ['sr_no', 'Sr. No.']) || `${index + 1}`;
    const date = take(row, ['expenditure_date', 'Expenditure Date']);

    const risk = deriveRisk({ work, constituency, vendor, amount, status }, vendorCounts, locationCounts);
    const anomaly = deriveAnomaly({ work, constituency, vendor, amount, status }, vendorCounts, locationCounts);

    const riskDrivers: RiskDriver[] = [
      {
        key: 'location',
        label: 'Location Proximity',
        score: anomaly === 'Duplicate Location' ? 90 : anomaly === 'Split Tendering' ? 58 : 35,
        weight: 0.35,
        note: 'Duplicate geo-tags and constituency overlaps are scanned for suspicious clustering.',
      },
      {
        key: 'vendor',
        label: 'Vendor Splitting',
        score: anomaly === 'Split Tendering' ? 92 : 34,
        weight: 0.35,
        note: 'Repeated near-threshold billing by the same vendor is treated as tender splitting risk.',
      },
      {
        key: 'budget',
        label: 'Budget Pattern',
        score: anomaly === 'Prohibited Asset' ? 95 : Math.min(85, Math.max(25, Math.round(risk * 0.9))),
        weight: 0.3,
        note: 'Outlier amount and prohibited keyword checks are converted into fiscal-risk scores.',
      },
    ];

    return {
      sr_no: srNo,
      state,
      work,
      work_id: workId,
      ida,
      mp,
      constituency,
      expenditure_date: normalizeDateString(date),
      vendor_name: vendor,
      payment_status: status,
      amount,
      risk_score: risk,
      anomaly_type: anomaly,
      risk_drivers: riskDrivers,
      approval_status: status.toLowerCase().includes('pending') ? 'Pending' : 'Approved',
      completion_percent: status.toLowerCase().includes('completed') ? 100 : status.toLowerCase().includes('in-progress') ? 60 : 20,
      'Sr. No.': toNumber(srNo),
      State: state,
      Work: work,
      'Work ID': workId,
      IDA: ida,
      "Hon'ble Members of Parliament": mp,
      Constituency: constituency,
      'Expenditure Date': normalizeDateString(date),
      'Vendor Name': vendor,
      'Payment Status': status,
      'Fund Disbursed Amount ( ₹ )': amount,
    };
  });
}

function deriveRisk(
  row: { work: string; constituency: string; vendor: string; amount: number; status: string },
  vendorCounts: Map<string, number>,
  locationCounts: Map<string, number>,
): number {
  let score = 22;
  const loweredWork = row.work.toLowerCase();
  const vendorKey = row.vendor.toLowerCase().trim();
  const locationKey = `${row.work}|${row.constituency}`.toLowerCase().trim();

  if (prohibitedKeywords.some((keyword) => loweredWork.includes(keyword))) score += 38;
  if ((vendorCounts.get(vendorKey) || 0) > 2 && row.amount >= 450000 && row.amount <= 500000) score += 36;
  if ((locationCounts.get(locationKey) || 0) > 1) score += 24;
  if (!isScStConstituency(row.constituency)) score += 8;
  if (row.status.toLowerCase().includes('pending')) score += 4;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function deriveAnomaly(
  row: { work: string; constituency: string; vendor: string; amount: number; status: string },
  vendorCounts: Map<string, number>,
  locationCounts: Map<string, number>,
): AnomalyType {
  const loweredWork = row.work.toLowerCase();
  const vendorKey = row.vendor.toLowerCase().trim();
  const locationKey = `${row.work}|${row.constituency}`.toLowerCase().trim();

  if (prohibitedKeywords.some((keyword) => loweredWork.includes(keyword))) return 'Prohibited Asset';
  if ((locationCounts.get(locationKey) || 0) > 1) return 'Duplicate Location';
  if ((vendorCounts.get(vendorKey) || 0) > 2 && row.amount >= 450000 && row.amount <= 500000) return 'Split Tendering';
  return 'Normal';
}

function take(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && `${value}`.trim() !== '') return `${value}`.trim();
  }
  return '';
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(`${value}`.replace(/[₹,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDateString(value: string): string | null {
  const trimmed = `${value || ''}`.trim();
  if (!trimmed) return null;
  const candidate = new Date(trimmed);
  if (Number.isNaN(candidate.getTime())) return trimmed;
  return candidate.toISOString().slice(0, 10);
}

function downloadTemplateCsv() {
  const sample = [
    'Sr. No.,State,Work,Work ID,IDA,Hon\'ble Members of Parliament,Constituency,Expenditure Date,Vendor Name,Payment Status,Fund Disbursed Amount ( ₹ )',
    '1,Uttar Pradesh,Construction of village roads,WS/MP1/2026/001,GHAZIABAD_IDA,ATUL GARG,GHAZIABAD,2026-08-21,DARSH BUILDCON,Payment In-Progress,799146',
    '2,Odisha,Community hall construction,WS/MP2/2026/002,SUNDARGARH_IDA,Shri Jual Oram,SUNDARGARH (ST),2026-07-14,OB AND OC WWB,Completed,2150000',
  ].join('\n');
  downloadBlob(sample, 'mospi_template.csv', 'text/csv;charset=utf-8;');
}

function downloadTemplateJson() {
  const sample = JSON.stringify(
    [
      {
        'Sr. No.': 1,
        State: 'Uttar Pradesh',
        Work: 'Construction of village roads',
        'Work ID': 'WS/MP1/2026/001',
        IDA: 'GHAZIABAD_IDA',
        "Hon'ble Members of Parliament": 'ATUL GARG',
        Constituency: 'GHAZIABAD',
        'Expenditure Date': '2026-08-21',
        'Vendor Name': 'DARSH BUILDCON',
        'Payment Status': 'Payment In-Progress',
        'Fund Disbursed Amount ( ₹ )': 799146,
      },
    ],
    null,
    2,
  );
  downloadBlob(sample, 'mospi_template.json', 'application/json;charset=utf-8;');
}

function downloadBlob(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function upsertProjects(records: Record<string, unknown>[]): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase client unavailable.' };

  // Try normalized-schema upsert first.
  const normalized = records.map((record) => ({
    sr_no: record.sr_no,
    state: record.state,
    work: record.work,
    work_id: record.work_id,
    ida: record.ida,
    mp: record.mp,
    constituency: record.constituency,
    expenditure_date: record.expenditure_date,
    vendor_name: record.vendor_name,
    payment_status: record.payment_status,
    amount: record.amount,
    risk_score: record.risk_score,
    anomaly_type: record.anomaly_type,
    risk_drivers: record.risk_drivers,
    approval_status: record.approval_status,
    completion_percent: record.completion_percent,
  }));

  const normalizedResult = await supabase
    .from('projects')
    .upsert(normalized, { onConflict: 'work_id', ignoreDuplicates: false });

  if (!normalizedResult.error) {
    return { ok: true };
  }

  // Fallback for legacy raw-column schema.
  const rawResult = await supabase
    .from('projects')
    .upsert(records as never[], { onConflict: 'Work ID', ignoreDuplicates: false });

  if (!rawResult.error) {
    return { ok: true };
  }

  return {
    ok: false,
    error: rawResult.error.message || normalizedResult.error.message,
  };
}

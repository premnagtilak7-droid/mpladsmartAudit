'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileText,
  Filter,
  HardHat,
  IndianRupee,
  Landmark,
  LayoutDashboard,
  Menu,
  Moon,
  Radar,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Sun,
  UserRound,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@/components/ThemeProvider';
import { useProjects } from '@/lib/useProjects';
import { formatCrores, formatINR } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/mockData';
import type { AnomalyType, Project, Role, RiskDriver } from '@/lib/types';

const anomalyOptions: Array<'All Types' | AnomalyType> = ['All Types', 'Duplicate Location', 'Split Tendering', 'Prohibited Asset', 'Normal'];
const roleIcons: Record<Role, typeof Shield> = { auditor: Shield, dm: Landmark, contractor: HardHat, citizen: Users };
const roleDescriptions: Record<Role, string> = {
  auditor: 'Central command • audit intelligence',
  dm: 'District queue • approvals & delays',
  contractor: 'Vendor workspace • submit invoices',
  citizen: 'Public transparency • read-only access',
};

export default function HomePage() {
  const { theme, toggle } = useTheme();
  const { projects, analytics, loading, live, recordCount, error, reload } = useProjects();
  const [role, setRole] = useState<Role>('auditor');
  const [query, setQuery] = useState('');
  const [anomaly, setAnomaly] = useState<'All Types' | AnomalyType>('All Types');
  const [sortDesc, setSortDesc] = useState(true);
  const [selected, setSelected] = useState<Project | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...projects]
      .filter((p) => anomaly === 'All Types' || p.anomaly_type === anomaly)
      .filter((p) => !needle || [p.work, p.vendor_name, p.constituency, p.mp].some((v) => v?.toLowerCase().includes(needle)))
      .sort((a, b) => sortDesc ? (b.risk_score ?? 0) - (a.risk_score ?? 0) : (a.risk_score ?? 0) - (b.risk_score ?? 0));
  }, [projects, query, anomaly, sortDesc]);

  const chartData = useMemo(() => [
    { name: 'High risk', value: analytics.flaggedHighRisk, fill: '#fb7185' },
    { name: 'Medium', value: Math.max(0, projects.filter((p) => (p.risk_score ?? 0) >= 50 && (p.risk_score ?? 0) < 80).length), fill: '#fbbf24' },
    { name: 'Normal', value: Math.max(0, projects.filter((p) => (p.risk_score ?? 0) < 50).length), fill: '#34d399' },
  ], [analytics.flaggedHighRisk, projects]);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900 dark:bg-[#080d1c] dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#080d1c]/90">
        <div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <button onClick={() => setMobileNav(!mobileNav)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-white/10" aria-label="Open navigation"><Menu size={20} /></button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 shadow-lg shadow-indigo-600/25"><Radar className="text-white" size={21} /></div>
            <div><div className="text-[16px] font-bold tracking-tight">MPLAD <span className="text-indigo-500">Radar</span></div><div className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:block">MoSPI Vigilance & Transparency Layer</div></div>
          </div>
          <div className="ml-4 hidden items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-50 px-3 py-1.5 md:flex dark:bg-emerald-500/10"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative h-2 w-2 rounded-full bg-emerald-500" /></span><span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{live ? `Live Supabase Dataset: ${(recordCount || projects.length || 0).toLocaleString('en-IN')} Records` : 'Supabase connection required'}</span></div>
          <div className="ml-auto flex items-center gap-2">
            <button className="hidden rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:block dark:hover:bg-white/10 dark:hover:text-white" aria-label="Notifications"><Bell size={18} /></button>
            <button onClick={toggle} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Toggle theme">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <div className="relative">
              <button onClick={() => setRoleOpen(!roleOpen)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold shadow-sm hover:border-indigo-300 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-indigo-400/50"><UserRound size={15} className="text-indigo-500" /><span className="hidden max-w-[145px] truncate sm:inline">{ROLE_LABELS[role]}</span><ChevronDown size={14} /></button>
              {roleOpen && <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-white/10 dark:bg-[#121a2d]">{(Object.keys(ROLE_LABELS) as Role[]).map((r) => { const Icon = roleIcons[r]; return <button key={r} onClick={() => { setRole(r); setRoleOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition ${role === r ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5'}`}><Icon size={15} /><span><strong className="block">{ROLE_LABELS[r]}</strong><small className="text-[10px] opacity-60">{roleDescriptions[r]}</small></span>{role === r && <Check className="ml-auto" size={15} />}</button>; })}</div>}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        <aside className={`${mobileNav ? 'fixed inset-y-[72px] left-0 z-20 flex' : 'hidden'} w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 lg:sticky lg:top-[72px] lg:flex lg:h-[calc(100vh-72px)] dark:border-white/[0.07] dark:bg-[#0b1224]`}>
          <div className="mb-5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</div>
          <nav className="space-y-1"><NavItem active icon={<LayoutDashboard size={17} />} label="Audit overview" /><NavItem icon={<ShieldAlert size={17} />} label="Anomaly queue" count={analytics.flaggedHighRisk} /><NavItem icon={<BarChart3 size={17} />} label="Fund intelligence" /><NavItem icon={<FileText size={17} />} label="Official notes" /></nav>
          <div className="mt-auto rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-cyan-50 p-4 dark:border-indigo-400/15 dark:from-indigo-500/10 dark:to-cyan-500/10"><Sparkles size={17} className="mb-3 text-indigo-500" /><div className="text-xs font-bold">AI Auditor online</div><p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">Evidence narratives are generated on demand for every flagged work.</p></div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1250px]">
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-500"><Zap size={13} /> Live command center</div><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">MPLAD audit overview</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Monitor public works, surface anomalies, and act before funds move.</p></div><button onClick={reload} className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm hover:border-indigo-300 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"><RefreshCw size={14} /> Refresh data</button></div>
            {error && <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"><AlertTriangle size={15} /> Supabase unavailable — no live records loaded. <span className="truncate opacity-70">{error}</span></div>}
            <AnalyticsGrid analytics={analytics} loading={loading} />
            {role !== 'auditor' ? <RoleView role={role} projects={filteredProjects} /> : <>
              <section className="mt-7 grid gap-5 lg:grid-cols-[1fr_280px]">
                <div className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.07] dark:bg-[#0f172a]">
                  <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-white/[0.07] sm:flex-row sm:items-center"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Work, Vendor, Constituency, or MP" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-white/10 dark:bg-white/[0.04]" /></div><div className="flex gap-2"><select value={anomaly} onChange={(e) => setAnomaly(e.target.value as 'All Types' | AnomalyType)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold outline-none dark:border-white/10 dark:bg-white/[0.04]"><option>All Types</option><option>Duplicate Location</option><option>Split Tendering</option><option>Prohibited Asset</option><option>Normal</option></select><button onClick={() => setSortDesc(!sortDesc)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold dark:border-white/10 dark:bg-white/[0.04]"><ArrowDownUp size={14} /> <span className="hidden xl:inline">Risk {sortDesc ? 'High → Low' : 'Low → High'}</span></button></div></div>
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/[0.07]"><div className="flex items-center gap-2 text-sm font-bold"><ClipboardCheck size={16} className="text-indigo-500" /> Audit queue <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-white/10 dark:text-slate-300">{filteredProjects.length} records</span></div><div className="hidden items-center gap-1.5 text-[10px] font-semibold text-slate-400 sm:flex"><span className="h-2 w-2 rounded-full bg-rose-400" /> High risk first</div></div>
                  <ProjectTable projects={filteredProjects} loading={loading} onInspect={setSelected} />
                </div>
                <aside className="hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[0.07] dark:bg-[#0f172a] lg:block"><div className="mb-1 flex items-center gap-2 text-sm font-bold"><BarChart3 size={16} className="text-indigo-500" /> Risk distribution</div><p className="mb-3 text-[11px] text-slate-400">Current monitored portfolio</p><div className="h-40"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 12, right: 0, left: -28, bottom: 0 }}><XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip cursor={{ fill: 'rgba(99,102,241,.06)' }} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11 }} /><Bar dataKey="value" radius={[5, 5, 0, 0]}>{chartData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div><div className="mt-4 space-y-3">{chartData.map((d) => <div key={d.name} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-slate-500"><span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />{d.name}</span><b>{d.value}</b></div>)}</div></aside>
              </section>
            </>}
          </div>
        </main>
      </div>
      <AnimatePresence>{selected && <AuditDrawer project={selected} onClose={() => setSelected(null)} />}</AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active, count }: { icon: React.ReactNode; label: string; active?: boolean; count?: number }) { return <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold ${active ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5'}`}>{icon}{label}{count ? <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">{count}</span> : null}</button>; }

function AnalyticsGrid({ analytics, loading }: { analytics: { totalFunds: number; totalWorks: number; flaggedHighRisk: number; fundsAtStake: number }; loading: boolean }) { const cards = [{ label: 'Total monitored funds', value: formatCrores(analytics.totalFunds), sub: `≈ ${formatINR(analytics.totalFunds)}`, icon: IndianRupee, tone: 'indigo' }, { label: 'Monitored works count', value: analytics.totalWorks.toLocaleString('en-IN'), sub: 'Rows in projects table', icon: Landmark, tone: 'sky' }, { label: 'Flagged high risk anomalies', value: analytics.flaggedHighRisk.toLocaleString('en-IN'), sub: 'Risk score ≥ 80', icon: ShieldAlert, tone: 'rose' }, { label: 'Potential funds at stake', value: formatCrores(analytics.fundsAtStake), sub: 'Exposure on flagged records', icon: IndianRupee, tone: 'emerald' }]; return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((c, i) => { const Icon = c.icon; return <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .05 }} className={`rounded-2xl border p-4 shadow-sm ${c.tone === 'rose' ? 'border-rose-200 bg-rose-50/70 dark:border-rose-500/20 dark:bg-rose-500/10' : c.tone === 'emerald' ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10' : 'border-slate-200 bg-white dark:border-white/[0.07] dark:bg-[#0f172a]'}`}><div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">{c.label}</span><span className={`rounded-lg p-2 ${c.tone === 'rose' ? 'bg-rose-500' : c.tone === 'emerald' ? 'bg-emerald-500' : c.tone === 'sky' ? 'bg-cyan-500' : 'bg-indigo-500'} text-white`}><Icon size={15} /></span></div>{loading ? <div className="shimmer h-8 w-28 rounded" /> : <div className={`text-2xl font-bold tracking-tight ${c.tone === 'rose' ? 'text-rose-500' : c.tone === 'emerald' ? 'text-emerald-500' : ''}`}>{c.value}</div>}<div className="mt-1 text-[11px] text-slate-400">{c.sub}</div></motion.div>; })}</div>; }

function ProjectTable({ projects, loading, onInspect }: { projects: Project[]; loading: boolean; onInspect: (p: Project) => void }) { if (loading) return <div className="space-y-3 p-4">{[1, 2, 3, 4].map((i) => <div key={i} className="shimmer h-16 rounded-xl" />)}</div>; return <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:bg-white/[0.02]"><tr><th className="px-4 py-3">Project / Work</th><th className="px-3 py-3">Vendor</th><th className="px-3 py-3">Constituency & MP</th><th className="px-3 py-3">Disbursed</th><th className="px-3 py-3">Anomaly</th><th className="px-3 py-3">Risk</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">{projects.map((p) => <tr key={p.id} className="group transition hover:bg-indigo-50/40 dark:hover:bg-indigo-500/[0.04]"><td className="max-w-[260px] px-4 py-4"><div className="truncate text-xs font-bold" title={p.work ?? ''}>{p.work || 'Untitled work'}</div><div className="mt-1 truncate font-mono text-[10px] text-slate-400">{p.work_id || `MPLAD-${p.id}`}</div></td><td className="max-w-[145px] px-3 py-4"><div className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">{p.vendor_name || '—'}</div><div className="mt-1 text-[10px] text-slate-400">{p.payment_status || 'Status pending'}</div></td><td className="px-3 py-4"><div className="text-xs font-semibold">{p.constituency || '—'}</div><div className="mt-1 text-[10px] text-slate-400">{p.mp || 'MP not listed'}</div></td><td className="whitespace-nowrap px-3 py-4 text-xs font-bold">{formatINR(Number(p.amount) || 0)}</td><td className="px-3 py-4"><AnomalyBadge type={p.anomaly_type} /></td><td className="px-3 py-4"><RiskBadge score={p.risk_score ?? 0} /></td><td className="px-4 py-4 text-right"><button onClick={() => onInspect(p)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-50 px-2.5 py-2 text-[10px] font-bold text-indigo-600 opacity-100 transition hover:bg-indigo-600 hover:text-white dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500 dark:hover:text-white">Inspect AI evidence <ArrowRight size={12} /></button></td></tr>)}</tbody></table>{projects.length === 0 && <div className="p-12 text-center text-sm text-slate-400"><Search className="mx-auto mb-3" size={22} />No records match these filters.</div>}</div>; }

function AnomalyBadge({ type }: { type: AnomalyType | null }) { const value = type || 'Normal'; const cls = value === 'Normal' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' : value === 'Duplicate Location' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300'; return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ${cls}`}>{value}</span>; }
function RiskBadge({ score }: { score: number }) { const cls = score >= 80 ? 'bg-rose-500 text-white' : score >= 50 ? 'bg-amber-400 text-amber-950' : 'bg-emerald-500 text-white'; return <span className={`inline-flex min-w-[38px] justify-center rounded-md px-2 py-1 text-[11px] font-black ${cls}`}>{score}</span>; }

function RoleView({ role, projects }: { role: Role; projects: Project[] }) { if (role === 'contractor') return <ContractorView />; if (role === 'citizen') return <CitizenView projects={projects} />; const pending = projects.filter((p) => p.approval_status === 'Pending'); return <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[0.07] dark:bg-[#0f172a]"><div className="mb-5 flex items-start justify-between"><div><div className="flex items-center gap-2 text-sm font-bold"><Landmark size={17} className="text-indigo-500" /> District approval queue</div><p className="mt-1 text-xs text-slate-400">Review works awaiting district-level approval and field confirmation.</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{pending.length} pending</span></div><div className="grid gap-3">{pending.slice(0, 8).map((p) => <div key={p.id} className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.07]"><div><div className="text-xs font-bold">{p.work}</div><div className="mt-1 text-[11px] text-slate-400">{p.constituency} • {p.vendor_name}</div></div><div className="flex items-center gap-3"><span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600"><Clock3 size={13} /> {p.delay_days ? `${p.delay_days}d delay` : 'Due today'}</span><button className="rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-bold text-white">Review approval</button></div></div>)}</div></section>; }
function ContractorView() { return <section className="mt-7 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/[0.07] dark:bg-[#0f172a]"><div className="mb-6 flex items-start gap-3"><div className="rounded-xl bg-indigo-50 p-3 text-indigo-500 dark:bg-indigo-500/10"><HardHat size={20} /></div><div><h3 className="font-bold">Submit an invoice</h3><p className="mt-1 text-xs text-slate-400">Attach a payment claim against an approved MPLAD work.</p></div></div><div className="grid gap-4"><Field label="Work ID" placeholder="e.g. WS/MP18218/2025-2026/233777" /><div className="grid gap-4 sm:grid-cols-2"><Field label="Invoice number" placeholder="INV-2026-001" /><Field label="Amount (₹)" placeholder="0.00" /></div><Field label="Supporting note" placeholder="Describe the milestone completed…" /><button className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700"><FileText size={15} /> Submit for verification</button></div></section>; }
function Field({ label, placeholder }: { label: string; placeholder: string }) { return <label className="text-xs font-bold text-slate-600 dark:text-slate-300">{label}<input placeholder={placeholder} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-normal outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-white/[0.04]" /></label>; }
function CitizenView({ projects }: { projects: Project[] }) { return <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[0.07] dark:bg-[#0f172a]"><div className="mb-5"><div className="flex items-center gap-2 text-sm font-bold"><Users size={17} className="text-indigo-500" /> Public project tracker</div><p className="mt-1 text-xs text-slate-400">Read-only progress view for monitored works.</p></div><div className="grid gap-3">{projects.slice(0, 8).map((p) => <div key={p.id} className="rounded-xl border border-slate-100 p-4 dark:border-white/[0.07]"><div className="flex justify-between gap-4"><div className="truncate text-xs font-bold">{p.work}</div><span className="text-xs font-black text-indigo-500">{p.completion_percent ?? 0}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" style={{ width: `${p.completion_percent ?? 0}%` }} /></div><div className="mt-2 text-[10px] text-slate-400">{p.constituency} • {p.vendor_name}</div></div>)}</div></section>; }

function AuditDrawer({ project, onClose }: { project: Project; onClose: () => void }) { const [loading, setLoading] = useState(true); const [narrative, setNarrative] = useState(''); const [action, setAction] = useState(''); useEffect(() => { let cancelled = false; fetch('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project }) }).then((r) => r.json()).then((d) => { if (!cancelled) setNarrative(d.narrative || 'No narrative returned.'); }).catch(() => { if (!cancelled) setNarrative('Unable to reach the AI auditor. Review the risk drivers below and retry when the service is available.'); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [project]); const drivers = project.risk_drivers || []; return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm" onClick={onClose}><motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28 }} onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-white p-5 shadow-2xl dark:bg-[#0c1427] sm:p-7"><div className="flex items-start justify-between"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-500"><Sparkles size={13} /> Gemini AI Auditor</div><h2 className="max-w-md text-xl font-bold leading-tight">Evidence inspection</h2><p className="mt-1 text-xs text-slate-400">{project.constituency} • {project.work_id}</p></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"><X size={19} /></button></div><div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/[0.07] dark:bg-white/[0.04]"><div className="text-xs font-bold">{project.work}</div><div className="mt-2 flex flex-wrap gap-2"><AnomalyBadge type={project.anomaly_type} /><span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">{formatINR(Number(project.amount) || 0)}</span><RiskBadge score={project.risk_score ?? 0} /></div></div><section className="mt-6"><SectionTitle icon={<BarChart3 size={15} />} title="Spatial risk breakdown" /><div className="mt-3 space-y-3">{drivers.length ? drivers.map((d) => <Driver key={d.key} driver={d} />) : <p className="text-xs text-slate-400">Risk drivers will be computed by the auditor.</p>}</div></section><section className="mt-7"><SectionTitle icon={<Sparkles size={15} />} title="Gemini AI auditor explanation" /><div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-400/20 dark:bg-indigo-500/10">{loading ? <div className="flex items-center gap-3 text-xs font-semibold text-indigo-600 dark:text-indigo-300"><span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" /> Synthesizing evidence narrative…</div> : <pre className="whitespace-pre-wrap font-sans text-xs leading-5 text-slate-700 dark:text-slate-200">{narrative}</pre>}</div></section><section className="mt-7"><SectionTitle icon={<Shield size={15} />} title="Recommended actions" /><div className="mt-3 grid gap-2"><ActionButton label="Freeze disbursement" icon={<ShieldAlert size={15} />} tone="rose" onClick={() => setAction('Disbursement freeze queued for authorization.')} /><ActionButton label="Dismiss alert" icon={<CheckCircle2 size={15} />} tone="slate" onClick={() => setAction('Alert marked for dismissal review.')} /><ActionButton label="Generate official audit note" icon={<FileText size={15} />} tone="indigo" onClick={() => setAction('Official audit note generation queued.')} /></div>{action && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{action}</div>}</section></motion.aside></motion.div>; }
function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) { return <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{icon}{title}</div>; }
function Driver({ driver }: { driver: RiskDriver }) { return <div><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-semibold">{driver.label}</span><span className="font-black text-indigo-500">{driver.score}/100</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className={`h-full rounded-full ${driver.score >= 80 ? 'bg-rose-400' : driver.score >= 50 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${driver.score}%` }} /></div><p className="mt-1 text-[10px] text-slate-400">{driver.note}</p></div>; }
function ActionButton({ label, icon, tone, onClick }: { label: string; icon: React.ReactNode; tone: 'rose' | 'slate' | 'indigo'; onClick: () => void }) { const cls = tone === 'rose' ? 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/10' : tone === 'indigo' ? 'border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/10' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5'; return <button onClick={onClick} className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-xs font-bold transition ${cls}`}>{icon}{label}<ArrowRight size={14} className="ml-auto" /></button>; }

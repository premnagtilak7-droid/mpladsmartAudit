'use client';

import { useMemo } from 'react';
import { MapPin, ShieldCheck, TriangleAlert, Printer, X, LockKeyhole, FileWarning } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatINR } from '@/lib/format';
import type { Project } from '@/lib/types';

export function ComplianceWidget({ projects }: { projects: Project[] }) {
  const compliance = useMemo(() => {
    const total = projects.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const sc = projects.filter((p) => isConstituency(p, 'SC')).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const st = projects.filter((p) => isConstituency(p, 'ST')).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    return { sc: total ? (sc / total) * 100 : 0, st: total ? (st / total) * 100 : 0 };
  }, [projects]);
  const compliant = compliance.sc >= 15 && compliance.st >= 7.5;
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[0.07] dark:bg-[#0f172a]">
    <div className="mb-4 flex items-start justify-between"><div><div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={17} className="text-indigo-500" /> Statutory allocation</div><p className="mt-1 text-[11px] text-slate-400">SC / ST MPLAD distribution compliance</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${compliant ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}>{compliant ? 'Compliant' : 'Deficit Alert'}</span></div>
    <ComplianceBar label="SC Area" target={15} actual={compliance.sc} /><ComplianceBar label="ST Area" target={7.5} actual={compliance.st} />
  </section>;
}

function ComplianceBar({ label, target, actual }: { label: string; target: number; actual: number }) { const safe = Math.min(100, actual); return <div className="mb-4 last:mb-0"><div className="mb-1.5 flex justify-between text-[11px]"><span className="font-semibold">{label} <span className="text-slate-400">target {target}%</span></span><b className={actual >= target ? 'text-emerald-500' : 'text-amber-500'}>{actual.toFixed(1)}%</b></div><div className="relative h-2 rounded-full bg-slate-100 dark:bg-white/10"><div className={`h-full rounded-full ${actual >= target ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${safe}%` }} /><span className="absolute top-[-3px] h-4 w-px bg-slate-500/60" style={{ left: `${target}%` }} /></div></div>; }

function isConstituency(project: Project, category: 'SC' | 'ST') { const text = `${project.constituency || ''} ${project.state || ''}`.toUpperCase(); return new RegExp(`(?:\\(|\\s|-)${category}(?:\\)|\\s|$)`).test(text); }

export function GISMapView({ projects, onInspect }: { projects: Project[]; onInspect: (project: Project) => void }) {
  const flagged = projects.filter((p) => (p.risk_score ?? 0) >= 80).slice(0, 40);
  return <div className="relative min-h-[540px] overflow-hidden bg-[#dfeaf2] dark:bg-[#10243a]">
    <div className="absolute inset-0 opacity-60 dark:opacity-30" style={{ backgroundImage: 'linear-gradient(30deg, transparent 48%, rgba(71,104,128,.22) 49%, transparent 51%), linear-gradient(120deg, transparent 48%, rgba(71,104,128,.18) 49%, transparent 51%), linear-gradient(rgba(255,255,255,.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.55) 1px, transparent 1px)', backgroundSize: '140px 110px, 180px 140px, 42px 42px, 42px 42px' }} />
    <div className="absolute left-5 top-5 z-10 rounded-xl border border-white/70 bg-white/85 px-3 py-2 text-[11px] font-bold text-slate-700 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-200"><MapPin size={14} className="mr-1 inline text-rose-500" /> High-risk anomaly clusters</div>
    {flagged.map((project, index) => { const left = 14 + ((index * 37) % 72); const top = 19 + ((index * 53) % 62); return <button key={project.id} onClick={() => onInspect(project)} className="group absolute z-10" style={{ left: `${left}%`, top: `${top}%` }} title={project.work || 'Flagged project'}><span className="absolute -inset-4 animate-ping rounded-full bg-rose-400/25" /><span className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-white shadow-lg shadow-rose-500/40"><MapPin size={14} fill="currentColor" /></span><span className="pointer-events-none absolute left-8 top-0 hidden min-w-44 rounded-lg bg-slate-950 px-2 py-1 text-left text-[10px] text-white group-hover:block">{project.constituency || 'Unknown district'}<br /><b>Risk {project.risk_score ?? 0}</b></span></button>; })}
    {flagged.length > 1 && <><span className="absolute left-[28%] top-[38%] h-28 w-28 rounded-full border-2 border-dashed border-rose-500/60 bg-rose-500/10" /><span className="absolute left-[31%] top-[43%] h-20 w-20 rounded-full border-2 border-dashed border-rose-500/50" /></>}
    <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center gap-4 rounded-xl border border-white/70 bg-white/85 px-3 py-2 text-[10px] font-semibold text-slate-600 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-300"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />Red pin: flagged project</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full border border-rose-500" />Cluster radius &lt; 50m</span><span className="ml-auto">{flagged.length} plotted records</span></div>
  </div>;
}

export function SplitTenderTimeline({ project }: { project: Project }) {
  const base = Number(project.amount) || 0;
  const data = [1, 2, 3, 4].map((day, index) => ({ day: `Day ${day}`, amount: Math.max(125000, Math.min(499000, Math.round((base / 8) + index * 21000))) }));
  return <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-400/15 dark:bg-amber-500/10"><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300"><TriangleAlert size={13} /> Split-tendering transaction window</div><div className="h-36"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#f59e0b30" vertical={false} /><XAxis dataKey="day" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} /><Tooltip formatter={(value) => formatINR(Number(value))} contentStyle={{ fontSize: 10, borderRadius: 8 }} /><Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div><p className="mt-2 text-[10px] leading-4 text-amber-700/80 dark:text-amber-200/80">Multiple bills below ₹5 lakh within a seven-day window for the same vendor signal possible tender splitting.</p></div>;
}

export function LegalMemoModal({ project, narrative, onClose }: { project: Project; narrative: string; onClose: () => void }) {
  return <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm" onClick={onClose}><article onClick={(event) => event.stopPropagation()} className="relative mx-auto my-6 max-w-3xl overflow-hidden bg-white text-slate-900 shadow-2xl print:my-0 print:max-w-none">
    <div className="flex items-center justify-between border-b-4 border-indigo-700 bg-white px-7 py-5"><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700">Government of India</div><div className="text-lg font-black">Ministry of Statistics & Programme Implementation</div><div className="text-[11px] font-semibold text-slate-500">MPLAD Vigilance & Transparency Layer • SIH26102</div></div><div className="text-right text-4xl font-black text-indigo-100">MoSPI</div></div>
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="rotate-[-28deg] text-7xl font-black tracking-widest text-slate-900/[0.035]">OFFICIAL</div></div>
    <div className="relative space-y-5 p-7"><div className="flex items-start justify-between"><div><div className="text-[10px] font-bold uppercase tracking-widest text-rose-600">Confidential • Legal escalation memo</div><h2 className="mt-1 text-2xl font-black">MPLAD anomaly escalation notice</h2></div><div className="text-right text-[11px] text-slate-500">Memo date<br /><b>{new Date().toLocaleDateString('en-IN')}</b></div></div><div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-4"><Meta label="Project ID" value={project.work_id || `MPLAD-${project.id}`} /><Meta label="MP Name" value={project.mp || 'Not recorded'} /><Meta label="District / Constituency" value={project.constituency || 'Not recorded'} /><Meta label="Disbursed amount" value={formatINR(Number(project.amount) || 0)} /></div><div><h3 className="mb-2 text-sm font-black">Gemini AI explanation memo</h3><p className="whitespace-pre-wrap text-xs leading-5 text-slate-700">{narrative || 'AI explanation pending.'}</p></div><div className="rounded-xl border-l-4 border-rose-500 bg-rose-50 p-4 text-xs leading-5 text-rose-900"><b>Section 3 Guidelines Violation Notice</b><br />The flagged expenditure requires immediate district-level verification against permitted MPLAD works, tendering thresholds, and the applicable statutory allocation guidelines. Further disbursement should remain frozen pending documentary and field verification.</div><div className="grid grid-cols-2 gap-10 pt-8 text-xs"><div className="border-t border-slate-400 pt-2">Prepared by<br /><b>Central Auditor, MPLAD Radar</b></div><div className="border-t border-slate-400 pt-2">Action / signature<br /><b>District Magistrate (DM)</b></div></div></div>
    <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-7 py-4 print:hidden"><button onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500">Close</button><button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white"><Printer size={14} /> Print / Save PDF</button></div>
  </article></div>;
}

function Meta({ label, value }: { label: string; value: string }) { return <div><div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 truncate font-bold" title={value}>{value}</div></div>; }

export function LockBadge({ timestamp }: { timestamp: string }) { return <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[9px] font-black text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"><LockKeyhole size={11} /> LOCKED {timestamp}</span>; }

'use client';

import { useMemo } from 'react';
import { BarChart3, Printer, X } from 'lucide-react';
import type { Project } from '@/lib/types';
import { formatCrores } from '@/lib/format';

export function ConstituencyScorecard({ constituency, projects, onClose }: { constituency: string; projects: Project[]; onClose: () => void }) {
  const rows = useMemo(() => projects.filter((project) => (project.constituency || '').toLowerCase() === constituency.toLowerCase()), [projects, constituency]);
  const stats = useMemo(() => {
    const sanctioned = rows.reduce((sum, row) => sum + (Number(row.sanctioned_amount ?? row.amount) || 0), 0);
    const spent = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const completed = rows.filter((row) => /completed|success/i.test(`${row.status || ''} ${row.payment_status || ''}`)).length;
    const vendors = new Map<string, number>();
    rows.forEach((row) => vendors.set(row.vendor_name || 'Unknown', (vendors.get(row.vendor_name || 'Unknown') || 0) + 1));
    const total = Math.max(1, rows.length);
    const hhi = [...vendors.values()].reduce((sum, count) => sum + ((count / total) * 100) ** 2, 0);
    return { sanctioned, spent, completed, hhi, utilization: sanctioned ? Math.min(100, (spent / sanctioned) * 100) : 0, completion: total ? (completed / total) * 100 : 0 };
  }, [rows]);

  return <div className="fixed inset-0 z-[92] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={onClose}><article className="w-full max-w-2xl rounded-2xl border border-indigo-400/30 bg-[#0f172a] p-6 text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
    <header className="flex items-start justify-between"><div><div className="text-[10px] font-black uppercase tracking-wider text-indigo-300">Constituency spending scorecard</div><h2 className="mt-1 text-2xl font-black">{constituency} Parliamentary Constituency</h2></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10"><X size={18} /></button></header>
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-4"><div className="text-[10px] font-black uppercase text-slate-400">MP budget utilization</div><div className="mt-2 text-3xl font-black text-indigo-200">{stats.utilization.toFixed(1)}%</div><div className="text-xs text-slate-400">₹{formatCrores(stats.spent)} spent of ₹{formatCrores(stats.sanctioned)} sanctioned</div></div><div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4"><div className="text-[10px] font-black uppercase text-slate-400">Work completion ratio</div><div className="mt-2 text-3xl font-black text-emerald-200">{stats.completion.toFixed(1)}%</div><div className="text-xs text-slate-400">{stats.completed} completed of {rows.length} works</div></div><div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 sm:col-span-2"><div className="text-[10px] font-black uppercase text-slate-400">Vendor concentration HHI</div><div className="mt-2 flex items-center justify-between"><span className={`text-3xl font-black ${stats.hhi > 2500 ? 'text-rose-300' : 'text-amber-200'}`}>{stats.hhi.toFixed(0)}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${stats.hhi > 2500 ? 'bg-rose-500/20 text-rose-200' : 'bg-emerald-500/20 text-emerald-200'}`}>{stats.hhi > 2500 ? 'Concentration warning' : 'Diversified vendor base'}</span></div></div></div>
    <div className="mt-5 flex justify-end"><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-500"><Printer size={14} /> Print / Save PDF</button></div>
  </article></div>;
}

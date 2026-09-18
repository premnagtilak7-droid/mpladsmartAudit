'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, FileText, Loader2 } from 'lucide-react';
import { formatCrores } from '@/lib/format';

type FiscalData = {
  days_to_fy_forfeiture: number;
  corpus_at_risk: number;
  critical_delayed_works: number;
  aging: { under_12_months: number; twelve_to_eighteen_months: number; over_18_months: number };
  delayed_works: Array<{ work_id?: string; title?: string; district?: string; age_months: number; status?: string }>;
};

export function FiscalLapsingRadar() {
  const [data, setData] = useState<FiscalData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/analytics/fiscal-lapsing').then((response) => response.json()).then((payload) => {
      if (!payload.ok) throw new Error(payload.error || 'Fiscal analytics unavailable.');
      setData(payload);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Fiscal analytics unavailable.'));
  }, []);

  return <section className="rounded-2xl border border-amber-400/25 bg-[#1e293b]/75 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-black text-amber-200"><CalendarClock size={17} /> GFR Rule 229 Fiscal-Lapsing Radar</div><p className="mt-1 text-[11px] text-slate-400">Aging works and corpus exposed to financial-year forfeiture.</p></div><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-white/5"><FileText size={12} /> Escalation Memo</button></div>
    {error ? <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-200">{error}</div> : !data ? <div className="mt-5 flex items-center gap-2 text-xs text-slate-400"><Loader2 size={14} className="animate-spin" /> Calculating statutory aging across the live dataset…</div> : <>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3"><div className="text-[10px] font-black uppercase text-slate-400">Days to FY forfeiture</div><div className="mt-1 text-2xl font-black text-amber-200">{data.days_to_fy_forfeiture}</div><div className="text-[10px] text-slate-400">Countdown to 31 March</div></div><div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3"><div className="text-[10px] font-black uppercase text-slate-400">Corpus at immediate risk</div><div className="mt-1 text-2xl font-black text-rose-200">₹{formatCrores(data.corpus_at_risk)}</div><div className="text-[10px] text-slate-400">Unspent sanctioned value</div></div><div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3"><div className="text-[10px] font-black uppercase text-slate-400">Critical delayed works</div><div className="mt-1 text-2xl font-black text-rose-200">{data.critical_delayed_works}</div><div className="text-[10px] text-slate-400">Aged over 18 months</div></div></div>
      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3"><div className="rounded-lg bg-emerald-500/10 p-3 text-emerald-200">Under 12 months: <b>{data.aging.under_12_months}</b></div><div className="rounded-lg bg-amber-500/10 p-3 text-amber-200">12–18 months: <b>{data.aging.twelve_to_eighteen_months}</b></div><div className="rounded-lg bg-rose-500/10 p-3 text-rose-200">Over 18 months: <b>{data.aging.over_18_months}</b></div></div>
      {data.delayed_works.length > 0 && <div className="mt-4 space-y-2"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Priority escalation list</div>{data.delayed_works.slice(0, 5).map((work) => <div key={String(work.work_id)} className="flex items-center justify-between gap-3 rounded-lg border border-slate-700/70 bg-[#0b132b]/70 px-3 py-2 text-[11px]"><div className="min-w-0"><div className="truncate font-bold text-slate-200">{work.title || work.work_id || 'Untitled work'}</div><div className="text-slate-500">{work.work_id} • {work.district || 'District not recorded'}</div></div><span className="shrink-0 inline-flex items-center gap-1 text-rose-300"><AlertTriangle size={12} /> {work.age_months} mo</span></div>)}</div>}
    </>}
  </section>;
}

'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { Project } from '@/lib/types';

export function PreSanctionComplianceGuard({ title, vendor, location, budget, projects }: { title: string; vendor: string; location: string; budget: string; projects: Project[] }) {
  const checks = useMemo(() => {
    const text = `${title} ${vendor} ${location}`.toLowerCase();
    const prohibited = /statue|religious|temple|mosque|church|private|personal|vehicle|motorcycle|furniture|generator|laptop|mobile phone/.test(text);
    const amount = Number(budget) || 0;
    const threshold = amount > 5_000_000;
    const duplicate = Boolean(title.trim()) && projects.some((project) => {
      const candidate = `${project.work || ''}`.toLowerCase();
      return candidate.length > 12 && candidate.includes(title.trim().toLowerCase());
    });
    const missing = !title.trim() || !vendor.trim() || !location.trim() || !amount;
    return [
      { label: 'Annexure-II prohibited work screen', pass: !prohibited, detail: prohibited ? 'Potentially prohibited asset keywords detected.' : 'No prohibited-work keyword detected.' },
      { label: 'CPWD SOR cost variance screen', pass: !threshold, detail: threshold ? 'Reference rate review required before sanction.' : 'Within preliminary threshold; official SOR lookup pending.' },
      { label: 'Duplicate work fingerprint', pass: !duplicate, detail: duplicate ? 'Similar work title found in the current register.' : 'No matching work title found in loaded register.' },
      { label: 'Submission completeness', pass: !missing, detail: missing ? 'Title, vendor, location, and budget are required.' : 'Minimum proposal fields are present.' },
    ];
  }, [title, vendor, location, budget, projects]);
  const ready = checks.every((check) => check.pass);
  return <section className="rounded-2xl border border-cyan-400/25 bg-[#1e293b]/75 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-black text-cyan-200"><ShieldCheck size={17} /> Pre-Sanction Compliance Guard</div><p className="mt-1 text-[11px] text-slate-400">Preliminary Annexure-II, cost, duplicate, and completeness screening.</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${ready ? 'bg-emerald-500/15 text-emerald-200' : 'bg-rose-500/15 text-rose-200'}`}>{ready ? 'READY FOR REVIEW' : 'HOLD FOR REVIEW'}</span></div><div className="mt-4 space-y-2">{checks.map((check) => <div key={check.label} className="flex items-start gap-2 rounded-lg border border-slate-700/70 bg-[#0b132b]/70 p-3"><span className={check.pass ? 'text-emerald-300' : 'text-rose-300'}>{check.pass ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}</span><div><div className="text-xs font-bold text-slate-200">{check.label}</div><div className="mt-0.5 text-[10px] text-slate-400">{check.detail}</div></div></div>)}</div><p className="mt-3 text-[10px] text-slate-500">This client-side guard is a preliminary screen; authoritative CPWD, Bhulekh, e-GramSwaraj, PMGSY, and DSC verification require connected government services.</p></section>;
}

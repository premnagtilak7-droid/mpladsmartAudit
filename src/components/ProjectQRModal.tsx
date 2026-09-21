'use client';

import { useMemo } from 'react';
import { ExternalLink, MapPin, QrCode, ShieldAlert, X } from 'lucide-react';
import type { Project } from '@/lib/types';
import { formatINR } from '@/lib/format';
import { CitizenVerification } from '@/components/CitizenVerification';

function riskMeta(score: number) {
  if (score > 75) return { label: 'HIGH RISK', range: '76–100', tone: 'border-rose-400/40 bg-rose-500/15 text-rose-200', bar: 'bg-rose-500' };
  if (score >= 40) return { label: 'MEDIUM RISK', range: '40–75', tone: 'border-amber-400/40 bg-amber-500/15 text-amber-200', bar: 'bg-amber-400' };
  return { label: 'LOW RISK', range: '0–39', tone: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200', bar: 'bg-emerald-400' };
}

function projectUrl(project: Project) {
  if (typeof window === 'undefined') return '';
  const id = encodeURIComponent(project.work_id || String(project.id));
  return `${window.location.origin}/?portal=citizen&verify=${id}`;
}

function anomalyReasons(project: Project): string[] {
  const reasons: string[] = [];
  if (project.anomaly_tag) reasons.push(project.anomaly_tag);
  if (project.anomaly_type === 'Duplicate Location') reasons.push('Overlapping proximity signal detected');
  if (project.anomaly_type === 'Split Tendering') reasons.push('Split-tendering pattern detected');
  if (project.anomaly_type === 'Prohibited Asset') reasons.push('Work description requires statutory review');
  if ((project.risk_score || 0) > 75 && reasons.length === 0) reasons.push('Composite risk score is above the scrutiny threshold');
  if ((project.risk_score || 0) >= 40 && reasons.length === 0) reasons.push('Moderate anomaly signals require verification');
  return reasons;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg border border-slate-700/70 bg-[#0b132b]/70 p-3"><dt className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1 break-words text-xs font-bold text-slate-100">{value || 'Not recorded'}</dd></div>;
}

export function ProjectQRModal({ project, onClose, showQr = true, auditLogs = [] }: { project: Project; onClose: () => void; showQr?: boolean; auditLogs?: Array<Record<string, unknown>> }) {
  const score = Number(project.risk_score) || 0;
  const risk = riskMeta(score);
  const url = projectUrl(project);
  const qrUrl = useMemo(() => `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`, [url]);
  const sanctioned = Number(project.sanctioned_amount ?? project.amount) || 0;
  const spent = Number(project.amount) || 0;
  const utilization = sanctioned > 0 ? Math.min(100, (spent / sanctioned) * 100) : 0;
  const reasons = anomalyReasons(project);

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <article className="relative mx-auto my-6 max-w-4xl overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#0f172a] text-white shadow-2xl shadow-black/70" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between border-b border-slate-700/70 bg-gradient-to-r from-[#112545] to-[#0b132b] px-5 py-4 sm:px-7">
          <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Public Transparency Passport</div><h2 className="mt-1 text-xl font-black sm:text-2xl">{project.work || 'MPLAD Work Profile'}</h2><p className="mt-1 font-mono text-[11px] text-slate-400">{project.work_id || `MPLAD-${project.id}`}</p></div>
          <button type="button" onClick={onClose} aria-label="Close passport" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
        </header>
        <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[190px_1fr]">
          {showQr && <aside className="flex flex-col items-center rounded-2xl border border-cyan-400/20 bg-white p-4 text-slate-900"><img src={qrUrl} alt="QR code for this public project passport" width={160} height={160} className="h-40 w-40" /><div className="mt-3 text-center text-[10px] font-black uppercase tracking-wider">Scan to verify</div><a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:underline">Open public passport <ExternalLink size={11} /></a></aside>}
          <div className={showQr ? '' : 'lg:col-span-2'}>
            <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${risk.tone}`}><div className="flex items-center gap-2 text-sm font-black"><ShieldAlert size={17} /> {risk.label} <span className="text-xs opacity-80">[{risk.range}]</span></div><div className="text-2xl font-black">{score}<span className="text-xs opacity-70">/100</span></div></div>
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><Field label="Work ID" value={project.work_id} /><Field label="Category" value={project.category} /><Field label="House" value={project.house} /><Field label="MP Name" value={project.mp} /><Field label="District / State" value={`${project.constituency || project.ida || 'District not recorded'} • ${project.state || 'State not recorded'}`} /><Field label="Vendor Name" value={project.vendor_name} /></dl>
            <section className="mt-4"><h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Financials</h3><dl className="grid gap-2 sm:grid-cols-3"><Field label="Sanctioned Amount" value={formatINR(sanctioned)} /><Field label="Spent Amount" value={formatINR(spent)} /><Field label="Utilization Ratio" value={`${utilization.toFixed(1)}%`} /></dl></section>
            <CitizenVerification project={project} />
            <section className="mt-4 rounded-xl border border-slate-700/70 bg-[#0b132b]/70 p-4"><h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-violet-300">Immutable audit trail</h3>{auditLogs.length ? <div className="space-y-2">{auditLogs.slice(0, 8).map((log, index) => <div key={`${String(log.id ?? index)}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-[10px] text-slate-300"><div className="font-bold text-slate-100">{String(log.action_taken ?? log.action ?? log.event_type ?? 'Audit event')}</div><div className="mt-1 break-all font-mono text-violet-300">{String(log.sha256_hash ?? log.hash ?? log.immutable_hash ?? 'Hash not recorded')}</div><div className="mt-1 text-slate-500">{String(log.created_at ?? 'Timestamp not recorded')}</div></div>)}</div> : <p className="text-xs text-slate-500">No public audit hash is recorded for this work yet.</p>}</section>
            <section className="mt-4 grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-slate-700/70 bg-[#0b132b]/70 p-4"><h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-rose-300">Anomaly Intelligence</h3>{reasons.length ? <ul className="space-y-2 text-xs font-semibold text-slate-200">{reasons.map((reason) => <li key={reason} className="flex gap-2"><span className="text-rose-400">•</span>{reason}</li>)}</ul> : <p className="text-xs text-emerald-300">No flagged anomaly reasons on record.</p>}</div><div className="rounded-xl border border-slate-700/70 bg-[#0b132b]/70 p-4"><h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Physical Verification</h3><div className="space-y-2 text-xs text-slate-200"><div className="flex items-center gap-2"><MapPin size={13} className="text-cyan-300" /> {project.latitude != null && project.longitude != null ? `${project.latitude.toFixed(5)}, ${project.longitude.toFixed(5)}` : 'GPS coordinates not recorded'}</div><div><span className="text-slate-500">Milestone:</span> {project.status || project.stage || project.payment_status || 'Not recorded'}</div><div><span className="text-slate-500">Vendor:</span> {project.vendor_name || 'Not recorded'}</div></div></div></section>
          </div>
        </div>
        <footer className="border-t border-slate-700/70 px-5 py-3 text-[10px] text-slate-500 sm:px-7">Public information view • Verify official records before relying on this summary.</footer>
      </article>
    </div>
  );
}

export function ProjectQRButton({ project, onOpen }: { project: Project; onOpen?: (project: Project) => void }) {
  return <button type="button" title="Open QR Passport" aria-label="Open QR Passport" onClick={() => onOpen?.(project)} className="inline-flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold text-cyan-200 hover:bg-cyan-500/20"><QrCode size={12} /> <span className="hidden sm:inline">QR Passport</span></button>;
}

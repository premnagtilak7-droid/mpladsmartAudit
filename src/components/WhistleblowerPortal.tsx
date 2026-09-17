'use client';

import { useState } from 'react';
import { AlertTriangle, Send, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Project } from '@/lib/types';

export function WhistleblowerPortal({ projects, onClose, onSubmitted }: { projects: Project[]; onClose: () => void; onSubmitted?: () => void }) {
  const [workId, setWorkId] = useState('');
  const [category, setCategory] = useState('Inflated Cost');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const submit = async () => {
    if (!description.trim()) { setMessage('Please describe the suspected malpractice.'); return; }
    const match = projects.find((project) => project.work_id?.toLowerCase() === workId.trim().toLowerCase());
    if (!match) { setMessage('Enter a valid Work ID from the public register so the tip can be routed to the audit queue.'); return; }
    setSending(true); setMessage('');
    const { error } = await supabase.from('anomaly_signals').insert({ project_id: match.id, total_risk_score: 85, primary_flag: 'CITIZEN_WHISTLEBLOWER_TIP', flag_details: { category, description, work_id: match.work_id, submitted_at: new Date().toISOString() } });
    setSending(false);
    if (error) { setMessage(error.message); return; }
    setMessage('Tip submitted anonymously to the Central Vigilance Director audit workspace.');
    setDescription(''); onSubmitted?.();
  };
  return <div className="fixed inset-0 z-[95] bg-slate-950/80 p-4 backdrop-blur-sm" onClick={onClose}><aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l border-rose-400/20 bg-[#0f172a] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
    <header className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-rose-300"><AlertTriangle size={14} /> Anonymous whistleblower portal</div><h2 className="mt-1 text-xl font-black text-white">Submit a vigilance tip</h2><p className="mt-1 text-xs text-slate-400">Your identity is not included in the public description.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10"><X size={18} /></button></header>
    <div className="mt-6 space-y-4"><label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Work ID / Project</span><input value={workId} onChange={(event) => setWorkId(event.target.value)} placeholder="e.g. WS/MP..." className="w-full rounded-lg border border-slate-700 bg-[#0b132b] px-3 py-2.5 text-sm text-white" /></label><label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Malpractice category</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#0b132b] px-3 py-2.5 text-sm text-white"><option>Inflated Cost</option><option>Duplicate Work</option><option>Substandard Material</option></select></label><label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Anonymous description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={7} placeholder="Describe the facts, location, dates, or evidence…" className="w-full rounded-lg border border-slate-700 bg-[#0b132b] px-3 py-2.5 text-sm text-white" /></label>{message && <p className="rounded-lg border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-200">{message}</p>}<button type="button" onClick={submit} disabled={sending} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-3 text-xs font-black text-white hover:bg-rose-500 disabled:opacity-60"><Send size={14} />{sending ? 'Routing tip…' : 'Submit Anonymous Tip'}</button></div>
  </aside></div>;
}

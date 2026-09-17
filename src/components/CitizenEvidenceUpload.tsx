'use client';

import { useState } from 'react';
import { Camera, Loader2, UploadCloud, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Project } from '@/lib/types';

export function CitizenEvidenceUpload({ project, onClose, onSubmitted }: { project: Project | null; onClose: () => void; onSubmitted?: () => void }) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('Delayed');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  if (!project) return null;
  const submit = async () => {
    if (!notes.trim()) { setMessage('Please add detailed site notes.'); return; }
    setSaving(true); setMessage('');
    try {
      let evidenceUrl: string | null = null;
      if (file) {
        const path = `citizen/${project.id}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`;
        const upload = await supabase.storage.from('citizen-evidence').upload(path, file, { upsert: false });
        if (upload.error) throw upload.error;
        evidenceUrl = supabase.storage.from('citizen-evidence').getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from('citizen_feedback').insert({ project_id: project.id, work_id: project.work_id, citizen_email: user.email, site_status: status, notes, evidence_url: evidenceUrl, created_at: new Date().toISOString(), flag: 'Pending Citizen Field Verification' });
      if (error) throw error;
      setMessage('Evidence submitted to the public record and DPO scrutiny queue.');
      onSubmitted?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit evidence.');
    } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[95] bg-slate-950/75 p-4 backdrop-blur-sm" onClick={onClose}><aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l border-cyan-400/20 bg-[#0f172a] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
    <header className="flex items-start justify-between"><div><div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Citizen evidence upload</div><h2 className="mt-1 text-xl font-black text-white">Report site conditions</h2><p className="mt-1 text-xs text-slate-400">{project.work_id || `MPLAD-${project.id}`}</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18} /></button></header>
    <div className="mt-6 space-y-4"><label className="block rounded-xl border border-dashed border-cyan-400/40 bg-cyan-500/5 p-5 text-center"><input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} /><Camera size={22} className="mx-auto text-cyan-300" /><span className="mt-2 block text-xs font-bold text-slate-200">{file?.name || 'Upload image or open camera'}</span><span className="mt-1 block text-[10px] text-slate-500">Evidence is attached to this work ID.</span></label>
      <label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Site status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#0b132b] px-3 py-2.5 text-sm text-white"><option>Delayed</option><option>Defective</option><option>Completed</option></select></label>
      <label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Detailed notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={6} placeholder="Describe what you observed at the site…" className="w-full rounded-lg border border-slate-700 bg-[#0b132b] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400" /></label>
      {message && <p className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 p-3 text-xs text-cyan-200">{message}</p>}
      <button type="button" onClick={submit} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-xs font-black text-white hover:bg-cyan-500 disabled:opacity-60">{saving ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} Submit Evidence</button>
    </div>
  </aside></div>;
}

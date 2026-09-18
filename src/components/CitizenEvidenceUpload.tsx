'use client';

import { useState } from 'react';
import { Camera, CheckCircle2, Loader2, UploadCloud, X } from 'lucide-react';
import exifr from 'exifr';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Project } from '@/lib/types';

type ForensicsResult = {
  verdict: 'PASSED' | 'FLAGGED' | 'REJECTED';
  width: number;
  height: number;
  mime: string;
  hasExif: boolean;
  hasGps: boolean;
  gpsDistanceMeters: number | null;
  gpsVerdict: 'PASSED' | 'FLAGGED' | 'UNAVAILABLE';
  elaVerdict: 'READY' | 'NOT_APPLICABLE';
  warnings: string[];
};

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radius = 6371000;
  const lat1 = aLat * Math.PI / 180;
  const lat2 = bLat * Math.PI / 180;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.asin(Math.sqrt(h));
}

async function analyzeImage(file: File, project: Project): Promise<ForensicsResult> {
  const metadata = await exifr.parse(file, { gps: true }).catch(() => null) as Record<string, unknown> | null;
  const gpsLat = Number(metadata?.latitude);
  const gpsLng = Number(metadata?.longitude);
  const hasGps = Number.isFinite(gpsLat) && Number.isFinite(gpsLng);
  const hasExif = Boolean(metadata && Object.keys(metadata).length);
  const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = URL.createObjectURL(file);
  });
  const warnings: string[] = [];
  let gpsDistanceMeters: number | null = null;
  let gpsVerdict: ForensicsResult['gpsVerdict'] = 'UNAVAILABLE';
  if (hasGps && project.latitude != null && project.longitude != null) {
    gpsDistanceMeters = distanceMeters(gpsLat, gpsLng, project.latitude, project.longitude);
    gpsVerdict = gpsDistanceMeters <= 25 ? 'PASSED' : 'FLAGGED';
    if (gpsVerdict === 'FLAGGED') warnings.push('EXIF GPS is more than 25m from the project coordinates.');
  } else {
    warnings.push('No usable EXIF GPS coordinates were found.');
  }
  if (!hasExif) warnings.push('Image has no readable EXIF metadata.');
  if (dimensions.width < 800 || dimensions.height < 600) warnings.push('Image resolution is below the recommended evidence quality.');
  const verdict = gpsVerdict === 'FLAGGED' ? 'REJECTED' : warnings.length ? 'FLAGGED' : 'PASSED';
  return { verdict, ...dimensions, mime: file.type, hasExif, hasGps, gpsDistanceMeters, gpsVerdict, elaVerdict: file.type === 'image/jpeg' ? 'READY' : 'NOT_APPLICABLE', warnings };
}

export function CitizenEvidenceUpload({ project, onClose, onSubmitted }: { project: Project | null; onClose: () => void; onSubmitted?: () => void }) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [forensics, setForensics] = useState<ForensicsResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [status, setStatus] = useState('Delayed');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  if (!project) return null;
  const handleFileChange = async (candidate: File | null) => {
    setFile(candidate);
    setForensics(null);
    if (!candidate) return;
    setAnalyzing(true);
    try { setForensics(await analyzeImage(candidate, project)); } catch { setMessage('Image analysis could not be completed.'); }
    finally { setAnalyzing(false); }
  };

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
      const { error } = await supabase.from('citizen_feedback').insert({ project_id: project.id, work_id: project.work_id, citizen_email: user.email, site_status: status, notes, evidence_url: evidenceUrl, forensic_result: forensics, created_at: new Date().toISOString(), flag: 'Pending Citizen Field Verification' });
      if (error) throw error;
      setMessage('Evidence submitted to the public record and DPO scrutiny queue.');
      onSubmitted?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit evidence.');
    } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[95] bg-slate-950/75 p-4 backdrop-blur-sm" onClick={onClose}><aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l border-cyan-400/20 bg-[#0f172a] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
    <header className="flex items-start justify-between"><div><div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Citizen evidence upload</div><h2 className="mt-1 text-xl font-black text-white">Report site conditions</h2><p className="mt-1 text-xs text-slate-400">{project.work_id || `MPLAD-${project.id}`}</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18} /></button></header>
    <div className="mt-6 space-y-4"><label className="block rounded-xl border border-dashed border-cyan-400/40 bg-cyan-500/5 p-5 text-center"><input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => handleFileChange(event.target.files?.[0] || null)} /><Camera size={22} className="mx-auto text-cyan-300" /><span className="mt-2 block text-xs font-bold text-slate-200">{file?.name || 'Upload image or open camera'}</span><span className="mt-1 block text-[10px] text-slate-500">Evidence is attached to this work ID.</span></label>
      {analyzing && <p className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 p-3 text-xs text-cyan-200">Running EXIF, GPS, resolution, and ELA readiness checks…</p>}
      {forensics && <div className={`rounded-xl border p-4 ${forensics.verdict === 'PASSED' ? 'border-emerald-400/30 bg-emerald-500/10' : forensics.verdict === 'FLAGGED' ? 'border-amber-400/30 bg-amber-500/10' : 'border-rose-400/30 bg-rose-500/10'}`}><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Evidence Forensics Verdict</span><span className="inline-flex items-center gap-1 text-xs font-black">{forensics.verdict === 'PASSED' && <CheckCircle2 size={13} />} {forensics.verdict}</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-300"><span>EXIF: {forensics.hasExif ? 'Present' : 'Missing'}</span><span>GPS: {forensics.gpsVerdict}</span><span>Resolution: {forensics.width}×{forensics.height}</span><span>ELA: {forensics.elaVerdict}</span></div>{forensics.warnings.length > 0 && <ul className="mt-2 space-y-1 text-[10px] text-amber-200">{forensics.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>}</div>}
      <label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Site status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#0b132b] px-3 py-2.5 text-sm text-white"><option>Delayed</option><option>Defective</option><option>Completed</option></select></label>
      <label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Detailed notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={6} placeholder="Describe what you observed at the site…" className="w-full rounded-lg border border-slate-700 bg-[#0b132b] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400" /></label>
      {message && <p className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 p-3 text-xs text-cyan-200">{message}</p>}
      <button type="button" onClick={submit} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-xs font-black text-white hover:bg-cyan-500 disabled:opacity-60">{saving ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} Submit Evidence</button>
    </div>
  </aside></div>;
}

'use client';

import { useState } from 'react';
import { CheckCircle2, LocateFixed, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Project } from '@/lib/types';

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radius = 6371000;
  const lat1 = aLat * Math.PI / 180;
  const lat2 = bLat * Math.PI / 180;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.asin(Math.sqrt(h));
}

export function CitizenVerification({ project }: { project: Project }) {
  const { user } = useAuth();
  const [state, setState] = useState<'idle' | 'locating' | 'verified' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const verify = () => {
    if (project.latitude == null || project.longitude == null) {
      setState('error');
      setMessage('This project does not have GPS coordinates for physical verification.');
      return;
    }
    if (!navigator.geolocation) {
      setState('error');
      setMessage('Browser geolocation is not available on this device.');
      return;
    }
    setState('locating');
    setMessage('Acquiring your current location…');
    navigator.geolocation.getCurrentPosition(async (position) => {
      const distance = distanceMeters(position.coords.latitude, position.coords.longitude, project.latitude!, project.longitude!);
      if (distance > 100) {
        setState('error');
        setMessage('You must be within 100m of the project site to log physical verification.');
        return;
      }
      const { error } = await supabase.from('citizen_verifications').insert({
        project_id: project.id,
        work_id: project.work_id,
        citizen_email: user.email,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        distance_meters: Math.round(distance),
        verified_at: new Date().toISOString(),
      });
      if (error) {
        setState('error');
        setMessage(`Verification could not be stored: ${error.message}`);
        return;
      }
      setState('verified');
      setMessage(`Site verified from ${Math.round(distance)}m away.`);
    }, (error) => {
      setState('error');
      setMessage(error.code === error.PERMISSION_DENIED ? 'Location permission is required to verify this work site.' : 'Unable to acquire your current location.');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };

  return <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Physical site verification</div><p className="mt-1 text-[11px] text-slate-400">Confirm you are physically present within 100m of this work.</p></div>
      {state === 'verified' ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black text-emerald-200"><CheckCircle2 size={13} /> Verified Local Citizen Inspector</span> : <button type="button" onClick={verify} disabled={state === 'locating'} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-[11px] font-black text-white hover:bg-cyan-500 disabled:opacity-60">{state === 'locating' ? <Loader2 size={13} className="animate-spin" /> : <LocateFixed size={13} />} Verify Work Site (I Am Here)</button>}
    </div>
    {message && <p className={`mt-2 text-[11px] ${state === 'verified' ? 'text-emerald-300' : state === 'error' ? 'text-rose-300' : 'text-slate-300'}`}>{message}</p>}
  </div>;
}

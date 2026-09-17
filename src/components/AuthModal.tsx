'use client';

import Link from 'next/link';
import { LockKeyhole, X } from 'lucide-react';

export function AuthModal({
  open,
  message,
  onClose,
}: {
  open: boolean;
  message?: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-blue-400/40 bg-[#0f172a] p-6 text-center shadow-2xl shadow-black/70"
      >
        <button type="button" aria-label="Close authentication dialog" onClick={onClose} className="absolute sr-only">Close</button>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/15 text-blue-300">
          <LockKeyhole size={24} />
        </div>
        <h2 id="auth-modal-title" className="mt-4 text-lg font-black text-white">Officer Authentication Required</h2>
        <p className="mt-2 text-xs leading-5 text-slate-300">{message || 'This administrative action is restricted to an authenticated officer profile.'}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/login" onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-blue-500">Proceed to Officer Login</Link>
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700"><X size={13} /> Dismiss</button>
        </div>
      </section>
    </div>
  );
}

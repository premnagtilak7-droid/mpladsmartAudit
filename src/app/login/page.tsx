'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, PRESET_ACCOUNTS, type UserRole } from '@/lib/AuthContext';
import { ArrowLeft, Building2, CheckCircle2, Landmark, LockKeyhole, ShieldCheck, Users } from 'lucide-react';

const profiles: Array<{
  key: keyof typeof PRESET_ACCOUNTS;
  icon: typeof ShieldCheck;
  accent: string;
  description: string;
}> = [
  {
    key: 'mospi_hq',
    icon: ShieldCheck,
    accent: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20',
    description: 'National scrutiny, model calibration, ingestion, and database administration.',
  },
  {
    key: 'dpo_varanasi',
    icon: Building2,
    accent: 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20',
    description: 'District operations, field verification, and Varanasi workspaces.',
  },
  {
    key: 'dpo_pune',
    icon: Building2,
    accent: 'border-blue-400/50 bg-blue-400/10 text-blue-200 hover:bg-blue-400/20',
    description: 'District operations, field verification, and Pune workspaces.',
  },
  {
    key: 'mp_varanasi',
    icon: Landmark,
    accent: 'border-amber-400/50 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20',
    description: 'Read-only constituency intelligence and proposal visibility.',
  },
  {
    key: 'public_citizen',
    icon: Users,
    accent: 'border-slate-500/60 bg-slate-400/10 text-slate-200 hover:bg-slate-400/20',
    description: 'Public transparency view with no administrative actions.',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { loginAs } = useAuth();

  const selectProfile = (key: keyof typeof PRESET_ACCOUNTS) => {
    loginAs(key);
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-[#050b18] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-3xl border border-cyan-400/20 bg-[#0b132b] shadow-2xl shadow-cyan-950/30">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <aside className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-br from-[#0d2440] via-[#0b1730] to-[#07101f] p-7 sm:p-10 lg:border-b-0 lg:border-r">
              <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
              <Link href="/" className="relative inline-flex items-center gap-2 text-xs font-bold text-cyan-200 hover:text-white">
                <ArrowLeft size={14} /> Return to public dashboard
              </Link>
              <div className="relative mt-16 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/40 bg-cyan-400/10 text-cyan-200 shadow-lg shadow-cyan-950/50">
                <LockKeyhole size={28} />
              </div>
              <p className="relative mt-8 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300">Government of India • MoSPI</p>
              <h1 className="relative mt-3 text-3xl font-black tracking-tight sm:text-4xl">e-SAKSHI<br /><span className="text-cyan-300">Secure Access</span></h1>
              <p className="relative mt-5 max-w-md text-sm leading-6 text-slate-300">MPLADS RAKSHAK is a controlled intelligence workspace for public-funds vigilance, anomaly review, and transparent scheme monitoring.</p>
              <div className="relative mt-10 space-y-3 text-xs font-semibold text-slate-300">
                <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> Session-scoped role access</div>
                <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> Audit-first action controls</div>
                <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> Public transparency remains read-only</div>
              </div>
            </aside>

            <section className="p-6 sm:p-10">
              <header className="mb-7">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Choose an authorised profile</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Sign in to your workspace</h2>
                <p className="mt-2 text-sm text-slate-400">Select the role profile issued for this demonstration environment.</p>
              </header>
              <div className="grid gap-3">
                {profiles.map(({ key, icon: Icon, accent, description }) => {
                  const profile = PRESET_ACCOUNTS[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectProfile(key)}
                      className={`group flex items-start gap-4 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${accent}`}
                    >
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-current/30 bg-black/10"><Icon size={19} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black">{profile.title}</span>
                        <span className="mt-1 block text-[11px] leading-5 opacity-80">{description}</span>
                        <span className="mt-2 block text-[10px] font-bold uppercase tracking-wider opacity-60">{profile.badge}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-7 text-center text-[10px] leading-5 text-slate-500">Demo role selection stores only a session-scoped profile in this browser. Production deployments should connect these roles to an institutional identity provider.</p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

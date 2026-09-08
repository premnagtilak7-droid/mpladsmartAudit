'use client';

import { useMemo, useState } from 'react';
import {
  Radar,
  Sun,
  Moon,
  ChevronDown,
  UserCog,
  Landmark,
  HardHat,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { useTheme } from './ThemeProvider';
import type { Role } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/mockData';
import { useProjects, useRecordCount } from '@/lib/useProjects';

const ROLE_ICONS: Record<Role, typeof UserCog> = {
  auditor: UserCog,
  dm: Landmark,
  contractor: HardHat,
  citizen: Users,
};

export function Header() {
  const { theme, toggle } = useTheme();
  const { projects, live } = useProjects();
  const count = useRecordCount(projects);
  const [role, setRole] = useState<Role>('auditor');
  const [open, setOpen] = useState(false);

  const statusText = live
    ? `Supabase DB: Connected (${count.toLocaleString('en-IN')} Records)`
    : `Preview Dataset: ${count.toLocaleString('en-IN')} Records`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl transition-colors dark:border-slate-800 dark:bg-slate-950/70">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-4 px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-sky-500 shadow-glow">
            <Radar className="h-5 w-5 text-white" strokeWidth={2.4} />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-bold tracking-tight sm:text-lg">
              MPLAD <span className="text-brand">Radar</span>
            </h1>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              MoSPI Vigilance &amp; Transparency Layer
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div className="ml-2 hidden items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50 px-3 py-1.5 md:flex dark:bg-emerald-500/10">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {statusText}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Role switcher */}
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand/50 hover:text-brand dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand/60"
            >
              {(() => {
                const Icon = ROLE_ICONS[role];
                return <Icon className="h-4 w-4" />;
              })()}
              <span className="hidden sm:inline">{ROLE_LABELS[role]}</span>
              <ChevronDown className="h-4 w-4 opacity-60" />
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card-lg dark:border-slate-700 dark:bg-slate-900">
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => {
                  const Icon = ROLE_ICONS[r];
                  const active = r === role;
                  return (
                    <button
                      key={r}
                      onClick={() => {
                        setRole(r);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                        active
                          ? 'bg-brand/10 font-semibold text-brand dark:text-brand-light'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{ROLE_LABELS[r]}</span>
                      {active && <CheckCircle2 className="ml-auto h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:text-brand dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}

'use client';

import { motion } from 'framer-motion';
import {
  Wallet,
  Construction,
  ShieldAlert,
  Banknote,
  Gauge,
} from 'lucide-react';
import type { Analytics } from '@/lib/types';
import { formatCrores, formatAmountCompact } from '@/lib/format';
import { useProjects } from '@/lib/useProjects';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

export function AnalyticsCards() {
  const { analytics, loading } = useProjects();

  const cards = [
    {
      key: 'funds',
      label: 'Total Monitored Funds',
      value: formatCrores(analytics.totalFunds),
      sub: 'Aggregate of disbursed amount',
      icon: Wallet,
      accent: 'from-sky-500/15 to-blue-500/10 text-sky-600 dark:text-sky-400',
      ring: 'ring-sky-500/20',
    },
    {
      key: 'works',
      label: 'Monitored Works',
      value: analytics.totalWorks.toLocaleString('en-IN'),
      sub: 'Rows in projects table',
      icon: Construction,
      accent: 'from-indigo-500/15 to-violet-500/10 text-indigo-600 dark:text-indigo-400',
      ring: 'ring-indigo-500/20',
    },
    {
      key: 'risk',
      label: 'Flagged High Risk',
      value: analytics.flaggedHighRisk.toLocaleString('en-IN'),
      sub: 'risk_score ≥ 80',
      icon: ShieldAlert,
      accent: 'from-rose-500/20 to-red-500/10 text-rose-600 dark:text-rose-400',
      ring: 'ring-rose-500/30',
      highlight: 'stated',
      bar: 'text-rose-600 dark:text-rose-400',
      track: 'bg-rose-500/15',
    },
    {
      key: 'stake',
      label: 'Funds at Stake',
      value: formatCrores(analytics.fundsAtStake),
      sub: `${formatAmountCompact(analytics.fundsAtStake)} in flagged records`,
      icon: Banknote,
      accent: 'from-emerald-500/20 to-teal-500/10 text-emerald-600 dark:text-emerald-400',
      ring: 'ring-emerald-500/30',
      highlight: 'stated',
      bar: 'text-emerald-600 dark:text-emerald-400',
      track: 'bg-emerald-500/15',
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        const isHighlight = (c as { highlight?: string }).highlight === 'stated';
        return (
          <motion.div
            key={c.key}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-card ring-1 transition hover:shadow-card-lg dark:bg-slate-900 dark:ring-1 ${c.ring} border-slate-200 dark:border-slate-800`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {c.label}
                </p>
                {loading ? (
                  <div className="mt-2 h-8 w-28 shimmer rounded-lg" />
                ) : (
                  <p
                    className={`mt-1 text-2xl font-bold tracking-tight sm:text-3xl ${
                      isHighlight
                        ? c.bar
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {c.value}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {c.sub}
                </p>
              </div>
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${c.accent}`}
              >
                <Icon className="h-5 w-5" strokeWidth={2.1} />
              </div>
            </div>
            {isHighlight && (
              <div className={`mt-3 h-1.5 w-full overflow-hidden rounded-full ${c.track}`}>
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${c.accent}`}
                  style={{
                    width: `${Math.min(
                      100,
                      (analytics.flaggedHighRisk / Math.max(analytics.totalWorks, 1)) * 100 + 8,
                    )}%`,
                  }}
                />
              </div>
            )}
            <Gauge className="absolute -right-3 -bottom-3 h-16 w-16 text-slate-900/[0.03] dark:text-white/[0.03]" />
          </motion.div>
        );
      })}
    </section>
  );
}

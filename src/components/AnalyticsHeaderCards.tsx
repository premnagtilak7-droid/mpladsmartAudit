'use client';

import { motion } from 'framer-motion';
import {
  IndianRupee,
  Layers3,
  ShieldAlert,
  HandCoins,
} from 'lucide-react';
import { formatCrores, formatINR } from '@/lib/format';
import type { Analytics } from '@/lib/types';

interface Props {
  analytics: Analytics;
  loading: boolean;
}

const cardBase =
  'relative overflow-hidden rounded-2xl border p-5 shadow-card transition-colors';

export default function AnalyticsHeaderCards({ analytics, loading }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* 1. Total Monitored Funds */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`${cardBase} border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900`}
      >
        <CardTop color="indigo">
          <IndianRupee size={16} className="text-white" />
          Total Monitored Funds
        </CardTop>
        <MetricValue
          loading={loading}
          value={formatCrores(analytics.totalFunds)}
          sub={`≈ ${formatINR(analytics.totalFunds)}`}
        />
      </motion.div>

      {/* 2. Monitored Works Count */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className={`${cardBase} border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900`}
      >
        <CardTop color="sky">
          <Layers3 size={16} className="text-white" />
          Monitored Works Count
        </CardTop>
        <MetricValue
          loading={loading}
          value={analytics.totalWorks.toLocaleString('en-IN')}
          sub="Total rows in projects table"
        />
      </motion.div>

      {/* 3. Flagged High Risk (rose) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className={`${cardBase} border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10`}
      >
        <CardTop color="rose">
          <ShieldAlert size={16} className="text-white" />
          Flagged High Risk
        </CardTop>
        <MetricValue
          loading={loading}
          value={analytics.flaggedHighRisk.toLocaleString('en-IN')}
          sub="Risk score ≥ 80"
          tone="rose"
        />
      </motion.div>

      {/* 4. Potential Funds at Stake (emerald) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className={`${cardBase} border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10`}
      >
        <CardTop color="emerald">
          <HandCoins size={16} className="text-white" />
          Potential Funds at Stake
        </CardTop>
        <MetricValue
          loading={loading}
          value={formatCrores(analytics.fundsAtStake)}
          sub="On risk score ≥ 80 records"
          tone="emerald"
        />
      </motion.div>
    </div>
  );
}

function CardTop({
  color,
  children,
}: {
  color: 'indigo' | 'sky' | 'rose' | 'emerald';
  children: React.ReactNode;
}) {
  const palette: Record<string, string> = {
    indigo: 'bg-brand',
    sky: 'bg-sky-500',
    rose: 'bg-rose-500',
    emerald: 'bg-emerald-500',
  };
  return (
    <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-lg ${palette[color]}`}
      >
        {children}
      </span>
      {analyticsLabel(children)}
    </div>
  );
}

// Extract label text from icon-wrapped children (avoids rendering icon in label).
function analyticsLabel(children: React.ReactNode): React.ReactNode {
  // The label is the last string-ish node; text nodes are rendered after the icon.
  return children;
}

function MetricValue({
  loading,
  value,
  sub,
  tone,
}: {
  loading: boolean;
  value: string;
  sub: string;
  tone?: 'rose' | 'emerald';
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="shimmer h-8 w-32 rounded-lg" />
        <div className="shimmer h-3 w-24 rounded" />
      </div>
    );
  }
  const toneCls =
    tone === 'rose'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'emerald'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-slate-900 dark:text-white';
  return (
    <div>
      <div className={`text-3xl font-bold tabular-nums tracking-tight ${toneCls}`}>
        {value}
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
    </div>
  );
}

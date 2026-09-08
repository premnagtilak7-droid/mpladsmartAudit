'use client';

import { Search, Filter, ArrowUpDown, X, ChevronDown } from 'lucide-react';
import type { AnomalyType } from '@/lib/types';

export type SortMode = 'risk_desc' | 'amount_desc' | 'date_desc' | 'risk_asc';

const ANOMALY_OPTIONS: Array<'All Types' | AnomalyType> = [
  'All Types',
  'Duplicate Location',
  'Split Tendering',
  'Prohibited Asset',
  'Normal',
];

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: 'risk_desc', label: 'Risk Score (High to Low)' },
  { value: 'risk_asc', label: 'Risk Score (Low to High)' },
  { value: 'amount_desc', label: 'Disbursed Amount (High to Low)' },
  { value: 'date_desc', label: 'Expenditure Date (Newest)' },
];

interface Props {
  query: string;
  setQuery: (v: string) => void;
  anomaly: 'All Types' | AnomalyType;
  setAnomaly: (v: 'All Types' | AnomalyType) => void;
  sort: SortMode;
  setSort: (v: SortMode) => void;
  onClear: () => void;
  resultCount: number;
}

export function ControlBar({
  query,
  setQuery,
  anomaly,
  setAnomaly,
  sort,
  setSort,
  onClear,
  resultCount,
}: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by Work, Vendor, Constituency, or MP…"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand/60 focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Anomaly filter */}
      <div className="relative">
        <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <select
          value={anomaly}
          onChange={(e) => setAnomaly(e.target.value as Props['anomaly'])}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm text-slate-700 outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 lg:w-52"
        >
          {ANOMALY_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o === 'All Types' ? 'Anomaly: All Types' : o}
            </option>
          ))}
        </select>
        <ChevronFold className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {/* Sort */}
      <div className="relative">
        <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm text-slate-700 outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 lg:w-64"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </select>
        <ChevronFold className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {/* Result count + clear */}
      <div className="mt-1 flex items-center gap-2 lg:mt-0">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          {resultCount.toLocaleString('en-IN')} records
        </span>
        {(query || anomaly !== 'All Types') && (
          <button
            onClick={onClear}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

// Reused chevron for custom selects.
function ChevronFold({ className }: { className?: string }) {
  return <ChevronDown className={className} />;
}

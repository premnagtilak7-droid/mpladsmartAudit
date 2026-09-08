'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import type { Analytics, AnomalyType, Project, RiskDriver } from './types';

export interface ProjectsState {
  projects: Project[];
  analytics: Analytics;
  loading: boolean;
  error: string | null;
  live: boolean;
  reload: () => void;
}

type SupabaseProjectRow = Record<string, unknown>;

/**
 * Loads the live projects table. There is deliberately no mock fallback here:
 * the dashboard must reflect the Supabase dataset and surface connection/query
 * errors instead of presenting simulated records as live data.
 */
export function useProjects(): ProjectsState {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setLive(false);

      if (!supabase || !isSupabaseConfigured) {
        if (!cancelled) {
          setProjects([]);
          setError('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.');
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error: queryError } = await supabase
          .from('projects')
          .select('*')
          .order('risk_score', { ascending: false });

        if (queryError) throw queryError;
        if (cancelled) return;

        setProjects((data ?? []).map(normalizeProject));
        setLive(true);
        setLoading(false);
      } catch (cause) {
        if (cancelled) return;
        setProjects([]);
        setLive(false);
        setError(cause instanceof Error ? cause.message : 'Unable to query Supabase projects.');
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const analytics = useMemo(() => computeLiveAnalytics(projects), [projects]);
  return { projects, analytics, loading, error, live, reload };
}

function normalizeProject(row: SupabaseProjectRow, index: number): Project {
  const amount = numberValue(row.amount ?? row['Fund Disbursed Amount ( ₹ )']);
  const riskScore = numberValue(row.risk_score ?? row['risk score'] ?? row['Risk Score']);
  const anomaly = anomalyValue(row.anomaly_type ?? row['Anomaly Type']);

  return {
    id: numberValue(row.id) || index + 1,
    sr_no: textValue(row.sr_no ?? row['Sr. No.']),
    state: textValue(row.state ?? row.State),
    work: textValue(row.work ?? row.Work),
    work_id: textValue(row.work_id ?? row['Work ID']),
    ida: textValue(row.ida ?? row.IDA),
    mp: textValue(row.mp ?? row["Hon'ble Members of Parliament"]),
    constituency: textValue(row.constituency ?? row.Constituency),
    expenditure_date: textValue(row.expenditure_date ?? row['Expenditure Date']),
    vendor_name: textValue(row.vendor_name ?? row['Vendor Name']),
    payment_status: textValue(row.payment_status ?? row['Payment Status']),
    amount,
    risk_score: riskScore,
    anomaly_type: anomaly,
    risk_drivers: riskDrivers(row.risk_drivers),
    approval_status: textValue(row.approval_status) ?? undefined,
    delay_days: numberValue(row.delay_days),
    completion_percent: numberValue(row.completion_percent),
  };
}

function computeLiveAnalytics(rows: Project[]): Analytics {
  return rows.reduce<Analytics>((summary, row) => {
    const amount = Number(row.amount) || 0;
    const highRisk = (Number(row.risk_score) || 0) >= 80;
    summary.totalFunds += amount;
    summary.totalWorks += 1;
    if (highRisk) {
      summary.flaggedHighRisk += 1;
      summary.fundsAtStake += amount;
    }
    return summary;
  }, { totalFunds: 0, totalWorks: 0, flaggedHighRisk: 0, fundsAtStake: 0 });
}

function textValue(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : String(value);
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/[₹,]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function anomalyValue(value: unknown): AnomalyType | null {
  const text = textValue(value);
  return text === 'Duplicate Location' || text === 'Split Tendering' || text === 'Prohibited Asset' || text === 'Normal' ? text : null;
}

function riskDrivers(value: unknown): RiskDriver[] | undefined {
  return Array.isArray(value) ? value as RiskDriver[] : undefined;
}

/** Summary count used by existing consumers. */
export function useRecordCount(projects: Project[]): number {
  return projects.length;
}

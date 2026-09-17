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
  recordCount: number;
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
  const [recordCount, setRecordCount] = useState(0);
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
          setRecordCount(0);
          setError('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.');
          setLoading(false);
        }
        return;
      }

      try {
        const rows = await fetchAllProjects();
        if (cancelled) return;

        setProjects(rows.map(normalizeProject));
        setRecordCount(rows.length);
        setLive(true);
        setLoading(false);
      } catch (cause) {
        if (cancelled) return;
        setProjects([]);
        setRecordCount(0);
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
  return { projects, analytics, loading, error, live, recordCount, reload };
}

async function fetchAllProjects(): Promise<SupabaseProjectRow[]> {
  if (!supabase) return [];

  const allData: SupabaseProjectRow[] = [];
  let page = 0;
  const pageSize = 1000;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20_000);

  try {
    while (true) {
      // Do not order by risk_score here. Older production datasets use the raw
      // CSV schema and do not have that column, which made the whole request
      // fail before any rows could render. The UI already sorts normalized rows.
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .abortSignal(controller.signal);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allData.push(...(data as SupabaseProjectRow[]));
      if (data.length < pageSize) break;
      page += 1;
    }

    return allData;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizeProject(row: SupabaseProjectRow, index: number): Project {
  const amount = numberValue(row.amount ?? row['Fund Disbursed Amount ( ₹ )']);
  const riskScore = numberValue(row.risk_score ?? row['risk score'] ?? row['Risk Score']);
  const anomaly = anomalyValue(row.anomaly_type ?? row['Anomaly Type']);

  return {
    id: numberValue(row.id) || index + 1,
    house: houseValue(row.house ?? row.house_of_parliament ?? row.HOUSE_OF_PARLIAMENT ?? row['House of Parliament']),
    sr_no: textValue(row.sr_no ?? row['Sr. No.']),
    state: textValue(row.state ?? row.State),
    work: textValue(row.work ?? row.work_title ?? row.Work ?? row.ACTIVITY_NAME),
    work_id: textValue(row.work_id ?? row['Work ID']),
    ida: textValue(row.ida ?? row.IDA),
    mp: textValue(row.mp ?? row.mp_name ?? row.MP_NAME ?? row["Hon'ble Members of Parliament"]),
    constituency: textValue(row.constituency ?? row.Constituency ?? row.CONSTITUENCY_NAME),
    expenditure_date: textValue(row.expenditure_date ?? row['Expenditure Date']),
    vendor_name: textValue(row.vendor_name ?? row['Vendor Name']),
    payment_status: textValue(row.payment_status ?? row['Payment Status'] ?? row.status ?? row.Status),
    status: textValue(row.status ?? row.Status ?? row.payment_status ?? row['Payment Status']),
    stage: textValue(row.stage ?? row.Stage ?? row.project_stage ?? row['Project Stage']),
    latitude: numberValue(row.latitude ?? row.lat ?? row.Latitude ?? row.Lat),
    longitude: numberValue(row.longitude ?? row.lng ?? row.Longitude ?? row.Lng),
    amount: amount ?? numberValue(row.spent_amount ?? row.sanctioned_amount ?? row['Fund Disbursed Amount ( ₹ )']),
    allocated_amount: numberValue(row.allocated_amount ?? row['Allocated Amount'] ?? row['Allocated AMOUNT (₹)']),
    sanctioned_amount: numberValue(row.sanctioned_amount ?? row['Sanctioned Amount'] ?? row['Sanctioned AMOUNT (₹)'] ?? row.RECOMMENDED_AMOUNT ?? row.SANCTIONED_AMOUNT),
    risk_score: riskScore,
    anomaly_type: anomaly,
    risk_drivers: riskDrivers(row.risk_drivers),
    approval_status: textValue(row.approval_status) ?? undefined,
    delay_days: numberValue(row.delay_days),
    completion_percent: numberValue(row.completion_percent),
  };
}

function houseValue(value: unknown): Project['house'] {
  const text = textValue(value)?.toLowerCase() ?? '';
  if (text.includes('rajya') || text === '1') return 'Rajya Sabha';
  if (text.includes('lok') || text === '2') return 'Lok Sabha';
  return textValue(value);
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

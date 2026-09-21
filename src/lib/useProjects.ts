'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import type { Analytics, AnomalyType, Project, RiskDriver } from './types';

export interface MospiSummary {
  allocated_limit: number;
  calamity_amount: number;
  works_recommended_count: number;
  works_recommended_amount: number;
  works_sanctioned_count: number;
  works_sanctioned_amount: number;
  works_completed_count: number;
  works_completed_amount: number;
  total_expenditure: number;
}

export interface ProjectsState {
  projects: Project[];
  analytics: Analytics;
  summary: MospiSummary | null;
  highRiskCount: number | null;
  riskQueue: Project[] | null;
  loading: boolean;
  error: string | null;
  live: boolean;
  recordCount: number;
  loadMore: () => Promise<void>;
  loadingMore: boolean;
  reload: () => void;
}

type SupabaseProjectRow = Record<string, unknown>;
export type HouseFilter = 'LOK_SABHA' | 'RAJYA_SABHA' | 'ALL';

function housePattern(houseFilter: HouseFilter): string | null {
  if (houseFilter === 'LOK_SABHA') return 'Lok Sabha';
  if (houseFilter === 'RAJYA_SABHA') return 'Rajya Sabha';
  return null;
}

/**
 * Loads the live projects table. There is deliberately no mock fallback here:
 * the dashboard must reflect the Supabase dataset and surface connection/query
 * errors instead of presenting simulated records as live data.
 */
export function useProjects(houseFilter: HouseFilter = 'ALL'): ProjectsState {
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<MospiSummary | null>(null);
  const [highRiskCount, setHighRiskCount] = useState<number | null>(null);
  const [riskQueue, setRiskQueue] = useState<Project[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [recordCount, setRecordCount] = useState(0);
  const [sourceTable, setSourceTable] = useState<'proposals' | 'projects'>('projects');
  const [loadingMore, setLoadingMore] = useState(false);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setLive(false);
      setSourceTable('projects');

      if (!supabase || !isSupabaseConfigured) {
        if (!cancelled) {
          setProjects([]);
          setSummary(null);
          setHighRiskCount(null);
          setRiskQueue(null);
          setRecordCount(0);
          setError('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.');
          setLoading(false);
        }
        return;
      }

      try {
        fetchMospiSummary(houseFilter)
          .then((liveSummary) => {
            if (!cancelled && liveSummary) setSummary(liveSummary);
          })
          .catch(() => {
            // Keep the project table usable if the RPC has not been deployed yet.
          });
        fetchHighRiskCount(houseFilter)
          .then((count) => {
            if (!cancelled) setHighRiskCount(count);
          })
          .catch(() => {
            // Risk KPI remains pending rather than blocking the dashboard.
          });
        fetchRiskQueue(houseFilter)
          .then((rows) => {
            if (!cancelled) setRiskQueue(rows.map(normalizeProject));
          })
          .catch(() => {
            // The dashboard can fall back to the visible page if this query fails.
          });
        let loaded = 0;
        const total = await fetchAllProjects(houseFilter, (batch, table) => {
          if (cancelled) return;
          setSourceTable(table);
          const normalized = batch.map((row, index) => normalizeProject(row, loaded + index));
          loaded += normalized.length;
          setProjects((current) => current.length === 0 ? normalized : [...current, ...normalized]);
          setRecordCount(loaded);
          setLive(true);
          // Render the first page immediately. The exact total comes from
          // Supabase count metadata, so no full-table download is required.
          setLoading(false);
        });
        if (cancelled) return;
        setRecordCount(total);
      } catch (cause) {
        if (cancelled) return;
        setProjects([]);
        setSummary(null);
        setHighRiskCount(null);
        setRiskQueue(null);
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
  }, [tick, houseFilter]);

  const loadMore = useCallback(async () => {
    if (!supabase || loadingMore || projects.length >= recordCount) return;
    setLoadingMore(true);
    const start = projects.length;
    try {
      const { data, error } = await supabase
        .from(sourceTable)
        .select('*')
        .order('id', { ascending: true })
        .range(start, start + 999);
      if (error) throw error;
      const rows = (data || []) as SupabaseProjectRow[];
      if (rows.length) setProjects((current) => [...current, ...rows.map((row, index) => normalizeProject(row, start + index))]);
      console.info(`[Supabase] ${sourceTable} next page`, { start, returned: rows.length, first: rows[0] ?? null });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the next live data page.');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, projects.length, recordCount, sourceTable]);

  const analytics = useMemo(() => computeLiveAnalytics(projects), [projects]);
  return { projects, analytics, summary, highRiskCount, riskQueue, loading, error, live, recordCount, loadMore, loadingMore, reload };
}

async function fetchRiskQueue(houseFilter: HouseFilter): Promise<SupabaseProjectRow[]> {
  if (!supabase) return [];
  let query = supabase
    .from('projects')
    .select('*')
    .gt('risk_score', 75);
  const pattern = housePattern(houseFilter);
  if (pattern) query = query.ilike('house', `%${pattern}%`);
  const { data, error } = await query
    .order('risk_score', { ascending: false })
    .order('id', { ascending: true })
    .range(0, 49);
    if (error) throw error;
    console.info('[Supabase] risk queue query', { returned: data?.length ?? 0, first: data?.[0] ?? null });
    return (data || []) as SupabaseProjectRow[];
}

async function fetchHighRiskCount(houseFilter: HouseFilter): Promise<number> {
  if (!supabase) return 0;
  let query = supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .gt('risk_score', 75);
  const pattern = housePattern(houseFilter);
  if (pattern) query = query.ilike('house', `%${pattern}%`);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function fetchMospiSummary(houseFilter: HouseFilter): Promise<MospiSummary | null> {
  if (!supabase) return null;
  const [{ data, error }, publicResult] = await Promise.all([
    supabase.rpc('get_esakshi_summary', { house_filter: houseFilter }),
    houseFilter === 'ALL' ? supabase.rpc('get_public_citizen_summary') : Promise.resolve({ data: null, error: null }),
  ]);
  if (error && publicResult.error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const publicRow = Array.isArray(publicResult.data) ? publicResult.data[0] : publicResult.data;
  if (!row && !publicRow) return null;
  const source = publicRow || row;
  return {
    allocated_limit: Number(source.allocated_limit) || 0,
    calamity_amount: Number(row?.calamity_amount ?? source.calamity_amount) || 0,
    works_recommended_count: Number(source.works_recommended_count) || 0,
    works_recommended_amount: Number(source.works_recommended_amount) || 0,
    works_sanctioned_count: Number(source.works_sanctioned_count) || 0,
    works_sanctioned_amount: Number(source.works_sanctioned_amount) || 0,
    works_completed_count: Number(source.works_completed_count) || 0,
    works_completed_amount: Number(source.works_completed_amount) || 0,
    total_expenditure: Number(source.total_expenditure) || 0,
  };
}

async function fetchAllProjects(houseFilter: HouseFilter, onPage: (rows: SupabaseProjectRow[], table: 'proposals' | 'projects') => void): Promise<number> {
  if (!supabase) return 0;

  const pageSize = 1000;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10_000);

  try {
    // Load only the first page. The exact total is returned by PostgREST count
    // metadata, while the summary RPC handles all-record aggregates. This keeps
    // the initial dashboard response small even with 118,018 projects.
    let lastError: unknown = null;
    for (const table of ['proposals', 'projects'] as const) {
      let query = supabase.from(table).select('*', { count: 'exact' });
      const pattern = housePattern(houseFilter);
      if (pattern) query = query.ilike('house', `%${pattern}%`);
      const result = await query
        .order('id', { ascending: true })
        .range(0, pageSize - 1)
        .abortSignal(controller.signal);
      if (result.error) {
        lastError = result.error;
        console.warn(`[Supabase] ${table} query failed; trying next live table`, result.error);
        continue;
      }
      const rows = (result.data || []) as SupabaseProjectRow[];
      console.info(`[Supabase] ${table} query`, { count: result.count, returned: rows.length, first: rows[0] ?? null });
      if (rows.length > 0) onPage(rows, table);
      return result.count ?? rows.length;
    }
    throw lastError instanceof Error ? lastError : new Error('Unable to query live proposals or projects.');
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizeProject(row: SupabaseProjectRow, index: number): Project {
  const amount = numberValue(row.amount ?? row.fund_disbursed ?? row.spent_amount ?? row['Fund Disbursed Amount ( ₹ )']);
  const riskScore = numberValue(row.risk_score ?? row.risk ?? row['risk score'] ?? row['Risk Score']);
  const anomaly = anomalyValue(row.anomaly_type ?? row['Anomaly Type']);

  return {
    id: numberValue(row.id) || stableNumericId(row.work_id ?? row.work_name ?? row.project_title ?? row.sr_no) || index + 1,
    house: houseValue(row.house ?? row.house_type ?? row.house_of_parliament ?? row.HOUSE_OF_PARLIAMENT ?? row['House of Parliament']),
    sr_no: textValue(row.sr_no ?? row['Sr. No.']),
    state: textValue(row.state ?? row.State),
    category: textValue(row.category ?? row.Category),
    work: textValue(row.work_name ?? row.project_title ?? row.work_title ?? row.work ?? row.Work ?? row.ACTIVITY_NAME),
    work_id: textValue(row.work_id ?? row.project_id ?? row['Work ID']),
    ida: textValue(row.ida ?? row.IDA),
    mp: textValue(row.mp ?? row.mp_name ?? row.MP_NAME ?? row["Hon'ble Members of Parliament"]),
    constituency: textValue(row.constituency ?? row.constituency_name ?? row.Constituency ?? row.CONSTITUENCY_NAME),
    expenditure_date: textValue(row.expenditure_date ?? row['Expenditure Date']),
    vendor_name: textValue(row.vendor_name ?? row.executing_agency ?? row.vendor ?? row['Vendor Name']),
    payment_status: textValue(row.payment_status ?? row['Payment Status'] ?? row.status ?? row.Status),
    status: textValue(row.status ?? row.Status ?? row.payment_status ?? row['Payment Status']),
    stage: textValue(row.stage ?? row.Stage ?? row.project_stage ?? row['Project Stage']),
    latitude: numberValue(row.latitude ?? row.lat ?? row.Latitude ?? row.Lat),
    longitude: numberValue(row.longitude ?? row.lng ?? row.Longitude ?? row.Lng),
    amount: amount ?? numberValue(row.fund_disbursed ?? row.spent_amount ?? row.sanctioned_amount ?? row['Fund Disbursed Amount ( ₹ )']),
    allocated_amount: numberValue(row.allocated_amount ?? row.allocation_amount ?? row.budget_amount ?? row['Allocated Amount'] ?? row['Allocated AMOUNT (₹)']),
    sanctioned_amount: numberValue(row.sanctioned_amount ?? row['Sanctioned Amount'] ?? row['Sanctioned AMOUNT (₹)'] ?? row.RECOMMENDED_AMOUNT ?? row.SANCTIONED_AMOUNT),
    risk_score: riskScore,
    anomaly_type: anomaly,
    risk_drivers: riskDrivers(row.risk_drivers),
    approval_status: textValue(row.approval_status) ?? undefined,
    delay_days: numberValue(row.delay_days),
    completion_percent: numberValue(row.completion_percent),
  };
}

function stableNumericId(value: unknown): number | null {
  const text = textValue(value);
  if (!text) return null;
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  return Math.abs(hash) || null;
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
    const highRisk = (Number(row.risk_score) || 0) > 75;
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

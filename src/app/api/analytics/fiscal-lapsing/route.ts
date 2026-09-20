import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PAGE_SIZE = 1000;

type Row = {
  id: string | number;
  work_id?: string | null;
  work_title?: string | null;
  state?: string | null;
  district?: string | null;
  constituency?: string | null;
  status?: string | null;
  sanctioned_amount?: number | string | null;
  spent_amount?: number | string | null;
  sanction_date?: string | null;
  created_at?: string | null;
};

function amount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthsOld(value: string | null | undefined, now: Date) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
}

function fiscalYearEnd(now: Date) {
  const year = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  return new Date(year, 2, 31, 23, 59, 59);
}

function getDataClient(): SupabaseClient {
  const admin = getAdminClient();
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) throw new Error('Supabase configuration is missing.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadRows() {
  const client = getDataClient();
  const rows: Row[] = [];
  for (let page = 0; ; page += 1) {
    const result = await client
      .from('projects')
      .select('id, work_id, work_title, state, district, constituency, status, sanctioned_amount, spent_amount, sanction_date, created_at')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const batch = (result.data || []) as Row[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function GET() {
  try {
    const rows = await loadRows();
    const now = new Date();
    const end = fiscalYearEnd(now);
    const daysToForfeiture = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
    const aging = { under_12_months: 0, twelve_to_eighteen_months: 0, over_18_months: 0 };
    let corpusAtRisk = 0;
    let criticalDelayed = 0;
    const delayedWorks: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      const age = monthsOld(row.sanction_date || row.created_at, now);
      const status = String(row.status || '').toLowerCase();
      const unfinished = !/completed|success|closed|handed.?over/.test(status);
      const sanctioned = amount(row.sanctioned_amount || row.spent_amount);
      if (age > 18) aging.over_18_months += 1;
      else if (age >= 12) aging.twelve_to_eighteen_months += 1;
      else aging.under_12_months += 1;
      if (unfinished && age >= 12) {
        corpusAtRisk += Math.max(0, sanctioned - amount(row.spent_amount));
        if (age > 18) criticalDelayed += 1;
        if (delayedWorks.length < 50) delayedWorks.push({ id: row.id, work_id: row.work_id, title: row.work_title, district: row.district, state: row.state, age_months: Number(age.toFixed(1)), sanctioned_amount: sanctioned, status: row.status || 'Not recorded' });
      }
    }

    return NextResponse.json({ ok: true, projects_scanned: rows.length, days_to_fy_forfeiture: daysToForfeiture, corpus_at_risk: corpusAtRisk, critical_delayed_works: criticalDelayed, aging, delayed_works: delayedWorks, generated_at: now.toISOString() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Fiscal-lapsing analytics failed.' }, { status: 503 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_TOKEN_HEADER, assertOfficer, getAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PAGE_SIZE = 1000;
const WRITE_BATCH_SIZE = 250;
const HIGH_RISK_THRESHOLD = 80;
const GRID_SIZE = 0.005;

type ProjectRow = {
  id: string;
  work_id?: string | null;
  category?: string | null;
  district?: string | null;
  vendor_name?: string | null;
  sanctioned_amount?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  sanction_date?: string | null;
  completion_date?: string | null;
  status?: string | null;
};

type ScoredRow = {
  project: ProjectRow;
  risk: number;
  cost: number;
  delay: number;
  concentration: number;
  spatial: number;
  flag: string;
};

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function key(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function daysBetween(start: string | null | undefined, end: Date): number {
  if (!start) return 0;
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - date.getTime()) / 86_400_000));
}

function bucket(value: number): number {
  return Math.floor(value / GRID_SIZE);
}

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const radius = 6_371_000;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

async function loadAllProjects(admin: ReturnType<typeof getAdminClient>): Promise<ProjectRow[]> {
  if (!admin) return [];
  const rows: ProjectRow[] = [];
  for (let page = 0; ; page += 1) {
    const result = await admin
      .from('projects')
      .select('id, work_id, category, district, vendor_name, sanctioned_amount, latitude, longitude, sanction_date, completion_date, status')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const batch = (result.data || []) as ProjectRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

function scoreProjects(rows: ProjectRow[]): ScoredRow[] {
  const categoryAmounts = new Map<string, number[]>();
  const districtVendorCounts = new Map<string, Map<string, number>>();
  const districtCounts = new Map<string, number>();
  const coordinates = new Map<string, ProjectRow[]>();

  for (const row of rows) {
    const category = key(row.category) || 'uncategorized';
    const amount = numeric(row.sanctioned_amount);
    const amounts = categoryAmounts.get(category) || [];
    if (amount > 0) amounts.push(amount);
    categoryAmounts.set(category, amounts);

    const district = key(row.district) || 'unknown';
    const vendor = key(row.vendor_name) || 'unknown';
    const vendors = districtVendorCounts.get(district) || new Map<string, number>();
    vendors.set(vendor, (vendors.get(vendor) || 0) + 1);
    districtVendorCounts.set(district, vendors);
    districtCounts.set(district, (districtCounts.get(district) || 0) + 1);

    const lat = numeric(row.latitude);
    const lng = numeric(row.longitude);
    if (lat && lng) {
      const cell = `${bucket(lat)}:${bucket(lng)}`;
      const cellRows = coordinates.get(cell) || [];
      cellRows.push(row);
      coordinates.set(cell, cellRows);
    }
  }

  return rows.map((project) => {
    const amount = numeric(project.sanctioned_amount);
    const categoryMedian = median(categoryAmounts.get(key(project.category) || 'uncategorized') || []);
    const cost = categoryMedian > 0 && amount > categoryMedian * 1.4 ? 30 : 0;

    const status = key(project.status);
    const delay = daysBetween(project.sanction_date, new Date()) > 180 || /overdue|delayed|stalled|in.?progress|pending/i.test(status) ? 25 : 0;

    const district = key(project.district) || 'unknown';
    const vendor = key(project.vendor_name) || 'unknown';
    const vendorCount = districtVendorCounts.get(district)?.get(vendor) || 0;
    const totalDistrict = districtCounts.get(district) || 1;
    const concentration = vendorCount / totalDistrict > 0.35 ? 25 : 0;

    const lat = numeric(project.latitude);
    const lng = numeric(project.longitude);
    let spatial = 0;
    if (lat && lng) {
      for (let latOffset = -1; latOffset <= 1 && spatial === 0; latOffset += 1) {
        for (let lngOffset = -1; lngOffset <= 1 && spatial === 0; lngOffset += 1) {
          const nearby = coordinates.get(`${bucket(lat) + latOffset}:${bucket(lng) + lngOffset}`) || [];
          if (nearby.some((other) => other.id !== project.id && distanceMeters(lat, lng, numeric(other.latitude), numeric(other.longitude)) < 500)) {
            spatial = 20;
          }
        }
      }
    }

    const risk = Math.min(100, cost + delay + concentration + spatial);
    const flag = cost ? 'Cost Outlier' : delay ? 'Execution Delay' : concentration ? 'Contractor Concentration' : spatial ? 'Spatial Overlap' : 'Normal';
    return { project, risk, cost, delay, concentration, spatial, flag };
  });
}

export async function POST(req: NextRequest) {
  const auth = assertOfficer(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase service-role configuration is missing.' }, { status: 503 });

  try {
    const rows = await loadAllProjects(admin);
    if (rows.length === 0) return NextResponse.json({ ok: true, projects_scanned: 0, high_risk: 0 });

    const scored = scoreProjects(rows);
    let updated = 0;
    let signals = 0;

    for (let offset = 0; offset < scored.length; offset += WRITE_BATCH_SIZE) {
      const batch = scored.slice(offset, offset + WRITE_BATCH_SIZE);
      const updates = await Promise.all(batch.map((row) =>
        admin.from('projects').update({ risk_score: row.risk }).eq('id', row.project.id),
      ));
      const failed = updates.find((result) => result.error);
      if (failed?.error) throw failed.error;
      updated += batch.length;

      const projectIds = batch.map((row) => row.project.id);
      const clearSignals = await admin.from('anomaly_signals').delete().in('project_id', projectIds);
      if (clearSignals.error) throw clearSignals.error;

      const flagged = batch.filter((row) => row.risk >= HIGH_RISK_THRESHOLD);
      if (flagged.length > 0) {
        const signalRows = flagged.map((row) => ({
          project_id: row.project.id,
          rule_score: Math.min(30, row.cost + row.delay),
          spatial_score: row.spatial,
          nlp_score: 0,
          ml_score: row.concentration,
          total_risk_score: row.risk,
          primary_flag: row.flag,
          flag_details: { cost: row.cost, delay: row.delay, concentration: row.concentration, spatial: row.spatial },
        }));
        const result = await admin.from('anomaly_signals').insert(signalRows);
        if (result.error) throw result.error;
        signals += signalRows.length;
      }
    }

    return NextResponse.json({
      ok: true,
      projects_scanned: rows.length,
      projects_updated: updated,
      high_risk: scored.filter((row) => row.risk >= HIGH_RISK_THRESHOLD).length,
      anomaly_signals_written: signals,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Dataset scoring failed.' }, { status: 500 });
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: 'POST, OPTIONS', [ADMIN_TOKEN_HEADER]: 'required' } });
}

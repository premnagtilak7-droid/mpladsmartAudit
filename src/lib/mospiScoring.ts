// ---------------------------------------------------------------------------
// MPLAD Radar — MoSPI ingestion scoring engine
// ---------------------------------------------------------------------------
// Pure, deterministic, dependency-free. Given a normalised batch of MoSPI
// records this module computes the per-project anomaly decomposition written to
// `anomaly_signals`:
//
//   rule_score     — Rule check          (prohibited assets, split tendering,
//                                         data integrity, stalled works)
//   spatial_score  — Spatial overlap     (works sharing a ~100 m grid cell)
//   nlp_score      — Duplicate proposals (Jaccard token similarity of titles)
//   ml_score       — Peer cost IQR       (statistical spend outlier vs peers)
//
// total_risk_score is the weighted blend (see SIGNAL_WEIGHTS) and primary_flag
// names the dominant driver so the UI can render an explainable reason.
//
// NOTE: the peer-relative signals (spatial / nlp / ml) are inherently
// batch-scoped: a work is anomalous *relative to the dataset it arrived in*.
// scoreMospiBatch therefore always scores the whole upload in one pass.
// ---------------------------------------------------------------------------

import {
  asAmount,
  asDate,
  asText,
  deriveCategory,
  deriveDistrict,
  deriveTargetArea,
  pick,
  type RawRecord,
} from './ingest';

/** The canonical column set of an official MoSPI / e-SAKSHI export. */
export const MOSPI_COLUMNS = [
  'work_id',
  'work_title',
  'category',
  'district',
  'state',
  'constituency',
  'sanctioned_amount',
  'spent_amount',
  'vendor_name',
  'status',
  'latitude',
  'longitude',
  'target_area',
  'sanction_date',
] as const;

export type MospiColumn = (typeof MOSPI_COLUMNS)[number];

/** Columns that must be present (and non-empty per row) to accept a record. */
export const REQUIRED_MOSPI_COLUMNS: MospiColumn[] = ['work_id', 'work_title'];

/** Relative contribution of each signal to the 0-100 total risk score. */
export const SIGNAL_WEIGHTS = { rule: 0.3, spatial: 0.25, nlp: 0.2, ml: 0.25 } as const;

/** Works scoring at or above this are treated as high-risk across the app. */
export const HIGH_RISK_THRESHOLD = 80;

/**
 * A single engine scoring at or above this is a critical finding and escalates
 * the composite score. See the escalation note in scoreMospiBatch.
 */
export const CRITICAL_SIGNAL_THRESHOLD = 75;

/**
 * A critical signal is scaled by this factor to form an escalation floor.
 * 0.9 means only genuinely severe findings (>= ~89 raw) push a work past the
 * 80-point scrutiny threshold, so a lone moderate signal cannot flood the queue.
 */
const CRITICAL_OVERRIDE_FACTOR = 0.9;

/** Composite score below which a work is reported with no primary flag. */
const NORMAL_FLAG_CUTOFF = 35;

/** Spatial grid resolution (~110 m at the equator) used for overlap detection. */
const GRID_PRECISION = 3;

/**
 * Titles must share at least this token similarity to count as a duplicate
 * proposal. Set high deliberately: official MoSPI titles are heavily templated
 * ("Construction of CC road at …"), so a permissive floor flags entire wards of
 * legitimate distinct works as duplicates.
 */
const NLP_SIMILARITY_FLOOR = 0.8;

/** A vendor with this many small works in one district looks like splitting. */
const SPLIT_TENDER_MIN_WORKS = 3;
const SPLIT_TENDER_MAX_AMOUNT = 500_000;

/** Keywords that mark a work as a potentially prohibited (non-asset) item. */
const PROHIBITED_KEYWORDS = [
  'statue',
  'religious',
  'temple',
  'church',
  'mosque',
  'gurudwara',
  'private',
  'personal',
  'vehicle',
  'motorcycle',
  'car ',
  'office furniture',
  'air conditioner',
  'ac unit',
  'generator',
  'laptop',
  'mobile phone',
];

/** Statuses that indicate an unfinished / stalled work. */
const STALLED_STATUS = /stall|abandon|incomplete|in.?progress|pending|held|halt|stopp|not.?start/i;

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** A single normalised row destined for the `projects` table. */
export interface MospiProject {
  work_id: string;
  work_title: string | null;
  category: string | null;
  district: string | null;
  state: string | null;
  constituency: string | null;
  sanctioned_amount: number | null;
  spent_amount: number | null;
  vendor_name: string | null;
  status: string | null;
  latitude: number | null;
  longitude: number | null;
  target_area: string;
  sanction_date: string | null;
}

/** A single row destined for the `anomaly_signals` table. */
export interface MospiSignal {
  work_id: string;
  rule_score: number;
  spatial_score: number;
  nlp_score: number;
  ml_score: number;
  total_risk_score: number;
  primary_flag: string;
  flag_details: Record<string, unknown>;
}

export interface NormalizeOutcome {
  project: MospiProject | null;
  /** Present only when `project` is null, explaining the rejection. */
  reason?: string;
}

export interface ScoringResult {
  projects: MospiProject[];
  signals: MospiSignal[];
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function asCoordinate(value: unknown, kind: 'lat' | 'lng'): number | null {
  if (value === null || value === undefined || `${value}`.trim() === '') return null;
  const num =
    typeof value === 'number' ? value : Number(`${value}`.replace(/[^\d.\-]/g, ''));
  if (!Number.isFinite(num) || num === 0) return null;
  if (kind === 'lat' && (num < -90 || num > 90)) return null;
  if (kind === 'lng' && (num < -180 || num > 180)) return null;
  return num;
}

/**
 * Maps one raw MoSPI record onto the canonical project shape.
 * Returns `{ project: null, reason }` when the row fails the minimum bar.
 */
export function normalizeMospiRecord(raw: RawRecord): NormalizeOutcome {
  const workId = asText(pick(raw, 'work_id'));
  if (!workId) return { project: null, reason: 'missing work_id' };

  const title = asText(pick(raw, 'work_title'));

  const state = asText(pick(raw, 'state'));
  const constituency = asText(pick(raw, 'constituency'));
  const ida = asText(pick(raw, 'ida'));

  const district =
    asText(pick(raw, 'district')) ?? deriveDistrict(ida) ?? constituency ?? null;

  const sanctioned = asAmount(pick(raw, 'sanctioned_amount'));
  const spent = asAmount(pick(raw, 'spent_amount'));

  const category =
    asText(pick(raw, 'category')) ?? deriveCategory(title) ?? null;

  return {
    project: {
      work_id: workId,
      work_title: title,
      category,
      district,
      state,
      constituency,
      sanctioned_amount: sanctioned,
      spent_amount: spent,
      vendor_name: asText(pick(raw, 'vendor_name')),
      status: asText(pick(raw, 'status')),
      latitude: asCoordinate(pick(raw, 'latitude'), 'lat'),
      longitude: asCoordinate(pick(raw, 'longitude'), 'lng'),
      target_area: deriveTargetArea(pick(raw, 'target_area'), constituency),
      sanction_date: asDate(pick(raw, 'sanction_date')),
    },
  };
}

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Linear-interpolated quantile over an already-sorted ascending array. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

function tokenSet(text: string | null): Set<string> {
  if (!text) return new Set();
  const stop = new Set(['of', 'the', 'and', 'for', 'at', 'in', 'to', 'a', 'an', 'by']);
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      // Numeric tokens are retained deliberately: MoSPI titles are heavily
      // templated ("…street light pole number 1/2/3 in ward"), and dropping the
      // distinguishing numeral would make every row in a ward look identical.
      .filter((t) => (t.length > 2 || /^\d+$/.test(t)) && !stop.has(t)),
  );
}

/** Jaccard similarity of two token sets (intersection / union). */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

function gridKey(lat: number, lng: number): string {
  return `${lat.toFixed(GRID_PRECISION)}|${lng.toFixed(GRID_PRECISION)}`;
}

function prohibitedMatch(title: string | null): string | null {
  if (!title) return null;
  const lower = title.toLowerCase();
  for (const keyword of PROHIBITED_KEYWORDS) {
    if (lower.includes(keyword)) return keyword.trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Header validation
// ---------------------------------------------------------------------------

export interface MospiHeaderCheck {
  ok: boolean;
  /** Required columns that could not be located in the header row. */
  missing: string[];
  /** Optional canonical columns that were not present. */
  absent_optional: string[];
  detected: string[];
}

/**
 * Verifies an uploaded header row contains the columns we require.
 * Uses the same alias resolution as ingestion, so "Work ID" and "work_id"
 * are both accepted.
 */
export function validateMospiHeaders(headers: string[]): MospiHeaderCheck {
  const probe: RawRecord = {};
  for (const header of headers) probe[header] = '__probe__';

  const missing = REQUIRED_MOSPI_COLUMNS.filter((col) => pick(probe, col) === null);
  const absentOptional = MOSPI_COLUMNS.filter(
    (col) => !REQUIRED_MOSPI_COLUMNS.includes(col) && pick(probe, col) === null,
  );

  return {
    ok: missing.length === 0,
    missing,
    absent_optional: absentOptional,
    detected: headers,
  };
}

// ---------------------------------------------------------------------------
// Batch scoring engine
// ---------------------------------------------------------------------------

interface WorkingRow {
  project: MospiProject;
  tokens: Set<string>;
}

/** Rule check: deterministic policy violations + data-integrity faults. */
function ruleScore(row: MospiProject, splitTenderVendors: Set<string>): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Severity weights are calibrated so that a *single* critical finding pushes
  // a work past the 80-point scrutiny threshold on its own (see the escalation
  // note in scoreMospiBatch): a prohibited asset is a hard statutory breach and
  // must never be diluted into "Normal" by the composite average.
  const prohibited = prohibitedMatch(row.work_title);
  if (prohibited) {
    score += 90;
    reasons.push(`prohibited-item keyword "${prohibited}"`);
  }

  if (row.vendor_name && splitTenderVendors.has(splitTenderKey(row))) {
    score += 75;
    reasons.push('vendor holds 3+ small works in the same district (split tendering)');
  }

  const sanctioned = row.sanctioned_amount ?? 0;
  if (!row.vendor_name) {
    score += 10;
    reasons.push('vendor name missing');
  }
  if (!row.sanction_date) {
    score += 8;
    reasons.push('sanction date missing');
  }
  if (row.spent_amount === null) {
    score += 10;
    reasons.push('spent amount missing');
  }
  if (sanctioned > 0 && (row.spent_amount ?? 0) > sanctioned * 1.02) {
    score += 18;
    reasons.push('spent exceeds sanctioned amount');
  }
  if (row.status && STALLED_STATUS.test(row.status)) {
    score += 20;
    reasons.push(`status "${row.status}" indicates a stalled work`);
  }
  if (row.latitude === null || row.longitude === null) {
    score += 10;
    reasons.push('geo-coordinates absent');
  }

  return { score: clamp(score), reasons };
}

function splitTenderKey(row: MospiProject): string {
  return `${(row.vendor_name || '').toLowerCase()}|${(row.district || '').toLowerCase()}`;
}

/** Spatial overlap: count projects sharing the same ~110 m grid cell. */
function spatialScores(rows: WorkingRow[]): Map<number, { score: number; peers: number; detail: string }> {
  const cells = new Map<string, number[]>();

  rows.forEach((row, index) => {
    const { latitude: lat, longitude: lng } = row.project;
    if (lat === null || lng === null) return;
    const key = gridKey(lat, lng);
    const bucket = cells.get(key) || [];
    bucket.push(index);
    cells.set(key, bucket);
  });

  const out = new Map<number, { score: number; peers: number; detail: string }>();
  for (const bucket of cells.values()) {
    if (bucket.length < 2) continue;
    // More co-located works in one ~110 m cell => higher overlap risk.
    const score = clamp(45 + 15 * (bucket.length - 2) + 10, 0, 100);
    for (const index of bucket) {
      out.set(index, {
        score,
        peers: bucket.length - 1,
        detail: `${bucket.length} works share one ~110 m grid cell`,
      });
    }
  }
  return out;
}

/** Duplicate proposals: Jaccard token similarity of work titles, per district. */
function nlpScores(rows: WorkingRow[]): Map<number, { score: number; similarity: number; twin: string | null }> {
  const out = new Map<number, { score: number; similarity: number; twin: string | null }>();

  // Bucket by state+district so we never run a national O(n^2) sweep.
  const buckets = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const key = `${(row.project.state || '').toLowerCase()}|${(row.project.district || '').toLowerCase()}`;
    const bucket = buckets.get(key) || [];
    bucket.push(index);
    buckets.set(key, bucket);
  });

  const MAX_BUCKET = 800; // guard against pathological districts

  for (const bucket of buckets.values()) {
    const scoped = bucket.slice(0, MAX_BUCKET);
    for (let i = 0; i < scoped.length; i += 1) {
      const a = scoped[i];
      for (let j = i + 1; j < scoped.length; j += 1) {
        const b = scoped[j];
        const sim = jaccard(rows[a].tokens, rows[b].tokens);
        if (sim < NLP_SIMILARITY_FLOOR) continue;

        const score = clamp(50 + (sim - NLP_SIMILARITY_FLOOR) * 150);
        const aTitle = rows[a].project.work_title;
        const bTitle = rows[b].project.work_title;

        const prevA = out.get(a);
        if (!prevA || sim > prevA.similarity) {
          out.set(a, { score, similarity: sim, twin: bTitle });
        }
        const prevB = out.get(b);
        if (!prevB || sim > prevB.similarity) {
          out.set(b, { score, similarity: sim, twin: aTitle });
        }
      }
    }
  }
  return out;
}

/**
 * ML / peer-cost signal: Tukey IQR fences computed against peer works in the
 * same category. Flags spend far above the peer upper fence, and severe
 * under-utilisation of a sanctioned amount.
 */
function mlScores(rows: WorkingRow[]): Map<number, { score: number; detail: string }> {
  const groups = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const key = (row.project.category || row.project.district || 'unclassified').toLowerCase();
    const bucket = groups.get(key) || [];
    bucket.push(index);
    groups.set(key, bucket);
  });

  const out = new Map<number, { score: number; detail: string }>();

  for (const bucket of groups.values()) {
    const spends = bucket
      .map((i) => rows[i].project.spent_amount)
      .filter((v): v is number => typeof v === 'number' && v > 0)
      .sort((a, b) => a - b);

    if (spends.length < 4) continue; // IQR is meaningless on tiny peer groups

    const q1 = quantile(spends, 0.25);
    const q3 = quantile(spends, 0.75);
    const median = quantile(spends, 0.5);
    const iqr = q3 - q1;

    let upperFence: number;
    let lowerFence: number;
    let fenceLabel: string;

    if (iqr > 0) {
      upperFence = q3 + 1.5 * iqr;
      lowerFence = q1 - 1.5 * iqr;
      fenceLabel = `Tukey IQR ${Math.round(iqr).toLocaleString('en-IN')}`;
    } else {
      // Degenerate IQR — half or more of the peer group spends an identical
      // amount, which is common in MoSPI exports where works are sanctioned at
      // flat rates. Tukey fences collapse to the median here, so falling back to
      // a median-ratio fence is essential: otherwise the single extreme outlier
      // responsible for flattening the IQR would be skipped entirely.
      upperFence = median > 0 ? median * 3 : 0;
      lowerFence = median > 0 ? median / 3 : 0;
      fenceLabel = 'median-ratio fence (flat peer pricing)';
    }

    for (const index of bucket) {
      const { spent_amount: spent, sanctioned_amount: sanctioned } = rows[index].project;

      if (typeof spent === 'number' && spent > upperFence && upperFence > 0) {
        const excess = (spent - upperFence) / (upperFence || 1);
        out.set(index, {
          score: clamp(60 + excess * 100),
          detail: `spend ${Math.round(spent).toLocaleString('en-IN')} exceeds peer upper fence ${Math.round(upperFence).toLocaleString('en-IN')} (${fenceLabel})`,
        });
        continue;
      }

      if (typeof spent === 'number' && spent < lowerFence && spent > 0) {
        out.set(index, {
          score: clamp(55),
          detail: `spend below peer lower fence (${Math.round(lowerFence).toLocaleString('en-IN')})`,
        });
        continue;
      }

      // Under-utilisation: sanctioned but largely unspent.
      if (sanctioned && sanctioned > 0) {
        const utilisation = (spent ?? 0) / sanctioned;
        if (utilisation < 0.3) {
          out.set(index, {
            score: clamp(50 + (0.3 - utilisation) * 100),
            detail: `only ${Math.round(utilisation * 100)}% of sanctioned amount utilised`,
          });
        }
      }
    }
  }
  return out;
}

/** Chooses the dominant driver and a human-readable flag label. */
function pickPrimaryFlag(args: {
  rule: number;
  spatial: number;
  nlp: number;
  ml: number;
  ruleReasons: string[];
  total: number;
}): string {
  if (args.total < NORMAL_FLAG_CUTOFF) return 'Normal';

  // Dominance is decided on RAW engine severity, not on weighted contribution.
  // Comparing weighted values lets a moderate signal in one engine outrank a
  // severe finding in another purely because the weights differ, so the label
  // would describe the weighting scheme rather than the actual anomaly.
  const peak = Math.max(args.rule, args.spatial, args.nlp, args.ml);
  if (peak === 0) return 'Normal';

  if (peak === args.rule) {
    const joined = args.ruleReasons.join(' ');
    // Most-severe statutory breach first.
    if (/prohibited-item/i.test(joined)) return 'Prohibited Asset';
    if (/split tendering/i.test(joined)) return 'Split Tendering';
    if (/stalled/i.test(joined)) return 'Stalled Work';
    return 'Data Integrity';
  }
  if (peak === args.spatial) return 'Duplicate Location';
  if (peak === args.nlp) return 'Duplicate Proposal';
  return 'Cost Outlier';
}

/**
 * Scores an entire normalised batch in one pass.
 *
 * Batch-scoped by design: spatial overlap, duplicate proposals and peer-cost
 * IQR are all relative measures, so every upload must be scored as a whole.
 */
export function scoreMospiBatch(projects: MospiProject[]): ScoringResult {
  const rows: WorkingRow[] = projects.map((project) => ({
    project,
    tokens: tokenSet(project.work_title),
  }));

  // Pre-compute split-tender vendor keys (vendor + district, 3+ small works).
  const vendorCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.project.vendor_name) continue;
    if ((row.project.sanctioned_amount ?? 0) > SPLIT_TENDER_MAX_AMOUNT) continue;
    const key = splitTenderKey(row.project);
    vendorCounts.set(key, (vendorCounts.get(key) || 0) + 1);
  }
  const splitTenderVendors = new Set(
    [...vendorCounts.entries()]
      .filter(([, count]) => count >= SPLIT_TENDER_MIN_WORKS)
      .map(([key]) => key),
  );

  const spatial = spatialScores(rows);
  const nlp = nlpScores(rows);
  const ml = mlScores(rows);

  const signals: MospiSignal[] = rows.map((row, index) => {
    const ruleOutcome = ruleScore(row.project, splitTenderVendors);
    const rule = ruleOutcome.score;
    const spatialHit = spatial.get(index);
    const nlpHit = nlp.get(index);
    const mlHit = ml.get(index);

    const spatialScoreValue = spatialHit?.score ?? 0;
    const nlpScoreValue = nlpHit?.score ?? 0;
    const mlScoreValue = mlHit?.score ?? 0;

    // Weighted composite of the four engines.
    const weightedTotal =
      rule * SIGNAL_WEIGHTS.rule +
      spatialScoreValue * SIGNAL_WEIGHTS.spatial +
      nlpScoreValue * SIGNAL_WEIGHTS.nlp +
      mlScoreValue * SIGNAL_WEIGHTS.ml;

    // ESCALATION — why this exists:
    // A weighted *average* caps each engine's contribution at its own weight
    // (rule 0.30 x 100 = 30). Without escalation a lone catastrophic finding —
    // a prohibited asset, a 100x cost outlier — could never exceed ~30 points
    // and would never reach the 80-point scrutiny threshold, leaving the
    // prioritised queue empty precisely when it matters most.
    // So a critical signal (>= CRITICAL_SIGNAL_THRESHOLD) sets a floor of
    // severity x CRITICAL_OVERRIDE_FACTOR, while still allowing genuinely
    // multi-signal works to score higher via the weighted path.
    const peak = Math.max(rule, spatialScoreValue, nlpScoreValue, mlScoreValue);
    const escalationFloor =
      peak >= CRITICAL_SIGNAL_THRESHOLD ? peak * CRITICAL_OVERRIDE_FACTOR : 0;

    const total = clamp(Math.max(weightedTotal, escalationFloor));

    return {
      work_id: row.project.work_id,
      rule_score: rule,
      spatial_score: spatialScoreValue,
      nlp_score: nlpScoreValue,
      ml_score: mlScoreValue,
      total_risk_score: total,
      primary_flag: pickPrimaryFlag({
        rule,
        spatial: spatialScoreValue,
        nlp: nlpScoreValue,
        ml: mlScoreValue,
        ruleReasons: ruleOutcome.reasons,
        total,
      }),
      flag_details: {
        rule: { score: rule, reasons: ruleOutcome.reasons },
        spatial: spatialHit
          ? { score: spatialHit.score, peers: spatialHit.peers, detail: spatialHit.detail }
          : { score: 0, peers: 0, detail: 'no co-located works' },
        nlp: nlpHit
          ? {
              score: nlpHit.score,
              similarity: Number(nlpHit.similarity.toFixed(3)),
              matched_title: nlpHit.twin,
            }
          : { score: 0, similarity: 0, matched_title: null },
        ml: mlHit ? { score: mlHit.score, detail: mlHit.detail } : { score: 0, detail: 'within peer IQR' },
        weights: SIGNAL_WEIGHTS,
      },
    };
  });

  return { projects: rows.map((row) => row.project), signals };
}

/** Convenience: normalise raw records then score the resulting batch. */
export function normalizeAndScore(records: RawRecord[]): ScoringResult & {
  skipped: Array<{ row: number; reason: string }>;
} {
  const projects: MospiProject[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  records.forEach((raw, index) => {
    const outcome = normalizeMospiRecord(raw);
    if (!outcome.project) {
      skipped.push({ row: index + 1, reason: outcome.reason || 'invalid row' });
      return;
    }
    projects.push(outcome.project);
  });

  const scored = scoreMospiBatch(projects);
  return { ...scored, skipped };
}


// Server-side MoSPI ingestion engine.
//
// Responsibilities:
//   1. Accept raw MoSPI records (already parsed from CSV or JSON).
//   2. Validate / normalise the messy source columns into the production
//      `projects` shape (see src/lib/schema.sql).
//   3. Compute the 4-signal anomaly decomposition used by `anomaly_signals`:
//         rule_score    — statutory / prohibited-asset rules
//         spatial_score — geographic & work-site duplication
//         nlp_score     — lexical near-duplicate proposals (token similarity)
//         ml_score      — peer-group cost outlier + vendor concentration
//      and a blended `total_risk_score` + `primary_flag`.
//
// Everything here is pure/deterministic so it can be unit-tested and replayed
// identically across environments.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RawRecord = Record<string, unknown>;

/** Normalised project row ready for the `projects` table. */
export interface ProjectInsert {
  work_id: string;
  work_title: string;
  category: string | null;
  district: string | null;
  state: string | null;
  constituency: string | null;
  sanctioned_amount: number | null;
  spent_amount: number | null;
  vendor_name: string | null;
  status: string | null;
  risk_score: number;
  latitude: number | null;
  longitude: number | null;
  target_area: string;
  sanction_date: string | null;
  completion_date: string | null;
}

/** Normalised signal row ready for the `anomaly_signals` table. */
export interface SignalInsert {
  work_id: string;
  rule_score: number;
  spatial_score: number;
  nlp_score: number;
  ml_score: number;
  total_risk_score: number;
  primary_flag: string;
  flag_details: Record<string, unknown>;
}

export interface IngestOptions {
  /** Cap the number of records accepted in one request. */
  maxRows?: number;
  /** Whether a `Work` / `work_title` value is mandatory (default true). */
  requireWorkTitle?: boolean;
}

export interface IngestResult {
  projects: ProjectInsert[];
  signals: SignalInsert[];
  skipped: Array<{ row: number; reason: string }>;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Tunables / constants
// ---------------------------------------------------------------------------

export const MAX_INGEST_ROWS = 20000;
export const DEFAULT_CHUNK_SIZE = 500;

/** Columns that MUST be resolvable in the uploaded dataset. */
export const REQUIRED_FIELDS = ['work_id', 'work_title'] as const;

/** Human-readable header names accepted for each canonical field. */
const FIELD_ALIASES: Record<string, string[]> = {
  work_id: ['work_id', 'Work ID', 'workId', 'work id', 'WorkID', 'work_code', 'work_no'],
  work_title: ['work_title', 'Work', 'work', 'Work Title', 'workTitle', 'name', 'title', 'work_name'],
  category: ['category', 'Category', 'work_category', 'Work Category', 'sector', 'Sector'],
  district: ['district', 'District', 'District Name', 'district_name'],
  state: ['state', 'State', 'State Name', 'state_name'],
  constituency: ['constituency', 'Constituency', 'PC', 'pc_name', 'Parliamentary Constituency'],
  sanctioned_amount: [
    'sanctioned_amount',
    'Sanctioned Amount',
    'Sanctioned AMOUNT (₹)',
    'sanction_amount',
    'sanctioned_amt',
    'Allocated Amount',
    'allocated_amount',
  ],
  spent_amount: [
    'spent_amount',
    'Fund Disbursed Amount ( ₹ )',
    'Fund Disbursed Amount',
    'amount',
    'Amount',
    'expenditure',
    'Expenditure',
    'disbursed_amount',
    'Fund Disbursed',
  ],
  vendor_name: ['vendor_name', 'Vendor Name', 'vendor', 'Vendor', 'contractor', 'Contractor'],
  status: ['status', 'Status', 'Payment Status', 'payment_status', 'Stage', 'stage', 'project_status'],
  latitude: ['latitude', 'Latitude', 'lat', 'Lat', 'y'],
  longitude: ['longitude', 'Longitude', 'lng', 'Lng', 'lon', 'Long', 'x'],
  target_area: ['target_area', 'Target Area', 'TargetArea', 'area_type', 'Area Type', 'category_area'],
  sanction_date: ['sanction_date', 'Sanction Date', 'sanctionDate', 'date_sanctioned', 'approved_date'],
  completion_date: ['completion_date', 'Completion Date', 'completionDate', 'date_completed', 'completed_date'],
  expenditure_date: ['expenditure_date', 'Expenditure Date', 'expenditureDate', 'payment_date'],
  ida: ['ida', 'IDA', 'implementing_agency', 'Implementing Agency'],
  mp: ['mp', "Hon'ble Members of Parliament", 'MP Name', 'member_of_parliament'],
  sr_no: ['sr_no', 'Sr. No.', 'Sr No', 'srno', 'serial', 'S.No'],
};

const PROHIBITED_KEYWORDS = [
  'statue',
  'religious',
  'temple',
  'church',
  'mosque',
  'private',
  'vehicle',
  'car ',
  'office furniture',
  'air conditioner',
  'ac unit',
  'generator',
  'personal',
];

const CATEGORY_RULES: Array<{ category: string; patterns: RegExp }> = [
  { category: 'Roads & Bridges', patterns: /road|bridge|culvert|pavement|interlocking|pathway|link road/i },
  { category: 'Community Infrastructure', patterns: /community|hall|shed|covered|sitting area|chowk|park|playground/i },
  { category: 'Water & Sanitation', patterns: /drain|drainage|water|sewer|toilet|sanitation|pipeline|borewell|hand ?pump/i },
  { category: 'Education', patterns: /school|college|class ?room|education|library|laboratory|lab\b|hostel|anganwadi/i },
  { category: 'Health', patterns: /health|hospital|dispensary|clinic|phc|medical|ambulance/i },
  { category: 'IT & Digital', patterns: /it system|computer|hardware|software|digital|smart class|network|cctv|laptop/i },
  { category: 'Energy & Electrification', patterns: /solar|street ?light|electrification|electric|transformer|lighting/i },
  { category: 'Sports & Culture', patterns: /stadium|sports|gym|cultural|auditorium|community centre/i },
];

// ---------------------------------------------------------------------------
// Field extraction helpers
// ---------------------------------------------------------------------------

/** Returns the first non-empty value found under any alias of `field`. */
export function pick(raw: RawRecord, field: string): unknown {
  const aliases = FIELD_ALIASES[field] || [field];
  for (const alias of aliases) {
    const value = raw[alias];
    if (value !== undefined && value !== null && `${value}`.trim() !== '') return value;
  }
  // Case-insensitive sweep as a last resort (CSV headers vary wildly).
  const lowered = aliases.map((a) => a.toLowerCase());
  for (const key of Object.keys(raw)) {
    if (lowered.includes(key.toLowerCase())) {
      const value = raw[key];
      if (value !== undefined && value !== null && `${value}`.trim() !== '') return value;
    }
  }
  return null;
}

export function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  // Strip the MoSPI non-breaking spaces that appear in exported CSVs.
  const text = `${value}`.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  return text === '' ? null : text;
}

/**
 * Parses an Indian-formatted currency string into a number.
 * Handles "₹", spaces, non-breaking spaces and comma grouping.
 */
export function asAmount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = `${value}`
    .replace(/\u00a0/g, '')
    .replace(/[₹,\s]/g, '')
    .replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parses common MoSPI date shapes into an ISO timestamp (or null). */
export function asDate(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;

  // DD-Mon-YYYY (e.g. 21-Aug-2026)
  const monMatch = text.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{4})$/);
  if (monMatch) {
    const parsed = new Date(`${monMatch[2]} ${monMatch[1]}, ${monMatch[3]}`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = Number(slash[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const generic = new Date(text);
  return Number.isNaN(generic.getTime()) ? null : generic.toISOString();
}

function asCoordinate(value: unknown, kind: 'lat' | 'lng'): number | null {
  const num = typeof value === 'number' ? value : Number(`${value ?? ''}`.replace(/[^\d.\-]/g, ''));
  if (!Number.isFinite(num)) return null;
  if (kind === 'lat' && (num < -90 || num > 90)) return null;
  if (kind === 'lng' && (num < -180 || num > 180)) return null;
  return num;
}

/** Derives a district name from a MoSPI IDA string when none is supplied. */
export function deriveDistrict(ida: string | null): string | null {
  if (!ida) return null;
  const match = ida.match(/^([^(_]+)/);
  const candidate = (match ? match[1] : ida).trim();
  return candidate ? candidate.replace(/\s+/g, ' ').toUpperCase() : null;
}

/** Classifies a work into a coarse sector label when no category is given. */
export function deriveCategory(workTitle: string | null): string | null {
  if (!workTitle) return null;
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.test(workTitle)) return rule.category;
  }
  return 'Other';
}

/**
 * Normalises a target area into the statutory General / SC / ST domain.
 * Falls back to markers like "(ST)" in the constituency name.
 */
export function deriveTargetArea(rawTarget: unknown, constituency: string | null): string {
  const text = (asText(rawTarget) || '').toUpperCase();
  if (/\bSC\b/.test(text)) return 'SC';
  if (/\bST\b/.test(text)) return 'ST';
  if (text.includes('GENERAL')) return 'General';

  const pc = (constituency || '').toUpperCase();
  if (/\(SC\)|\bSC\b/.test(pc)) return 'SC';
  if (/\(ST\)|\bST\b/.test(pc)) return 'ST';
  return 'General';
}

function tokenize(text: string | null): string[] {
  if (!text) return [];
  const stop = new Set([
    'of', 'the', 'and', 'to', 'for', 'in', 'at', 'on', 'with', 'from', 'by', 'a', 'an',
    'construction', 'work', 'works', 'including', 'other', 'any', 'system', 'systems',
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stop.has(token));
}

function lowerKey(value: string | null): string {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationOutcome {
  ok: boolean;
  missing: string[];
  detected: Record<string, string>;
}

/**
 * Checks that the uploaded dataset exposes every REQUIRED_FIELDS column.
 * `detected` maps canonical field -> the actual header that satisfied it.
 */
export function validateColumns(rows: RawRecord[]): ValidationOutcome {
  const missing: string[] = [];
  const detected: Record<string, string> = {};

  const sample = rows.slice(0, 25);
  const headers = new Set<string>();
  for (const row of sample) {
    for (const key of Object.keys(row)) headers.add(key);
  }

  for (const field of REQUIRED_FIELDS) {
    const aliases = FIELD_ALIASES[field] || [field];
    const lowered = aliases.map((a) => a.toLowerCase());
    const hit = [...headers].find((h) => lowered.includes(h.toLowerCase()));
    if (hit) detected[field] = hit;
    else missing.push(field);
  }

  // Also accept a positional payload where values are non-empty but unnamed.
  if (missing.length > 0 && sample.length > 0) {
    const filtered = missing.filter((field) => {
      const aliases = FIELD_ALIASES[field] || [field];
      return !sample.some((row) =>
        aliases.some((alias) => row[alias] !== undefined && `${row[alias]}`.trim() !== ''),
      );
    });
    return { ok: filtered.length === 0, missing: filtered, detected };
  }

  return { ok: missing.length === 0, missing, detected };
}

// ---------------------------------------------------------------------------
// Signal computation
// ---------------------------------------------------------------------------

interface WorkingRow {
  index: number;
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
  completion_date: string | null;
  tokens: string[];
}

/**
 * Core pipeline: validate -> normalise -> score.
 */
export function buildIngestPayload(
  rows: RawRecord[],
  options: IngestOptions = {},
): IngestResult {
  const maxRows = options.maxRows ?? MAX_INGEST_ROWS;
  const requireWorkTitle = options.requireWorkTitle ?? true;

  const warnings: string[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  if (rows.length > maxRows) {
    warnings.push(
      `Dataset contains ${rows.length.toLocaleString('en-IN')} rows; only the first ${maxRows.toLocaleString('en-IN')} were processed.`,
    );
  }

  const source = rows.slice(0, maxRows);

  // ---- Pass 1: normalise every row ----------------------------------------
  const working: WorkingRow[] = [];
  const seenWorkIds = new Map<string, number>();

  source.forEach((raw, index) => {
    const workId = asText(pick(raw, 'work_id'));
    const workTitle = asText(pick(raw, 'work_title'));

    if (!workId) {
      skipped.push({ row: index + 1, reason: 'Missing required work_id' });
      return;
    }
    if (requireWorkTitle && !workTitle) {
      skipped.push({ row: index + 1, reason: 'Missing required work_title' });
      return;
    }
    if (seenWorkIds.has(workId)) {
      skipped.push({
        row: index + 1,
        reason: `Duplicate work_id "${workId}" (first seen on row ${seenWorkIds.get(workId)})`,
      });
      return;
    }
    seenWorkIds.set(workId, index + 1);

    const constituency = asText(pick(raw, 'constituency'));
    const ida = asText(pick(raw, 'ida'));
    const district = asText(pick(raw, 'district')) || deriveDistrict(ida);
    const category = asText(pick(raw, 'category')) || deriveCategory(workTitle);
    const spentAmount = asAmount(pick(raw, 'spent_amount'));
    const sanctionedAmount = asAmount(pick(raw, 'sanctioned_amount'));

    working.push({
      index: index + 1,
      work_id: workId,
      work_title: workTitle,
      category,
      district,
      state: asText(pick(raw, 'state')),
      constituency,
      sanctioned_amount: sanctionedAmount,
      spent_amount: spentAmount,
      vendor_name: asText(pick(raw, 'vendor_name')),
      status: asText(pick(raw, 'status')),
      latitude: asCoordinate(pick(raw, 'latitude'), 'lat'),
      longitude: asCoordinate(pick(raw, 'longitude'), 'lng'),
      target_area: deriveTargetArea(pick(raw, 'target_area'), constituency),
      sanction_date: asDate(pick(raw, 'sanction_date')) || asDate(pick(raw, 'expenditure_date')),
      completion_date: asDate(pick(raw, 'completion_date')),
      tokens: tokenize(workTitle),
    });
  });

  if (working.length === 0) {
    return { projects: [], signals: [], skipped, warnings };
  }

  // ---- Pass 2: aggregate context for scoring ------------------------------
  const workSiteCounts = new Map<string, number>();
  const vendorCounts = new Map<string, number>();
  const vendorNearThreshold = new Map<string, number>();
  const tokenSignatureCounts = new Map<string, number>();
  const amountByCategory = new Map<string, number[]>();
  const coordinateCounts = new Map<string, number>();

  for (const row of working) {
    const siteKey = `${lowerKey(row.work_title)}|${lowerKey(row.district)}|${lowerKey(row.constituency)}`;
    workSiteCounts.set(siteKey, (workSiteCounts.get(siteKey) || 0) + 1);

    if (row.vendor_name) {
      const vendorKey = lowerKey(row.vendor_name);
      vendorCounts.set(vendorKey, (vendorCounts.get(vendorKey) || 0) + 1);
      const amount = row.spent_amount ?? 0;
      // Near-threshold chunking: a classic MPLADS split-tendering smell.
      if (amount >= 400000 && amount <= 500000) {
        vendorNearThreshold.set(vendorKey, (vendorNearThreshold.get(vendorKey) || 0) + 1);
      }
    }

    if (row.tokens.length > 0) {
      const signature = [...row.tokens].sort().join(' ');
      tokenSignatureCounts.set(signature, (tokenSignatureCounts.get(signature) || 0) + 1);
    }

    if (row.latitude !== null && row.longitude !== null) {
      const geoKey = `${row.latitude.toFixed(3)},${row.longitude.toFixed(3)}`;
      coordinateCounts.set(geoKey, (coordinateCounts.get(geoKey) || 0) + 1);
    }

    const amount = row.spent_amount ?? row.sanctioned_amount;
    if (amount !== null && amount > 0) {
      const bucket = row.category || 'Other';
      const list = amountByCategory.get(bucket) || [];
      list.push(amount);
      amountByCategory.set(bucket, list);
    }
  }

  for (const list of amountByCategory.values()) list.sort((a, b) => a - b);
  const overallAmounts = [...amountByCategory.values()].flat().sort((a, b) => a - b);

  // ---- Pass 3: score ------------------------------------------------------
  const projects: ProjectInsert[] = [];
  const signals: SignalInsert[] = [];

  for (const row of working) {
    const signalsForRow = scoreRow(row, {
      workSiteCounts,
      vendorCounts,
      vendorNearThreshold,
      tokenSignatureCounts,
      amountByCategory,
      coordinateCounts,
      overallAmounts,
    });

    projects.push({
      work_id: row.work_id,
      work_title: row.work_title || row.work_id,
      category: row.category,
      district: row.district,
      state: row.state,
      constituency: row.constituency,
      sanctioned_amount: row.sanctioned_amount,
      spent_amount: row.spent_amount,
      vendor_name: row.vendor_name,
      status: row.status,
      risk_score: signalsForRow.total_risk_score,
      latitude: row.latitude,
      longitude: row.longitude,
      target_area: row.target_area,
      sanction_date: row.sanction_date,
      completion_date: row.completion_date,
    });

    signals.push({ work_id: row.work_id, ...signalsForRow });
  }

  return { projects, signals, skipped, warnings };
}

interface ScoreContext {
  workSiteCounts: Map<string, number>;
  vendorCounts: Map<string, number>;
  vendorNearThreshold: Map<string, number>;
  tokenSignatureCounts: Map<string, number>;
  amountByCategory: Map<string, number[]>;
  coordinateCounts: Map<string, number>;
  overallAmounts: number[];
}

interface ScoreBreakdown {
  rule_score: number;
  spatial_score: number;
  nlp_score: number;
  ml_score: number;
  total_risk_score: number;
  primary_flag: string;
  flag_details: Record<string, unknown>;
}

/**
 * Blends the four signals into a single 0-100 risk score plus an explainable
 * `primary_flag` for triage. Weights mirror the product spec:
 * rule 0.30 · spatial 0.25 · nlp 0.20 · ml 0.25
 */
function scoreRow(row: WorkingRow, ctx: ScoreContext): ScoreBreakdown {
  const details: Record<string, unknown> = {};

  // --- Signal 1: statutory RULE checks ------------------------------------
  let rule = 0;
  const ruleHits: string[] = [];
  const title = (row.work_title || '').toLowerCase();
  const hitKeyword = PROHIBITED_KEYWORDS.find((keyword) => title.includes(keyword));
  if (hitKeyword) {
    rule += 55;
    ruleHits.push(`prohibited_asset_keyword:${hitKeyword.trim()}`);
  }
  if (!row.vendor_name) {
    rule += 10;
    ruleHits.push('missing_vendor');
  }
  if (!row.sanctioned_amount && !row.spent_amount) {
    rule += 15;
    ruleHits.push('missing_financials');
  }
  if (row.sanctioned_amount && row.spent_amount && row.spent_amount > row.sanctioned_amount) {
    rule += 25;
    ruleHits.push('spend_exceeds_sanction');
  }
  if (!row.district) {
    rule += 8;
    ruleHits.push('missing_district');
  }
  if (!row.latitude || !row.longitude) {
    rule += 7;
    ruleHits.push('missing_geotag');
  }
  if (row.target_area === 'SC' || row.target_area === 'ST') {
    // Statutory target areas carry a completion-date obligation.
    if (!row.completion_date) {
      rule += 12;
      ruleHits.push(`${row.target_area.toLowerCase()}_target_without_completion`);
    }
  }
  const ruleScore = clampScore(rule);
  details.rule_hits = ruleHits;

  // --- Signal 2: SPATIAL duplication --------------------------------------
  let spatial = 0;
  const spatialHits: string[] = [];
  const siteKey = `${lowerKey(row.work_title)}|${lowerKey(row.district)}|${lowerKey(row.constituency)}`;
  const siteCount = ctx.workSiteCounts.get(siteKey) || 1;
  if (siteCount > 1) {
    spatial += 40 + Math.min(40, (siteCount - 1) * 15);
    spatialHits.push(`duplicate_worksite_x${siteCount}`);
  }
  if (row.latitude !== null && row.longitude !== null) {
    const geoKey = `${row.latitude.toFixed(3)},${row.longitude.toFixed(3)}`;
    const geoCount = ctx.coordinateCounts.get(geoKey) || 1;
    if (geoCount > 1) {
      spatial += 30 + Math.min(30, (geoCount - 1) * 10);
      spatialHits.push(`coincident_geotag_x${geoCount}`);
    }
  }
  const spatialScore = clampScore(spatial);
  details.spatial_hits = spatialHits;

  // --- Signal 3: NLP lexical near-duplicates ------------------------------
  let nlp = 0;
  const nlpHits: string[] = [];
  if (row.tokens.length > 0) {
    const signature = [...row.tokens].sort().join(' ');
    const sigCount = ctx.tokenSignatureCounts.get(signature) || 1;
    if (sigCount > 1) {
      nlp += 50 + Math.min(40, (sigCount - 1) * 12);
      nlpHits.push(`identical_proposal_text_x${sigCount}`);
    } else if (row.tokens.length <= 2) {
      // Very short titles are weak evidence; nudge the score up slightly.
      nlp += 12;
      nlpHits.push('vague_proposal_text');
    }
  }
  const nlpScore = clampScore(nlp);
  details.nlp_hits = nlpHits;

  // --- Signal 4: ML cost-outlier + vendor concentration -------------------
  const amount = row.spent_amount ?? row.sanctioned_amount;
  const peerAmounts = ctx.amountByCategory.get(row.category || 'Other') || [];
  const peerSource = peerAmounts.length >= 5 ? peerAmounts : ctx.overallAmounts;
  const median = quantile(peerSource, 0.5);
  const q1 = quantile(peerSource, 0.25);
  const q3 = quantile(peerSource, 0.75);
  const iqr = Math.max(1, q3 - q1);
  const upperFence = q3 + 1.5 * iqr;

  let ml = 0;
  const mlHits: string[] = [];
  if (amount && amount > 0 && median > 0) {
    const ratio = amount / median;
    if (amount > upperFence) {
      const excess = Math.min(60, ((amount - upperFence) / upperFence) * 100);
      ml += 35 + excess * 0.5;
      mlHits.push(`cost_outlier_above_iqr_fence`);
    }
    if (ratio >= 2) {
      ml += Math.min(30, (ratio - 1) * 15);
      mlHits.push(`amount_ratio_${ratio.toFixed(2)}x_peer_median`);
    }
    ml = Math.min(ml, 85);
  }
  if (row.vendor_name) {
    const vendorKey = lowerKey(row.vendor_name);
    const nearThreshold = ctx.vendorNearThreshold.get(vendorKey) || 0;
    const vendorTotal = ctx.vendorCounts.get(vendorKey) || 0;
    if (nearThreshold >= 3) {
      ml += 30 + Math.min(20, (nearThreshold - 3) * 5);
      mlHits.push(`split_tender_near_threshold_x${nearThreshold}`);
    } else if (vendorTotal >= 4) {
      ml += 18;
      mlHits.push(`vendor_concentration_x${vendorTotal}`);
    }
  }
  const mlScore = clampScore(ml);
  details.ml_hits = mlHits;
  details.peer_median = Math.round(median);
  details.peer_upper_fence = Math.round(upperFence);
  details.amount_observed = amount ?? null;

  // --- Blend ---------------------------------------------------------------
  const total = clampScore(
    ruleScore * 0.3 + spatialScore * 0.25 + nlpScore * 0.2 + mlScore * 0.25,
  );

  const primaryFlag = pickPrimaryFlag({
    row,
    ruleScore,
    spatialScore,
    nlpScore,
    mlScore,
    total,
    ruleHits,
    mlHits,
  });

  details.weights = { rule: 0.3, spatial: 0.25, nlp: 0.2, ml: 0.25 };
  details.target_area = row.target_area;
  details.engine_version = 'mplad-4signal-v1';

  return {
    rule_score: ruleScore,
    spatial_score: spatialScore,
    nlp_score: nlpScore,
    ml_score: mlScore,
    total_risk_score: total,
    primary_flag: primaryFlag,
    flag_details: details,
  };
}

function pickPrimaryFlag(args: {
  row: WorkingRow;
  ruleScore: number;
  spatialScore: number;
  nlpScore: number;
  mlScore: number;
  total: number;
  ruleHits: string[];
  mlHits: string[];
}): string {
  const { row, ruleScore, spatialScore, nlpScore, mlScore, total, ruleHits, mlHits } = args;

  if (total < 35) return 'Normal';

  const prohibited = ruleHits.some((hit) => hit.startsWith('prohibited_asset_keyword'));
  if (prohibited && ruleScore >= Math.max(spatialScore, nlpScore, mlScore)) {
    return 'Prohibited Asset';
  }
  if (ruleHits.some((hit) => hit.includes('_target_without_completion'))) {
    return 'SC-ST Deficit';
  }

  const max = Math.max(ruleScore, spatialScore, nlpScore, mlScore);
  if (max === spatialScore && spatialScore > 0) return 'Duplicate Location';
  if (max === nlpScore && nlpScore > 0) return 'Duplicate Location';
  if (max === mlScore && mlScore > 0) {
    if (mlHits.some((hit) => hit.startsWith('split_tender'))) return 'Split Tendering';
    return 'Cost Outlier';
  }
  if (max === ruleScore && ruleScore > 0) {
    return row.target_area === 'SC' || row.target_area === 'ST' ? 'SC-ST Deficit' : 'Procedural Gap';
  }
  return 'Normal';
}

// ---------------------------------------------------------------------------
// Dataset parsing (server-side)
// ---------------------------------------------------------------------------

export interface ParsedDataset {
  records: RawRecord[];
  format: 'csv' | 'json';
}

/**
 * Parses a raw uploaded file body into an array of records.
 * Throws a user-facing Error when the payload is malformed.
 */
export function parseDataset(text: string, filename: string): ParsedDataset {
  const isJson =
    filename.toLowerCase().endsWith('.json') ||
    text.trim().startsWith('[') ||
    text.trim().startsWith('{');

  if (isJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Malformed JSON upload: could not parse the file body.');
    }
    const rows = Array.isArray(parsed)
      ? parsed
      : (parsed as { records?: unknown; data?: unknown })?.records ??
        (parsed as { data?: unknown })?.data;
    if (!Array.isArray(rows)) {
      throw new Error('JSON upload must be an array, or an object with a "records" array.');
    }
    return { records: rows as RawRecord[], format: 'json' };
  }

  const { records } = parseCsv(text);
  return { records, format: 'csv' };
}

/** Minimal RFC-4180 CSV parser (quoted fields, embedded commas/newlines). */
export function parseCsv(text: string): { headers: string[]; records: RawRecord[] } {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    // Skip fully-empty trailing rows.
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
    row = [];
  };

  const cleaned = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    if (inQuotes) {
      if (char === '"') {
        if (cleaned[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\n') {
      pushRow();
    } else if (char === '\r') {
      // swallow; \n handles the row break
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) pushRow();

  if (rows.length === 0) return { headers: [], records: [] };

  const headers = rows[0].map((h) => h.replace(/\u00a0/g, ' ').trim());
  const records: RawRecord[] = [];
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r];
    const record: RawRecord = {};
    headers.forEach((header, index) => {
      if (!header) return;
      const value = cells[index];
      record[header] = value === undefined ? '' : value.replace(/\u00a0/g, ' ').trim();
    });
    if (Object.values(record).some((value) => `${value}`.trim() !== '')) records.push(record);
  }

  return { headers, records };
}

/** Splits an array into fixed-size chunks for paginated PostgREST writes. */
export function chunk<T>(items: T[], size: number = DEFAULT_CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

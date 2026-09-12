// Temporary runtime smoke-test for the MoSPI scoring engine.
import { normalizeAndScore, validateMospiHeaders } from '../src/lib/mospiScoring';

// --- 1. Header validation ---------------------------------------------------
const good = validateMospiHeaders([
  'work_id', 'work_title', 'category', 'district', 'state', 'constituency',
  'sanctioned_amount', 'spent_amount', 'vendor_name', 'status',
  'latitude', 'longitude', 'target_area', 'sanction_date',
]);
console.log('[headers] ok=', good.ok, 'missing=', good.missing);

const bad = validateMospiHeaders(['Work ID', 'State']);
console.log('[headers] bad.ok=', bad.ok, 'missing=', bad.missing);

// --- 2. Batch scoring ------------------------------------------------------
const records = [
  // Clean baseline work.
  {
    work_id: 'W-001', work_title: 'Construction of approach road from NH-2 to village',
    category: 'Roads', district: 'Varanasi', state: 'Uttar Pradesh',
    constituency: 'Varanasi', sanctioned_amount: '₹12,00,000', spent_amount: '900000',
    vendor_name: 'Alpha Constructions', status: 'Completed',
    latitude: 25.3176, longitude: 82.9739, target_area: 'General', sanction_date: '12-Aug-2025',
  },
  // Same grid cell as W-001 -> spatial overlap.
  {
    work_id: 'W-002', work_title: 'Repair of village road near NH-2 approach',
    category: 'Roads', district: 'Varanasi', state: 'Uttar Pradesh',
    constituency: 'Varanasi', sanctioned_amount: '1000000', spent_amount: '450000',
    vendor_name: 'Beta Works', status: 'In Progress',
    latitude: 25.31761, longitude: 82.97391, target_area: 'General', sanction_date: '01-Sep-2025',
  },
  // Near-identical title -> duplicate proposal (NLP).
  {
    work_id: 'W-003', work_title: 'Construction of approach road from NH-2 to village',
    category: 'Roads', district: 'Varanasi', state: 'Uttar Pradesh',
    constituency: 'Varanasi', sanctioned_amount: '1000000', spent_amount: '500000',
    vendor_name: 'Gamma Infra', status: 'Completed',
    latitude: 25.4000, longitude: 83.0100, target_area: 'General', sanction_date: '02-Sep-2025',
  },
  // Prohibited item + stalled status.
  {
    work_id: 'W-004', work_title: 'Installation of marble statue at community park',
    category: 'Community', district: 'Pune', state: 'Maharashtra',
    constituency: 'Pune', sanctioned_amount: '800000', spent_amount: '50000',
    vendor_name: 'Delta Traders', status: 'Stalled',
    latitude: 18.5204, longitude: 73.8567, target_area: 'General', sanction_date: '15-Jul-2025',
  },
  // Cost outlier: peers cluster ~50k, this is 5,000,000.
  ...Array.from({ length: 6 }, (_, i) => ({
    work_id: `P-${i + 1}`, work_title: `Provision of street light pole number ${i + 1} in ward`,
    category: 'Energy', district: 'Pune', state: 'Maharashtra',
    constituency: 'Pune', sanctioned_amount: '60000', spent_amount: '50000',
    vendor_name: `Local Vendor ${i + 1}`, status: 'Completed',
    latitude: 18.53 + i * 0.01, longitude: 73.86 + i * 0.01, target_area: 'General', sanction_date: '10-Jun-2025',
  })),
  {
    work_id: 'W-005', work_title: 'Installation of street light poles in ward corridor',
    category: 'Energy', district: 'Pune', state: 'Maharashtra',
    constituency: 'Pune', sanctioned_amount: '5000000', spent_amount: '5000000',
    vendor_name: 'Mega Electricals', status: 'Completed',
    latitude: 18.60, longitude: 73.92, target_area: 'SC', sanction_date: '20-Jun-2025',
  },
  // Split-tender vendor: 3 small works, same vendor + district.
  ...Array.from({ length: 3 }, (_, i) => ({
    work_id: `S-${i + 1}`, work_title: `Construction of drainage chamber segment ${i + 1}`,
    category: 'Water', district: 'Patna', state: 'Bihar',
    constituency: 'Patna', sanctioned_amount: '400000', spent_amount: '390000',
    vendor_name: 'Split Co', status: 'Completed',
    latitude: 25.6 + i * 0.05, longitude: 85.1 + i * 0.05, target_area: 'General', sanction_date: '05-May-2025',
  })),
  // Invalid row -> must be skipped.
  { work_title: 'No work id present', state: 'Bihar' },
];

const result = normalizeAndScore(records as never);
console.log('\n[score] valid projects =', result.projects.length);
console.log('[score] skipped =', JSON.stringify(result.skipped));

console.log('\n[score] per-work decomposition:');
for (const signal of result.signals) {
  console.log(
    `  ${signal.work_id.padEnd(7)} total=${String(signal.total_risk_score).padStart(3)} ` +
    `rule=${String(signal.rule_score).padStart(3)} spatial=${String(signal.spatial_score).padStart(3)} ` +
    `nlp=${String(signal.nlp_score).padStart(3)} ml=${String(signal.ml_score).padStart(3)} ` +
    `-> ${signal.primary_flag}`,
  );
}

// --- 3. Assertions ---------------------------------------------------------
const byId = new Map(result.signals.map((s) => [s.work_id, s]));
const checks: Array<[string, boolean]> = [
  ['W-004 flagged Prohibited Asset', byId.get('W-004')!.primary_flag === 'Prohibited Asset'],
  ['W-004 rule score high', byId.get('W-004')!.rule_score >= 55],
  ['W-002 & W-001 share spatial signal', byId.get('W-002')!.spatial_score > 0 && byId.get('W-001')!.spatial_score > 0],
  ['W-003 duplicate proposal detected', byId.get('W-003')!.nlp_score > 0],
  ['W-005 cost outlier detected', byId.get('W-005')!.ml_score > 0],
  ['S-1 split tender detected', byId.get('S-1')!.rule_score > 0],
  ['invalid row skipped', result.skipped.length === 1],
  ['all totals within 0-100', result.signals.every((s) => s.total_risk_score >= 0 && s.total_risk_score <= 100)],
  ['all sub-scores within 0-100', result.signals.every((s) =>
    [s.rule_score, s.spatial_score, s.nlp_score, s.ml_score].every((v) => v >= 0 && v <= 100))],
];

console.log('\n[assertions]');
let failed = 0;
for (const [label, passed] of checks) {
  console.log(`  ${passed ? 'PASS' : 'FAIL'} — ${label}`);
  if (!passed) failed += 1;
}
console.log(`\n${failed === 0 ? 'ALL ASSERTIONS PASSED' : `${failed} ASSERTION(S) FAILED`}`);
process.exit(failed === 0 ? 0 : 1);

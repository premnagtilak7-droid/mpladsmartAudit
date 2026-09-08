import type { Project, Role, Analytics, AnomalyType } from './types';

/**
 * Bundled representative dataset so the UI is fully navigable in preview / before
 * Supabase env vars are wired. Mirrors the shape returned by the `projects` table
 * (post risk-enrichment migration).
 */
const MOCK_RAW: Array<Partial<Project>> = [
  {
    sr_no: '1001',
    state: 'Uttar Pradesh',
    work: 'Construction of roads, link roads, pathways or any other road with or without drainage system',
    work_id: 'WS/MP18218/2025-2026/233777',
    ida: 'GHAZIABAD(DISTRICT MAGISTRAE GHAZIABAD_IDA)',
    mp: 'ATUL GARG',
    constituency: 'GHAZIABAD',
    expenditure_date: '2026-08-21',
    vendor_name: 'DARSH BUILDCON',
    payment_status: 'Payment In-Progress',
    amount: 799146,
  },
  {
    sr_no: '1002',
    state: 'Odisha',
    work: 'Construction of community centers and community halls',
    work_id: 'WS/MP370/2024-2025/145537',
    ida: 'Sundaragada(DISTRICT COLLECTOR SUNDARGARH_IDA)',
    mp: 'Shri Jual Oram',
    constituency: 'SUNDARGARH (ST)',
    expenditure_date: '2026-08-31',
    vendor_name: 'MEMBER SECY OB AND OC WWB BBSR',
    payment_status: 'Payment In-Progress',
    amount: 2000,
  },
  {
    sr_no: '1003',
    state: 'Meghalaya',
    work: 'Purchase of IT systems, including hardware and software for educational purposes',
    work_id: 'WS/MP18137/2025-2026/234004',
    ida: 'EAST KHASI HILLS(Deputy Commissioner, East Khasi Hills District)',
    mp: 'ANDREW J. SYNGKON',
    constituency: 'SHILLONG',
    expenditure_date: '2026-03-23',
    vendor_name: 'DANNY LANGSTIEH',
    payment_status: 'Payment Success',
    amount: 200000,
  },
  {
    sr_no: '1004',
    state: 'Jammu And Kashmir',
    work: 'Construction of common work sheds/ common covered sitting area',
    work_id: 'WS/MP331/2025-2026/189808',
    ida: 'JAMMU(DEPUTY COMMISSIONER JAMMU_IDA)',
    mp: 'Shri Jugal Kishore Sharma',
    constituency: 'JAMMU',
    expenditure_date: '2026-04-15',
    vendor_name: 'VIPAN KUMAR CONTRACTOR',
    payment_status: 'Payment Success',
    amount: 519000,
  },
  {
    sr_no: '1005',
    state: 'Bihar',
    work: 'Construction of drainage system',
    work_id: 'WS/MP212/2024-2025/118876',
    ida: 'PATNA(DISTRICT MAGISTRATE PATNA_IDA)',
    mp: 'Dr. Sanjay Jaiswal',
    constituency: 'PATNA SAHIB',
    expenditure_date: '2026-01-12',
    vendor_name: 'SHIVAM INFRA & VENTURES PRIVATE LIMITED',
    payment_status: 'Payment Success',
    amount: 12500000,
  },
  {
    sr_no: '1006',
    state: 'Rajasthan',
    work: 'Construction of school building',
    work_id: 'WS/MP/2025-2026/226251',
    ida: 'JAIPUR(DISTRICT COLLECTOR JAIPUR_IDA)',
    mp: 'Manish Sharma',
    constituency: 'JAIPUR RURAL',
    expenditure_date: '2026-02-02',
    vendor_name: 'RAJ BUILDERS PVT LTD',
    payment_status: 'Payment Success',
    amount: 4800000,
  },
  {
    sr_no: '1007',
    state: 'Tamil Nadu',
    work: 'Construction of roads, link roads, pathways',
    work_id: 'WS/MP/2025-2026/227500',
    ida: 'CHENNAI(DISTRICT COLLECTOR CHENNAI_IDA)',
    mp: 'T. R. Baalu',
    constituency: 'CHENNAI SOUTH',
    expenditure_date: '2026-05-19',
    vendor_name: 'TARUN INFRA',
    payment_status: 'Payment In-Progress',
    amount: 3200000,
  },
  {
    sr_no: '1008',
    state: 'Jharkhand',
    work: 'Construction of community centers and community halls',
    work_id: 'WS/MP/2024-2025/101234',
    ida: 'RANCHI(DISTRICT MAGISTRATE RANCHI_IDA)',
    mp: 'Sanjay Seth',
    constituency: 'RANCHI',
    expenditure_date: '2026-06-30',
    vendor_name: 'BHARAT TRADING ENTERPRISES',
    payment_status: 'Payment Success',
    amount: 880000,
  },
  {
    sr_no: '1009',
    state: 'Madhya Pradesh',
    work: 'Purchase of IT systems, including hardware and software for educational purposes',
    work_id: 'WS/MP/2025-2026/226500',
    ida: 'BHOPAL(DISTRICT COLLECTOR BHOPAL_IDA)',
    mp: 'Alok Sharma',
    constituency: 'BHOPAL',
    expenditure_date: '2026-07-11',
    vendor_name: 'TECHNICIAN SYSTEMS',
    payment_status: 'Payment Success',
    amount: 640000,
  },
  {
    sr_no: '1010',
    state: 'West Bengal',
    work: 'Construction of roads, link roads, pathways or any other road with or without drainage system',
    work_id: 'WS/MP/2025-2026/228100',
    ida: 'KOLKATA(DISTRICT MAGISTRATE KOLKATA_IDA)',
    mp: 'Shatrughan Prasad Sinha',
    constituency: 'KOLKATA',
    expenditure_date: '2026-08-05',
    vendor_name: 'AASTA INFRA SOLUTION',
    payment_status: 'Payment In-Progress',
    amount: 920000,
  },
  {
    sr_no: '1011',
    state: 'Gujarat',
    work: 'Construction of common work sheds/ common covered sitting area',
    work_id: 'WS/MP/2025-2026/229000',
    ida: 'AHMEDABAD(DISTRICT COLLECTOR AHMEDABAD_IDA)',
    mp: 'Amit Shah',
    constituency: 'GANDHINAGAR',
    expenditure_date: '2026-09-01',
    vendor_name: 'SARDAR CONSTRUCTION',
    payment_status: 'Payment Success',
    amount: 2100000,
  },
];

// Deterministic pseudo-random risk enrichment so mock rows look like a real audit
// dataset. In production this is computed server-side / by migration.
const DRIVER_POOL: Record<
  AnomalyType,
  { loc: number; ven: number; bud: number }
> = {
  'Duplicate Location': { loc: 92, ven: 55, bud: 70 },
  'Split Tendering': { loc: 45, ven: 95, bud: 88 },
  'Prohibited Asset': { loc: 30, ven: 40, bud: 96 },
  Normal: { loc: 18, ven: 20, bud: 15 },
};

function pickAnomaly(i: number): AnomalyType {
  const cycle: AnomalyType[] = [
    'Duplicate Location',
    'Split Tendering',
    'Prohibited Asset',
    'Normal',
    'Normal',
    'Split Tendering',
  ];
  return cycle[i % cycle.length];
}

export function buildMockProjects(): Project[] {
  return MOCK_RAW.map((raw, i) => {
    const anomaly = pickAnomaly(i);
    const drivers = DRIVER_POOL[anomaly];
    const base = Math.round(drivers.loc * 0.35 + drivers.ven * 0.35 + drivers.bud * 0.3);
    const risk = Math.max(0, Math.min(100, base + (i % 5) - 2));
    return {
      id: i + 1,
      sr_no: raw.sr_no ?? null,
      state: raw.state ?? null,
      work: raw.work ?? null,
      work_id: raw.work_id ?? null,
      ida: raw.ida ?? null,
      mp: raw.mp ?? null,
      constituency: raw.constituency ?? null,
      expenditure_date: raw.expenditure_date ?? null,
      vendor_name: raw.vendor_name ?? null,
      payment_status: raw.payment_status ?? null,
      amount: raw.amount ?? null,
      risk_score: risk,
      anomaly_type: anomaly,
      risk_drivers: [
        { key: 'location', label: 'Location Proximity', score: drivers.loc, weight: 0.35, note: 'Clustering of vouchers within a tight geographic radius.' },
        { key: 'vendor', label: 'Vendor Splitting', score: drivers.ven, weight: 0.35, note: 'Multiple vouchers to overlapping vendor entities near the threshold.' },
        { key: 'budget', label: 'Budget Pattern', score: drivers.bud, weight: 0.3, note: 'Expenditure pattern deviates from benchmark per-work cost.' },
      ],
      approval_status: i % 3 === 0 ? 'Pending' : 'Approved',
      delay_days: i % 4 === 0 ? (i % 4) * 7 + 3 : null,
      completion_percent: [35, 60, 85, 100, 20, 70][i % 6],
    };
  });
}

/** Compute the four analytics header cards from an array of projects. */
export function computeAnalytics(projects: Project[]): Analytics {
  let totalFunds = 0;
  let flaggedHighRisk = 0;
  let fundsAtStake = 0;

  for (const p of projects) {
    const amt = Number(p.amount) || 0;
    totalFunds += amt;
    if ((p.risk_score ?? 0) >= 80) {
      flaggedHighRisk += 1;
      fundsAtStake += amt;
    }
  }

  return {
    totalFunds,
    totalWorks: projects.length,
    flaggedHighRisk,
    fundsAtStake,
  };
}

export const ROLE_LABELS: Record<Role, string> = {
  auditor: 'Central Auditor (Admin)',
  dm: 'District Magistrate',
  contractor: 'Contractor',
  citizen: 'Citizen View',
};

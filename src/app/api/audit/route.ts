import { NextRequest, NextResponse } from 'next/server';
import type { AuditRequest, AuditResponse, RiskDriver } from '@/lib/types';

/**
 * POST /api/audit
 *
 * Returns a plain-text AI audit narrative for a given project. This is the
 * server-side consolidation point for the "Gemini AI Auditor" explainability:
 * the narrative can be produced by a model (e.g. Gemini via a server-side key
 * stored in an env var) or, when no key is configured, by a deterministic
 * rule-based fallback so the feature works end-to-end in preview.
 *
 * NOTE: Never expose an AI/LLM provider key to the browser — call the model
 * provider here, server-side only.
 */
export async function POST(req: NextRequest) {
  let body: AuditRequest;
  try {
    body = (await req.json()) as AuditRequest;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const p = body?.project;
  if (!p) {
    return NextResponse.json({ error: 'Missing project' }, { status: 400 });
  }

  const riskScore = clamp(p.risk_score ?? 0, 0, 100);
  const anomaly =
    p.anomaly_type && p.anomaly_type !== 'Normal'
      ? p.anomaly_type
      : classify(riskScore);

  const drivers = p.risk_drivers?.length
    ? p.risk_drivers
    : buildDrivers(anomaly);

  // Optional: swap in a real LLM call here using a server-side API key.
  const narrative = buildNarrative(p, anomaly, riskScore, drivers);
  const generatedAt = new Date().toISOString();

  const response: AuditResponse = {
    narrative,
    riskScore,
    anomalyType: anomaly,
    drivers,
    generatedAt,
  };

  return NextResponse.json(response);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function classify(score: number): AuditResponse['anomalyType'] {
  if (score >= 80) return 'Prohibited Asset';
  if (score >= 50) return 'Split Tendering';
  return 'Normal';
}

function buildDrivers(anomaly: string): RiskDriver[] {
  const map: Record<string, RiskDriver[]> = {
    'Duplicate Location': [
      { key: 'location', label: 'Location Proximity', score: 88, weight: 0.35, note: 'Vouchers cluster within a narrow geo-radius.' },
      { key: 'vendor', label: 'Vendor Splitting', score: 52, weight: 0.35, note: 'Overlapping vendor entities detected.' },
      { key: 'budget', label: 'Budget Pattern', score: 65, weight: 0.3, note: 'Unit cost deviates from benchmark.' },
    ],
    'Split Tendering': [
      { key: 'location', label: 'Location Proximity', score: 42, weight: 0.35, note: 'Minor geographic overlap.' },
      { key: 'vendor', label: 'Vendor Splitting', score: 92, weight: 0.35, note: 'Tenders split below sanction threshold via related vendors.' },
      { key: 'budget', label: 'Budget Pattern', score: 84, weight: 0.3, note: 'Multiple sums close to approval cap.' },
    ],
    'Prohibited Asset': [
      { key: 'location', label: 'Location Proximity', score: 30, weight: 0.35, note: 'No clustering concern.' },
      { key: 'vendor', label: 'Vendor Splitting', score: 38, weight: 0.35, note: 'Single vendor.' },
      { key: 'budget', label: 'Budget Pattern', score: 94, weight: 0.3, note: 'Asset class flagged as non-permissible expenditure.' },
    ],
    Normal: [
      { key: 'location', label: 'Location Proximity', score: 15, weight: 0.35, note: 'No clustering.' },
      { key: 'vendor', label: 'Vendor Splitting', score: 18, weight: 0.35, note: 'No related parties.' },
      { key: 'budget', label: 'Budget Pattern', score: 14, weight: 0.3, note: 'Unit costs within benchmark.' },
    ],
  };
  return map[anomaly] ?? map.Normal;
}

function buildNarrative(
  p: AuditRequest['project'],
  anomaly: string,
  score: number,
  drivers: RiskDriver[],
): string {
  const work = p.work || 'the sanctioned work';
  const vendor = p.vendor_name || 'the vendor';
  const mp = p.mp || 'the MP';
  const constituency = p.constituency || 'the constituency';
  const amt = p.amount ? Number(p.amount).toLocaleString('en-IN') : 'n/a';

  const driverLine = drivers
    .map((d) => `- ${d.label}: ${d.score}/100 (${d.note})`)
    .join('\n');

  const disposition =
    score >= 80
      ? 'HIGH RISK'
      : score >= 50
        ? 'MEDIUM RISK'
        : 'LOW RISK';

  return [
    `AI AUDITOR NARRATIVE — "${disposition}" (Risk ${score}/100)`,
    ``,
    `Project: ${work}`,
    `Work ID: ${p.work_id || 'N/A'} | MP: ${mp} | Constituency: ${constituency}`,
    `Vendor: ${vendor} | Disbursed: ₹${amt}`,
    ``,
    `Anomaly Type: ${anomaly}`,
    ``,
    `The system flags this record for "${anomaly}" with an overall risk score of ${score}/100. Key risk drivers:`,
    driverLine,
    ``,
    score >= 80
      ? `Recommendation: Immediately halt any in-flight disbursement, escalate to the District Magistrate for an on-ground verification, and place the vendor on the watch-list pending an official audit note. Freezing disbursement is advised to prevent further exposure of public funds.`
      : score >= 50
        ? `Recommendation: Schedule a field verification within 30 days. Confirm whether the expenditure aligns with sanctioned MPLAD guidelines and whether vendor splitting bypassed tender limits. If confirmed, elevate for an official audit note.`
        : `Recommendation: No immediate action required. The record aligns with normal disbursement patterns. Retain for periodic post-facto review.`,
  ].join('\n');
}

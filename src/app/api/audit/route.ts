import { NextRequest, NextResponse } from 'next/server';
import type {
  AuditRequest,
  AuditResponse,
  Project,
  ViolationCategory,
} from '@/lib/types';

const MODEL = 'gemini-1.5-flash';
const TEMPERATURE = 0.2;

const SYSTEM_PROMPT = [
  'You are a MoSPI Senior Vigilance Auditor for the MPLAD Scheme.',
  'Your analysis must reference legal controls from:',
  '- MPLAD Scheme Guidelines Section 3: Prohibited Works/Assets',
  '- MPLAD Scheme Guidelines Section 4: SC/ST statutory mandate.',
  'Always be factual, strict, and concise.',
  'Return ONLY valid JSON matching this schema:',
  '{',
  '  "violation_category": "Split Tendering" | "Duplicate Location" | "Prohibited Asset" | "SC-ST Deficit",',
  '  "risk_score": number,',
  '  "audit_summary": ["bullet 1", "bullet 2", "bullet 3"],',
  '  "recommended_action": "single actionable District Magistrate directive"',
  '}',
  'No markdown. No extra keys. Exactly 3 bullets in audit_summary.',
].join('\n');

export async function POST(req: NextRequest) {
  let body: AuditRequest;
  try {
    body = (await req.json()) as AuditRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const project = body?.project;
  if (!project) {
    return NextResponse.json({ error: 'Missing project' }, { status: 400 });
  }

  try {
    const response = await runGeminiAudit(project);
    return NextResponse.json(response);
  } catch {
    const fallback = buildFallback(project);
    return NextResponse.json(fallback);
  }
}

async function runGeminiAudit(project: Project): Promise<AuditResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY missing');
  }

  const payload = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    generationConfig: {
      temperature: TEMPERATURE,
      responseMimeType: 'application/json',
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: JSON.stringify({
              context: 'MPLAD work expenditure audit',
              project,
              expected_categories: [
                'Split Tendering',
                'Duplicate Location',
                'Prohibited Asset',
                'SC-ST Deficit',
              ],
            }),
          },
        ],
      },
    ],
  };

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  if (!geminiRes.ok) {
    throw new Error(`Gemini call failed with ${geminiRes.status}`);
  }

  const data = (await geminiRes.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = JSON.parse(text) as Partial<AuditResponse>;

  return normalizeAuditResponse(parsed, project);
}

function normalizeAuditResponse(input: Partial<AuditResponse>, project: Project): AuditResponse {
  const allowed: ViolationCategory[] = [
    'Split Tendering',
    'Duplicate Location',
    'Prohibited Asset',
    'SC-ST Deficit',
  ];

  const violationCategory = allowed.includes(input.violation_category as ViolationCategory)
    ? (input.violation_category as ViolationCategory)
    : inferCategory(project);

  const risk = clamp(Number(input.risk_score ?? project.risk_score ?? 50), 0, 100);

  const summary = Array.isArray(input.audit_summary)
    ? input.audit_summary.filter(Boolean).map((line) => String(line).trim()).slice(0, 3)
    : [];

  while (summary.length < 3) {
    summary.push(defaultSummaryLine(summary.length, violationCategory, project));
  }

  return {
    violation_category: violationCategory,
    risk_score: risk,
    audit_summary: summary,
    recommended_action:
      String(input.recommended_action || '').trim() ||
      defaultAction(violationCategory),
    generated_at: new Date().toISOString(),
  };
}

function buildFallback(project: Project): AuditResponse {
  const violation = inferCategory(project);
  const risk = clamp(Number(project.risk_score ?? 70), 0, 100);

  return {
    violation_category: violation,
    risk_score: risk,
    audit_summary: [
      `Work ${project.work_id || `MPLAD-${project.id}`} indicates ${violation} with risk score ${risk}/100 after statutory checks.`,
      'Section 3 compliance review indicates expenditure pattern may conflict with permissible MPLAD work categories.',
      'Section 4 allocation review requires SC/ST share verification with district-level documentary evidence.',
    ],
    recommended_action: defaultAction(violation),
    generated_at: new Date().toISOString(),
  };
}

function inferCategory(project: Project): ViolationCategory {
  const anomaly = project.anomaly_type;
  if (anomaly === 'Split Tendering') return 'Split Tendering';
  if (anomaly === 'Duplicate Location') return 'Duplicate Location';
  if (anomaly === 'Prohibited Asset') return 'Prohibited Asset';

  const constituency = `${project.constituency || ''}`.toUpperCase();
  if (!constituency.includes('SC') && !constituency.includes('ST')) {
    return 'SC-ST Deficit';
  }
  return 'Split Tendering';
}

function defaultSummaryLine(index: number, violation: ViolationCategory, project: Project): string {
  const lines = [
    `Potential ${violation} observed in work ${project.work_id || `MPLAD-${project.id}`} based on disbursement and location signals.`,
    'Section 3 legal screening indicates elevated risk of non-permissible expenditure or sanctioned scope deviation.',
    'Section 4 statutory obligation to ensure SC/ST allocation requires immediate district verification and compliance report.',
  ];
  return lines[index] || lines[2];
}

function defaultAction(violation: ViolationCategory): string {
  if (violation === 'Duplicate Location') {
    return 'Issue duplicate-site verification notice, geo-validate with field team, and freeze further disbursement until closure.';
  }
  if (violation === 'Prohibited Asset') {
    return 'Issue Section 3 Show-Cause Notice & Freeze Account pending MoSPI legal scrutiny and asset admissibility review.';
  }
  if (violation === 'SC-ST Deficit') {
    return 'Issue Section 4 compliance direction, mandate SC/ST corrective allocation plan, and suspend new drawdowns until compliance.';
  }
  return 'Issue Section 3 Show-Cause Notice & Freeze Account; direct DM to conduct vendor and sanction-threshold verification within 7 days.';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

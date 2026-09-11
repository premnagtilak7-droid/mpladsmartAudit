// Core domain types for MPLAD Radar.

export type Role = 'auditor' | 'dm' | 'contractor' | 'citizen';

export type AnomalyType =
  | 'Duplicate Location'
  | 'Split Tendering'
  | 'Prohibited Asset'
  | 'Normal';

export type ViolationCategory =
  | 'Split Tendering'
  | 'Duplicate Location'
  | 'Prohibited Asset'
  | 'SC-ST Deficit';

export interface RiskDriver {
  key: 'location' | 'vendor' | 'budget';
  label: string;
  score: number; // 0-100
  weight: number; // 0-1
  note: string;
}

/** Row shape from the Supabase `projects` table (analytics + risk enrichment). */
export interface Project {
  id: number;
  /** "Sr. No." */
  sr_no: string | null;
  /** "State" */
  state: string | null;
  /** "Work" */
  work: string | null;
  /** "Work ID" */
  work_id: string | null;
  /** "IDA" */
  ida: string | null;
  /** "Hon'ble Members of Parliament" */
  mp: string | null;
  /** "Constituency" */
  constituency: string | null;
  /** "Expenditure Date" */
  expenditure_date: string | null;
  /** "Vendor Name" */
  vendor_name: string | null;
  /** "Payment Status" */
  payment_status: string | null;
  /** Optional normalized status/stage fields present in newer MoSPI ingests. */
  status?: string | null;
  stage?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** "Fund Disbursed Amount ( ₹ )" */
  amount: number | null;
  allocated_amount?: number | null;
  sanctioned_amount?: number | null;

  // --- Risk enrichment (added by migration / server) ---
  risk_score: number | null;
  anomaly_type: AnomalyType | null;
  risk_drivers?: RiskDriver[];

  // --- Workflow enrichment (DM / Citizen views) ---
  approval_status?: string;
  delay_days?: number | null;
  completion_percent?: number | null;
}

/** Aggregated analytics computed from the projects dataset. */
export interface Analytics {
  totalFunds: number; // in rupees
  totalWorks: number;
  flaggedHighRisk: number; // risk_score >= 80
  fundsAtStake: number; // sum of amounts with risk_score >= 80
}

export interface AuditNarrative {
  riskScore: number;
  anomalyType: AnomalyType;
  narrative: string;
  drivers: RiskDriver[];
  generatedAt: string;
}

/** Shape used by section B POST /api/audit payload & response. */
export interface AuditRequest {
  project: Project;
}

export interface AuditResponse {
  violation_category: ViolationCategory;
  risk_score: number;
  audit_summary: string[];
  recommended_action: string;
  generated_at: string;
}
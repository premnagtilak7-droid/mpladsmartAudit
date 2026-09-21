import type { AnomalyType } from './types';

/** Derives the public-facing anomaly explanation from the persisted score. */
export function anomalyTagForScore(score: number | null | undefined): string | null {
  const value = Number(score) || 0;
  if (value >= 90) return 'Cost Inflation 32% (Severe)';
  if (value >= 85) return 'Cost Outlier Anomaly';
  if (value >= 75) return 'Duplicate Spatial Scope / Timeline Review';
  return null;
}

/** Keeps existing CVD/DPO anomaly filters compatible with score-only imports. */
export function anomalyTypeForScore(score: number | null | undefined): AnomalyType {
  const value = Number(score) || 0;
  if (value >= 90) return 'Prohibited Asset';
  if (value >= 85) return 'Split Tendering';
  if (value >= 75) return 'Duplicate Location';
  return 'Normal';
}

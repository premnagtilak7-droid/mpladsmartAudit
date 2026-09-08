/** Formatting helpers shared across the UI. */

const RUPEE = '\u20B9';

/** Format a rupee amount in Indian number system, e.g. ₹12,50,000. */
export function formatINR(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return `${RUPEE} 0`;
  // Use en-IN so thousands are grouped in the Indian system (2,2,3).
  return `${RUPEE}${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Number(value))}`;
}

/** Convert a rupee amount to Crores (1 Cr = 10,000,000). */
export function toCrores(value: number | null | undefined): number {
  if (value == null || Number.isNaN(Number(value))) return 0;
  return Number(value) / 10_000_000;
}

/** Format a number as Crores with a compact label, e.g. "4.24 Cr". */
export function formatCrores(value: number | null | undefined): string {
  const cr = toCrores(value);
  return `${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
  }).format(cr)} Cr`;
}

/** Compact Indian currency for large footers, e.g. "279.14 Cr". */
export function formatAmountCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return `${RUPEE} 0`;
  const abs = Math.abs(Number(value));
  const sign = Number(value) < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}${RUPEE}${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}${RUPEE}${(abs / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${sign}${RUPEE}${(abs / 1e3).toFixed(1)} K`;
  return `${sign}${RUPEE}${abs.toFixed(0)}`;
}

/** Normalize a raw `YYYY-MM-DD` (or empty) to a friendly date. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.split('-');
  if (!y || !m || !d) return value;
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const idx = Number(m) - 1;
  const mon = months[idx] ?? m;
  return `${d}-${mon}-${y}`;
}

/** Truncate long strings with an ellipsis. */
export function truncate(value: string | null | undefined, max = 90): string {
  if (!value) return '';
  return value.length > max ? value.slice(0, max - 1).trimEnd() + '\u2026' : value;
}

/** Map a risk score to a color token used in badges. */
export function riskTone(score: number): 'rose' | 'amber' | 'emerald' {
  if (score >= 80) return 'rose';
  if (score >= 50) return 'amber';
  return 'emerald';
}

export { RUPEE };

// Pure presentation logic for the Accounts-View report: accounting sign convention and variance (Δ).
// Extracted from the report screen for unit testing (design/specs/web/global/testing.md, Tier 1).
import { NORMAL_BALANCE, type AccountType } from '$lib/data/types';

// Present a raw signed balance for display: credit-normal types (Liability/Equity/Income) read positive
// when they carry a (normal) credit balance, so signs match balance-sheet convention.
export const presentBalance = (raw: number, type: AccountType): number =>
  NORMAL_BALANCE[type] === 'credit' ? -raw : raw;

export type VarianceFormat = 'dollar' | 'percent' | 'both';

// Δ$ and Δ% between an older and newer value. `p` is null when the older value is 0 (no meaningful %).
export const varianceOf = (older: number, newer: number): { d: number; p: number | null } => ({
  d: newer - older,
  p: older !== 0 ? ((newer - older) / Math.abs(older)) * 100 : null,
});

// Format a variance per the chosen format. `fmt` renders a currency amount (injected so this stays pure
// and the caller controls cents/locale). Uses U+2212 (−) for negatives to match the report cells.
export function formatVariance(
  older: number,
  newer: number,
  unit: string,
  format: VarianceFormat,
  fmt: (amount: number, unit: string) => string,
): string {
  const { d, p } = varianceOf(older, newer);
  const dol = (d >= 0 ? '+' : '−') + fmt(Math.abs(d), unit);
  const pct = p === null ? '—' : (p >= 0 ? '+' : '−') + Math.abs(p).toFixed(1) + '%';
  if (format === 'dollar') return dol;
  if (format === 'percent') return pct;
  return `${dol}  ${pct}`;
}

// Unit-aware amount formatting — pure (Tier 1). See design/specs/domain/units.md § Amounts & Display.
//
// Amounts are integers in a unit's smallest increment; `displayDivisor` turns them into display
// values. That divisor is NOT always 100: securities use 10000, JPY 1, labor-minutes 60. And a unit
// code is not always an ISO currency — `Intl.NumberFormat({ style: 'currency', currency: 'NYSE:VPER' })`
// throws. Both facts are why this exists instead of a hardcoded `/100`.

import type { Unit } from '$lib/data';

/** Decimal places implied by a divisor: 100 → 2, 10000 → 4, 1 → 0. Non-powers-of-ten (60, 12) → 2. */
export function decimalsFor(divisor: number): number {
  if (!Number.isFinite(divisor) || divisor <= 1) return 0;
  const log = Math.log10(divisor);
  return Number.isInteger(log) ? log : 2;
}

/** True when a code can be handed to Intl as a currency: exactly three ASCII letters. */
function isIsoCurrency(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

export interface FormatOptions {
  /** Append the unit's symbol/code for non-currency units. Default true. */
  withUnit?: boolean;
  /** Force a sign on positive values. */
  signed?: boolean;
  /**
   * Thousands separators. Default true for display — but MUST be false when the string is going into
   * an `<input type="number">`, which silently rejects "1,000.0000" and renders an empty field.
   */
  grouping?: boolean;
}

/**
 * Format a stored integer amount for display in its own unit.
 *
 *   formatAmount(128000000, { code: 'NYSE:VPER', symbol: 'VPER', displayDivisor: 10000 })
 *     → "12,800.0000 VPER"
 *   formatAmount(17280, { code: 'USD', displayDivisor: 100 })  → "$172.80"
 */
export function formatAmount(amount: number, unit?: Unit, options: FormatOptions = {}): string {
  const { withUnit = true, signed = false, grouping = true } = options;
  const divisor = unit?.displayDivisor ?? 100;
  const decimals = decimalsFor(divisor);
  const value = amount / divisor || 0;   // `|| 0` normalises -0 so we never render "-$0.00"
  const code = unit?.code ?? 'USD';

  if (isIsoCurrency(code)) {
    const text = new Intl.NumberFormat('en-US', {
      style: 'currency', currency: code,
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
      signDisplay: signed ? 'exceptZero' : 'auto',
      useGrouping: grouping,
    }).format(value);
    return text;
  }

  // Non-currency unit (a security, a CHIP, a widget): plain number plus the short symbol.
  const text = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    signDisplay: signed ? 'exceptZero' : 'auto',
    useGrouping: grouping,
  }).format(value);
  const label = unit?.symbol || code;
  return withUnit ? `${text} ${label}` : text;
}

/**
 * Format a rate in WHOLE units, e.g. "1 VPER = $0.013500".
 * Rates need more precision than amounts — a sub-cent share price rounded to 2 decimals reads as $0.01.
 */
export function formatRate(rate: number, fromUnit?: Unit, toUnit?: Unit): string {
  const from = fromUnit?.symbol || fromUnit?.code || '';
  const magnitude = Math.abs(rate);
  // Small rates need more places to stay meaningful; large ones don't.
  const decimals = magnitude === 0 ? 2 : magnitude < 0.01 ? 6 : magnitude < 1 ? 4 : 2;
  const value = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(rate);
  const to = toUnit && isIsoCurrency(toUnit.code)
    ? `${new Intl.NumberFormat('en-US', { style: 'currency', currency: toUnit.code, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(rate)}`
    : `${value} ${toUnit?.symbol || toUnit?.code || ''}`.trim();
  return `1 ${from} = ${to}`;
}

/** Look up units by code, for the formatters above. */
export function unitLookup(units: Unit[]): (code: string) => Unit | undefined {
  const byCode = new Map(units.map((u) => [u.code, u]));
  return (code) => byCode.get(code);
}

/**
 * A stored amount as a bare decimal string for an `<input type="number">`.
 *
 * Separate from `formatAmount` on purpose: a number input parses its value with the HTML number
 * grammar, which has no room for thousands separators or a currency symbol. Feed it "1,000.0000" and
 * it shows an EMPTY field — which is how a stock transaction opened for editing silently lost its
 * quantity and value.
 */
export function formatForInput(amount: number, unit?: Unit): string {
  const divisor = unit?.displayDivisor ?? 100;
  // Deliberately NOT via formatAmount: its currency branch would prepend "$", which a number input
  // rejects just as surely as a comma.
  return (amount / divisor || 0).toFixed(decimalsFor(divisor));
}

// Quantity / Price / Value arithmetic for the transaction editor — pure (Tier 1).
// Rules: design/specs/web/components/transaction-edit.md § Multi-Unit Entries.
//
// A multi-unit row holds three related numbers and the user supplies any two:
//     quantity (in the row account's unit)  ×  price (per whole unit)  =  value (in the reckoning unit)
// Everything here works in DISPLAY numbers (what the user types), not smallest increments — the
// caller scales to integers on save.

/** Which field the user most recently edited; the other derived field is the one we recompute. */
export type EntryField = 'quantity' | 'price' | 'value';

export interface EntryRow {
  quantity?: number;
  price?: number;
  value?: number;
}

const isNum = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Fill in the missing third value, given which field was just edited.
 *
 * The field the user just touched is never overwritten. Of the other two, we recompute whichever is
 * *not* part of the pair they're working with, so their in-progress entry survives.
 *
 * Returns the row unchanged when fewer than two fields are known — a half-entered row stays
 * half-entered rather than being filled with a guess.
 */
export function completeRow(row: EntryRow, edited: EntryField): EntryRow {
  const { quantity, price, value } = row;

  if (edited === 'quantity') {
    // Prefer holding price steady (the usual "I bought N more at the same price").
    if (isNum(quantity) && isNum(price)) return { ...row, value: quantity * price };
    if (isNum(quantity) && isNum(value)) return { ...row, price: quantity === 0 ? undefined : value / quantity };
    return row;
  }

  if (edited === 'price') {
    if (isNum(price) && isNum(quantity)) return { ...row, value: quantity * price };
    if (isNum(price) && isNum(value)) return { ...row, quantity: price === 0 ? undefined : value / price };
    return row;
  }

  // edited === 'value'
  if (isNum(value) && isNum(quantity)) return { ...row, price: quantity === 0 ? undefined : value / quantity };
  if (isNum(value) && isNum(price)) return { ...row, quantity: price === 0 ? undefined : value / price };
  return row;
}

/**
 * The rate a row implies, in whole units — what the guard shows the user for confirmation.
 * Null when it can't be determined (no quantity, or a zero quantity).
 */
export function impliedRate(quantity?: number, value?: number): number | null {
  if (!isNum(quantity) || !isNum(value) || quantity === 0) return null;
  return Math.abs(value) / Math.abs(quantity);
}

/**
 * Does an implied rate deviate far enough from a known reference rate to be worth warning about?
 *
 * This is the forgotten-leg detector: buying €850 for $1,000 while omitting a $30 wire fee still
 * balances, it just implies $1.212/EUR instead of $1.176/EUR — a ~3% distortion that hides the $30.
 * An imbalance would be caught by the balance check; a distorted rate would not, which is why the
 * threshold is deliberately tight.
 */
export function rateDeviates(implied: number, reference: number, tolerance = 0.02): boolean {
  if (!isNum(implied) || !isNum(reference) || reference === 0) return false;
  return Math.abs(implied - reference) / Math.abs(reference) > tolerance;
}

/** A stable key for "this rate, on this row" so an acknowledgment doesn't survive an edit. */
export function rateAckKey(quantity?: number, value?: number): string {
  const rate = impliedRate(quantity, value);
  return rate === null ? '' : rate.toPrecision(12);
}

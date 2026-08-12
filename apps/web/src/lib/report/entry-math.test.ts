// Tier-1 unit tests for the editor's quantity/price/value arithmetic and the implied-rate guard.
// Spec: design/specs/web/components/transaction-edit.md § Multi-Unit Entries.

import { describe, it, expect } from 'vitest';
import { completeRow, impliedRate, rateDeviates, rateAckKey } from './entry-math';

describe('completeRow — any two fill the third', () => {
  it('quantity × price → value', () => {
    expect(completeRow({ quantity: 100, price: 2.83 }, 'quantity').value).toBeCloseTo(283, 10);
  });

  it('quantity + value → price', () => {
    // Kyle's example: 100 shares for $283 implies $2.83/share.
    expect(completeRow({ quantity: 100, value: 283 }, 'value').price).toBeCloseTo(2.83, 10);
  });

  it('price + value → quantity', () => {
    expect(completeRow({ price: 2.83, value: 283 }, 'value').quantity).toBeCloseTo(100, 10);
  });

  it('never overwrites the field the user just edited', () => {
    const r = completeRow({ quantity: 100, price: 2.83, value: 999 }, 'value');
    expect(r.value).toBe(999);          // untouched
    expect(r.price).toBeCloseTo(9.99, 10);  // recomputed instead
  });

  it('holds price steady when the quantity changes', () => {
    // "I bought 200 more at the same price" — price stays, value follows.
    const r = completeRow({ quantity: 200, price: 2.83, value: 283 }, 'quantity');
    expect(r.price).toBe(2.83);
    expect(r.value).toBeCloseTo(566, 10);
  });

  it('leaves a half-entered row alone rather than guessing', () => {
    expect(completeRow({ quantity: 100 }, 'quantity')).toEqual({ quantity: 100 });
    expect(completeRow({}, 'value')).toEqual({});
  });

  it('does not divide by zero', () => {
    expect(completeRow({ quantity: 0, value: 50 }, 'value').price).toBeUndefined();
    expect(completeRow({ price: 0, value: 50 }, 'value').quantity).toBeUndefined();
  });

  it('handles a sub-cent share price without losing it', () => {
    const r = completeRow({ quantity: 12800, value: 172.8 }, 'value');
    expect(r.price).toBeCloseTo(0.0135, 10);
  });
});

describe('impliedRate', () => {
  it('is magnitude-only, so a credit and a debit imply the same rate', () => {
    expect(impliedRate(-12800, -172.8)).toBeCloseTo(0.0135, 10);
    expect(impliedRate(12800, 172.8)).toBeCloseTo(0.0135, 10);
  });

  it('is null when it cannot be determined', () => {
    expect(impliedRate(0, 100)).toBeNull();
    expect(impliedRate(undefined, 100)).toBeNull();
    expect(impliedRate(100, undefined)).toBeNull();
  });
});

describe('rateDeviates — the forgotten-leg detector', () => {
  it('catches the classic missing wire fee', () => {
    // €850 for $1,000 with a forgotten $30 fee implies 1.2118 instead of 1.1765 — ~3%.
    const withFee = 1000 / 850;        // 1.17647 — the honest rate
    const withoutFee = 1030 / 850;     // 1.21176 — what the forgotten fee implies
    expect(rateDeviates(withoutFee, withFee)).toBe(true);
  });

  it('tolerates ordinary market drift', () => {
    expect(rateDeviates(1.18, 1.1765)).toBe(false);
  });

  it('is silent when there is nothing to compare against', () => {
    expect(rateDeviates(1.2, 0)).toBe(false);
    expect(rateDeviates(NaN, 1.2)).toBe(false);
  });
});

describe('rateAckKey', () => {
  it('changes when the rate changes, so an acknowledgment does not survive an edit', () => {
    const before = rateAckKey(100, 283);
    const after = rateAckKey(100, 290);
    expect(before).not.toBe(after);
  });

  it('is stable for the same rate expressed at a different scale', () => {
    expect(rateAckKey(100, 283)).toBe(rateAckKey(200, 566));
  });

  it('is empty when no rate is implied', () => {
    expect(rateAckKey(0, 50)).toBe('');
  });
});

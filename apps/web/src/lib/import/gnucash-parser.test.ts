// Tier-1 unit tests for the pure parts of the GnuCash parser (design/specs/web/global/testing.md).
// The DOM-walking half needs a browser and is covered by e2e; these cover the two places where
// multi-unit books were silently corrupted.

import { describe, it, expect } from 'vitest';
import { unitCodeFor, rationalToSmallestUnit } from './gnucash-parser';

describe('unitCodeFor', () => {
  it('leaves currencies bare', () => {
    expect(unitCodeFor('CURRENCY', 'USD')).toBe('USD');
    expect(unitCodeFor('CURRENCY', 'eur')).toBe('EUR');
  });

  it('namespaces securities so colliding tickers stay distinct', () => {
    // Both exist in Kyle's investment books; Unit.code is the primary key, so they must not merge.
    expect(unitCodeFor('NYSE', 'VPER')).toBe('NYSE:VPER');
    expect(unitCodeFor('NASDAQ', 'VPER')).toBe('NASDAQ:VPER');
    expect(unitCodeFor('NYSE', 'VPER')).not.toBe(unitCodeFor('NASDAQ', 'VPER'));
  });
});

describe('rationalToSmallestUnit', () => {
  it('passes through when the source denominator is the unit divisor', () => {
    expect(rationalToSmallestUnit('12345/100', 100)).toBe(12345);      // $123.45
    expect(rationalToSmallestUnit('-1752110000/10000', 10000)).toBe(-1752110000); // -175,211 shares
  });

  it('rescales between denominators', () => {
    expect(rationalToSmallestUnit('5/1', 100)).toBe(500);              // 5 → 500 cents
    expect(rationalToSmallestUnit('250/100', 10000)).toBe(25000);      // 2.5 → 2.5000 shares
  });

  it('does NOT force securities through a fixed denominator of 100', () => {
    // The old parser hardcoded /100, turning 175,211 shares into 17,521.10 — corruption, not rounding.
    const shares = rationalToSmallestUnit('-1752110000/10000', 10000);
    expect(shares / 10000).toBe(-175211);
  });

  it('keeps a sub-cent share price exact through quantity and value', () => {
    // "Sell VPER 12800 @ 0.0135": -12,800 shares for -$172.80.
    const qty = rationalToSmallestUnit('-128000000/10000', 10000);
    const value = rationalToSmallestUnit('-17280/100', 100);
    expect(qty / 10000).toBe(-12800);
    expect(value / 100).toBe(-172.8);
    // The implied rate is value/amount with each side divided by ITS OWN unit's divisor —
    // dollars-per-share, not cents-per-ten-thousandth-share.
    expect((value / 100) / (qty / 10000)).toBeCloseTo(0.0135, 10);
  });

  it('tolerates malformed input', () => {
    expect(rationalToSmallestUnit('', 100)).toBe(0);
    expect(rationalToSmallestUnit('5', 100)).toBe(0);
    expect(rationalToSmallestUnit('5/0', 100)).toBe(0);
  });
});

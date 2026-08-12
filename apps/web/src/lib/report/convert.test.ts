// Tier-1 unit tests for the report unit-conversion engine (design/specs/domain/units.md).

import { describe, it, expect } from 'vitest';
import {
  buildRateTable, findConversion, convertAmount, convertBalance, divisorLookup,
  multiplyRates, invertRate, reduce, rateToNumber, valueReport,
} from './convert';
import type { NativeAccountBalance } from './convert';
import type { Exchange } from '$lib/data';

const rate = (
  unitA: string, unitB: string, num: number, den: number, date: string,
  source: Exchange['source'] = 'MARKET',
): Exchange => ({ id: `${unitA}-${unitB}-${date}`, date, unitA, unitB, rateNumerator: num, rateDenominator: den, source });

const UNITS = [
  { code: 'USD', name: 'US Dollar', unitType: 'FIAT' as const, displayDivisor: 100 },
  { code: 'CHIP', name: 'CHIP', unitType: 'OTHER' as const, displayDivisor: 100 },
  { code: 'NYSE:VPER', name: 'Viper', unitType: 'SECURITY' as const, displayDivisor: 10000 },
  { code: 'INV:widget', name: 'Widget', unitType: 'INVENTORY' as const, displayDivisor: 1 },
];
const divisorOf = divisorLookup(UNITS);

describe('rational arithmetic', () => {
  it('reduces and normalises sign', () => {
    expect(reduce({ num: 50, den: 100 })).toEqual({ num: 1, den: 2 });
    expect(reduce({ num: 1, den: -2 })).toEqual({ num: -1, den: 2 });
  });

  it('inverts', () => {
    expect(invertRate({ num: 1, den: 4 })).toEqual({ num: 4, den: 1 });
  });

  it('cross-reduces so chained large-denominator quotes do not overflow', () => {
    // Real GnuCash quotes carry 1e8 denominators; three naive hops exceed 2^53 and lose precision.
    const q = { num: 898980000, den: 100000000 };
    const chained = multiplyRates(multiplyRates(q, q), q);
    expect(Number.isSafeInteger(chained.num)).toBe(true);
    expect(Number.isSafeInteger(chained.den)).toBe(true);
    expect(rateToNumber(chained)).toBeCloseTo(8.9898 ** 3, 6);
  });
});

describe('buildRateTable — as-of-date selection', () => {
  const rates = [
    rate('NYSE:VPER', 'USD', 135, 10000, '2019-03-04'),
    rate('NYSE:VPER', 'USD', 200, 10000, '2026-08-01'),
    rate('NYSE:VPER', 'USD', 999, 10000, '2027-01-01'),
  ];

  it('uses the most recent quote at or before the report date, not today', () => {
    const dec = findConversion(buildRateTable(rates, '2019-12-31'), 'NYSE:VPER', 'USD');
    expect(rateToNumber(dec!.rate)).toBeCloseTo(0.0135, 10);

    const now = findConversion(buildRateTable(rates, '2026-08-11'), 'NYSE:VPER', 'USD');
    expect(rateToNumber(now!.rate)).toBeCloseTo(0.02, 10);
  });

  it('ignores quotes dated after the report date', () => {
    const t = buildRateTable(rates, '2026-08-11');
    expect(rateToNumber(findConversion(t, 'NYSE:VPER', 'USD')!.rate)).not.toBeCloseTo(0.0999, 10);
  });

  it('has no edges at all before the first quote', () => {
    expect(findConversion(buildRateTable(rates, '2018-01-01'), 'NYSE:VPER', 'USD')).toBeNull();
  });

  it('ignores a zero rate rather than producing an infinite inverse', () => {
    const t = buildRateTable([rate('CHIP', 'USD', 0, 100, '2026-01-01')], '2026-08-11');
    expect(findConversion(t, 'USD', 'CHIP')).toBeNull();
  });
});

describe('findConversion', () => {
  const table = buildRateTable([
    rate('INV:widget', 'USD', 20, 1, '2026-01-01'),
    rate('USD', 'CHIP', 8, 10, '2026-01-05'),
  ], '2026-08-11');

  it('is identity for the same unit, and not an estimate', () => {
    const c = findConversion(table, 'USD', 'USD')!;
    expect(rateToNumber(c.rate)).toBe(1);
  });

  it('converts in the stored direction', () => {
    expect(rateToNumber(findConversion(table, 'INV:widget', 'USD')!.rate)).toBe(20);
  });

  it('converts in the inverse direction without a stored inverse', () => {
    expect(rateToNumber(findConversion(table, 'USD', 'INV:widget')!.rate)).toBeCloseTo(0.05, 10);
  });

  it('traverses intermediate units — widget → USD → CHIP', () => {
    const c = findConversion(table, 'INV:widget', 'CHIP')!;
    expect(rateToNumber(c.rate)).toBeCloseTo(16, 10);
    expect(c.provenance.path).toEqual(['INV:widget', 'USD', 'CHIP']);
  });

  it('reports the STALEST hop as the estimate date', () => {
    // widget/USD is from Jan 1, USD/CHIP from Jan 5 — the chain is only as fresh as Jan 1.
    expect(findConversion(table, 'INV:widget', 'CHIP')!.provenance.asOf).toBe('2026-01-01');
  });

  it('returns null when no path exists — never a zero', () => {
    expect(findConversion(table, 'NYSE:VPER', 'USD')).toBeNull();
  });
});

describe('convertAmount — divisors enter the arithmetic', () => {
  it('converts shares to cents at a sub-cent price', () => {
    // 12,800.0000 shares (stored 128000000 at 1/10000) at $0.0135 = $172.80 = 17280 cents.
    expect(convertAmount(128000000, { num: 135, den: 10000 }, 10000, 100)).toBe(17280);
  });

  it('converts dollars to a unit-divisor-1 commodity', () => {
    // $500.00 at 1 widget = $20 → 25 widgets.
    expect(convertAmount(50000, { num: 1, den: 20 }, 100, 1)).toBe(25);
  });

  it('rounds to the nearest smallest increment', () => {
    // 1 share at $1/3 → 33.33 cents → 33.
    expect(convertAmount(10000, { num: 1, den: 3 }, 10000, 100)).toBe(33);
    // A holding worth less than half a cent rounds to zero — genuinely 0, not "unvalued".
    expect(convertAmount(10000, { num: 5, den: 100000 }, 10000, 100)).toBe(0);
  });

  it('rounds ONCE — no truncation at intermediate hops', () => {
    // widget → USD → CHIP where each hop alone would round badly: 1 widget = $1/3, 1 USD = 1/3 CHIP,
    // so 3000 widgets = 333.33 CHIP. Rounding per hop would give 0 (1/3 → 0 cents at hop one).
    const table = buildRateTable([
      rate('INV:widget', 'USD', 1, 3, '2026-01-01'),
      rate('USD', 'CHIP', 1, 3, '2026-01-01'),
    ], '2026-08-11');
    const c = findConversion(table, 'INV:widget', 'CHIP')!;
    expect(convertAmount(3000, c.rate, 1, 100)).toBe(33333); // 333.33 CHIP
  });
});

describe('convertBalance', () => {
  const table = buildRateTable([rate('NYSE:VPER', 'USD', 135, 10000, '2019-03-04')], '2026-08-11');

  it('treats a same-unit balance as a FACT, not an estimate', () => {
    const b = convertBalance(102500, 'USD', 'USD', table, divisorOf);
    expect(b).toMatchObject({ converted: 102500, isEstimate: false });
    expect(b.provenance).toBeUndefined();
  });

  it('marks a converted balance as an estimate and keeps the native fact', () => {
    // 2,000,000 shares at $0.0135 = $27,000.
    const b = convertBalance(20000000000, 'NYSE:VPER', 'USD', table, divisorOf);
    expect(b.native).toBe(20000000000);
    expect(b.nativeUnit).toBe('NYSE:VPER');
    expect(b.converted).toBe(2700000);
    expect(b.isEstimate).toBe(true);
    expect(b.provenance?.path).toEqual(['NYSE:VPER', 'USD']);
  });

  it('converts a ZERO balance without a rate — zero of anything is zero', () => {
    const b = convertBalance(0, 'CHIP', 'USD', table, divisorOf);
    expect(b.converted).toBe(0);
    expect(b.isEstimate).toBe(false);   // it's a certainty, not an estimate
  });

  it('returns null (not 0) when the unit cannot reach the display unit', () => {
    const b = convertBalance(500, 'CHIP', 'USD', table, divisorOf);
    expect(b.converted).toBeNull();
    expect(b.native).toBe(500);
    // The distinction that matters: an unvalued holding must never be summed as zero.
    expect(b.converted).not.toBe(0);
  });
});

describe('valueReport', () => {
  const acct = (
    id: string, type: NativeAccountBalance['accountType'], balance: number, unit: string,
  ): NativeAccountBalance => ({
    accountId: id, accountName: id, groupId: `g-${type}`, groupName: type, accountType: type, balance, unit,
  });

  // A tiny balanced book: $10,000 cash was spent on 1,000,000 VPER shares, funded by owner equity.
  // Recorded (debit-positive) sums to zero, as every set of books must.
  const book = [
    acct('Cash', 'ASSET', 500000, 'USD'),               //  $5,000
    acct('Shares', 'ASSET', 10000000000, 'NYSE:VPER'),  //  1,000,000 shares, cost $10,000
    acct('Equity', 'EQUITY', -1500000, 'USD'),          // -$15,000 (credit)
  ];

  it('is an identity pass for a single-unit book — no estimates, no gain/loss line', () => {
    const singleUnit = [acct('Cash', 'ASSET', 500000, 'USD'), acct('Equity', 'EQUITY', -500000, 'USD')];
    const v = valueReport(singleUnit, 'USD', [], UNITS, '2026-08-11');
    expect(v.unrecognizedGainLoss).toBe(0);
    expect(v.unvaluedUnits).toEqual([]);
    expect(v.totalsArePartial).toBe(false);
    expect(v.accountBalances.every((a) => a.isEstimate === false)).toBe(true);
    expect(v.totals.assets).toBe(500000);
  });

  it('produces zero gain/loss when the market rate equals cost', () => {
    // Cost was $10,000 for 1,000,000 shares → $0.01/share. Value at exactly that rate.
    const v = valueReport(book, 'USD', [rate('NYSE:VPER', 'USD', 1, 100, '2026-08-01')], UNITS, '2026-08-11');
    expect(v.totals.assets).toBe(1500000);          // $5,000 cash + $10,000 shares
    expect(v.unrecognizedGainLoss).toBe(0);
  });

  it('surfaces appreciation as a positive (credit) Unrecognized Gain/Loss that makes it balance', () => {
    // Shares now $0.0135 → 1,000,000 × 0.0135 = $13,500, up $3,500 from the $10,000 cost.
    const v = valueReport(book, 'USD', [rate('NYSE:VPER', 'USD', 135, 10000, '2026-08-01')], UNITS, '2026-08-11');
    expect(v.totals.assets).toBe(1850000);          // $5,000 + $13,500
    expect(v.unrecognizedGainLoss).toBe(350000);    // +$3,500

    // The whole point of the line: with it, the statement balances.
    const presentedEquity = -v.totals.equity + v.unrecognizedGainLoss;
    expect(presentedEquity).toBe(v.totals.assets - -v.totals.liabilities);
  });

  it('surfaces depreciation as a negative gain/loss', () => {
    // Shares down to $0.005 → $5,000, a $5,000 loss against cost.
    const v = valueReport(book, 'USD', [rate('NYSE:VPER', 'USD', 5, 1000, '2026-08-01')], UNITS, '2026-08-11');
    expect(v.unrecognizedGainLoss).toBe(-500000);
  });

  it('EXCLUDES an unvalued holding from totals and names its unit — never counts it as zero', () => {
    const v = valueReport(book, 'USD', [], UNITS, '2026-08-11');   // no rates at all
    expect(v.totals.assets).toBe(500000);           // cash only; shares excluded, not zeroed
    expect(v.unvaluedUnits).toEqual(['NYSE:VPER']);
    expect(v.totalsArePartial).toBe(true);
    expect(v.accountBalances.find((a) => a.accountId === 'Shares')!.convertedBalance).toBeNull();
    // The native quantity survives as the fact, so the UI can still show the holding.
    expect(v.accountBalances.find((a) => a.accountId === 'Shares')!.balance).toBe(10000000000);
  });

  it('does not flag a ZERO-balance account in an unrateable unit as unvalued', () => {
    const v = valueReport([...book.slice(0, 1), acct('Closed', 'ASSET', 0, 'CHIP')], 'USD', [], UNITS, '2026-08-11');
    expect(v.unvaluedUnits).toEqual([]);
  });

  it('marks group subtotals that contain estimates or gaps', () => {
    const v = valueReport(book, 'USD', [], UNITS, '2026-08-11');
    expect(v.groupBalances.find((g) => g.groupId === 'g-ASSET')).toMatchObject({ hasUnvalued: true });
  });

  it('renders the same book in a different display unit', () => {
    // 1 USD = 0.8 CHIP; shares at $0.01. Cash $5,000 → 4,000 CHIP.
    const v = valueReport(book, 'CHIP', [
      rate('NYSE:VPER', 'USD', 1, 100, '2026-08-01'),
      rate('USD', 'CHIP', 8, 10, '2026-08-01'),
    ], UNITS, '2026-08-11');
    expect(v.totals.assets).toBe(1200000);          // 15,000 USD of assets → 12,000.00 CHIP
    expect(v.accountBalances.find((a) => a.accountId === 'Cash')!.isEstimate).toBe(true);
  });
});

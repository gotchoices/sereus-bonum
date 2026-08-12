// Unit conversion for report rendering — pure, backend-independent (Tier 1, see
// design/specs/web/global/testing.md). Rules: design/specs/domain/units.md.
//
// The one thing to hold onto: a converted figure is an ESTIMATE, and a native balance is a FACT.
// Everything here produces estimates, and every result says so — including when it can't produce one
// at all, which must surface as "unvalued", never as zero.

import type { AccountBalance, AccountType, Exchange, GroupBalance, Unit } from '$lib/data';

/** An exact rational. Rates are never decimals — a $0.0132 share price must round-trip. */
export interface Rate {
  num: number;
  den: number;
}

/** How a conversion was reached, so the UI can show the user what's behind an estimate. */
export interface RateProvenance {
  /** Units traversed, from source to target, e.g. ["NYSE:VPER", "USD", "CHIP"]. */
  path: string[];
  /** The oldest quote used — the estimate is only as fresh as its stalest hop. */
  asOf: string;
  sources: string[];
}

export interface Conversion {
  rate: Rate;
  provenance: RateProvenance;
}

/**
 * Rates indexed for lookup, already filtered to a report date.
 * Built once per report, then queried per account.
 */
export interface RateTable {
  /** Adjacency: unit -> neighbouring unit -> best (most recent) edge at or before the as-of date. */
  edges: Map<string, Map<string, { rate: Rate; date: string; source: string }>>;
}

// -----------------------------------------------------------------------------
// Rational helpers
// -----------------------------------------------------------------------------

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = b; b = a % b; a = t; }
  return a || 1;
}

/** Keep numerator/denominator small so chained multiplication doesn't overflow to Infinity. */
export function reduce(r: Rate): Rate {
  const g = gcd(r.num, r.den);
  const num = r.num / g, den = r.den / g;
  return den < 0 ? { num: -num, den: -den } : { num, den };
}

export function multiplyRates(a: Rate, b: Rate): Rate {
  // Cross-reduce before multiplying — 1e8-denominator quotes chained three deep otherwise overflow
  // the 2^53 integer range and silently lose precision.
  const g1 = gcd(a.num, b.den);
  const g2 = gcd(b.num, a.den);
  return reduce({ num: (a.num / g1) * (b.num / g2), den: (a.den / g2) * (b.den / g1) });
}

export function invertRate(r: Rate): Rate {
  return reduce({ num: r.den, den: r.num });
}

// -----------------------------------------------------------------------------
// Building the table
// -----------------------------------------------------------------------------

/**
 * Index reference rates for a report date.
 *
 * Only quotes at or before `asOf` are eligible: a balance sheet for last December must value holdings
 * at December rates, not today's. For each pair the most recent eligible quote wins, and each edge is
 * added in both directions (the inverse is computed, never stored).
 */
export function buildRateTable(rates: Exchange[], asOf?: string): RateTable {
  const edges = new Map<string, Map<string, { rate: Rate; date: string; source: string }>>();

  const link = (from: string, to: string, rate: Rate, date: string, source: string) => {
    let row = edges.get(from);
    if (!row) { row = new Map(); edges.set(from, row); }
    const existing = row.get(to);
    if (!existing || existing.date <= date) row.set(to, { rate: reduce(rate), date, source });
  };

  for (const r of rates) {
    if (asOf && r.date > asOf) continue;
    if (!r.rateNumerator || !r.rateDenominator) continue;   // a zero rate is not a rate
    const rate: Rate = { num: r.rateNumerator, den: r.rateDenominator };
    link(r.unitA, r.unitB, rate, r.date, r.source);
    link(r.unitB, r.unitA, invertRate(rate), r.date, r.source);
  }

  return { edges };
}

// -----------------------------------------------------------------------------
// Finding a conversion
// -----------------------------------------------------------------------------

/**
 * Find a conversion from `from` to `to`, traversing intermediate units if there's no direct quote
 * (`INV:widget → USD → CHIP`). Breadth-first, so the path with the fewest hops wins — each hop
 * compounds staleness and rounding, so shorter is strictly better.
 *
 * Returns null when no path exists. That is a real answer, not an error: the caller must surface the
 * holding as unvalued rather than count it as zero.
 */
export function findConversion(table: RateTable, from: string, to: string): Conversion | null {
  if (from === to) {
    return { rate: { num: 1, den: 1 }, provenance: { path: [from], asOf: '', sources: [] } };
  }

  const visited = new Set<string>([from]);
  let frontier: Array<{ unit: string; rate: Rate; path: string[]; asOf: string; sources: string[] }> = [
    { unit: from, rate: { num: 1, den: 1 }, path: [from], asOf: '', sources: [] },
  ];

  while (frontier.length > 0) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      const row = table.edges.get(node.unit);
      if (!row) continue;
      for (const [neighbour, edge] of row) {
        if (visited.has(neighbour)) continue;
        const rate = multiplyRates(node.rate, edge.rate);
        const path = [...node.path, neighbour];
        // The estimate is only as fresh as its stalest hop.
        const asOf = !node.asOf || edge.date < node.asOf ? edge.date : node.asOf;
        const sources = node.sources.includes(edge.source) ? node.sources : [...node.sources, edge.source];
        if (neighbour === to) return { rate, provenance: { path, asOf, sources } };
        visited.add(neighbour);
        next.push({ unit: neighbour, rate, path, asOf, sources });
      }
    }
    frontier = next;
  }

  return null;
}

// -----------------------------------------------------------------------------
// Applying a conversion
// -----------------------------------------------------------------------------

/**
 * Convert an integer amount from one unit's smallest increment into another's.
 *
 * A rate is expressed in WHOLE units ("1 VPER = 0.0135 USD"), while amounts are stored in smallest
 * increments (1/10000 share, 1 cent). So the divisors have to enter the arithmetic — converting
 * 12,800.0000 shares (stored 128000000) at 0.0135 gives 17280 cents, not 1728000000.
 *
 * Rounds once, at the end.
 */
export function convertAmount(
  amount: number,
  rate: Rate,
  fromDivisor: number,
  toDivisor: number,
): number {
  const scaled = multiplyRates(rate, { num: toDivisor, den: fromDivisor });
  return Math.round((amount * scaled.num) / scaled.den);
}

/** Rate as a decimal, in whole units — for display and for the implied-rate guard only. */
export function rateToNumber(rate: Rate): number {
  return rate.num / rate.den;
}

// -----------------------------------------------------------------------------
// Report-level conversion
// -----------------------------------------------------------------------------

export interface ConvertedBalance {
  /** The recorded fact: balance in the account's own unit, smallest increment. */
  native: number;
  nativeUnit: string;
  /**
   * The estimate: `native` expressed in the display unit, smallest increment.
   * `null` means NO conversion path existed — the caller must show it as unvalued and exclude it
   * from totals. It must never be coerced to 0.
   */
  converted: number | null;
  /** True when `converted` came from a rate (i.e. it's an estimate, not a fact). */
  isEstimate: boolean;
  provenance?: RateProvenance;
}

/**
 * Value one account balance in the display unit.
 * When the account already holds the display unit, the result is a fact, not an estimate.
 */
export function convertBalance(
  native: number,
  nativeUnit: string,
  displayUnit: string,
  table: RateTable,
  divisorOf: (unit: string) => number,
): ConvertedBalance {
  if (nativeUnit === displayUnit) {
    return { native, nativeUnit, converted: native, isEstimate: false };
  }
  // Zero of anything is zero of everything. No rate is needed and none is an estimate, so a dormant
  // holding with no quote shouldn't be reported as unvaluable.
  if (native === 0) {
    return { native, nativeUnit, converted: 0, isEstimate: false };
  }
  const conversion = findConversion(table, nativeUnit, displayUnit);
  if (!conversion) {
    return { native, nativeUnit, converted: null, isEstimate: false };
  }
  return {
    native,
    nativeUnit,
    converted: convertAmount(native, conversion.rate, divisorOf(nativeUnit), divisorOf(displayUnit)),
    isEstimate: true,
    provenance: conversion.provenance,
  };
}

/** Convenience: a divisor lookup from the unit list, defaulting to 100 for unknown units. */
export function divisorLookup(units: Unit[]): (unit: string) => number {
  const byCode = new Map(units.map((u) => [u.code, u.displayDivisor]));
  return (unit) => byCode.get(unit) ?? 100;
}

// -----------------------------------------------------------------------------
// Valuing a whole report
// -----------------------------------------------------------------------------

/** An account balance as recorded: in the account's own unit. The fact, before any valuation. */
export interface NativeAccountBalance {
  accountId: string;
  accountName: string;
  accountCode?: string;
  groupId: string;
  groupName: string;
  accountType: AccountType;
  /** Signed sum (debit positive), in `unit`'s smallest increment. */
  balance: number;
  unit: string;
  /** The account's own quantity, carried through untouched so reports can show the fact. */
  nativeBalance?: number;
  nativeUnit?: string;
}

export interface ValuedReport {
  accountBalances: AccountBalance[];
  groupBalances: GroupBalance[];
  /** Signed (debit-positive) totals in the display unit, excluding unvalued accounts. */
  totals: { assets: number; liabilities: number; equity: number; income: number; expense: number };
  /**
   * The derived equity plug that makes a converted statement balance, credit-normal (same sign
   * convention as `totalEquity`). Zero when nothing was converted.
   */
  unrecognizedGainLoss: number;
  /** Units held by this entity that couldn't reach the display unit — surfaced, never dropped. */
  unvaluedUnits: string[];
  /** True when at least one account was excluded from the totals for want of a rate. */
  totalsArePartial: boolean;
}

/**
 * Value a set of native account balances in a chosen display unit.
 *
 * Pure, so both backends share one implementation and it's directly testable. For a single-unit
 * entity every account already holds the display unit, so this is an identity pass: nothing is
 * marked as an estimate, `unrecognizedGainLoss` is 0, and totals match the pre-multi-unit behaviour
 * exactly.
 */
export function valueReport(
  accounts: NativeAccountBalance[],
  displayUnit: string,
  rates: Exchange[],
  units: Unit[],
  asOf?: string,
): ValuedReport {
  const table = buildRateTable(rates, asOf);
  const divisorOf = divisorLookup(units);

  const accountBalances: AccountBalance[] = [];
  const groupTotals = new Map<string, GroupBalance>();
  const totals = { assets: 0, liabilities: 0, equity: 0, income: 0, expense: 0 };
  const unvalued = new Set<string>();

  for (const a of accounts) {
    const c = convertBalance(a.balance, a.unit, displayUnit, table, divisorOf);

    accountBalances.push({
      accountId: a.accountId, accountName: a.accountName, accountCode: a.accountCode,
      groupId: a.groupId, groupName: a.groupName, accountType: a.accountType,
      balance: a.balance, unit: a.unit,
      nativeBalance: a.nativeBalance, nativeUnit: a.nativeUnit,
      convertedBalance: c.converted, isEstimate: c.isEstimate,
      rateAsOf: c.provenance?.asOf, ratePath: c.provenance?.path,
    });

    if (!groupTotals.has(a.groupId)) {
      groupTotals.set(a.groupId, {
        groupId: a.groupId, groupName: a.groupName, accountType: a.accountType,
        balance: 0, hasEstimate: false, hasUnvalued: false,
      });
    }
    const group = groupTotals.get(a.groupId)!;

    if (c.converted === null) {
      // No rate path. Excluded from every total and surfaced — NEVER counted as zero, which would
      // silently understate the books.
      if (a.balance !== 0) unvalued.add(a.unit);
      group.hasUnvalued = true;
      continue;
    }

    group.balance += c.converted;
    if (c.isEstimate) group.hasEstimate = true;
    switch (a.accountType) {
      case 'ASSET': totals.assets += c.converted; break;
      case 'LIABILITY': totals.liabilities += c.converted; break;
      case 'EQUITY': totals.equity += c.converted; break;
      case 'INCOME': totals.income += c.converted; break;
      case 'EXPENSE': totals.expense += c.converted; break;
    }
  }

  // Every transaction balances, so the signed sum of all balances is zero as recorded. Once holdings
  // are revalued at report-date rates while the equity that funded them stays at historical cost,
  // it no longer is — and that residual IS the unrecognized gain/loss. Negating converts the
  // debit-positive residual into the credit-normal convention used for equity.
  const residual = totals.assets + totals.liabilities + totals.equity + totals.income + totals.expense;

  return {
    accountBalances,
    groupBalances: [...groupTotals.values()],
    totals,
    unrecognizedGainLoss: residual,
    unvaluedUnits: [...unvalued].sort(),
    totalsArePartial: unvalued.size > 0,
  };
}

// -----------------------------------------------------------------------------
// Transaction balancing
// -----------------------------------------------------------------------------

/**
 * A transaction balances when its entries sum to zero IN ITS RECKONING UNIT.
 *
 *  - `valueUnit` null (the ordinary single-unit transaction) → the amounts themselves sum to zero.
 *  - `valueUnit` set → the VALUES sum to zero. An entry whose account already holds the reckoning
 *    unit carries no `value`, and contributes its `amount`.
 *
 * Summing raw amounts across units is meaningless — 100 shares and −$283 don't cancel as quantities.
 * See design/specs/domain/units.md § Transaction Balancing.
 */
export function assertBalanced(entries: { amount: number; value?: number }[], valueUnit?: string): void {
  const total = entries.reduce((sum, e) => sum + (valueUnit ? (e.value ?? e.amount) : e.amount), 0);
  if (Math.abs(total) > 0.001) {
    throw new Error(`Transaction entries do not balance: ${total}${valueUnit ? ` ${valueUnit}` : ''}`);
  }
}

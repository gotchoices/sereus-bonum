// Tier-1 unit tests for unit-aware formatting (design/specs/domain/units.md § Amounts & Display).

import { describe, it, expect } from 'vitest';
import { formatAmount, formatRate, decimalsFor, unitLookup } from './format';
import type { Unit } from '$lib/data';

const USD: Unit = { code: 'USD', name: 'US Dollar', symbol: '$', unitType: 'FIAT', displayDivisor: 100 };
const JPY: Unit = { code: 'JPY', name: 'Yen', symbol: '¥', unitType: 'FIAT', displayDivisor: 1 };
const VPER: Unit = { code: 'NYSE:VPER', name: 'Viper', symbol: 'VPER', unitType: 'SECURITY', displayDivisor: 10000 };
const CHIP: Unit = { code: 'CHIP', name: 'CHIP', symbol: 'ᶜ', unitType: 'OTHER', displayDivisor: 100 };
const WIDGET: Unit = { code: 'INV:widget', name: 'Widget', symbol: 'widget', unitType: 'INVENTORY', displayDivisor: 1 };
const HOUR: Unit = { code: 'labor-minute', name: 'Labor', symbol: 'h', unitType: 'OTHER', displayDivisor: 60 };

describe('decimalsFor', () => {
  it('derives places from the divisor', () => {
    expect(decimalsFor(100)).toBe(2);
    expect(decimalsFor(10000)).toBe(4);
    expect(decimalsFor(1)).toBe(0);
    expect(decimalsFor(100000000)).toBe(8);
  });

  it('falls back to 2 for non-power-of-ten divisors (60 minutes, 12 eggs)', () => {
    expect(decimalsFor(60)).toBe(2);
    expect(decimalsFor(12)).toBe(2);
  });
});

describe('formatAmount', () => {
  it('formats an ISO currency with its symbol', () => {
    expect(formatAmount(17280, USD)).toBe('$172.80');
  });

  it('respects a divisor of 1 — yen have no cents', () => {
    expect(formatAmount(500, JPY)).toBe('¥500');
  });

  it('formats a security at its own 4-decimal precision', () => {
    // 128000000 at 1/10000 = 12,800 shares. The old /100 path would have said 1,280,000.00.
    expect(formatAmount(128000000, VPER)).toBe('12,800.0000 VPER');
  });

  it('does NOT hand a namespaced code to Intl as a currency', () => {
    // `Intl.NumberFormat({ style:'currency', currency:'NYSE:VPER' })` throws — this must not.
    expect(() => formatAmount(1, VPER)).not.toThrow();
  });

  it('formats a non-ISO currency-like unit with its symbol, not as a currency', () => {
    expect(formatAmount(50000, CHIP)).toBe('500.00 ᶜ');
  });

  it('formats whole-number inventory', () => {
    expect(formatAmount(10, WIDGET)).toBe('10 widget');
  });

  it('handles a non-decimal divisor', () => {
    expect(formatAmount(150, HOUR)).toBe('2.50 h');   // 150 minutes = 2.5 hours
  });

  it('normalises negative zero', () => {
    expect(formatAmount(-0, USD)).toBe('$0.00');
  });

  it('can omit the unit label', () => {
    expect(formatAmount(128000000, VPER, { withUnit: false })).toBe('12,800.0000');
  });

  it('defaults to a 100-divisor dollar when the unit is unknown', () => {
    expect(formatAmount(17280, undefined)).toBe('$172.80');
  });
});

describe('formatRate', () => {
  it('keeps sub-cent share prices legible', () => {
    // At 2 decimals this would read "$0.01" and hide the real price.
    expect(formatRate(0.0135, VPER, USD)).toBe('1 VPER = $0.0135');
  });

  it('widens further for very small rates', () => {
    expect(formatRate(0.000025, VPER, USD)).toBe('1 VPER = $0.000025');
  });

  it('uses fewer places for ordinary magnitudes', () => {
    expect(formatRate(20, WIDGET, USD)).toBe('1 widget = $20.00');
  });

  it('formats a non-currency target unit', () => {
    expect(formatRate(0.8, USD, CHIP)).toBe('1 $ = 0.8000 ᶜ');
  });
});

describe('unitLookup', () => {
  it('resolves by code and misses cleanly', () => {
    const at = unitLookup([USD, VPER]);
    expect(at('NYSE:VPER')).toBe(VPER);
    expect(at('NASDAQ:VPER')).toBeUndefined();
  });
});

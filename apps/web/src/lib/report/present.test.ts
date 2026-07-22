import { describe, it, expect } from 'vitest';
import { presentBalance, varianceOf, formatVariance } from './present';

// A deterministic currency stub (cents → "$x.xx") so formatVariance stays locale/DOM-independent.
const fmt = (amount: number) => `$${(amount / 100).toFixed(2)}`;

describe('presentBalance', () => {
  it('passes debit-normal types straight through', () => {
    expect(presentBalance(500, 'ASSET')).toBe(500);
    expect(presentBalance(500, 'EXPENSE')).toBe(500);
    expect(presentBalance(-200, 'ASSET')).toBe(-200);
  });
  it('negates credit-normal types so a normal credit reads positive', () => {
    expect(presentBalance(500, 'LIABILITY')).toBe(-500);
    expect(presentBalance(-500, 'LIABILITY')).toBe(500);
    expect(presentBalance(-300, 'EQUITY')).toBe(300);
    expect(presentBalance(-300, 'INCOME')).toBe(300);
  });
});

describe('varianceOf', () => {
  it('computes Δ$ and Δ%', () => {
    expect(varianceOf(100, 150)).toEqual({ d: 50, p: 50 });
    expect(varianceOf(200, 100)).toEqual({ d: -100, p: -50 });
  });
  it('uses |older| as the % base so a negative base still reads correctly', () => {
    expect(varianceOf(-100, -50)).toEqual({ d: 50, p: 50 });
  });
  it('returns p=null when the older value is 0', () => {
    expect(varianceOf(0, 50)).toEqual({ d: 50, p: null });
  });
});

describe('formatVariance', () => {
  it('formats dollar / percent / both', () => {
    expect(formatVariance(10000, 15000, 'USD', 'dollar', fmt)).toBe('+$50.00');
    expect(formatVariance(10000, 15000, 'USD', 'percent', fmt)).toBe('+50.0%');
    expect(formatVariance(10000, 15000, 'USD', 'both', fmt)).toBe('+$50.00  +50.0%');
  });
  it('uses a U+2212 minus for negatives', () => {
    expect(formatVariance(15000, 10000, 'USD', 'dollar', fmt)).toBe('−$50.00');
    expect(formatVariance(15000, 10000, 'USD', 'percent', fmt)).toBe('−33.3%');
  });
  it('shows — for percent when the older value is 0', () => {
    expect(formatVariance(0, 5000, 'USD', 'percent', fmt)).toBe('—');
    expect(formatVariance(0, 5000, 'USD', 'dollar', fmt)).toBe('+$50.00');
  });
});

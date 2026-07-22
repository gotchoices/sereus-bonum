import { describe, it, expect } from 'vitest';
import {
  resolveTokenDate,
  resolveColumnChain,
  migrateField,
  endTokens,
  startTokens,
  isoOf,
} from './dates';

// A pinned "today" so relative-date assertions don't drift (see testing.md, Tier 1). Run under TZ=UTC
// (the test:unit script sets it) so isoOf() is stable regardless of the host timezone.
const REF = new Date(2026, 4, 15); // 2026-05-15, mid-Q2 (Apr–Jun)

describe('resolveTokenDate', () => {
  const cases: [string, Date][] = [
    ['today', REF],
    ['cm-start', new Date(2026, 4, 1)],
    ['cm-end', new Date(2026, 4, 31)],
    ['pm-start', new Date(2026, 3, 1)],
    ['pm-end', new Date(2026, 3, 30)],
    ['cq-start', new Date(2026, 3, 1)],
    ['cq-end', new Date(2026, 5, 30)],
    ['pq-start', new Date(2026, 0, 1)],
    ['pq-end', new Date(2026, 2, 31)],
    ['cy-start', new Date(2026, 0, 1)],
    ['cy-end', new Date(2026, 11, 31)],
    ['py-start', new Date(2025, 0, 1)],
    ['py-end', new Date(2025, 11, 31)],
  ];
  it.each(cases)('%s resolves correctly', (token, expected) => {
    expect(resolveTokenDate(token, REF)).toEqual(expected);
  });

  it('falls back to ref for an unknown token', () => {
    expect(resolveTokenDate('bogus', REF)).toEqual(REF);
  });
});

describe('resolveColumnChain', () => {
  const fixed = (d: string) => ({ endField: { basis: 'fixed', fixedDate: d } });
  const token = (b: string) => ({ endField: { basis: b, fixedDate: '' } });

  it('resolves a single relative column against today', () => {
    expect(resolveColumnChain([token('cy-end')], REF)).toEqual([{ end: '2026-12-31', start: undefined }]);
  });

  it('chains "previous year" leftward off a fixed anchor (descending sequence)', () => {
    const cols = [token('py-end'), token('py-end'), fixed('2026-12-31')];
    expect(resolveColumnChain(cols, REF)).toEqual([
      { end: '2024-12-31', start: undefined },
      { end: '2025-12-31', start: undefined },
      { end: '2026-12-31', start: undefined },
    ]);
  });

  it('chains relative columns off the rightmost-vs-today column', () => {
    const cols = [token('py-end'), token('cy-end')];
    expect(resolveColumnChain(cols, REF)).toEqual([
      { end: '2025-12-31', start: undefined },
      { end: '2026-12-31', start: undefined },
    ]);
  });

  it('resolves start+end for a period (income-statement) column', () => {
    const cols = [{ endField: { basis: 'today', fixedDate: '' }, startField: { basis: 'cy-start', fixedDate: '' } }];
    expect(resolveColumnChain(cols, REF)).toEqual([{ end: '2026-05-15', start: '2026-01-01' }]);
  });
});

describe('migrateField', () => {
  it('maps legacy tokens to the current vocabulary', () => {
    expect(migrateField({ basis: 'eoy', fixedDate: 'x' })).toEqual({ basis: 'cy-end', fixedDate: 'x' });
    expect(migrateField({ basis: 'soly', fixedDate: 'x' })).toEqual({ basis: 'py-start', fixedDate: 'x' });
  });
  it('leaves fixed and already-current bases untouched', () => {
    expect(migrateField({ basis: 'fixed', fixedDate: '2026-01-01' })).toEqual({ basis: 'fixed', fixedDate: '2026-01-01' });
    expect(migrateField({ basis: 'cy-end', fixedDate: '' })).toEqual({ basis: 'cy-end', fixedDate: '' });
  });
});

describe('token option lists', () => {
  it('offers current+previous on the rightmost column, previous-only elsewhere', () => {
    expect(endTokens(true)).toContain('today');
    expect(endTokens(true)).toContain('cy-end');
    expect(endTokens(false)).not.toContain('today');
    expect(endTokens(false)).not.toContain('cy-end');
    expect(endTokens(false).every((t) => t.startsWith('p'))).toBe(true);
    expect(startTokens(false).every((t) => t.startsWith('p'))).toBe(true);
  });
});

describe('isoOf', () => {
  it('formats a date as YYYY-MM-DD (UTC)', () => {
    expect(isoOf(new Date(Date.UTC(2026, 11, 31)))).toBe('2026-12-31');
  });
});

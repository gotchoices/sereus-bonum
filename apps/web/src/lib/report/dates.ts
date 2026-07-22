// Pure date logic for the Accounts-View report columns. Extracted from the report screen so the
// tricky chained-relative-date resolution can be unit-tested with a pinned "today" (see
// design/specs/web/global/testing.md, Tier 1). No component/store/runtime coupling.
import type { DateFieldValue } from '$lib/stores/savedReports';

export const isoOf = (d: Date): string => d.toISOString().split('T')[0];

export const parseISO = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

// Resolve a relative token against a reference date. Tokens: {c|p}{m|q|y}-{start|end}
// (current/previous month/quarter/year) plus 'today'. Unknown tokens fall back to `ref`.
export function resolveTokenDate(token: string, ref: Date): Date {
  const y = ref.getFullYear(), m = ref.getMonth(), q = Math.floor(m / 3) * 3;
  switch (token) {
    case 'today': return ref;
    case 'cm-start': return new Date(y, m, 1);       case 'cm-end': return new Date(y, m + 1, 0);
    case 'pm-start': return new Date(y, m - 1, 1);   case 'pm-end': return new Date(y, m, 0);
    case 'cq-start': return new Date(y, q, 1);       case 'cq-end': return new Date(y, q + 3, 0);
    case 'pq-start': return new Date(y, q - 3, 1);   case 'pq-end': return new Date(y, q, 0);
    case 'cy-start': return new Date(y, 0, 1);       case 'cy-end': return new Date(y, 11, 31);
    case 'py-start': return new Date(y - 1, 0, 1);   case 'py-end': return new Date(y - 1, 11, 31);
    default: return ref;
  }
}

// Token option lists by field role (end = as-of/to, start = from) and column position. Non-rightmost
// columns get only "previous" tokens (they chain off the column to their right).
export const endTokens = (rightmost: boolean): string[] =>
  rightmost ? ['today', 'cm-end', 'cq-end', 'cy-end', 'pm-end', 'pq-end', 'py-end'] : ['pm-end', 'pq-end', 'py-end'];

export const startTokens = (rightmost: boolean): string[] =>
  rightmost ? ['cm-start', 'cq-start', 'cy-start', 'pm-start', 'pq-start', 'py-start'] : ['pm-start', 'pq-start', 'py-start'];

// Migrate the previous token names (single-column era) → the current vocabulary.
export const TOKEN_MIGRATE: Record<string, string> = {
  som: 'cm-start', eom: 'cm-end', soq: 'cq-start', eoq: 'cq-end',
  soy: 'cy-start', eoy: 'cy-end', soly: 'py-start', eoly: 'py-end',
};

export const migrateField = (f: DateFieldValue): DateFieldValue =>
  f && f.basis !== 'fixed' && TOKEN_MIGRATE[f.basis] ? { ...f, basis: TOKEN_MIGRATE[f.basis] } : f;

export interface ChainColumn {
  endField: DateFieldValue;
  startField?: DateFieldValue;
}

// Chained resolution: the rightmost column resolves against `today`; each column to its left resolves
// against its right neighbour's resolved END date. Returns index-aligned { end, start? } ISO strings.
// A fixed-date column anchors the columns to its left. This is what makes "End previous year" on each
// left column produce a descending sequence (…2024, 2025, today).
export function resolveColumnChain(columns: ChainColumn[], today: Date): { end: string; start?: string }[] {
  const res: { end: string; start?: string }[] = columns.map(() => ({ end: '' }));
  let ref = today;
  for (let i = columns.length - 1; i >= 0; i--) {
    const c = columns[i];
    const end = c.endField.basis === 'fixed' ? c.endField.fixedDate : isoOf(resolveTokenDate(c.endField.basis, ref));
    const start = c.startField
      ? (c.startField.basis === 'fixed' ? c.startField.fixedDate : isoOf(resolveTokenDate(c.startField.basis, ref)))
      : undefined;
    res[i] = { end, start };
    ref = parseISO(end);
  }
  return res;
}

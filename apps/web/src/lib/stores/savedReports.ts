/**
 * Saved Reports — named Accounts-View configurations, persisted to localStorage (shared across entities).
 * See design/specs/web/screens/saved-reports-ux.md.
 *
 * Dates are stored as DateFieldValue (a basis + a fixed date), NOT resolved ISO strings — so a report
 * saved with a relative basis ("End of this year") auto-adjusts every time it's loaded. See the date
 * abstraction in accounts-view.md.
 */

import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type ReportMode = 'balance_sheet' | 'trial_balance' | 'income_statement' | 'cash_flow' | 'custom';

/**
 * A date field's value: a `basis` that is either `'fixed'` (use `fixedDate`) or a relative token
 * (`today`, `eom`, `eoy`, `eoly`, …) resolved against the current date at load/render time.
 */
export interface DateFieldValue {
  basis: string;      // 'fixed' | relative token
  fixedDate: string;  // ISO date, meaningful when basis === 'fixed' (also the last resolved value)
}

export interface SavedColumn {
  name: string;
  endField: DateFieldValue;
  startField?: DateFieldValue;   // only for period modes (income statement / cash flow)
}

export interface SavedReport {
  id: string;
  name: string;
  mode: ReportMode;
  columns: SavedColumn[];        // one per report column (multi-period comparison)
  hideZeroBalance: boolean;
  showClosedAccounts: boolean;
  createdAt: string;
  lastUsedAt: string;
}

const KEY = 'bonum-saved-reports';

function load(): SavedReport[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedReport[]) : [];
  } catch {
    return [];
  }
}

export const savedReports = writable<SavedReport[]>(load());

if (browser) {
  savedReports.subscribe((list) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('[SavedReports] persist failed', e);
    }
  });
}

/** Insert or overwrite by name (case-insensitive), preserving id/createdAt of an existing same-name report. */
export function upsertReport(report: SavedReport): void {
  savedReports.update((list) => {
    const i = list.findIndex((r) => r.name.toLowerCase() === report.name.toLowerCase());
    if (i >= 0) {
      const copy = [...list];
      copy[i] = { ...report, id: list[i].id, createdAt: list[i].createdAt };
      return copy;
    }
    return [...list, report];
  });
}

export function deleteReport(id: string): void {
  savedReports.update((list) => list.filter((r) => r.id !== id));
}

export function touchReport(id: string, now: string): void {
  savedReports.update((list) => list.map((r) => (r.id === id ? { ...r, lastUsedAt: now } : r)));
}

// Dev/test-only probe. Exposes the DataService seam + a raw-SQL path on `window.__bonum` so the perf
// harness (perf/run.mjs) and E2E seeding can drive real queries and load fixtures WITHOUT walking the
// UI — measuring the query, not the render. See design/specs/web/global/testing.md.
//
// No-op unless running under `vite dev` (import.meta.env.DEV), so nothing is exposed in a prod build.
import { browser } from '$app/environment';
import { BACKEND, USE_QUEREUS } from '$lib/config';
import { getDataService, resetDataService } from '$lib/data';
import { importNativeBooks } from '$lib/import/native';
import type { BonumBooksFile } from '$lib/import/native';

export interface BonumProbe {
  backend: string;
  useQuereus: boolean;
  getDataService: typeof getDataService;
  resetDataService: typeof resetDataService;
  /** Restore a native books file into a fresh entity; returns the new entity id. Doubles as the write benchmark. */
  importNativeBooks: (file: BonumBooksFile) => Promise<string>;
  /** Raw SQL — quereus backends only (the store is where JOIN cost lives). Lazily imports the quereus db module. */
  rawQuery: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  /** Reset the query-economy counters (quereus backends only). Call before a measured DataService op. */
  resetQueryStats: () => Promise<void>;
  /** Read the query-economy counters since the last reset (quereus backends only). */
  getQueryStats: () => Promise<{ queries: number; rows: number }>;
}

export function installProbe(): void {
  if (!browser || !import.meta.env.DEV) return;
  const probe: BonumProbe = {
    backend: BACKEND,
    useQuereus: USE_QUEREUS,
    getDataService,
    resetDataService,
    importNativeBooks,
    rawQuery: async (sql, params = []) => {
      if (!USE_QUEREUS) throw new Error('rawQuery: quereus backends only');
      const db = await import('$lib/data/production/db');
      const conn = await db.getQuereusDb();
      return db.all(conn, sql, params as never);
    },
    resetQueryStats: async () => {
      if (!USE_QUEREUS) throw new Error('resetQueryStats: quereus backends only');
      (await import('$lib/data/production/db')).resetQueryStats();
    },
    getQueryStats: async () => {
      if (!USE_QUEREUS) throw new Error('getQueryStats: quereus backends only');
      return (await import('$lib/data/production/db')).getQueryStats();
    },
  };
  (window as unknown as { __bonum: BonumProbe }).__bonum = probe;
}

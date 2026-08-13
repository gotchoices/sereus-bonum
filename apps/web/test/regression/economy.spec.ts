// Part-C regression: correctness + query economy on the REAL quereus-local (IndexedDB) backend.
// See design/specs/web/global/testing.md (Part C) and docs/quereus-workarounds.md.
import { test, expect } from '@playwright/test';
import { waitForProbe, seedBooks } from '../support/harness';

// Minimal in-page probe typings (window.__bonum is installed only under `vite dev`). NOTE: this type is
// used ONLY for the `window` cast inside page.evaluate — the callbacks run in the browser, so nothing from
// Node module scope (helpers, closures) is available there.
type Probe = {
  getDataService: () => Promise<{
    getBalanceSheet: (entityId: string, endDate?: string, startDate?: string) => Promise<{
      totalAssets: number; totalLiabilities: number; totalEquity: number; totalIncome: number; totalExpense: number;
    }>;
    getLedgerEntries: (accountId: string, opts?: { sortOrder?: 'oldest' | 'newest' }) => Promise<Array<{ runningBalance: number }>>;
  }>;
  rawQuery: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  resetQueryStats: () => Promise<void>;
  getQueryStats: () => Promise<{ queries: number; rows: number }>;
};
type Win = { __bonum: Probe };

test.describe('quereus-local regression', () => {
  test('balance sheet balances and account balance == ledger sum (real IndexedDB)', async ({ page }) => {
    await waitForProbe(page);
    const eid = await seedBooks(page, 'books-100.json');

    const r = await page.evaluate(async (entityId) => {
      const api = (window as unknown as Win).__bonum;
      const ds = await api.getDataService();

      const bs = await ds.getBalanceSheet(entityId);
      // Presented (credit-normal) balance-sheet identity: Assets − (Liab + Equity + Income − Expense) ≈ 0.
      const identity = bs.totalAssets - (bs.totalLiabilities + bs.totalEquity + bs.totalIncome - bs.totalExpense);

      // The busiest account's running ledger balance must equal a raw SUM of its entries.
      const busiest = (await api.rawQuery(
        `select account_id, count(*) c from entry where entity_id = ? group by account_id order by c desc limit 1`,
        [entityId],
      ))[0] as { account_id: string };
      const led = await ds.getLedgerEntries(busiest.account_id, { sortOrder: 'oldest' });
      const running = led.length ? led[led.length - 1].runningBalance : 0;
      const rawSum = Number((await api.rawQuery(
        `select sum(amount) s from entry where account_id = ?`, [busiest.account_id],
      ))[0].s);

      return { identity, running, rawSum };
    }, eid);

    expect(Math.abs(r.identity), 'balance sheet identity').toBeLessThan(1);
    expect(Math.abs(r.running - r.rawSum), 'ledger running balance == raw SUM').toBeLessThan(1);
  });

  test('getLedgerEntries query count is independent of ledger size', async ({ page }) => {
    await waitForProbe(page);

    // Measure how many SQL queries getLedgerEntries issues, for a small and a 10× larger book. A per-row
    // query sneaking back in would make this scale with rows; the guard is that the count is IDENTICAL.
    const countFor = async (fixtureName: string): Promise<number> => {
      const eid = await seedBooks(page, fixtureName);
      return page.evaluate(async (entityId) => {
        const api = (window as unknown as Win).__bonum;
        const ds = await api.getDataService();
        const busiest = (await api.rawQuery(
          `select account_id, count(*) c from entry where entity_id = ? group by account_id order by c desc limit 1`,
          [entityId],
        ))[0] as { account_id: string };
        await api.resetQueryStats();
        await ds.getLedgerEntries(busiest.account_id, { sortOrder: 'newest' });
        return (await api.getQueryStats()).queries;
      }, eid);
    };

    const small = await countFor('books-100.json'); // ~200 entries
    const large = await countFor('books-1000.json'); // ~2000 entries

    expect(large, 'query count must not scale with ledger size').toBe(small);
    expect(small, 'ledger read should be a small constant number of queries').toBeLessThanOrEqual(10);
  });
});

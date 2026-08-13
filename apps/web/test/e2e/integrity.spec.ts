import { test, expect } from '@playwright/test';
import { seedEntity } from './helpers';

// Programmatic data-integrity guard (via the probe) — the same invariants the perf harness asserts, but
// as a fast pass/fail on the mock backend: the balance-sheet identity holds and every account's balance
// equals the sum of its ledger entries.
test('data integrity: balance sheet balances and account balance == ledger sum', async ({ page }) => {
  const id = await seedEntity(page);
  const res = await page.evaluate(async (entityId) => {
    const api = (window as unknown as {
      __bonum: {
        getDataService: () => Promise<{
          getBalanceSheet: (e: string, end: string) => Promise<{ totalAssets: number; totalLiabilities: number; totalEquity: number; totalIncome: number; totalExpense: number }>;
          getAccounts: (e: string) => Promise<{ id: string }[]>;
          getLedgerEntries: (a: string) => Promise<{ amount: number }[]>;
          getAccountBalance: (a: string) => Promise<number>;
        }>;
      };
    }).__bonum;
    const ds = await api.getDataService();
    const bs = await ds.getBalanceSheet(entityId, '2035-12-31');
    const identity = bs.totalAssets - (bs.totalLiabilities + bs.totalEquity + bs.totalIncome - bs.totalExpense);
    const accounts = await ds.getAccounts(entityId);
    let worstDiff = 0;
    let totalEntries = 0;
    let totalAbs = 0;
    for (const a of accounts) {
      const led = await ds.getLedgerEntries(a.id);
      const sum = led.reduce((s, e) => s + e.amount, 0);
      const bal = await ds.getAccountBalance(a.id);
      worstDiff = Math.max(worstDiff, Math.abs(bal - sum));
      totalEntries += led.length;
      totalAbs += Math.abs(bal);
    }
    return { identity, worstDiff, accounts: accounts.length, totalEntries, totalAbs };
  }, id);

  expect(res.accounts).toBeGreaterThan(0);
  expect(res.totalEntries).toBeGreaterThan(0); // guard: not a trivially-empty entity
  expect(res.totalAbs).toBeGreaterThan(0);
  expect(Math.abs(res.identity)).toBeLessThan(1);
  expect(res.worstDiff).toBeLessThan(1);
});

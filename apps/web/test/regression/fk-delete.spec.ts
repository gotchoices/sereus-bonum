// Part-C write-side tripwire: W7 (docs/quereus-workarounds.md). deleteEntity disables FK enforcement for its
// manual child→parent cascade because the store's RESTRICT check costs ~35ms per deleted parent row even when
// it matches nothing. This measures that per-row check cost — FK-on vs FK-off — for childless txn deletes,
// bounded to N rows so an on-FK run stays ~1s. When the check is no longer materially slower, leave FK on.
import { test, expect } from '@playwright/test';
import { waitForProbe, seedBooks } from '../support/harness';

type Probe = {
  rawQuery: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  run: (sql: string, params?: unknown[]) => Promise<void>;
};
type Win = { __bonum: Probe };

test.describe('quereus-local workaround tripwires (write)', () => {
  test('W7: disabling FK enforcement for cascade deletes still beats leaving it on', async ({ page }) => {
    await waitForProbe(page);
    const eid = await seedBooks(page, 'books-100.json');

    const r = await page.evaluate(async (entityId) => {
      const api = (window as unknown as Win).__bonum;
      const now = () => performance.now();
      const N = 30; // childless txns deleted per FK mode

      const txns = (await api.rawQuery(`select id from txn where entity_id = ?`, [entityId])).map((t) => t.id as string);
      const onSet = txns.slice(0, N);
      const offSet = txns.slice(N, 2 * N);

      // Make these txns childless first (delete their entries) with FK off — mirrors deleteEntity's cascade
      // order, and isolates the measurement to the parent-row RESTRICT check that W7 is about.
      await api.run('PRAGMA foreign_keys = 0');
      for (const id of [...onSet, ...offSet]) await api.run('DELETE FROM entry WHERE txn_id = ?', [id]);

      // FK ON: each childless-txn delete still pays the RESTRICT check (matches nothing) — the cost W7 dodges.
      await api.run('PRAGMA foreign_keys = 1');
      let t = now();
      for (const id of onSet) await api.run('DELETE FROM txn WHERE id = ?', [id]);
      const fkOnPerRow = (now() - t) / N;

      // FK OFF: no check.
      await api.run('PRAGMA foreign_keys = 0');
      t = now();
      for (const id of offSet) await api.run('DELETE FROM txn WHERE id = ?', [id]);
      const fkOffPerRow = (now() - t) / N;
      await api.run('PRAGMA foreign_keys = 1');

      const round = (x: number) => Math.round(x * 100) / 100;
      return { fkOnPerRow: round(fkOnPerRow), fkOffPerRow: round(fkOffPerRow), n: N };
    }, eid);

    console.log(`  [W7] FK-on delete ${r.fkOnPerRow}ms/row  vs  FK-off ${r.fkOffPerRow}ms/row  (n=${r.n})`);
    expect(
      r.fkOffPerRow,
      `W7 tripwire: FK-on delete (${r.fkOnPerRow}ms/row) is no longer materially slower than FK-off ` +
      `(${r.fkOffPerRow}ms/row) — the store may batch FK checks now; consider leaving enforcement on for ` +
      `cascade deletes (quereus-workarounds.md W7).`,
    ).toBeLessThan(r.fkOnPerRow);
  });
});

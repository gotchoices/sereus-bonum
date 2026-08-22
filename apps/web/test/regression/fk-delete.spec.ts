// Part-C write-side tripwire: W7 (docs/quereus-workarounds.md). W7 was REVERTED on 4.16 — deleteEntity now
// runs its child→parent cascade with FK enforcement ON. The store's RESTRICT probe dropped from ~35ms/row
// (a 1k-txn entity took ~49s) to ~2ms/row, on par with FK-off against the full cascade, so keeping the
// referential safety net is worth it. This guards the reverted path: the real FK-on entity-delete cascade
// must stay cheap per row. If it climbs back toward the old per-row cost, that's the signal to reconsider
// disabling FK for bulk cascades again.
import { test, expect } from '@playwright/test';
import { waitForProbe, seedBooks } from '../support/harness';

type Probe = {
  rawQuery: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  getDataService: () => Promise<{ deleteEntity: (id: string) => Promise<void> }>;
};
type Win = { __bonum: Probe };

test.describe('quereus-local workaround tripwires (write)', () => {
  test('W7 reverted: FK-on entity-delete cascade stays cheap per row', async ({ page }) => {
    await waitForProbe(page);
    const eid = await seedBooks(page, 'books-100.json');

    const r = await page.evaluate(async (entityId) => {
      const api = (window as unknown as Win).__bonum;
      const now = () => performance.now();
      const count = async (sql: string) => Number((await api.rawQuery(sql, [entityId]))[0].c);
      const rows = await count(`select count(*) c from entry where entity_id = ?`)
        + await count(`select count(*) c from txn where entity_id = ?`)
        + await count(`select count(*) c from account where entity_id = ?`);

      const ds = await api.getDataService();
      const t = now();
      await ds.deleteEntity(entityId); // the real cascade, now with FK enforcement ON
      const perRow = (now() - t) / rows;

      const left = await count(`select count(*) c from entry where entity_id = ?`)
        + await count(`select count(*) c from txn where entity_id = ?`);
      return { rows, perRow: Math.round(perRow * 100) / 100, left };
    }, eid);

    console.log(`  [W7] FK-on cascade delete ${r.perRow}ms/row over ${r.rows} rows (left ${r.left})`);
    expect(r.left, 'entity delete left rows behind (cascade or FK order is wrong)').toBe(0);
    // Guard: the reverted FK-on cascade must stay far below the ~35ms/row era that justified disabling FK.
    // ~1.5ms/row measured on 4.16; 10ms/row is a drift-tolerant ceiling that still catches a real regression.
    expect(
      r.perRow,
      `W7 revert guard: FK-on cascade delete is ${r.perRow}ms/row (was ~1.5ms/row on 4.16). If this climbs ` +
      `back toward the old ~35ms/row, reconsider disabling FK for bulk cascades (quereus-workarounds.md W7).`,
    ).toBeLessThan(10);
  });
});

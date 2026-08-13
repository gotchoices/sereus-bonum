// Part-C workaround tripwires (docs/quereus-workarounds.md). Measures, IN THE SAME RUN, the "workaround"
// path and the "naive" path we'd prefer, and asserts the workaround still wins. A same-run ratio cancels
// machine drift. When Quereus improves enough that the naive path wins, the tripwire FAILS — and that
// failure is the signal to go delete the workaround (read the message, don't just re-green it).
//
// One test seeds one fixture (quereus-local bulk import is the slow part), then runs every comparison
// against it — so add tripwires here as extra measurements, not extra seeds.
import { test, expect } from '@playwright/test';
import { waitForProbe, seedBooks, fixtureExists } from '../support/harness';

const FIXTURE = 'books-10000.json'; // reproducible via `node apps/web/scripts/gen-books.mjs`

type Probe = { rawQuery: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]> };
type Win = { __bonum: Probe };

test.describe('quereus-local workaround tripwires', () => {
  test.skip(!fixtureExists(FIXTURE), `${FIXTURE} missing — run: node apps/web/scripts/gen-books.mjs`);

  test('workarounds still beat their naive paths (W1 join, W4 MV read)', async ({ page }) => {
    await waitForProbe(page);
    const eid = await seedBooks(page, FIXTURE);

    const r = await page.evaluate(async (entityId) => {
      const api = (window as unknown as Win).__bonum;
      const now = () => performance.now();
      const med = async (fn: () => Promise<unknown>, n = 2) => {
        await fn(); const ts: number[] = [];
        for (let i = 0; i < n; i++) { const s = now(); await fn(); ts.push(now() - s); }
        return ts.sort((a, b) => a - b)[Math.floor(n / 2)];
      };

      // W1 — full-scan entry + JS group  vs  entry⋈txn SQL grouped join.
      const w1_js = await med(async () => {
        const bal = new Map<string, number>();
        for (const e of await api.rawQuery(`select account_id, amount, entity_id from entry`)) {
          if (e.entity_id === entityId) bal.set(e.account_id as string, (bal.get(e.account_id as string) ?? 0) + Number(e.amount));
        }
        return bal;
      });
      const w1_sql = await med(() => api.rawQuery(
        `select e.account_id, sum(e.amount) b from entry e join txn t on t.id = e.txn_id where t.entity_id = ? group by e.account_id`,
        [entityId],
      ));

      // W4 — full-scan the monthly MV + JS filter  vs  the entity_id/period index-seek.
      const period = '2026-01';
      const w4_scan = await med(async () => {
        const bal = new Map<string, number>();
        for (const row of await api.rawQuery(`select account_id, period, balance, entity_id from account_balance_monthly`)) {
          if (row.entity_id === entityId && (row.period as string) < period) bal.set(row.account_id as string, 0);
        }
        return bal;
      });
      const w4_seek = await med(() => api.rawQuery(
        `select account_id, sum(balance) b from account_balance_monthly where entity_id = ? and period < ? group by account_id`,
        [entityId, period],
      ));

      const mvRows = Number((await api.rawQuery(
        `select count(*) c from account_balance_monthly where entity_id = ?`, [entityId]))[0].c);

      return {
        mvRows,
        w1_js: Math.round(w1_js), w1_sql: Math.round(w1_sql),
        w4_scan: Math.round(w4_scan), w4_seek: Math.round(w4_seek),
      };
    }, eid);

    console.log(`  [W1] full-scan+JS ${r.w1_js}ms  vs  SQL join ${r.w1_sql}ms`);
    console.log(`  [W4] MV full-scan ${r.w4_scan}ms  vs  index-seek ${r.w4_seek}ms  (MV ${r.mvRows} rows)`);

    // W1 — robust at any scale: the join-key push-down gap makes the SQL join scale with total entries.
    expect(
      r.w1_js,
      `W1 tripwire: SQL JOIN (${r.w1_sql}ms) ≤ full-scan+JS (${r.w1_js}ms) — join keys may be pushed to the ` +
      `store now; re-test and consider moving joins back into SQL (quereus-workarounds.md W1).`,
    ).toBeLessThan(r.w1_sql);

    // W4 — SCALE-gated. The seek's per-row cursor cost only dominates a large MV (accounts × months); below
    // ~4k MV rows the seek is fine (often faster), so the full-scan workaround isn't even justified there.
    // gen-books fixtures are narrow (9 accounts) → the MV stays small → this is informational until a
    // wide-account fixture pushes the MV over the threshold, at which point it becomes a live tripwire.
    const W4_MIN_MV_ROWS = 4000;
    if (r.mvRows >= W4_MIN_MV_ROWS) {
      expect(
        r.w4_scan,
        `W4 tripwire: index-seek (${r.w4_seek}ms) ≤ MV full-scan (${r.w4_scan}ms) at ${r.mvRows} MV rows — the ` +
        `seek may be getAll-batched now; consider deleting the full-scan workaround (quereus-workarounds.md W4).`,
      ).toBeLessThan(r.w4_seek);
    } else {
      console.log(`  [W4] not asserted — MV only ${r.mvRows} rows (< ${W4_MIN_MV_ROWS}); the workaround is a ` +
        `large-MV optimization. Use a wide-account fixture to activate this tripwire.`);
    }
  });
});

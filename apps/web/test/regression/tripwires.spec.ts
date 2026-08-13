// Part-C workaround tripwires (docs/quereus-workarounds.md). Measures, IN THE SAME RUN, the "workaround"
// path and the "naive" path we'd prefer, and asserts the workaround still wins. A same-run ratio cancels
// machine drift. When Quereus improves enough that the naive path wins, the tripwire FAILS — and that
// failure is the signal to go delete the workaround (read the message, don't just re-green it).
//
// One test seeds one fixture (quereus-local bulk import is the slow part), then runs every comparison
// against it — so add tripwires here as extra measurements, not extra seeds.
import { test, expect } from '@playwright/test';
import { waitForProbe, seedBooks, fixtureExists } from '../support/harness';

const FIXTURE = 'books-wide.json'; // wide chart (≈100 accts × ~135 months) so the MV is large enough for W4;
                                   // reproducible via `node apps/web/scripts/gen-books.mjs wide`

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

      // W3 — date range. naive: WHERE entity_id=? AND date<=? (seeks entity_id, then filters the range — the
      // no-range-seek gap)  vs  workaround: full-scan + JS date filter.
      const asOf = '2011-06-15'; // mid-range for the books-wide (2005→2016) span
      const w3_naive = await med(() => api.rawQuery(
        `select account_id, amount from entry where entity_id = ? and date <= ?`, [entityId, asOf]));
      const w3_scan = await med(async () => {
        const out: unknown[] = [];
        for (const e of await api.rawQuery(`select account_id, amount, entity_id, date from entry`)) {
          if (e.entity_id === entityId && (e.date as string) <= asOf) out.push(e);
        }
        return out;
      });

      // W5 — one aggregate value. naive: SELECT max(date) FROM entry WHERE entity_id=? (an aggregate over a
      // range → O(table))  vs  workaround: read the denormalized entity.max_entry_date (one row).
      const w5_naive = await med(() => api.rawQuery(`select max(date) m from entry where entity_id = ?`, [entityId]));
      const w5_denorm = await med(() => api.rawQuery(`select max_entry_date from entity where id = ?`, [entityId]));

      const mvRows = Number((await api.rawQuery(
        `select count(*) c from account_balance_monthly where entity_id = ?`, [entityId]))[0].c);

      return {
        mvRows,
        w1_js: Math.round(w1_js), w1_sql: Math.round(w1_sql),
        w4_scan: Math.round(w4_scan), w4_seek: Math.round(w4_seek),
        w3_scan: Math.round(w3_scan), w3_naive: Math.round(w3_naive),
        w5_denorm: Math.round(w5_denorm), w5_naive: Math.round(w5_naive),
      };
    }, eid);

    console.log(`  [W1] full-scan+JS ${r.w1_js}ms  vs  SQL join ${r.w1_sql}ms`);
    console.log(`  [W3] full-scan+JS ${r.w3_scan}ms  vs  WHERE date<=? ${r.w3_naive}ms`);
    console.log(`  [W4] MV full-scan ${r.w4_scan}ms  vs  index-seek ${r.w4_seek}ms  (MV ${r.mvRows} rows)`);
    console.log(`  [W5] entity.max_entry_date ${r.w5_denorm}ms  vs  max(date) ${r.w5_naive}ms`);

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

    // W3 — the no-range-seek gap: `WHERE entity_id=? AND date<=?` seeks the entity then walks/filters the
    // range, so it scales with the table. When it returns in O(result), delete the month-bucket regimes.
    expect(
      r.w3_scan,
      `W3 tripwire: WHERE date<=? (${r.w3_naive}ms) ≤ full-scan+JS (${r.w3_scan}ms) — range seeks may work now; ` +
      `consider dropping the month-bucket decomposition (quereus-workarounds.md W3).`,
    ).toBeLessThan(r.w3_naive);

    // W5 — a single aggregate value over a range costs O(table); we denormalize it onto `entity` instead.
    expect(
      r.w5_denorm,
      `W5 tripwire: max(date) (${r.w5_naive}ms) ≤ reading entity.max_entry_date (${r.w5_denorm}ms) — max() over ` +
      `an indexed column may be O(1) now; consider dropping the denormalized columns (quereus-workarounds.md W5).`,
    ).toBeLessThan(r.w5_naive);
  });
});

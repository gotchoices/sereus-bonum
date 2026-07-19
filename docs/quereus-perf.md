# Quereus performance: diagnosis & recommendations

Context: Home screen ~10 s, balance sheet ~18 s on real data (Kyle.gnucash: ~143 accounts, 17,756
transactions, ~35k entries) on the `quereus-local` (IndexedDB) backend. Based on a deep read of the
shipped Quereus 4.3.2 docs/code (`node_modules/@quereus/{quereus,store,plugin-indexeddb}`).

## Diagnosis

Both slow screens are the **same query**: `getBalanceSheet`. The Home screen's `VisualBalanceSheet`
calls it for the selected entity; the entity page calls it too. `EntityList` itself is cheap (a plain
entity list) — the cost is the balance sheet it renders next to the list.

`getBalanceSheet` **recomputes from scratch every time**:
1. `account ⋈ account_group` as a **SQL JOIN** (143 rows) — a join over the store.
2. Scan **all** transactions for the entity (`SELECT id,date FROM txn WHERE entity_id=? AND date<=?`, ~17k rows) for a date map.
3. Scan **all** entries for the entity (`SELECT … FROM entry WHERE account_id IN (…143…)`, ~35k rows).
4. Sum in JS.

At 20k txns / 40k entries (9 accounts) this measured ~5 s (txn scan ~3.3 s + entry scan ~1.5 s). Real
data adds the 143-way account `IN` and the account⋈group SQL join, consistent with the ~18 s observed.

## How Quereus wants to be used (from its docs/code)

- **All tables are virtual tables**; persistence is the `store` vtab (IndexedDB). The planner is
  rule-based with cost-based physical selection.
- **Single-table WHERE `=`/range, ORDER BY, LIMIT/OFFSET push down** into the store as real bounded
  index seeks/range scans (`getBestAccessPlan`). So our indexes *are* effective for single-table access.
- **JOIN keys are NOT pushed into the store as seek constraints** ("future work"); correlated joins run
  as nested loops that re-execute the inner side per outer row — each inner probe an awaited IndexedDB
  transaction. This is the ~140× "SQL JOIN vs JS join" gap we already hit. → **Keep doing joins in JS.**
- **No triggers.** But Quereus has **native materialized views** (`CREATE MATERIALIZED VIEW … USING
  store AS SELECT … GROUP BY …`, shipped in 4.3.2). A single-source `GROUP BY` aggregate MV is
  **maintained incrementally, O(log n) per posted row, synchronously inside the writing transaction**,
  persisted in IndexedDB. This is the "cache of subtotals" we want — engine-maintained, no app cache
  invalidation, no triggers.
- **Batch writes** in one `BEGIN…COMMIT` → one atomic IndexedDB commit (we already do this in bulkImport).

## Answers to the specific questions

1. **Do we have effective indexes on all tables?** Yes for the hot paths. We have PKs + 6 secondary
   indexes (`account.entity_id`, `account.account_group_id`, `txn.entity_id`, `txn.date`, `entry.txn_id`,
   `entry.account_id`), and the store honors them for single-table access. Notes:
   - `UNIQUE (entity_id, code)` on `account` is a **bare UNIQUE → no read-side index** in Quereus. Fine
     today (we never seek by code); add `CREATE INDEX`/`CREATE UNIQUE INDEX` if that changes.
   - A composite `CREATE INDEX idx_txn_entity_date ON txn(entity_id, date)` would let the txn scan use
     one index for both the filter and the ordering (minor).
   - Small tables (unit, account_group, entity, partner, tag) don't need secondary indexes.
   - Indexes do **not** help the account⋈group / entry⋈txn **joins** (join-key gap) — that needs JS joins.

2. **A nifty way to cache subtotals?** Yes — **materialized views** (above). This is the headline win.

## Recommendations (ranked)

1. **Account-balance materialized view — the big win.**
   ```sql
   CREATE MATERIALIZED VIEW account_balance (account_id, balance, entry_count) USING store AS
     SELECT account_id, SUM(amount) AS balance, COUNT(*) AS entry_count FROM entry GROUP BY account_id;
   ```
   `getBalanceSheet` (current / as-of-today) and `getAccountBalance` then read **~143 rows** instead of
   scanning ~35k entries → milliseconds. Maintenance is incremental and in-transaction.
   - **Tradeoff:** every entry write updates the MV, so bulk import gets slower (35k incremental updates).
     Acceptable per the "slight pause on write" goal, but must be measured — a big import could regress.
     Mitigation to test: build/attach the MV *after* a bulk load, or batch-refresh.
   - **As-of-date / period ranges:** the per-account MV is an all-time (current) balance — perfect for
     Home and the current balance sheet. For historical "as of past date" and income-statement ranges,
     either (a) fall back to the entry scan (rare path), or (b) add a **period-bucketed** MV
     (`GROUP BY account_id, period`) — which needs `entry.date` denormalized (copy `txn.date` onto the
     entry at write time) so the aggregate stays single-source.

2. **Convert `getBalanceSheet`'s `account ⋈ account_group` to a JS join** (reuse the existing
   `buildAccountDir` helper). Quick, low-risk, helps now — independent of the MV.

3. **Add the composite `txn(entity_id, date)` index** (small, safe).

4. **Home screen:** with the MV, the VBS is cheap. Absent the MV, show a cached net-worth (a single MV
   read) rather than rendering the full balance sheet next to the entity list.

## Suggested sequencing

- **Phase 1 (quick, low-risk, no schema-version bump beyond an index):** JS-join the accts query +
  composite txn index. Immediate partial improvement, no MV risk.
- **Phase 2 (big win, needs validation):** spike the `account_balance` MV — verify maintenance works
  with `bulkImport` / create / update / delete, measure the import slowdown, verify correctness vs a
  full scan. Wire `getBalanceSheet`/`getAccountBalance` to read it for the current-date case, scan
  fallback for historical. MVs are "Beta" tier in Quereus — if they prove flaky, fall back to an
  **app-maintained summary table** updated in the same transaction as writes (same idea, more code,
  full control).
- **Phase 3 (if historical/period views need speed):** period-bucketed MV + denormalized `entry.date`.

Any MV / `entry.date` change is a **schema change** — it touches `domain/schema.qsql` + `schema.md`
(and bumps `SCHEMA_VERSION`), which is a human-spec edit to review.

## Spike results (measured, N=1000, quereus-local)

Prototyped the MV design in isolation. Findings:

| | time | per row |
|---|---|---|
| plain insert (no MV) | 425 ms | 0.44 ms |
| insert **with 2 MVs** (account rollup + account×period bucket) | 6,193 ms | ~2.9 ms/row/MV |
| **one-shot MV build over a pre-loaded table** | 51 ms | ~0.05 ms |
| read all balances from MV | 5 ms | — |
| read via full scan + JS group | 57 ms | — |
| **as-of balance** (bucket MV, `WHERE account_id=? AND period<=?`) | 8 ms | — |
| **income-statement range** (bucket MV, period BETWEEN) | 7 ms | — |

- **Reads/correctness: excellent.** MV totals match a full scan exactly; single-row incremental update
  is correct; the **bucketed MV answers by-month / by-year / as-of / arbitrary-range** directly via its
  own `(account_id, period)` key (7–8 ms). This validates the MV-based design.
- **Write maintenance: the one weak spot.** Per-row incremental maintenance is ~50–120× slower than a
  one-shot rebuild of the identical result — i.e. maintenance isn't batched within the transaction.
  Filed as a maintainer report: `tmp/quereus-mv-maintenance-perf.md`.

## Adoption plan (per the "design to Quereus's philosophy, report gaps upstream" principle)

Adopt the MV design (it is the correct, scalable, Quereus-idiomatic shape), and work *with* the engine
where it's strong while pushing the one gap upstream:

- **Schema:** add `entry.date` (denormalized, bare column, written from the txn) + two `USING store` MVs:
  `account_balance (account_id → SUM, COUNT)` and `entry_by_period (account_id, period → SUM, COUNT)`.
- **Reads:** `getBalanceSheet`/`getAccountBalance`/income-statement read the MVs (current = account_balance;
  as-of/period = sum entry_by_period buckets, with a small raw-entry scan only for non-month-aligned
  edge buckets). Milliseconds instead of full scans.
- **Incremental posts** (ledger add/edit/delete, one txn): rely on live MV maintenance — a few ms, fine.
- **Bulk import:** use the **drop-MV → bulk load → rebuild-MV** pattern (one-shot build ≈0.05 ms/row) so a
  35k-row import isn't dragged into minutes of per-row maintenance. This is a standard bulk-load idiom,
  not a workaround that hides the gap — and the gap itself is filed for a fix (`tmp/quereus-mv-maintenance-perf.md`),
  after which live maintenance on import would also be viable.
- **Report filed:** `tmp/quereus-mv-maintenance-perf.md` (ask: batch MV maintenance per-group at commit).

## Preferred / intended caching model (period-close-aware) — RECORDED, not yet built

This is the target design for scale. It layers three caches so both report types are O(accounts) and
independent of total history, while keeping maintenance cheap.

**Caches**
1. **`entry_by_period`** — MV, `(account_id, period) → SUM(amount), COUNT`. Incrementally maintained
   (single-source GROUP BY over a bare `entry.period`/`entry.date`; one bucket per post, back-dated safe).
   Serves **income statements** and the live open-period portion of balance sheets.
2. **`account_balance`** — MV, `(account_id) → SUM(amount)`. Incremental. Instant current net worth /
   current balance sheet. (Optional — derivable by summing `entry_by_period`, but cheap to keep.)
3. **`closing_balance`** — plain summary table, `(account_id, period) → cumulative balance through end of
   that CLOSED period`. **Written once at period close** (a one-shot aggregate — ~0.05 ms/row), then
   **immutable**. This is the inception-to-date cache; it is *not* maintained per-post (a running sum
   isn't an incremental-MV shape, and back-dated posts would cascade to every later period).

**Why cumulative is cached at close, not live:** closed periods don't change (posts go to the open
period; reopening is explicit), so the cumulative-through-close is stable. Computing it one-shot at the
close checkpoint sidesteps both the back-dated cascade and Quereus's lack of incremental window-sum MVs.

**Close-aware reads** (a view or a data-service method chooses the source):
- **Balance sheet as-of end of a closed period P** → read `closing_balance(P)`. O(accounts), instant.
- **Balance sheet as-of now** (mid open period) → `closing_balance(last close)` + SUM of `entry_by_period`
  buckets *after* the last close. Bounded by "buckets since last close", not total history.
- **Income statement for a closed period / range** → `entry_by_period` buckets for that range.
- **Income statement to-date / spanning the open period** → `entry_by_period` (the open bucket is live).

**Maintenance summary**
- Normal post (ledger add/edit/delete, one txn) → live update of the two MVs (few ms).
- Bulk import → drop MVs → bulk load → rebuild MVs one-shot (per `tmp/quereus-mv-maintenance-perf.md`).
- Period close → one-shot aggregate into `closing_balance`; freeze the period.

**Domain implication (needs its own spec/story):** "Period close" becomes a real domain concept —
immutable closed periods, adjusting entries into the open period, explicit reopen — and intersects
reconciliation ([story 05](../design/stories/web/05-reconciliation.md)). When we build this, it wants a
`domain/` spec (period model + close semantics) and a story, plus the schema additions
(`entry.date`/`period`, the MVs, `closing_balance`) — all human-spec/schema edits to review.

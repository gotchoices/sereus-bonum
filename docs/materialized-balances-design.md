# Design: incremental materialized balances (Quereus-native)

> **Status: engine-native path identified and empirically proven; build decision pending.**
> Updated 2026-08-08 after discovering Quereus already ships incrementally-maintained materialized views
> (`CREATE MATERIALIZED VIEW … USING store`) + a `db.watch()` change-subscription API. This supersedes the
> earlier "deferred until the primitive exists" framing — **the primitive exists**. What's left is a schema
> change + a decision on when to build (see § Build decision).

## The problem it solves

Reports (balance sheet, income statement) aggregate an entity's ledger entries. Brute-force means
re-scanning **all** of history on every load — multiple seconds at ~35k entries, `O(all history)` forever.
Re-scanning immutable history on every render is the wrong shape.

## What the stack provides (verified on Quereus 4.10.0)

- **`CREATE MATERIALIZED VIEW <name> USING store AS <select>`** — a persistent (IndexedDB-backed) view whose
  backing table survives reload.
- **Incremental maintenance** for qualifying shapes: a **single-source `GROUP BY` with a retractable
  aggregate (`SUM`/`COUNT`/`AVG`)** is maintained by **O(1) delta arithmetic per changed row** at write time
  — not recomputed.
- **`db.watch(scope, handler)`** — a post-commit notification with the changed key/group tuples; the app
  re-reads the (already-maintained) view. Distributed/replicated writes enter via
  `notifyExternalChange` / `ingestExternalRowChanges`, so the same maintenance + notification applies to
  remote activity.

**Measured (this repo, 2,001 entries, single-source `SELECT account_id, SUM(amount) … GROUP BY account_id`):**
brute-force 213 ms → **MV read 2–3 ms (~70×)**; an insert auto-updated the MV by the exact delta. The read is
`O(#accounts)`, so the gap widens with history (at 35k entries brute-force is seconds; the MV read stays ~ms).

## The design

- **Balance map as a materialized view.** `CREATE MATERIALIZED VIEW account_balance USING store AS
  SELECT entity_id, account_id, SUM(amount) AS balance FROM entry GROUP BY entity_id, account_id`. Reads:
  `SELECT … FROM account_balance WHERE entity_id = ?` — a handful of rows, ~ms, independent of history size.
- **Reactivity.** `db.watch` a scope over `account_balance` → refresh the UI when balances change (local or
  replicated writes both flow through maintenance).
- **Closed-period snapshots** remain the audit anchor + bound any rebuild (replay since the last snapshot,
  not all history).

### Two hard constraints (from the engine, verified)

1. **Must be single-source — our real query is aggregate-over-a-join, which is NOT incremental.**
   `SUM(amount) FROM entry JOIN txn … GROUP BY account_id` fits no bounded-delta arm → full-rebuild floor
   (and is even blocked by a 10k `materialized_view_rebuild_row_threshold` create-gate). **Fix: denormalize**
   `entity_id` and `date` onto the `entry` row (or maintain a 1:1 `entry⋈txn` MV first) so the balance
   aggregate reads a single source. This is a **schema change** (+ SCHEMA_VERSION bump, + import/writer
   updates to populate the denormalized columns).
2. **No parameters / as-of-date in the view body.** An MV body must be deterministic — no `?`, no
   `date <= <param>`. So a maintained MV gives the **current** cumulative balance per account (the common
   case: balance sheet "as of today"). **Historical as-of-date and period (income-statement) reports are not
   a single maintained sum** — they need period-bucketed MVs (`GROUP BY entity_id, account_id, period`) and/or
   fall back to brute-force queries (where the upstream read-path fixes P0–P2 still matter). Filtering by
   `date` at *read* time against `account_balance` doesn't help — the MV already summed all dates.

### Why this is also the distributed answer

`SUM` is commutative/associative → the balance map is a per-account **PN-counter CRDT**; concurrent posts
just both apply deltas and converge with no conflict logic. Remote entries arrive via
`ingestExternalRowChanges` and maintain the same MV; `watch` refreshes the UI. Ordering-sensitive views (a
ledger's running balance) still need commit order, which Optimystic provides.

## Build decision

This is now a **supported, proven architecture**, not an app-side cache that masks a slow engine — so the
earlier "don't build until Quereus brute-force is fast" logic **no longer blocks the current-balance path**.
It splits cleanly:

- **Current balances (balance sheet as-of-today — the hot path):** the MV path is the right answer and is
  ready to build. Cost: the `entry` denormalization (schema change) + an `account_balance` MV + `watch`
  wiring + a read-path switch. Gets the headline screens to ~ms at any scale.
- **Period / historical / ad-hoc reports (income statement, as-of past dates, ledger, search):** still
  brute-force → **keep pushing the Quereus read-path fixes** (`tmp/quereus-read-perf-report.md`, P0–P2).
  These paths are why the upstream report still matters even after adopting MVs.

**Recommended trigger to build the MV path:** when we choose to make the balance sheet production-fast at
Kyle scale — it's no longer gated on an external primitive (it exists), only on committing to the schema
change. Suggest prototyping on a branch (denormalized `entry` + `account_balance` MV + `getBalanceSheet`
reads the MV for the no-date-range case) and measuring at 20k–40k entries before committing.

## Update: monthly MV generalizes the hot path to ALL date ranges (verified @ 20k, Quereus 4.11)

The current-balance MV (`account_balance = SUM(amount) GROUP BY account_id`) only fast-paths the
as-of-*today* balance sheet. A **monthly** MV generalizes it to any date range with *uniform* performance:

- **MV:** `account_balance_monthly = SUM(amount) GROUP BY entity_id, account_id, period` (`period='YYYY-MM'`),
  still single-source over `entry` → **incremental O(1)-per-write** (needs the denormalized `entity_id`/`period`).
  Indexed `(entity_id, period)` — confirmed **IndexSeek**.
- **`balanceAsOf(D)`** (exact at any D): sum whole months from the MV (`WHERE entity_id=? AND period < D-month`,
  ~27ms) **+** the partial current month from `entry`. Balance sheet = `balanceAsOf(end)`; income statement
  I/E = `balanceAsOf(end) − balanceAsOf(start−1day)`. No even/odd-boundary special-casing — one code path.
- **The partial-month seek is subtle (planner index choice).** `WHERE period = ?` **alone** is a selective
  IndexSeek on `idx_entry_period` (~1 month of rows, ~7ms). Adding `entity_id`/`date` to the WHERE makes the
  planner pick `idx_entry_entity_date` instead, which equality-seeks the **non-selective** `entity_id` and
  scans the whole table (~4s at 20k — *slower than brute-force*). Fix: keep the SQL predicate to `period`
  alone and restrict to entity + `date <= D` **in JS** over the handful of month rows.

**Measured @ 20k entries (`books-10000`), Quereus 4.11:** monthly path **~28ms flat** for early-2020 /
mid-2025 / current-2035 (85–110× vs 2.4–3.0s brute-force), `maxDiff 0` at every date. Wired `getBalanceSheet`:
balance-sheet as-of 40ms (balanced, A−(L+E+I−E)=0), income statement 69ms — both exact vs brute-force.

**Implication:** the monthly MV **subsumes** the current-balance MV (as-of-today = `balanceAsOf(today)`). If
adopted as the default, `account_balance` becomes redundant and can be dropped (one MV to maintain, one read
path). Code is wired behind `MV_APPROACH = 'monthly'` in `service.ts` for A/B; schema is v5 (denormalized
`entity_id`/`date`/`period` on `entry` + `idx_entry_period`). Uncommitted pending adopt/branch decision.

## References
- `tmp/quereus-read-perf-report.md` — brute-force read-path findings (still needed for non-MV paths).
- Quereus (installed 4.10.0): `CREATE/REFRESH/DROP MATERIALIZED VIEW`, `USING store` backing host,
  `db.watch` + `analyzeChangeScope`, `notifyExternalChange`/`ingestExternalRowChanges`; pragma
  `materialized_view_rebuild_row_threshold`. Docs referenced by the source: `materialized-views.md`,
  `incremental-maintenance.md`, `mv-ingestion.md`.
- Prior art: incremental view maintenance / differential dataflow; PN-counter CRDTs.

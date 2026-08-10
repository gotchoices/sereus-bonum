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

### The read strategy matters more than the MV shape — measured at TWO scales

A 9-account fixture (940-row MV) hid the real cost. Re-measured at **Kyle scale** (36k entries, **100
accounts, 248 months** → **13,271-row MV**) the naïve read is *slow*, and the fix is about HOW we read:

| read strategy (as-of a mid date) | 9 accts / 940-row MV | 100 accts / 13k-row MV |
|---|---|---|
| monthly MV **index-seek** `WHERE entity_id=? AND period<?` + GROUP BY | 27ms | **2375ms** |
| monthly MV **full-scan** + JS filter/sum (getAll-batched) | ~25ms | **227ms** |
| current-balance MV `account_balance` (O(accounts)) | 2ms | **2ms** |
| raw `entry` full-scan + JS | 600ms | 638ms |

- **Index-seek reads are ~10× slower than full scans** on the store: a seek returns rows via per-row cursors
  (~0.18ms/row), a full scan is one batched `getAll` (~0.017ms/row). So `balanceAsOf` must **full-scan** the
  monthly MV and filter in JS — never the `entity_id` IndexSeek. (Maintainer feedback item — extend the 4.11
  `getAll` batching to index-seek reads.)
- **The monthly MV read is O(accounts × months)** and grows with history — it does NOT give O(1) reads. So it
  does **not** subsume the current-balance MV; keep both.

### Shipped mechanism: nearest-anchor prefix balance

Every figure is a per-account **prefix sum** `P(D) = Σ amount WHERE date ≤ D` (balance sheet = `P(end)`;
income statement I/E = `P(end) − P(start−1)`). We read `P(D)` from the nearer of two **free anchors** and walk
to `D` with month buckets — `getBalanceSheet`'s "prefix-balance reader":

- `P(∞)` = the current-balance MV (`SUM GROUP BY account_id`, O(accounts), ~2ms) — the "as of now" anchor.
- `P(0)` = 0.

Dispatch on `D`:
| regime | condition | read | cost |
|---|---|---|---|
| **current** | `D ≥ today` | current-balance MV | ~2ms |
| **backward** | within `BACKWARD_MAX_MONTHS` (12) of today | current MV − Σ(entries after `D`); tail months by `period = ?` seek | ~5ms/month |
| **forward** | older | Σ(monthly-MV months `< D`, **full scan**) + partial current month | flat ~150–220ms |

The monthly MV is **full-scanned**, never `entity_id`-IndexSeeked (seek = per-row cursors, ~10× slower — see
`tmp/quereus-4.11-range-and-indexed-reads.md`). `BACKWARD_MAX_MONTHS=12`: the backward tail is ~5ms/month and
the forward scan is flat ~200ms, so the crossover is ~40 months — anything within the last year is far cheaper
backward. Backward assumes entries aren't dated beyond the current month (a normal-ledger invariant); older/
middle dates always take the correct forward scan. A brute-force grouped-join fallback covers MV-unavailable.

**Measured wired @ Kyle scale (36k entries, 100 accts, 248 months), Quereus 4.11, all `maxDiff 0` vs brute-force:**

| regime | date | time |
|---|---|---|
| current | today | 11ms |
| backward | −1 / −3 / −8 / −12 months | 12 / 21 / 27 / 21ms |
| forward | 2020 / 2010 | 208 / 220ms |
| income statement | 2024 full year | 378ms |

vs ~4–5.5s brute-force. Schema v6 (denormalized `entity_id`/`date`/`period` on `entry` + `idx_entry_period`;
monthly MV intentionally unindexed). Both MVs are single-source → incrementally maintained and commutative
(PN-counter CRDTs) — the right fit for the distributed roadmap; a cumulative-snapshot MV would read faster but
break commutativity, so it's rejected. Deferred (build when income statements/past-period reports demand it):
a **year tier** (`GROUP BY entity_id, account_id, year`) collapsing the forward scan's prior-years to O(years).

## References
- `tmp/quereus-read-perf-report.md` — brute-force read-path findings (still needed for non-MV paths).
- Quereus (installed 4.10.0): `CREATE/REFRESH/DROP MATERIALIZED VIEW`, `USING store` backing host,
  `db.watch` + `analyzeChangeScope`, `notifyExternalChange`/`ingestExternalRowChanges`; pragma
  `materialized_view_rebuild_row_threshold`. Docs referenced by the source: `materialized-views.md`,
  `incremental-maintenance.md`, `mv-ingestion.md`.
- Prior art: incremental view maintenance / differential dataflow; PN-counter CRDTs.

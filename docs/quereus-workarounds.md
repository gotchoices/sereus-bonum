# Quereus Data-Layer Register

**Where our data layer diverges from textbook SQL, why, and the terminal state each divergence is driving toward.**

Not everything here is a hack. Some entries are **kludges** — done the wrong way only because the Quereus store
is slow at them *today*, to be deleted the moment it catches up. Others are **architecture** — designs (a
materialized balance, a tenant-id denormalization) we would keep even if Quereus were infinitely fast, because
they're what any serious ledger does. This file keeps the two straight, so we neither carry kludges forever nor
apologize for good design. Every entry is driving toward one of two **terminal states** — *reverted* (upstream
fixed it, kludge deleted) or *principled-and-kept* (architecture we're done second-guessing); when all of them
are in one of those, we've given the feedback that helps and we stop poking.

- The *why* behind the balance machinery: [materialized-balances-design.md](./materialized-balances-design.md)
- The original 4.3.2 diagnosis (historical): [quereus-perf.md](./quereus-perf.md)
- Upstream issues: [quereus#30](https://github.com/gotchoices/quereus/issues/30),
  [quereus#31](https://github.com/gotchoices/quereus/issues/31); earlier reports `tmp/quereus-*.md`

**Currently on:** `@quereus/quereus` **4.16.0** · `@quereus/store` 4.16.0 · `@quereus/plugin-indexeddb`
4.16.0 · `@optimystic/db-*` 0.22.0 · `@serfab/cadre-core` 0.10.0
**Last reviewed:** 2026-08-21

---

## The one rule

> **Never ask the store a table-wide question.**
> Full-scan and filter in JS, or denormalize the answer onto a row you already read.

On the IndexedDB store, a query returning **one row** can cost **12× a full scan of the entire table**,
because a selective predicate becomes an index seek that walks rows through per-row cursors while a full
scan is `getAll`-batched. Measured on Kyle's investment books (23,898 entries):

| query | ms | rows returned |
|---|---|---|
| `SELECT max(date) FROM entry WHERE entity_id = ?` | 4,186 | 1 |
| `SELECT … FROM entry WHERE entity_id = ? AND value IS NOT NULL` | 3,749 | 553 |
| `SELECT DISTINCT value_unit FROM txn WHERE entity_id = ?` | 1,471 | 1 |
| `SELECT account_id, amount FROM entry` (**full scan**) | **355** | **23,898** |

This inverts normal SQL instinct, which is exactly why it keeps catching us. Every entry below is a
consequence of it.

---

## How to read this register

Two independent questions place every entry:

1. **Would we keep it if Quereus were infinitely fast?**
   - **No → kludge.** Delete it when upstream catches up.
   - **Yes → architecture.** Keep it; it is not debt.
2. **Is there reasonable hope Quereus gets faster here?**
   - **Yes →** keep testing and filing issues. Bonum is a real-world Quereus test-bed; using it cleanly is what
     generates the good bug reports, so "keep filing" and "keep the code clean" reinforce each other.
   - **Near a real limit** (integrity checks, scattered row resolution — costs a row-store must pay) → stop
     expecting more; decide if it is *fast enough* and, if so, prefer clean SQL / data integrity / readable code.

**Two tests gate a revert** (a kludge costs maintenance and correctness risk — denormalized columns can go
stale into a *wrong balance* — so "fast enough" beats "faster"):
- **Asymptotic (decisive):** natural SQL must scale with what's *viewed* (O(result)), not O(table), or it is a
  time bomb as the books grow.
- **Perceptibility (tiebreak):** once scaling is safe, revert if the natural path stays imperceptible even at a
  modest slowdown — judged against the interaction (an awaited click wants < ~100 ms; a rare / destructive /
  bulk op may take seconds) — keeping a fallback only for the tail.

File an upstream issue when a *same-result* formulation is dramatically faster (a real planner gap); accept the
cost when it's inherent to the data volume (a whole-entity aggregate must read every row — use an MV).

## Status at a glance

| entry | classification | state | on watch for |
|---|---|---|---|
| **W1** ledger read | kludge (hand-rolled INL) | active | store batching INL multi-seeks — the CTE-join switch is ready |
| **W2** `entity_id` / `period` on `entry` | **architecture** (locality denorm; `period` also feeds the MV) | principled-and-kept | — |
| **W3 / W4** monthly balance MV | **architecture** (materialized period balances) | principled-and-kept | read detail only — the planner full-scans it fine now |
| **W5** `entity` rollups (`max_entry_date`, `entry_periods`, `reckoning_units`) | kludge (denormalized aggregate) | active | [quereus#31](https://github.com/gotchoices/quereus/issues/31) — index-boundary min/max |
| **W6** cost basis as an MV measure | not a hack (incremental MV maintenance) | principled-and-kept | — |
| **W7** FK-disable on cascade delete | kludge | **reverted** (4.16.0) | — |
| **W8** `splitStatements` | not a hack (app expedience) | — | — |

Only **W1** and **W5** remain active kludges — both with a live upstream path
([quereus#30](https://github.com/gotchoices/quereus/issues/30) / #31). Everything else is reverted, or
principled architecture we're no longer second-guessing. The `Wn` numbering is kept because code comments and
issues reference it; treat the classification above as authoritative, not the "workaround" label on each entry.

---

## Register

### W1 — JS-side joins instead of SQL JOINs  *(PARTIALLY REVERTED on 4.12.1)*
**Where:** `production/service.ts` (`getLedgerEntries`, `entriesByTxn`, `buildAccountDir`)
**Instead of:** `entry ⋈ txn ⋈ account` in SQL.
**Why:** join keys aren't pushed into the store; a correlated join re-executes the inner side per outer
row, each an awaited IndexedDB transaction. Measured ~140× slower than joining in JS.
**Update (2026-08-14, 4.12.x):** 4.12.x **batched secondary-index row resolution**, so `entry WHERE
account_id=?` is now a fast IndexSeek (~52ms, was scattered per-row cursors). `getLedgerEntries` was rewritten
to a **targeted O(account) read** (account_id seek + a `txn_id` IN-list multi-seek), **10–21× faster** for a
typical account, falling back to the old full-scan only past the store's ~1000-key multi-seek window. The
`entry ⋈ txn` full-scan in the ledger is gone. The **balance-sheet** join (`getBalanceSheet`) is NOT reverted —
its tripwire still shows the SQL join losing to full-scan+JS (~2.9× on 4.12.1). So W1 is now: *ledger reverted,
balance-sheet join still worked around.*
**Upstream:** `tmp/quereus-join-perf.md`, `tmp/quereus-join-index-perf.md`; the enabling fix is the store's
batched index-seek scan (completed upstream, landed by 4.12).
**Revert test (remaining, balance-sheet):** the `tripwires.spec.ts` W1 assertion (full-scan+JS vs SQL grouped
join); when the SQL join wins, move the balance-sheet join back into SQL too. The ledger revert is guarded by
the `[ledger]` targeted-vs-fallback assertion in the same spec.
**Update (2026-08-21, 4.16.0 + ANALYZE):** `bulkImport` now runs `ANALYZE`; with stats an *explicit-join* off
a selective seek plans as an index-nested-loop. The ledger read was re-expressed as a CTE of the account's txn
ids JOINed to every leg + txn (`LEDGER_STRATEGY = 'sql-join'`, switchable) — ~23ms raw for a 70-entry account.
NOT the default: it seeks per txn with no batched fallback, so the busiest account (1176 txns) runs ~670ms vs
the targeted path's ~490ms. The CTE-join is the best natural form to re-adopt (as a hybrid keeping the
full-scan fallback for the tail) once the store batches INL seeks. Load-bearing detail: the same set via
`WHERE txn_id IN (SELECT …)` plans as a semi hash-join that full-scans entry+txn (~20× slower) —
filed **[quereus#30](https://github.com/gotchoices/quereus/issues/30)** (JOIN, don't `IN`).

### W2 — Denormalized columns on `entry` (`entity_id`, `date`, `period`)
**Where:** `schema.qsql`, written by every entry insert.
**Instead of:** reading them from the parent `txn` via a join.
**Why:** W1 — and `period` in particular exists because `period = ?` equality is the *only* selective
read shape that is fast (~7 ms), so month buckets are how we express a date range at all.
**Revert test:** once range seeks land (W3), `entry.period` loses its purpose; `entity_id`/`date` follow
once joins are cheap (W1).

### W3 — Month-bucket decomposition of date ranges
**Where:** `production/service.ts` `getBalanceSheet` (`balanceAsOf`, forward/backward regimes).
**Instead of:** `WHERE entity_id = ? AND date <= ?` / `period < ?`.
**Why:** **no range seeks.** An inequality on the leading indexed column becomes a post-filter, so a
range degrades to "seek the non-selective prefix → walk everything → filter in JS". Measured: 4,499 ms
to return 80 rows. So a prefix sum is assembled from whole-month buckets plus a partial month.
**Upstream:** `tmp/quereus-4.11-range-and-indexed-reads.md` (Gap 2). **Update (2026-08-14, 4.12.1):** range
seeks now EXIST — `WHERE entity_id=? AND date<=?` plans as `INDEX RANGE` (396ms) — but still lose to the full
scan (292ms) because the range's rows are resolved scattered. The "no range seeks" reason above is superseded;
the real blocker is resolution on large-fraction ranges.
**Revert test:** the `tripwires.spec.ts` W3 assertion (full-scan+JS vs the `date<=?` range seek); when the
seek wins, delete the month-bucket regimes.

### W4 — Full-scan the monthly MV instead of seeking it
**Where:** `getBalanceSheet` forward regime (`SELECT … FROM ${MONTHLY_MV}` with no WHERE, filtered in JS).
**Instead of:** `WHERE entity_id = ? AND period < ?`, which has a perfectly good index.
**Why:** the index seek is ~10× *slower* than scanning the whole MV (2,375 ms vs 227 ms for the same
rows) because seeks aren't `getAll`-batched. We disabled the index deliberately.
**Upstream:** `tmp/quereus-4.11-range-and-indexed-reads.md` (Gap 1, largely fixed on 4.12.x). **Update
(2026-08-14):** the seek is now a real `INDEX RANGE` (the `tripwires.spec.ts` W4 assertion creates the index
and tests it — full-scan 127ms vs seek 315ms, still loses, resolution-bound). **Covering tested + parked:** a
wide-key index `(entity_id, period, account_id, balance)` gives a covered O(result) range read (76ms for an
old/selective date) but loses for recent/large ranges (301ms) and costs a wide index on every write — not
worth it while our balance-sheet ranges are large. See `tmp/quereus-mv-covering-feedback.md`.
**Revert test:** the `tripwires.spec.ts` W4 assertion; when the range seek beats the full scan, use it.

### W5 — Read-side denormalizations on `entity` (`max_entry_date`, `reckoning_units`, `entry_periods`)
**Where:** `schema.qsql`; maintained in `noteTransaction` / `bulkImport`; read via the `getEntity()` call
`getBalanceSheet` already makes (1 ms).
**Instead of:** `SELECT max(date) …`, `SELECT DISTINCT value_unit …` per report.
**Why:** those two queries cost 4,186 ms and 1,471 ms respectively (table above) to return one row each.
All three are **raised only** — an over-stated value costs a few wasted probes, an under-stated one would
be a wrong balance.
**Upstream:** `max(col)`/`min(col)` over an indexed column scans the table — filed
**[quereus#31](https://github.com/gotchoices/quereus/issues/31)** (index-boundary read). `entry_periods` /
`reckoning_units` are the same aggregate-over-a-range shape.
**Revert test:** when `max(col)` over an indexed column is O(1)-ish (quereus#31 closed), drop the columns and
query directly. Fails the asymptotic test today — `max(date)` is O(table) — so this one *stays* until #31.

### W6 — Cost basis as a second MV measure
**Where:** `db.ts` — `SUM(COALESCE(value, amount)) AS cost` on both MVs.
**Instead of:** summing `coalesce(value, amount)` per report.
**Why:** the per-report scan cost 3,749 ms (table above). As an MV measure it is free at read time.
**Cost:** ~5% on write (1.7 s of 32 s at perf size 5000, measured by removing it).
**Not a hack to revert** — this is the engine doing the right thing (incremental MV maintenance verified:
an insert of amount 100 / value 7777 moved the two measures by exactly that). Listed so the write-side
cost is attributable.

### W7 — FK enforcement disabled during bulk cascade deletes  *(REVERTED on 4.16.0)*
**Where:** `deleteEntity`.
**Why (historical):** the referential check cost ~35 ms per deleted parent row on the store *even with the
child FK column indexed* — a 1,000-txn entity delete took ~49 s. We cascaded manually in child→parent order
and disabled the (redundant) checks for the batch.
**Update (2026-08-21, 4.16.0):** re-measured — the RESTRICT probe is now ~2 ms/row and the FK-on cascade is on
par with FK-off (books-100: 458 ms vs 325 ms; books-1000: 6.1 s vs 8.0 s). The ~30× penalty is gone, so we
**stopped disabling FK**: `deleteEntity` now cascades with enforcement ON, restoring the referential safety net
(a cascade-order bug errors instead of silently orphaning rows). The `DELETE … WHERE txn_id IN (SELECT …)`
subquery workaround (materialized account_id IN list) stays — same semi-join gap as
[quereus#30](https://github.com/gotchoices/quereus/issues/30).
**Guarded by:** `fk-delete.spec.ts` now asserts the FK-on cascade stays cheap per row (regression signal to
re-disable if it climbs back toward ~35 ms/row).

### W8 — `splitStatements` splits `.qsql` on `;` and strips only whole-line comments
**Where:** `production/db.ts`.
**Why:** expedience, not a Quereus gap.
**Trap:** a semicolon inside a *trailing* comment silently truncates a `CREATE TABLE`. This has bitten
once. Either make the splitter comment-aware or keep `;` out of inline comments.

---

## Not a Quereus problem (but lives here because it looks like one)

### N1 — `stopPropagation` on a link forces a full page reload
SvelteKit's router listens for clicks **delegated at the document**. An `on:click|stopPropagation` on or
above an `<a href>` means the router never sees the click, so the browser navigates for real and the
**entire Quereus backend is torn down and rebuilt** — schema check, catalog rehydrate, and an IndexedDB
upgrade that can block for seconds waiting on the previous connection to close.

This made Home→entity feel like a database problem when the database was fine (the balance sheet itself
is ~39 ms). Verified directly: a plain anchor navigates client-side; the same anchor with
`stopPropagation` reloads the page. Fixed in `EntityList.svelte` by having the row/menu handlers ignore
clicks that originated on an anchor. **If a navigation ever feels slow, check this before profiling SQL.**

### N2 — slow reopen (reload / new tab / first load) — CHARACTERIZED, then FIXED upstream in 4.14.0
Full page loads (reload, open-in-new-tab, cold start) cost 6–14s at real scale while in-app navigation stayed
fast. **Characterized (2026-08-17):** it was **not** connection lifecycle, MVs, indexes, or queries — it was
`rehydrateCatalog` (the store's reopen "adopt catalog" step) reading **base table row data**, i.e. O(total
rows). Phase split at 36k entries: IndexedDB open ~40ms, `rehydrateCatalog` **~10–14s**, everything else ms.
Filed as `tmp/quereus-4.13-rehydrate-catalog-perf.md`. **FIXED in `@quereus/store` 4.14.0** — `rehydrateCatalog`
now ~50–100ms (reopen ~0.6s). Boot-phase timing added in `production/db.ts` (`store opened + registered` /
`Rehydrated persisted catalog` / `Local backend ready` logs) confirms it and guards against a regression.

---

## Reviewing this file on a Quereus upgrade

1. Bump the version line above and the date.
2. Walk only the **active kludges** in the status table (currently W1, W5) — the principled-and-kept entries
   don't need re-litigating. For each, run its revert test against the two gates (asymptotic, then
   perceptibility).
3. Delete what's earned it and move it to *reverted*; if an issue closed, note it. Record changes in
   `docs/STATUS.md`.
4. Re-run `yarn perf` and, if the wins are real, `yarn perf --update-baseline`.

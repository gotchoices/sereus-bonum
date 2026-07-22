# Spec: Testing & Performance Strategy (Web)

**Scope:** how the web app guards against regressions — both **UX/functional** correctness and
**database performance** as the underlying engines (`@quereus/*`, `@optimystic/*`) evolve. This is a
contract for *what we test and why*; concrete harness code lives under `apps/web/` (see § Layout).

## Goals

1. **Lock in the screens/flows that work well today** so future changes can't silently break them.
2. **Measure the exact query shapes Bonum actually runs**, at graduated data scales, across backends —
   so each new Quereus/Optimystic release can be judged *for our workload* and regressions or
   improvements are detected immediately (not felt in production).

Both hinge on one architectural seam: the **`DataService` interface** (`lib/data/types.ts`) is the
backend-agnostic boundary. A dev/test-only hook exposes it on `window` (`window.__bonum`) so tests and
benchmarks can drive real queries directly — measuring the query, not the render — and seed
deterministic state without walking the whole UI.

## The three backends (test matrix)

`VITE_BACKEND` selects the engine (`data-backend.md`): **`mock`** (sql.js, in-memory) — fast &
deterministic, the default for functional tests; **`quereus-local`** (Quereus over browser IndexedDB) —
the real production path, used for a smoke subset + all perf runs; **`quereus-p2p`** (Optimystic) —
perf-tracked, single-node today.

---

## Part A — Functional / UX regression tests

A layered pyramid — cheapest and most durable at the bottom.

### Tier 1 — Unit tests (`vitest`), pure logic

The trickiest, most churn-prone logic is pure and belongs in unit tests with no browser. Extract it out
of large components into `lib/report/*` (and similar) and test the edge cases directly:

- **Relative-date resolution & chaining** — `resolveTokenDate` (every token), `resolveColumnChain`
  (rightmost vs. today, each left column vs. its right neighbour, "previous"-only), legacy token
  migration. Tests **pin "today"** (pass a fixed `Date`) so they don't drift daily.
- **Sign convention** — `presentBalance` (credit-normal types read positive).
- **Variance** — `varianceOf` (Δ$, Δ%, `null` when prior is 0), `formatVariance` ($/%/both formatting).
- Future extractions as they're factored out: the report row/tree builder (`reportRowsByType`),
  hierarchy roll-ups, import classification helpers (`buildMergePlan` pure parts), `topoSortByParent`.

Unit tests are backend-independent and run on every commit.

### Tier 2 — End-to-end assertion tests (`@playwright/test`)

Real browser, real app, **assertions on DOM/text — not pixels**. Run against **`mock`** by default
(fast, deterministic); a **smoke subset also runs against `quereus-local`** to prove the real backend
agrees. State is seeded from a small **deterministic fixture** via the `window.__bonum` hook (or a
native-import of a committed fixture) — not by hand-clicking. Determinism rules: **pin the clock**
(override `Date` via `addInitScript`/`page.clock`) for any relative-date assertion, and **clear
IndexedDB** between `quereus-local` runs (the schema-version rebuild also covers this).

**Stake-our-ground set** (things working well now, worth freezing):

- **Report correctness invariants** — Balance Sheet balances (`Assets = Liab + Equity`), Trial Balance
  verification line, Income Statement net income, Retained-Earnings breakdown, credit-normal reads
  positive, single logical path + `(direct)` row, expand/collapse (groups *and* parent accounts),
  multi-column Δ$/Δ%, chained relative dates.
- **Ledger** — running balance, split detection, create/edit persists, zero-sum rejects an imbalanced save.
- **Manage Accounts** — re-parent moves the whole subtree, delete guard, retire-needs-zero-balance guard.
- **Catalog** — CRUD, hierarchical render, parent-dropdown type filter.
- **Import** — GnuCash parse counts, native export→import round-trip identical counts, **merge
  idempotence** (re-import ⇒ 0 new).
- **Search** — "show all" totals balanced.
- **Settings** — settings persist across reload.

### Tier 3 — Visual snapshots (sparingly)

`toHaveScreenshot()` on a few *stable* layouts only (report grid, Visual Balance Sheet), with masking.
Pixel diffs are brittle — Tier 2 assertions are the real net; snapshots only catch gross layout breaks.

---

## Part B — Database performance harness

A **separate** harness that drives `DataService` directly through `window.__bonum` in a real browser
(so it measures the true `@quereus/plugin-indexeddb`-over-IndexedDB behaviour), **not** through the UI.

### Query catalog (the shapes Bonum actually runs)

Exercised at each fixture size (`books-{100,1k,5k,10k,20k}.json`) against each backend:

| Op | Method | Notes |
|----|--------|-------|
| Bulk write | `bulkImport` | the import hot path (batched multi-row VALUES) |
| Balance sheet | `getBalanceSheet(end)` | A/L/E cumulative |
| Income statement | `getBalanceSheet(start,end)` | period-filtered I/E |
| Ledger (busy acct) | `getLedgerEntries` | running balance over the busiest account |
| Cross-entity list | `getAllTransactions` | feeds search "show all" |
| Account search | `searchAccounts` | |
| Single balance | `getAccountBalance` | |

### Naive-JOIN variant (regression *and* improvement detection)

For each path we hand-rolled into **JS-side joins** (because store-side SQL `JOIN`s degrade to per-row
async nested loops — see `tmp/quereus-join-index-perf.md`), the harness also times the **naive
SQL-JOIN** form. This keeps the filed-upstream gap *measured*: when a Quereus release fixes join-key
pushdown, the naive variant's time drops and we learn we can delete the JS workaround. This is the living
form of "design to Quereus's philosophy; file cases when it underperforms."

### Method & output

- **Warm up, then median of N repeats**; report p50/p95. Fixed seed data (deterministic fixtures).
- **Stamp every run** with the resolved `@quereus/*` and `@optimystic/*` versions (from the lockfile),
  backend, dataset size, op, ms, and row counts → append to a results log (`perf-results.jsonl`) and
  print a human table (same shape as the STATUS perf tables).
- **Correctness assertions inside the perf run** (e.g. the balance sheet balances at every scale) so a
  DB-layer regression can't hide behind a green timing.
- **Baseline by ratio, not absolute ms.** Commit a `baseline.json`; compare ratios and flag
  regressions/improvements. Absolute wall-clock is hardware-dependent — don't hard-fail on it; perf is a
  **report + alert**, run on version bumps / nightly, not on every PR.
- **Version-sweep workflow:** given a target engine version, install → bench → record, so evaluating a
  new Quereus/Optimystic is one command plus a diff against the baseline.

---

## CI posture

- **Every PR:** Tier 1 unit + Tier 2 E2E (against `mock`) + `svelte-check` + `build`. Fast, deterministic.
- **On engine version bump / nightly:** the perf harness (all backends × sizes) + the `quereus-local`
  smoke E2E; results diffed against the committed baseline.

## Layout & commands

- `apps/web/src/lib/**/**.test.ts` — Tier 1 unit tests (co-located with the pure modules).
- `apps/web/e2e/` — Tier 2/3 `@playwright/test` specs + fixtures.
- `apps/web/perf/` — the DB perf harness, `perf-results.jsonl`, `baseline.json`.
- `apps/web/scripts/` — existing ad-hoc `.mjs` harnesses (migrated into the above over time).
- npm scripts (to be added): `test:unit` (vitest), `test:e2e` (playwright), `perf` (harness). The current
  `gen-books.mjs` continues to produce the graduated fixtures.

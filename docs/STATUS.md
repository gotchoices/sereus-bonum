# Bonum Project Status

**Legend:** ⬜ Todo | 🔄 In Progress | ✅ Done | ❓ Needs Discussion | 🔮 Future

---

## Dev Configuration

**Backend** — `VITE_BACKEND` (default now **`quereus-local`**). npm scripts:
- `npm run dev` → **quereus-local** (Quereus + browser IndexedDB, real SQL). Default & recommended; fully implemented.
- `npm run dev:p2p` → quereus-p2p (Quereus + Optimystic, single-node cadre — runs on latest Sereus).
- `npm run dev:mock` → mock (sql.js + localStorage). Demo/dev only; **can't hold large datasets** (localStorage quota → a big import silently isn't persisted, now surfaced as an error).

See `design/specs/web/global/data-backend.md`.

**Schema versioning:** a schema change bumps `SCHEMA_VERSION` (`production/db.ts`); a persisted quereus DB
stamped with an older version is **rebuilt from the authoritative DDL** (data discarded — export via the
native `.json` dump to keep it). To reset from scratch: clear the `bonum` IndexedDB in DevTools →
Application. Backends are **not** kept in sync; switching wipes.

---

## Roadmap — resume here

Pick-up list for returning after a pause (e.g. while cadre management matures). Grouped by theme,
roughly prioritized. The app currently runs on **quereus-local** with real GnuCash data (Kyle.gnucash:
143 accounts / 17,756 txns) importing and browsing; the biggest felt issue is read performance at scale.

### A. Closing & reconciliation (new domain area — terminology settled in `domain/rules.md` § Closing)
None of the four are implemented yet; story/spec status noted per item.
- ⬜ **Close out a period for an account** — set `closedThrough`; entries dated ≤ it become read-only;
  reopen support. **No story yet.** Needs: a story; app schema rename `closed_date`→`closed_through`
  (+ `SCHEMA_VERSION` bump); ledger lock UI; the close action. This is the trigger for the balance cache
  (see `docs/quereus-perf.md`). **Test:** locking, reopen, edit-blocked-on-closed.
- ⬜ **Period close progress** — a view of which accounts are / aren't closed through a period end
  ("how closed-out is the period / are the books closed?"). Entity period-close = every account
  (incl. Imbalance) `closedThrough` ≥ period end. **No story.** **Test:** partial vs full close, Imbalance blocks.
- ⬜ **Reconcile an account** (optional, per-account) — **fully storied** (`05-reconciliation.md`); schema
  present (`reconciliation` table, `entry.reconciliationId`); **UI/flow NOT built.** Implement the
  reconcile view, finalize/unreconcile, statement history. **Test:** finalize requires checked==statement
  balance; unreconcile entry/statement; async new-entry appears.
- ⬜ **Zero & close an account** — retire via `isActive=false` (requires **zero balance**, hidden from
  active views). **No story.** Needs a story + close-account action + zero-balance guard. **Test:**
  refuse on non-zero balance; hidden after close; no new entries.

### B. Performance (real-data scale — Home ~10 s, balance sheet ~18 s today; both are `getBalanceSheet`)
See `docs/quereus-perf.md` (design) + filed upstream reports in `tmp/`.
- ⬜ **Adopt MV-based balance caching** — `account_balance` + bucketed `entry_by_period` materialized
  views (schema change + version bump); read paths (balance sheet / income statement / account balance)
  read the MVs; bulk import uses drop→load→rebuild; period-close writes the immutable `closing_balance`.
- ⬜ **Quick wins (low-risk):** JS-join `getBalanceSheet`'s `account⋈account_group`; add composite index
  `txn(entity_id, date)`.
- 🔮 **Upstream (filed, pending maintainer):** `tmp/quereus-join-index-perf.md` (store JOINs don't push
  join keys), `tmp/quereus-mv-maintenance-perf.md` (per-row MV maintenance ~50–120× a one-shot rebuild).

### C. Import
- ⬜ **Stock / multi-unit base-unit fix** — `pickBaseUnit` grabs the first 3-letter commodity (a stock,
  e.g. AEF) instead of the CURRENCY (USD), and missing units aren't created → `Loan_Investments.gnucash`
  fails on `fk_entity_unit` (error now visible via notifications). Prefer CURRENCY + create missing units.
- ⬜ **Editable account mapping** in the preview (autocomplete / tree / settle / rescan) — M3 deferred.
- ⬜ **Inline completion of Incomplete transactions** (today they must be excluded).
- 🔮 **Import Transactions mode** (CSV / QIF / OFX bank downloads).

### D. Screen gaps (from the generated-consolidation audit)
- ⬜ Ledger: keyboard shortcuts (Esc/Enter/Ctrl+Enter); real-time running balance (recomputes on reload); no closed-date control.
- ⬜ Entity view: Cash Flow / Custom modes are selectable but unimplemented; no load-error + Retry UI; no account-name hover tooltip.
- ⬜ Search: query builder / saved searches (Phase 2); pagination for "show all" (loads everything).
- ⬜ Catalog: reorder child groups; delete has no usage gate.
- ⬜ Settings: API key not actually validated on blur; Sereus Nodes UI is a stub.
- ⬜ Adopt unified notifications (`stores/notifications`) in remaining screens (entity, ledger, catalog).

### E. Storied but unimplemented features
- ⬜ Multi-unit (08), Tags (11), Sharing / multi-user (10), AI assistant + capture (07 / 09).

### F. Cadre / p2p (the gating item being waited on)
- 🔄 quereus-p2p runs **single-node** on latest Sereus (see Track C below). **Multi-node cadre
  management** is the blocker for sharing/distributed and is what work may pause on. Browser bring-up
  feedback filed in `tmp/optimystic-web-browser-incompat.md`.

### G. Housekeeping
- ⬜ On building period-close, sync app code to the domain contract: `closed_date`→`closed_through` in
  `types.ts` + both schemas + service mappers (+ `SCHEMA_VERSION` bump). Contract is updated; code lags
  intentionally to avoid a data-wipe rebuild for a rename alone.
- ⬜ Regenerate `design/generated/` consolidations after the M3 import rebuild + perf/close changes land.

---

## Spec Reorganization — July 2026 Review

Full review of stories + specs against current appeus guidance (domain-folder convention, which
bonum predated). This section is the running todo for the cleanup.

### ✅ Done — Slice 1 (domain folder + schema)
- **Domain folder created** (`design/specs/domain/`) with `index.md` + `AGENTS.md` symlink.
- **Schema extracted** to `domain/schema.md` (the authoritative field-level contract). `docs/Schema.md`
  slimmed to objectives/strategy only and points to the domain spec (docs = *why*, domain = *what*).
- **`account-groups.md` moved** `web/global/` → `domain/`; all references repointed (catalog,
  account-group-tree-selector, import).
- **Stale template folders removed:** `specs/schema/` and `specs/api/` (were unedited Item/User /
  procedure-template placeholders). `project.md` "Shared Resources" updated to point at `domain/`.
- **i18n de-duped:** deleted floating `specs/i18n.md`; folded shared principles into
  `web/global/i18n.md`.
- **Stories:** `stories/web/STATUS.md` rewritten as a current index (01–07) with a tracked-gaps
  section; fixed story 07's broken `ai-wizard.md` → `ai-assistant.md` reference.

### ✅ Done — Slice 2 (remaining domain migration)
The rest of the cross-target concerns are out of `web/global/` and trimmed to lean, outcome-based
contracts (code/config detail deferred to generated consolidations):
- ✅ `web/global/backend.md` → **`domain/interfaces.md`** — storage & sync model; env-var mechanics
  dropped; schema pointer fixed to `domain/schema.md`; added selective-sharing section.
- ✅ `web/global/import.md` → **`domain/import.md`** — format matrix, type mapping, dedup rules kept;
  module-architecture sentence dropped; web entry-points stay in `web/screens/import.md`.
- ✅ `web/global/export.md` → **`domain/export.md`** — format contract; refs repointed (search,
  saved-reports).
- ✅ `docs/Units-and-Exchange.md` split: concrete tactics → **`domain/units.md`** (balancing,
  rendering, costing); docs slimmed to rationale/objectives. `domain/schema.md` unit/exchange
  pointers repointed to `domain/units.md`.
- ✅ **`domain/rules.md`** created — double-entry integrity, imbalance account, closed periods,
  reconciliation invariants, audit trail.
- Result: `web/global/` now holds only view/target-specific specs (ui, toolchain, i18n, view-state).
  See `design/specs/domain/index.md` for the full contract map.

### ✅ Done — Platform-agnosticism & leanness pass (domain)
Reviewed every domain file so it carries only platform-neutral principles (web-specific detail lives
in web specs); tightened for context economy:
- ✅ `domain/interfaces.md` — dropped browser/SQLite/WASM/localStorage specifics; mock backend now
  described as a generic "on-device local store."
- ✅ `domain/export.md` — removed web delivery mechanics (browser download prompt, memory fallback,
  export button); kept the format/layout/amount contract only. Delivery is per-target.
- ✅ `domain/import.md` — generalized UI phrasings (checkboxes, "mapping UI"); the web wizard remains
  in `web/screens/import.md`.
- ✅ `domain/rules.md` — generalized "lock separator in the ledger"; removed a web-story link.
- Verified: no `browser/svelte/click/tap/keyboard/window/scroll` vocabulary remains in `domain/`.

### ✅ Done — Spec integrity fixes
- ✅ `web/navigation.md` rewritten as a real, crisp nav spec (sitemap, global menu, entity context
  menu, window model, `bonum://`); the mislabeled `web/global/navigation.md` (menu chrome) was folded
  in and deleted.
- ✅ Removed the phantom `TransactionResultsTable → transaction-results-table.md` row from
  `web/components/index.md`; noted that `web/screens/search.md` owns that table.
- ✅ `web/screens/index.md` reconciled (Entity Accounts → `accounts-view.md`, Saved Reports added) and
  both index files stripped of template "Instructions" boilerplate.
- ✅ Mobile `navigation.md` and `screens/index.md` replaced with crisp "not started" markers (were
  Item/User templates).

### 🔄 Stories gaps
Tracked in detail in [`design/stories/web/STATUS.md`](../design/stories/web/STATUS.md) → "Known Gaps".
- ✅ Acceptance criteria filled for stories 01–03.
- ✅ Variant/error template established (01–03, 08, 09); extend to 04, 06, 07.
- ✅ Added stories 08 (Multiple Units of Account), 09 (AI-Assisted Capture & Import),
  10 (Sharing & Multi-User Books), and 11 (Tagging Entries). All capability gaps now covered.
- ✅ Variants (happy/empty/error) present on every web story (01–11).
- Stories are complete and consistent — no remaining known gaps.

### ✅ Done — Data backend scaffold (npm, three modes)
- **Confirmed:** the web app runs **mock-only** (in-browser `sql.js`, localStorage). It has never
  been on sereus — `production/service.ts` was pure stubs and there were zero sereus deps. No local
  clones were ever used, so we go **straight to npmjs.org** (no clone-switch file needed).
- **Deps added** to `apps/web/package.json` from npm (latest published, ahead of the local clones):
  `@quereus/* ^4.3.2` (incl. `plugin-indexeddb`), `@optimystic/* ^0.16.2` (incl. `db-p2p-storage-web`),
  `@serfab/cadre-core ^0.8.1`, `p2p-fret ^0.6.0`. `yarn install` clean (mock build still compiles;
  the only errors under `yarn check` are 53 **pre-existing** app type errors, unrelated).
- **Three-mode toggle** in `apps/web/src/lib/config.ts`: `VITE_BACKEND = mock | quereus-local |
  quereus-p2p`, exposing `USE_QUEREUS` (mock vs real DB) and `USE_OPTIMYSTIC` (local vs distributed).
  Higher-level code checks only `USE_QUEREUS`.
- **Spec:** `design/specs/web/global/data-backend.md` documents modes, packages, and status.
### 🔄 Track C — Quereus backend (C1+C2 done; C3 = p2p remaining)

**C1 (done, RUNTIME-verified):** quereus-local works end-to-end.
- Canonical executable schema: `design/specs/domain/schema.qsql` (Quereus `create table` DDL,
  mirrored app-side in `apps/web/src/lib/data/production/schema.qsql`). Listed in the domain index.
- `production/db.ts` — connection singleton: `new Database()` + `registerPlugin(@quereus/plugin-indexeddb,
  {databaseName,moduleName})` + `pragma default_vtab_module='store'` + apply schema (statement-split)
  on fresh DB, then seed. `USE_OPTIMYSTIC` branches to a p2p stub. Helpers `all/get/run` over
  `eval`/`exec` with `SqlValue[]` params.
- `production/seed.ts` — seeds base units + the account-group catalog on fresh DB (reuses the mock's
  data arrays). Demo entities/accounts/txns → C2.
- `production/service.ts` — **entities, units, account groups** (full CRUD) implemented at C1;
  accounts, transactions/entries, balances, ledger, search were typed stubs (done in C2 below).
- **Runtime-verified via Playwright** (`apps/web/scripts/shot.mjs`, headless Chromium screenshot +
  console capture): with `VITE_BACKEND=quereus-local`, the app initializes the DB, applies schema,
  seeds, and the **Catalog renders the 40 seeded account groups** with correct hierarchy — proving
  init → schema → INSERT (FK-ordered) → SELECT → render.
- **Key finding:** `exec("declare schema main {…}")` silently creates **no tables** on a plain
  `Database` (that form is for StrandDatabase; health's leveldb path is effectively untested since it
  defaults to optimystic). The working form is individual `create table … ` statements with
  `default_vtab_module='store'`. `yarn check` 0 errors, `yarn build` succeeds.
- **Reusable harness:** `scripts/shot.mjs` (+ `playwright` devDep, Chromium installed) — the
  screenshot/console loop for verifying UI and backend behavior from here on.

**C2 (done, RUNTIME-verified):** the full DataService is implemented against Quereus SQL, so
**quereus-local now runs every implemented screen**.
- `production/service.ts` — accounts, transactions/entries (createTransaction enforces the zero-sum
  rule), balances, ledger, and search all implemented. `getBalanceSheet` aggregates **in JS** to avoid
  Quereus's GROUP-BY "duplicate-id-in-scope" quirk; ledger/search use scalar subqueries (the safe form).
- `production/seed.ts` — now also seeds the two demo entities + their accounts, and (when `DEBUG_DATA`)
  the demo transactions. Reuses the mock's exported data arrays (no drift).
- **Verified via Playwright screenshots** with `VITE_BACKEND=quereus-local VITE_DEBUG_DATA=true`:
  - Home lists both entities; accounts view renders the **Balance Sheet, balanced** (Assets
    $524,375 = Liab + Equity $524,375 ✓) with Retained Earnings broken out.
  - Ledger shows running balance, resolved offset accounts, and split detection.
  - Search "Show All" returns 29 cross-entity transactions with splits, **Totals balanced**.
- `yarn check` 0 errors, `yarn build` succeeds.
- Note: mock (`sql.js`) remains the default backend (`VITE_BACKEND` unset → `mock`); quereus-local is
  opt-in via env. Both share the same schema + seed data.

**C3 (WORKING in the browser — single node, on latest Sereus):** `quereus-p2p` — Optimystic.
- `production/cadre.ts` (web CadreService) + `initOptimystic` in `db.ts` boot `@serfab/cadre-core`
  `CadreNode` over libp2p, open the strand's Quereus Database (`StrandDatabase`), seed, and serve the
  same DataService. Single node only — multi-node cadre is still experimental/upstream-in-progress.
- **On LATEST:** `@optimystic/* 0.16.2` + `@quereus/* 4.3.2` (the old `resolveCollation` collation trap
  is fixed upstream in 0.16.2's plugin, which uses `builtinCollationResolver`). The `resolutions` block
  is updated accordingly.
- **Three fixes made it run in the browser** (per `tmp/optimystic-review.md`'s diagnosis):
  1. `vite.config.ts`: `resolve.conditions: ['browser', …]` (so multiformats' browser `sha2` /
     `crypto.subtle` is used, not `node:crypto.createHash`) + `optimizeDeps` for multiformats +
     `resolve.alias.chai` → empty stub (`src/lib/empty-module.js`) for a stray test import.
  2. **Patched `@optimystic/db-p2p`** via `yarn patch`: guard 7 unconditional `.unref()` calls
     (`?.unref?.()`) — the one genuine source defect (still present in 0.16.2). Patch lives in
     `.yarn/patches/`.
  3. Dropped `vite-plugin-node-polyfills` (its shims caused the `fs/promises` error; the real fix is
     the browser condition above).
- **Verified via Playwright** (`VITE_BACKEND=quereus-p2p`): CadreNode starts (peer id assigned), strand
  DB opens, seeds, Home renders the 2 seeded entities. `yarn build` clean, `yarn check` 0 errors.
- **Upstream feedback filed for latest:** `tmp/optimystic-web-browser-incompat.md` (rewritten for
  0.16.2) — Issue 1 the `.unref()` guard, Issue 2 the `chai` test-import packaging. Both worked around
  locally; upstream fixes would remove the patch/alias.
- Note: mock remains the default backend; `quereus-local` and `quereus-p2p` are opt-in via `VITE_BACKEND`.

### ✅ Done — Track D: green the app (type-clean + builds)
Cleared all **53** pre-existing `svelte-check` errors → **0 errors**; `yarn build` succeeds. Root
causes and fixes:
- Svelte 5 rune typing: `let x: T | null = $state(null)` inferred `null` → used `$state<T | null>(null)`
  (VisualBalanceSheet).
- `$derived(() => …)` returned the function itself → `$derived.by(() => …)` (AccountGroupAutocomplete).
- **Schema drift:** code used `account.groupId`; the field is `accountGroupId` (ledger).
- `EntryInput` required `transactionId`, but `createTransaction` assigns it → `Omit<Entry,'id'|'transactionId'>`.
- Nullable SvelteKit route params (`$page.params.*`) asserted where the route guarantees them.
- Focus-handler plumbing typed through AccountAutocomplete → TransactionEditor → ledger; `unit` prop
  widened to accept the `Unit` shape; import page `parsedData` type-positions and a missing
  `groupPathExists` helper.
- ⬜ **Not addressed (separate pass):** 93 `svelte-check` **warnings** — 55 dead CSS, ~28 a11y
  (relevant to the WCAG target), 4 Svelte-4 `on:click` deprecations, and **1 real reactivity warning**
  ("only captures the initial value of `groups`") worth investigating.

---

## Import — Merge Regeneration (in progress)

Reworking import into a **merge** (idempotent re-import) per the augmented specs
([story 02](../design/stories/web/02-gnucash.md), [screens/import.md](../design/specs/web/screens/import.md),
[domain/import.md](../design/specs/domain/import.md)). Goal: run GnuCash + Bonum in parallel and
periodically re-import to sync; the preview classifies each transaction as **already-imported / new /
incomplete** and writes only new ones. Milestones:

- ✅ **M1 — source-identity persistence.** Added `sourceId` (source GUID/FITID) to `Transaction` +
  `Account`: `types.ts`, all three schemas (`domain/schema.qsql` + app copy + `mock/schema.sql`),
  `domain/schema.md`, and both services' mappers + create methods. `yarn check` 0 errors, build clean,
  quereus-local still renders. **Migration note:** existing `quereus-local` IndexedDB (or mock
  localStorage) has the old schema — clear it (fresh DB) after this change; a schema-version bump is a
  TODO.
- ✅ **M2 — import-service merge logic (VERIFIED with real data).** `import-service.ts` rewritten from a
  no-op stub into a real merge engine: `buildMergePlan` (resolve accounts by stored `sourceId`/name +
  type auto-match; classify each txn exists/new/incomplete against stored txn `sourceId`s) and
  `executeMerge`. Added an **atomic `bulkImport`** to `DataService` (both backends: one
  `BEGIN…COMMIT`) since 17k individual `createTransaction` calls were untenable. A compat `importBooks`
  keeps the current screen working until M3.
  - **Verified:** drove the current screen with `tmp/Kyle.gnucash` on quereus-local — parsed **161
    accounts / 17,756 transactions / 162 commodities**, auto-mapped 149/149, and **imported +137
    accounts + 17,756 transactions atomically** into a new entity. (Import was a no-op stub before —
    it now actually works.)
  - ✅ **SCALE BOTTLENECK — RESOLVED** (see "Native Books + Perf Pass" below). Root cause was **SQL
    `JOIN`s over the IndexedDB store**, not missing indexes: a 3-way `entry⋈txn⋈account` join took
    **44,488 ms for 2 k entries** (per-row async nested loop). Rewriting `getBalanceSheet` to two
    single-table indexed reads joined **in JS** dropped that to ~310 ms (**~140× faster**), and batching
    `bulkImport` into multi-row `VALUES` cut writes ~6×.
- ✅ **M3 — rebuilt import screen (plan-driven).** Replaced the disconnected mapping table with a
  preview built from `buildMergePlan` (no writes) that **drives** `executeMerge`. New-or-existing
  target; hierarchy-aware account resolution (general levels → shared groups, specific → nested
  accounts via `parentId`); transaction **dispositions** (new / incomplete / already-imported) grouped
  with counts; **already-imported hidden by default + toggle**; expandable entries; exclude / force-
  include. Import gated until no unresolved Incomplete remains. Regenerated
  `design/generated/web/screens/import.md`. Verified: `scripts/test-hierarchy.mjs` (9 assertions) +
  real `Kyle.gnucash` (161 accts / 17,756 txns) on quereus-local.
  - **Deferred (tracked in the consolidation):** editable account mapping (autocomplete/tree/settle/
    rescan), inline completion of Incomplete txns (must exclude for now), Import-Transactions mode
    (CSV/QIF/OFX).
  - **Fixed:** Step-1 target toggle *looked* backwards — the active segmented button was invisible
    because the new screen used undefined CSS vars (`--primary-color`, `--surface-*`). Reconciled to the
    app's real vars (`--accent-color`, `--bg-*`, `--danger/success/warning`). **Theming nit:** the
    **ledger** screen still uses the undefined `--surface-*` vars (renders via fallbacks) — reconcile.
  - **Consolidations refreshed:** regenerated `generated/web/screens/import.md`; appended dated Update
    notes to `entity-accounts.md` (Export + getBalanceSheet perf), `ledger.md`, `search.md`. Added the
    native Export trigger to `accounts-view.md` spec.
- ✅ **M4 — real data verified** (`Kyle.gnucash`, quereus-local) as part of M3.
- ✅ **Stale schema (source_id) + GnuCash mapping bugs fixed** — see "GnuCash import fixes" below.

## GnuCash import fixes — ✅ Done

- **`source_id` error on import** was a **stale persisted DB** (pre-`source_id` schema). Replaced the
  earlier in-place ALTER idea with a **schema-version stamp + rebuild-on-mismatch** (mock `PRAGMA
  user_version`, quereus `schema_meta`): a persisted DB whose version ≠ current is discarded and rebuilt
  from the authoritative DDL. No in-place migration; backends are **not** kept in sync (switching wipes,
  by design). `SCHEMA_VERSION = 2`.
- **Flattened target groups** — the importer now maps general source levels to shared catalog groups and
  nests specific levels as accounts via `parentId` (see M3 / domain/import.md Hierarchy Mapping).
- **Entity page stuck "Loading…" after import** — the entities store wasn't refreshed post-import
  (GnuCash *and* native paths); both now call `initializeEntities()` before navigating.
- **Mock can't persist ~17k txns** (`QuotaExceededError`, localStorage ~5-10 MB). Use `quereus-local`
  (IndexedDB) for real data; mock stays the small demo backend.

## Native Books (dump / restore) + Perf Pass — ✅ Done

A non-merge, non-interactive **round-trip** dump/restore for a single entity — built first (before the
GnuCash merge screen) so we can create/reload test datasets at any scale. Spec: `domain/import.md`
(Native Books) + `domain/export.md`.

- ✅ **`import/native.ts`** — `exportBooks(entityId)` dumps `{ format:"bonum-books", version, entity,
  units, accounts (local `ref`), transactions (entries by `ref`) }`; `importNativeBooks(file)` restores
  into a **fresh** entity (new ids), ensuring units exist, reusing the atomic `bulkImport`.
- ✅ **Import screen** wired for `.json`: native file → skip entity-name/mapping, non-interactive
  restore, then refresh the entities store and navigate. (Fixed a latent bug: the entity page reads
  `entity` from the `entities` store, so a freshly-created entity showed a perpetual "Loading…" until
  the store was refreshed.)
- ✅ **Export button** on the entity page — downloads `{entity}-{date}.json`. Round-trip verified:
  restore → export → identical counts (accounts/txns/entries).
- ✅ **Generator** `scripts/gen-books.mjs` — emits graduated `books-{100,1k,5k,10k,20k}.json` (balanced
  txns, seed catalog groups). Test harnesses: `scripts/test-native-roundtrip.mjs`,
  `scripts/test-export-roundtrip.mjs` (Playwright).

**Perf results (quereus-local, headless Chromium):**

| txns | restore (write) | balance-sheet view |
|------|-----------------|--------------------|
| 1 k  | ~10 s | ~0.4 s |
| 5 k  | ~21 s | ~1.4 s |
| 10 k | ~42 s | ~2.4 s |
| 20 k | ~99 s | ~5 s |

**Attribution:** both remaining costs are the **IndexedDB store's per-row async work** (an
optimystic/quereus storage characteristic), not our query shape:
- **Reads:** avoid SQL `JOIN`s on the store — they degrade to per-row async nested loops (confirmed
  super-linear; see `tmp/quereus-join-index-perf.md`, filed for the Quereus maintainer). Do joins in JS
  over single-table indexed reads. Applied to **`getBalanceSheet`, `getLedgerEntries`,
  `getAllTransactions`, and `searchAccounts`** (all rewritten to load single tables and join/group in a
  shared `buildAccountDir` + `entriesByTxn` helper; the ledger's N+1 offset/split lookups are gone).
- **Writes:** batched `bulkImport` into multi-row `VALUES` (~500–2000 params/stmt). Batching itself was
  the win (121 s→21 s at 5 k); larger batches gave marginal gains — residual ~1.6 ms/row is the store.
- Added the 6 secondary indexes to both Quereus schemas (`create index` works with the store vtable),
  matching mock. FKs are **not** auto-indexed; PK is.

**Ledger + search perf (JS-join rewrite, quereus-local):**

| dataset | ledger (busiest account) | search "show all" (cross-entity) |
|---------|--------------------------|----------------------------------|
| 10 k txns (20 k entries) | ~2.5 s (Checking, 5,352 entries) | ~8 s (20 k entries) |
| 20 k txns (40 k entries) | ~5.2 s (Checking, 10,723 entries) | ~22 s (40 k entries) |

Before the rewrite the ledger for a busy account and cross-entity search **hung** (5-way join + N+1).
Correctness verified: offset accounts, `[Split]` detection, and running balance all intact.

**Remaining scale item (follow-up):** the search browser's "show all" loads every entry (feeds
export-all), so it's inherently linear — ~22 s at 40 k. Wants a `LIMIT`/"load more" story with export
kept separate; deferred because it's a UX+export-semantics decision, not a query-shape fix. The ledger
loads all of one account's entries (needed for the running balance) but virtualizes rendering
(`content-visibility`), so it stays usable (~2.5 s at 5 k entries).

## Current Sprint (Active Development)

### 🔄 Web MVP - Core Screens
- ✅ Home screen with entity list & VBS
- ✅ Account Catalog (manage account groups)
- ✅ Accounts View (Balance Sheet, Trial Balance, Income Statement modes)
- ✅ Ledger (transaction entry with split support, scroll position persistence)
- ✅ Transaction Search (Phase 1: Browser with export)
- ⬜ Transaction Search (Phase 2: Query builder)
- ✅ Settings screen (theme, dates, account display, sign reversal)
- 🔄 Import Books (GnuCash) - Parser complete, account/transaction creation pending

### ⬜ Ledger Filtering & Search
- ⬜ **Quick Filter** (ephemeral, keyboard-driven)
  - Icon/input next to account title
  - Searches: Memo, Note, Reference (substring, case-insensitive)
  - Shortcut: Ctrl+F or `/` key
  - Clears on account change
- ⬜ **Rich Filters** (persistent, UI-driven)
  - Date range picker
  - Amount range
  - Show only open periods (transactions after closed date)
  - Show current year/month/quarter
  - Account dropdown (for split entries)
  - Combine filters with AND logic
- ⬜ **Filtered Display**
  - Show matching transactions only
  - Optional: Show filtered balance vs. total balance
  - Link to advanced search (/search) for boolean queries

**Key Design Questions:**
- Q1: Should quick filter persist in viewState or be truly ephemeral?
- Q2: Rich filters - where to place UI? (Header bar? Sidebar? Popup panel?)
- Q3: How to indicate filtered state? (Badge? Background color? Status bar?)
- Q4: Filtered balance - show both (filtered vs. total) or just suppress balance?
- Q5: Should "show only open periods" be a rich filter or a global toggle?

---

## Recently Completed

### ✅ Ledger Grid Refactor - Production-Ready Layout
**Implementation:** Replaced HTML tables with CSS Grid + ARIA for industrial-strength scalability
- **Motivation:** Enable virtual scrolling for 10K+ transactions (per production delivery posture)
- **Architecture:** CSS Grid with `display: contents` pattern for proper column alignment
- **Accessibility:** Full ARIA grid implementation (`role="grid"`, `role="row"`, `role="gridcell"`, `role="columnheader"`)
- **Performance:** CSS `content-visibility: auto` for browser-native virtualization
- **Components Refactored:**
  - `apps/web/src/routes/ledger/[accountId]/+page.svelte` - Main ledger page (table → grid)
  - `apps/web/src/lib/components/TransactionEditor.svelte` - Clean grid-first nested layout
- **Editor Design:** Nested grid architecture (spans parent columns, creates 8-column internal grid)
  - Container has border/background (not individual rows)
  - Rows use `display: contents` for cell alignment
  - Actions row spans full width with flexbox button layout
- **Maintains:** All existing functionality (expand/collapse, inline editing, locked transactions, keyboard nav, split mode)
- **Grid Layout:** 8 columns (40px, 135px, 100px, 1fr, 200px, 160px, 160px, 160px)
- **Dev Tools:** Compact test data generator (config-controlled)
  - **Location:** Top-right of ledger header (above balance display)
  - **UI:** Number input (default: 1000) + 🧪 button
  - **Config:** `VITE_ENABLE_TEST_DATA=true` in `.env.local` (DEV mode only)
  - **Persistence:** When enabled, localStorage is **disabled** for speed and to avoid quota errors
  - **Usage:** Generate transactions in small chunks for incremental performance testing
  - **Note:** Data is ephemeral - refresh creates a fresh database
- **Performance Testing Results:** 20,000 transactions tested - scrolling is fast and efficient with `content-visibility: auto`

### ✅ Ledger Scroll Position - Smart Viewport Management
**Implementation:** Scroll to latest date on load, persist viewport position per account, scroll after save
- **Default Behavior:** Scroll to blank entry row (adapts to sort order)
  - Newest first → blank entry at top (scroll to top)
  - Oldest first → blank entry at bottom (scroll to bottom)
- **After Saving Transaction:** Scroll to show the saved transaction
  - Uses `scrollIntoView({ block: 'nearest' })` for minimal scroll
  - If transaction already visible → No scroll (perfect for editing)
  - If transaction off-screen → Scroll to bring it into view
  - New transactions naturally appear near blank entry (both visible together)
- **After Test Data Generation:** Scroll to blank entry to show results (TODO: timing issue - may need refinement)
- **Viewport Persistence:** Saves `lastVisibleTransactionId` in `viewState`
  - Tracks topmost visible transaction (debounced during scroll)
  - Restores position on reload (falls back to blank entry if transaction not found)
- **Scroll Tracking:** 300ms debounce on scroll events to capture user's reading position
- **Benefits:** Users always see their work, viewport adapts intelligently to context

### ✅ Account Autocomplete & Transaction Entry - Specs & Help
- **Created specs:**
  - `/design/specs/web/components/account-autocomplete.md` (agent rules)
  - `/design/specs/web/components/transaction-edit.md` (agent rules - renamed & refactored)
- **Created help content:**
  - `/apps/web/src/routes/help/en/account-autocomplete/+page.md` (user narrative)
  - `/apps/web/src/routes/help/en/transaction-entry/+page.md` (user narrative)
- **Tracked in:** `/design/generated/web/meta/outputs.json`
- **Refined colon completion logic:**
  - Uses highlighted result (not always top)
  - Finds longest matching path element
  - Never completes final account name
- **Implemented in:** `AccountAutocomplete.svelte`
- **Key behaviors:** Max 10 results, arrow navigation, Tab vs Enter distinction, Escape, auto-clear on blur, auto-select on tab

---

## Spec Cleanup History

Dec 2025: an earlier pass cleaned web specs for appeus-compliance (removed TypeScript/SQL/
implementation detail from screen, component, and global specs; kept user-observable behavior).
July 2026: the reorganization above superseded much of that layout — several files were moved,
renamed, or merged (schema/units/account-groups/import/export/interfaces → `design/specs/domain/`).
Per-file detail of the Dec pass lives in git history; it is intentionally not reproduced here to
keep this file lean and its paths current.

## Backlog (Priority Order)

### High Priority (MVP Blockers)

#### ✅ Transaction Search (Story 06) - Phase 1 Complete

**Phase 1: Transaction Browser** (Ready for Imbalance Debugging)
- ✅ Create consolidation for search screen
- ✅ Build `TransactionResultsTable.svelte` component (reusable)
- ✅ Create `/search` route
- ✅ "Show All Transactions" button
- ✅ Transaction grouping (header + split rows)
- ✅ Debit/Credit columns with proper alignment
- ✅ Totals row with balance verification
- ✅ Entity column (cross-entity view)
- ✅ Account column with hyperlinks
- ✅ Export to CSV/Excel with proper decimal formatting

**Phase 2: Query Builder** (Future)
- ⬜ Visual query builder interface
- ⬜ Field selection (entity, account, memo, date, amount, etc.)
- ⬜ Operators per field type (<, >, =, contains, wildcard, regexp)
- ⬜ AND/OR logic with grouping (indentation)
- ⬜ Query preview/validation
- ⬜ Save/recall named searches
- ⬜ Edit/duplicate/delete saved searches
- ⬜ Export results to CSV

**Why Phase 1 first:** Provides immediate debugging tool for imbalance investigation. Phase 2 builds on the results table.

#### ✅ Fix Balance Sheet Imbalance (Complete)
**Issue:** Equity total didn't include Retained Earnings
- ✅ Fixed backend: `totalEquity` now returns equity accounts only (not including net income)
- ✅ Added `totalIncome` and `totalExpense` to balance sheet data
- ✅ Fixed frontend: Equity total in both modes now includes Retained Earnings
- ✅ Retained Earnings shown under Equity in both modes:
  - **Balance Sheet:** Expandable to show Income/Expense breakdown
  - **Trial Balance:** Non-expandable line item (I/E already shown separately)
- ✅ Verification formula: Assets = Liabilities + Equity + Net Income (works for both modes)
- ✅ Removed Net Worth display (redundant with Equity)
- ✅ Balance Sheet: Balanced
- ✅ Trial Balance: Balanced

#### ✅ Clarify Trial Balance vs Balance Sheet
**Resolution:** Stories and specs updated
- Balance Sheet: Shows A/L/E only, RE expandable under Equity to show I/E subcategories
- Trial Balance: Shows all 5 types (A/L/E/I/E) at top level, no RE expansion needed
- Income Statement: Shows I/E with Net Income calculation line
- Updated: Story 04, `design/specs/web/screens/accounts-view.md`

#### ✅ Income Statement Date Range (Complete)
**Implementation:** Income Statement and Cash Flow now support date ranges
- ✅ Updated `BalanceSheetData` type with `startDate` and renamed `asOf` to `endDate`
- ✅ Updated backend SQL query with conditional date filtering:
  - A/L/E accounts: cumulative through endDate (ignores startDate)
  - I/E accounts: period-based (startDate to endDate) when startDate provided
- ✅ Frontend conditional date picker:
  - Balance Sheet & Trial Balance: single "As of" date
  - Income Statement & Cash Flow: "From" and "To" dates (vertically stacked)
- ✅ Auto-sets default start date (Jan 1 of current year) for period-based modes
- ✅ Vertical date stack styling (prepares for multi-column reports)

#### ✅ Account Hyperlinks Everywhere
**Issue:** Account names should be clickable throughout
- ✅ Retained Earnings breakdown (I/E accounts)
- ✅ Split transaction entries in ledger
- ⬜ VBS click-through (future enhancement)
- ⬜ Search results (when implemented)

#### ✅ Settings Screen (Complete - Compact Design)
**Implemented with auto-save behavior and compact UI**

Features implemented:
- ✅ Compact row-based layout (label + dropdown per setting)
- ✅ Light/dark/system theme toggle (immediate effect)
- ✅ Language selector (English only for MVP, dropdown ready for future)
- ✅ Date format with live preview (US/EU/ISO)
- ✅ Account display format (Code/Name/Path/Code: Name)
- ✅ Simplified sign toggle (hide negatives for Equity + Income together)
- ✅ Sereus nodes list UI (empty state, "+ Add Node" button for future)
- ✅ Settings persist in localStorage
- ✅ Auto-load on app startup

**Dark theme improvements:**
- ✅ Better contrast for disabled elements (improved in Accounts View)
- ✅ Improved global `text-muted` color (#6e7a8a)
- ✅ More visible borders (#3d4751)
- ⬜ Test all screens in both themes
- ⬜ Consider separate dark theme color palette

### Medium Priority (Polish & UX)

#### ✅ Ledger Performance Optimization (Complete)
**Solution:** CSS Grid refactor + browser-native virtualization
- ✅ **Refactored to grid layout:** Replaced `<table>` with CSS Grid (maintains alignment, enables future virtual scrolling)
- ✅ **Added CSS `content-visibility: auto`:** Browser automatically virtualizes off-screen rows
- ✅ **Full ARIA support:** Accessible grid with proper roles for screen readers
- ✅ **Maintained all functionality:** Expand/collapse, inline editing, keyboard nav
- **Performance:** Should handle 10K+ transactions smoothly (to be validated with real import)
- **Fallback ready:** TanStack Virtual can be added if `content-visibility` insufficient
- **Package installed:** `@tanstack/svelte-virtual` (v3.13.13) - ready if needed

#### ⬜ Collapsible Global Menu
- Hamburger toggle to hide/show sidebar
- More screen space for data-heavy views
- Persist state

#### ⬜ UI Help Elements
Help content exists at `/help/en/*` routes, needs UI access:
- **Global:** Help icon (?) in header/menu → opens help index or search
- **Contextual:** Info icons (ⓘ) next to complex fields → opens relevant help page
- **Keyboard shortcut:** F1 or ? key → context-aware help
- **First-time tips:** Dismissible tooltips for new features
- Help pages already exist:
  - `/help/en/account-autocomplete` (colon completion, search behavior)
  - `/help/en/transaction-entry` (keyboard workflow, split mode)

#### ⬜ Print/PDF Report Rendering
From story 04:
- Clean, printable layout
- Opens in new browser tab
- Works for all report modes

#### ⬜ Refine Visual Balance Sheet
Current VBS is proof-of-concept:
- Improve proportions and visual accuracy
- Better color schemes and contrast
- Hover states with detailed tooltips
- Click-through to account details
- Handle edge cases (zero balances, negative equity)
- Optional Ring 3 (individual accounts)
- Scroll events to zoom in/out

### Lower Priority (Nice to Have)

#### ⬜ Multi-Column Reports
From story 04 (Alt F):
- ✅ UI placeholder: "+ Add Column" button in header (disabled with tooltip)
- ✅ UX spec: `design/specs/web/screens/saved-reports-ux.md`
- ⬜ Implement column management (add/remove/rename)
- ⬜ Implement per-column date inputs (vertically stacked)
- ⬜ Implement responsive layout (horizontal scroll, sticky headers)
- ⬜ Implement variance columns ($ change and % change)
- ⬜ Update backend to handle multiple date ranges
- ⬜ Update export to multi-column format

#### ⬜ Saved Reports
From story 04 (Alt G):
- ✅ UI placeholder: "⭐ Reports" button in header (disabled with tooltip)
- ✅ Store skeleton: `savedReports.ts` with interface definitions
- ✅ UX spec: `design/specs/web/screens/saved-reports-ux.md`
- ⬜ Implement save dialog
- ⬜ Implement dropdown with saved reports list
- ⬜ Implement load/rename/delete functionality
- ⬜ Persist to localStorage

#### ⬜ Cash Flow Mode Implementation
From story 04 (Alt C):
- Pre-configured account group selections
- Operating, Investing, Financing categories
- Show changes over period

#### ⬜ Custom Mode Implementation
From story 04 (Alt D):
- Checkboxes to select account groups
- Any combination visible
- Save as custom report

---

## Import Implementation

### 🔄 GnuCash Import
- ✅ XML format research
- ✅ Parser prototype (`test/manual/gnucash-parser.ts`)
- ✅ Format documentation (`design/specs/domain/import.md`)
- ✅ **Import Strategy Spec** (`design/specs/web/global/import.md`)
  - Two entry points: "Import Books" (new entity) and "Import Transactions" (existing entity)
  - Single reusable import engine
  - GUID-based idempotence for GnuCash
- ✅ **Import Module Created** (`apps/web/src/lib/import/`)
  - `types.ts`: TypeScript interfaces
  - `gnucash-parser.ts`: GnuCash XML parser (accounts, transactions, commodities)
  - `import-service.ts`: Main import orchestration
  - `index.ts`: Public API
- ✅ **Import UI** (`apps/web/src/routes/import/+page.svelte`)
  - File upload with drag & drop
  - Progress indicator
  - Real GnuCash parsing (uncompressed XML)
  - Account/transaction count display
- ⬜ **Next Steps:**
  - Account creation with DataService
  - Transaction creation with DataService
  - Account mapping UI (for existing entity imports)
  - Duplicate detection (GUID-based)
  - Gzip decompression support
- ⬜ Handle scheduled transactions
- ⬜ Handle price database (multi-currency/securities)
- ⬜ Handle lots (cost basis tracking)
- ⬜ SQLite format support

### ⬜ Transaction Import (CSV, QIF, QFX, OFX)
- ⬜ CSV with column mapping
- ⬜ QIF parser
- ⬜ OFX/QFX parser
- ⬜ Duplicate detection
- ⬜ Auto-categorization rules
- ⬜ Import UI workflow

### ⬜ QuickBooks IIF Import
- ⬜ Research IIF format
- ⬜ Create parser
- ⬜ Document format

---

## AI-Assisted Features

### Implementation Phasing

#### Phase 1: Settings & API Configuration ✅
- ✅ Settings screen integration for AI
  - ✅ API key management (per-provider: OpenAI, Anthropic, Google)
  - ✅ Provider selection (dropdown)
  - ✅ Enable/disable toggle
  - ⬜ Multiple provider/key configurations [Future]
  - ⬜ Active provider selection in Settings [Future]
  - ⬜ Query provider for available models (dynamic model list) [Future]
  - ⬜ Model selection in AI dialog (not Settings) [Future]
  - ⬜ User-specified rules files (text box per agent + global rules) [Future]
  - ⬜ Rules scope: agent-specific and all-agents [Future]
- ✅ Backend service layer for agent API calls
- ✅ Credential storage strategy (localStorage, browser-only)

#### Phase 2: UI & Conversation Interface ✅
- ✅ AI assistant component (floating window, lower-left corner)
  - ✅ Query input field with paper airplane send icon
  - ✅ Scrollable dialog/conversation display
  - ✅ Clear conversation button
  - ✅ Minimize button (collapse to button)
  - ✅ Resizable height (drag top edge, persistent)
  - ⬜ Export conversation (PDF, text) [Future]
  - ⬜ Print conversation [Future]
- ✅ Global activation (button at bottom of nav menu)
- ⬜ Context awareness foundation [Phase 3]
  - Track active screen/route
  - Capture selected entity
  - Capture open account(s)
  - Multi-window/pane awareness (desktop: multiple screens open simultaneously)
- ⬜ **Post-MVP Refinements** (answer after first generation)
  - Placement alternatives (sidebar vs. overlay vs. top/bottom pane)
  - Optimal width/height for different query types
  - Docking behavior relative to global menu dock/undock
  - Conversation persistence strategy (per-screen, global, saved history)
  - State management across multi-tab/multi-window sessions

#### Phase 3: Q&A + Contextual Help
- ⬜ Fixed context bundle (app documentation)
  - How to use the app (navigation, screens, workflows)
  - Accounting concepts (debit/credit, accrual, balance sheet, etc.)
  - Common tasks (create entity, enter transaction, reconcile)
- ⬜ Agent can answer questions about:
  - General accounting principles
  - How to use Bonum features
  - Current entity/account context
- ⬜ Interactive setup workflows (see Story 07)
- ⬜ **RAG (Retrieval Augmented Generation)** for documentation
  - Break manual into chunks, create searchable index
  - At query time: retrieve only relevant sections
  - Avoids sending entire manual with every query
  - Options: simple keyword search or embedding-based semantic search

#### Phase 4: Non-Generative Actions (Read-Only)
- ⬜ **Tool Calling / Function Calling** framework
  - AI requests specific functions when needed (e.g., `getAccountBalance()`)
  - We execute function, return result as text
  - AI uses result to formulate answer
  - More efficient than sending all data upfront
  - Examples: "What's my checking balance?" → calls `getAccountBalance({ name: "Checking" })`
- ⬜ Query data (accounts, transactions, balances)
- ⬜ Build and display reports (Balance Sheet, Income Statement, etc.)
- ⬜ Print ledgers
- ⬜ Open/configure screens
- ⬜ Search for transactions

#### Phase 5: Generative Actions (Data Writes)
- ⬜ Enter transactions (with user review/approval)
- ⬜ Assist in reconciliation
- ⬜ Assist in account generation
- ⬜ Account mapping during import (see Import Books section)
- ⬜ **Review/Approve Workflow** (design after Phase 3 testing)
  - How to display proposed changes (diff view? preview modal? inline highlights?)
  - Approve/reject controls (per-item? batch?)
  - Undo/rollback mechanism
- ⬜ **Privacy & Data Minimization** (design before Phase 5 implementation)
  - Define what data is sent to AI API (screen name? entity ID? full transactions?)
  - User visibility/consent for data sharing
  - Local-only vs. cloud-enhanced modes
  - Audit log of what was sent to AI
- ⬜ **Error Handling & Offline** (design in Phase 2/3)
  - Graceful degradation when API unavailable
  - Error messages for failures (rate limits, invalid key, network)
  - Offline mode behavior
- ⬜ **Cost Management** (design in Phase 2/3)
  - User awareness of API costs per interaction
  - Optional rate limiting
  - Token usage tracking/display

#### Phase 6: Advanced Features (Voice, OCR, Polish)
- 🔮 Voice input (Web Speech API)
  - Microphone icon in AI wizard
  - Browser speech-to-text → agent parsing
  - Examples: "I just paid $43.97 for lunch" → agent asks clarifying questions
- 🔮 Voice output (text-to-speech)
  - Digital toggle for reading responses aloud
  - Browser Speech Synthesis API
- 🔮 Invoice/Receipt OCR (Vision models)
  - Upload image of invoice or receipt
  - Agent extracts: date, vendor, amount, line items
  - Agent suggests categorization
  - User reviews/approves generated transaction
- 🔮 Custom report generation
  - Natural language: "Show me net worth over time"
  - Agent generates chart/report configuration
  - Renders using existing report components

### 🔄 Story & Spec Development
- **Story:** `design/stories/web/07-ai-assistant.md` (core Q&A and interactive setup)
- **Component Spec:** `design/specs/web/components/ai-assistant.md` (draft)
- **Integration:** Vercel AI SDK (`ai` npm package)
- **Status:** Ready for initial generation (Phases 1-3)

### Strategy
**Integration:** Vercel AI SDK (`ai` npm package) - TypeScript toolkit for structured AI output
**Approach:** Story-driven design → lightweight specs for UI → implementation
**Provider:** User-supplied API key (OpenAI/Anthropic/Google) in Settings

### Context Management Strategy
**Problem:** Can't send entire manual + all user data with every query (token limits, cost, latency)

**Solution - Hybrid Approach:**
1. **Static Context** (current): Basic system prompt with app overview
2. **RAG for Documentation** (Phase 3): Retrieve relevant manual sections on-demand
   - Pre-index documentation chunks
   - Search based on user query
   - Send only relevant 2-3 sections
3. **Tool Calling for Live Data** (Phase 4): Let AI request specific data when needed
   - AI: "I need the checking account balance"
   - App: Executes `getAccountBalance()`, returns result
   - AI: Uses result to answer user
4. **Conversation History**: Full message history sent each time (context preservation)

**Benefits:**
- Stays within token limits
- Cost-efficient (only pay for what's needed)
- Faster responses (less data to process)
- Scalable to large manuals and datasets

### 🔄 Planned AI Assistance Use Cases

#### Phase 1: Stories & Core Infrastructure
- ⬜ **Story:** New user needs help setting up account structure
- ⬜ **Story:** User unsure how to create starting balances
- ⬜ **Story:** User needs help categorizing transactions
- ⬜ **Story:** User unsure how to handle amortization/capitalization
- ⬜ **Story:** User mapping 100+ accounts during GnuCash import
- ⬜ Add AI provider settings (API key, provider choice, auto-apply confidence threshold)
- ⬜ Create AI service wrapper (`lib/ai/wizard.ts`)
- ⬜ Build reusable `AIWizardBubble.svelte` component (floating assistant)

#### Phase 2: Import Account Mapping (First Implementation)
- ⬜ Implement `generateObject()` for account mapping suggestions
- ⬜ UI: Show AI suggestions with confidence indicators (🟢 High, 🟡 Medium, 🔴 Low)
- ⬜ UI: Manual override dropdowns for low-confidence mappings
- ⬜ Store `gnucash_guid` in account table for future import detection
- ⬜ Complete import flow: parse → AI suggest → user review → create accounts/transactions

#### Phase 3: Additional AI Assistance
- ⬜ Context-aware help bubble on any screen
- ⬜ Transaction categorization suggestions
- ⬜ Setup wizard for new users

### Prerequisites
- ✅ Virtual scrolling (for large imports) - Complete! Grid refactor + CSS `content-visibility`
- ✅ Import parser complete (GnuCash XML)
- ⬜ Schema: Add `gnucash_guid TEXT` column to `account` table
- ⬜ Schema: Add `gnucash_guid TEXT` column to `entry` table (for transaction deduplication)

**Note:** Stories come first, specs minimal (UI pattern only). AI wizard is reusable across all use cases.

---

## Production Backend (Sereus Integration)

### ⬜ Quereus Backend Implementation
Currently all stubs:
- ⬜ Connect to Sereus/Quereus network
- ⬜ Implement DataService interface
- ⬜ Handle sync conflicts
- ⬜ Offline queue

---

## Future Features (Post-MVP)

### 🔮 Performance Optimizations

#### Virtual Scrolling (Optional Enhancement)
**Status:** Deferred - Current implementation handles 20K+ transactions well
- **Trigger:** Only needed if user feedback indicates performance issues beyond 50K transactions
- **Implementation:** TanStack Virtual for Svelte (`yarn add @tanstack/svelte-virtual` when needed)
- **Approach:** JavaScript-driven windowing with precise buffer control
- **Settings Toggle:** Allow users to enable/disable (some prefer full scrollbar for jump-to-date)
- **Challenges to address:**
  - Dynamic row heights (collapsed vs. expanded vs. edit modes)
  - Keyboard navigation across virtual boundaries
  - Edit mode state persistence for off-screen rows
  - Scroll position tracking with virtualized items
- **Alternative:** Continue relying on CSS `content-visibility: auto` (browser-native, zero JS overhead)

### 🔮 Reporting Enhancements
- Multi-period comparisons
- Budget vs actual
- Trend analysis
- Graphical reports

### 🔮 Advanced Features (from stories/STATUS.md)
- Partners (vendors, customers, employees)
- Invoices & AP/AR
- Paying vendors
- 1099 reporting
- Recurring transactions
- Attachments (receipts, invoices)
- Job/project costing

### 🔮 Mobile App
Framework decision: NativeScript-Svelte (primary), React Native (fallback)
- ⬜ Scaffold mobile app
- ⬜ Adapt stories for mobile UX
- ⬜ Generate mobile screens
- ⬜ Implement mobile-specific features (camera, quick entry)

### 🔮 Multi-Entity Consolidation
- Consolidation reports across entities
- Inter-entity elimination
- EntityGroup definitions

---

## Completed (Recent)

### ✅ Web App Foundation
- SQLite mock backend (sql.js + localStorage)
- i18n infrastructure (dictionary-based, English MVP)
- View state persistence (expand/collapse, modes)
- Logger with configurable levels
- DataService abstraction layer

### ✅ Core Screens (v1)
- Home: Entity list with VBS dashboard
- Account Catalog: Hierarchical group management
- Accounts View: Balance Sheet / Trial Balance / Income Statement modes
  - Date range support (period-based filtering for I/E accounts)
  - Date persistence in viewState
  - Onblur optimization for large datasets
  - Expand/collapse, verification line
- Ledger: Transaction entry with autocomplete, keyboard navigation, split support
  - ✅ **Reusable AccountAutocomplete Component** - used in all account inputs
  - ✅ Split button (|) to **right** of account input, disabled when account selected
  - ✅ **Colon completion FIXED** - Search results now sorted by relevance (`:` uses top **relevant** result)
  - ✅ Tab from account input: goes to split button if empty, skips to debit if filled
  - ✅ Tab in Debit OR Credit (simple mode) → saves and focuses date of next row
  - ✅ Tab in Debit OR Credit (split mode) → focuses first split's Note field
  - ✅ Click transaction row to edit (placeholder - logs click)
  - ✅ Split entry mode with multi-line UI (REFINED)
    - Main transaction line shows current account (disabled) with debit/credit amount
    - Split rows: Note, Account (autocomplete), **Debit, Credit** (separate columns), Remove
    - No informational header row
  - ✅ **Auto-balance calculation** (pre-fills appropriate debit OR credit field)
    - If main account has Credit $123.45, first split defaults to Debit $123.45
    - If user changes first split to Debit $98, next split defaults to Debit $25.45
  - ✅ Tab flow in split mode: Debit/Credit → First split Note → Account → Debit → Credit → Next split
  - ✅ **Transaction Entry per Spec (Complete):**
    - ✅ Auto-select text on focus (all input fields)
    - ✅ Debit/Credit mutual exclusion via blur (both always enabled)
    - ✅ Split mode initial focus: Debit field of main transaction line
    - ✅ Tab from last split Credit: if balanced → Save button, if unbalanced → auto-create new split
    - ✅ Button order: [Save] [Cancel] [+ Add Split]
    - ✅ Enter key: in field = save, on button = activate
    - ✅ Simple mode: Tab from Debit or Credit → save & new blank row
    - ✅ Spec-driven implementation: `/design/specs/web/components/transaction-edit.md`
  - ✅ **Tab from last split credit → "Add Split" button → "Save" → "Cancel"**
  - ✅ Add/remove split entries (any number of debits or credits)
  - ✅ Save split transactions with multiple entries
  - ✅ Space/Enter on split button toggles split mode
- Transaction Search: Browse all transactions, export to CSV/Excel

### ✅ Documentation & Planning
- Vision and requirements docs
- Schema design (Units, Entities, Accounts, Transactions)
- Web user stories (01-05)
- Specs for: import formats, VBS, i18n, backend, view state
- Appeus workflow integration

---

## Schema & Design Reference

### Core Decisions (Resolved)

**D1: Signed Amounts**
- Single `amount` field: positive = debit, negative = credit

**D2: Entry-Level Tags**
- Tags on Entry (not Transaction) for split transaction support

**D3: Units Model**
- Generalized from "Currency" to "Unit" (currencies, crypto, commodities, inventory)
- `displayDivisor` for non-decimal units (time, dozens)

**D4: Retained Earnings**
- Pseudo-account (not in DB)
- Calculated as: Income - Expense from inception

**D5: AccountGroup Hierarchy**
- `parentId` on AccountGroup for hierarchy
- AccountType enum still used for top-level categorization

**D6: Account Hierarchy**
- `parentId` on Account (per-entity hierarchy)
- Example: "Bank of America" → Checking, Savings

**D7: Imbalance Account**
- Each entity has system "Imbalance" account
- Flagged prominently in reports
- Cannot close period with Imbalance balance

### Open Questions (For Future Iteration)

**Q1: Attachments** — How to store receipts/invoices? (Entity vs Sereus file handling)

**Q2: Recurring Transactions** — Template system for subscriptions, payroll?

**Q3: Invoice/Bill Entity** — Formal AR/AP tracking vs simple transactions?

**Q4: Opening Balances** — Special transaction type or regular dated entry?

**Q5: EntityGroup** — Formal consolidation sets or UI-driven ad-hoc selection?

---

## Notes

- Original design doc: `docs/Schema-original.md`
- Active design surface: `design/`
- Generated code: `apps/web/`, `apps/mobile/` (future)
- Test utilities: `test/manual/`
- Appeus toolkit: `appeus/` (submodule)

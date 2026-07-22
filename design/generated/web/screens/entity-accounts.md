---
dependsOn:
  - design/specs/web/screens/accounts-view.md
  - design/specs/web/screens/saved-reports-ux.md
  - design/stories/web/01-firstlook.md
  - design/stories/web/04-reporting.md
  - design/specs/domain/rules.md
  - design/specs/domain/schema.md
  - design/specs/domain/export.md
depHashes:
  design/specs/web/screens/accounts-view.md: ad5d8c72139ec40e54831052969aae3dd9815735b7f80054df9f8b11af2be11b
  design/specs/web/screens/saved-reports-ux.md: 0c48670d4d21219e8ed1e3c55290234327f154f1b11e5fe2eab9b2842b765269
  design/stories/web/01-firstlook.md: 11e9c354253b25afbcbaee117a3cc645ba53348eaf9c46a831127520807a3222
  design/stories/web/04-reporting.md: 9f2e90d7cefd3e1d23787b6edaafe84cddb6d39c556c1c08c21dd92ff18f90c5
  design/specs/domain/rules.md: fb5f4acfe557b963423b354d66c89b5fcf5f37364de3b03ef2096f03d5b09244
  design/specs/domain/schema.md: 44ec79253286e31c446d1238de03d3282379e50a04969629998d59753f6a4d80
  design/specs/domain/export.md: bee9d08052449e9c34f929adc94dc5b5f472de0471cf0a247d3f5a73f405295a
provides:
  - screen:EntityAccounts
needs:
  - service:DataService
  - service:native-books
  - store:entities
  - store:accounts
  - store:savedReports
  - store:viewState
generated: 2026-07-22
lastUpdated: 2026-07-22
component: apps/web/src/routes/entities/[id]/+page.svelte
status: implemented
---

# Consolidation: Entity Accounts View (reports)

**Route:** `/entities/[id]`
**Component:** `apps/web/src/routes/entities/[id]/+page.svelte`
**Generated:** 2026-07-22 · reconciled to the implementation (the built screen is the source of truth for
this consolidation).

---

## Purpose

An entity's accounts rendered as multi-period financial reports — Balance Sheet, Trial Balance, Income
Statement (Cash Flow and Custom are selectable/deferred). One seamless hierarchy (account groups + account
`parentId`), per-column dates (fixed or relative), optional variance (Δ) columns, saved reports, and export.
This is the *analytical* view; per-entity account CRUD lives in **Manage Accounts** (`account-edit.md`), and
the shared group taxonomy in the **Catalog** (`catalog.md`). See
[accounts-view.md](../../../specs/web/screens/accounts-view.md) and
[saved-reports-ux.md](../../../specs/web/screens/saved-reports-ux.md).

## Architecture

- **Screen** (`+page.svelte`): all report state (`reportMode`, `columns[]`, `varianceFormat`, expand map,
  filters), the render tree, and the header controls.
- **Columns model**: `columns[]` (each `{ name, endField, startField?, varianceLeft? }`); `columnSlots`
  interleaves data + variance cells; `resolvedColumns` chains relative dates (rightmost vs today, each other
  vs its right neighbour). One `DataService.getBalanceSheet(entityId, end, start?)` per column →
  `balanceByColumn[]`. `getBalanceSheet` does single-table indexed reads joined in JS (not a store-side
  3-way JOIN — ~140× faster; see `tmp/quereus-join-index-perf.md`).
- **Render**: `reportRowsByType` builds one node tree per type from the group tree + account `parentId`
  (unified `emitGroup`/`emitAccount`), producing depth-tagged rows with a per-column `amounts[]`. CSS grid +
  subgrid rows; content-sized columns; horizontal scroll (`.report-scroll`); sticky name column. Amounts use
  accounting sign convention via `presentBalance` + `NORMAL_BALANCE` (see rules.md).
- **Persistence** (`$lib/stores/viewState`): mode, columns, expand map, RE-expanded, filters, variance format
  — keyed per entity.
- **Saved reports** (`$lib/stores/savedReports`): named configs in `localStorage['bonum-saved-reports']`,
  shared across entities (legacy pre-`columns[]` reports migrated on load).
- **Export** (`$lib/import/native.ts` `exportBooks`): native re-importable `.json` dump; browser print for PDF.

---

## Source Requirements Verification

### Report modes (accounts-view.md § Report Modes; 04-reporting.md)
| Requirement | Status | Implementation |
|---|---|---|
| Balance Sheet — A/L/E, "as of", cumulative | ✅ | `getVisibleTypes` `balance_sheet`; `requiresDateRange=false` |
| BS — RE expandable under Equity (I/E breakdown), in Equity total | ✅ | `retainedEarningsExpandable`; RE pseudo-node; `typeTotalOf('EQUITY')` adds net income |
| Trial Balance — all 5 types as sections | ✅ | `getVisibleTypes` `trial_balance` |
| TB — RE non-expandable, in Equity total; verification line | ✅ | RE node (no toggle); `isBalancedOf`/`imbalanceOf` per column |
| Income Statement — I/E only, From/To, period-filtered; Net Income | ✅ | `getVisibleTypes` `income_statement`; `startField`→`getBalanceSheet`; `netIncomeOf` per column |
| Cash Flow | ⛔ Deferred | selectable; renders default (all 5); no Operating/Investing/Financing map |
| Custom | ⛔ Deferred | **removed** from the mode selector (scope pending) |

### Dates (accounts-view.md § Date Inputs)
| Requirement | Status | Implementation |
|---|---|---|
| Date field(s) sit **above** their number column (basis over picker/resolved) | ✅ | grid header `columnHeader`/`dateCell` snippets |
| Basis = Fixed or relative token (Start/End · current/previous · month/quarter/year, + Today for rightmost) | ✅ | `resolveTokenDate`; `endTokens`/`startTokens` by role + position |
| Chained relative resolution (rightmost vs today; left vs right-neighbour; "previous"-only on left) | ✅ | `resolvedColumns` derived |
| BS/TB single "as of"; IS/CF From+To | ✅ | `requiresDateRange`; per-column `startField` |
| Reload on basis change / fixed-date blur | ✅ | `onDateFieldChange`; `handleDateInput`/`handleDateBlur` |

### Hierarchy & display (accounts-view.md § Account Display; schema.md § Hierarchy; rules.md)
| Requirement | Status | Implementation |
|---|---|---|
| One logical path: group tree → account `parentId`; groups & accounts differ only by colour | ✅ | unified `emitGroup`/`emitAccount`; single-path invariant (schema composite FK) |
| Parent account with own postings **and** children → `(direct)` synthetic child | ✅ | `emitAccount` emits `(direct)` row when own≠0 and has kids |
| Expand/collapse extends to parent **accounts**, not just groups; Expand/Collapse All | ✅ | `toggleId` on accounts+groups; `expandAll` covers parent accounts |
| Reverse-indent funnel (names forward, amounts reverse), per column | ✅ | `--depth` padding; `.gname`/`.gamount` |
| Content-sized columns; horizontal scroll; sticky name column | ✅ | CSS grid + subgrid; `.report-scroll`; sticky `.gname` |
| Sign convention (credit-normal reads positive) | ✅ | `presentBalance` + `NORMAL_BALANCE` |
| Account names link to `/ledger/[id]` | ✅ | `.rr-label.link` anchor |
| Full group→account path hover tooltip | ⛔ Deferred | link `title` is the name only |

### Multi-column & variance (saved-reports-ux.md; accounts-view.md § Columns & variance)
| Requirement | Status | Implementation |
|---|---|---|
| Add columns (≤12); per-column ☰ menu | ✅ | `columnHeader` ☰; `MAX_COLUMNS=12` |
| Insert-left ("older") column | ✅ | `insertColumnBefore` |
| Remove column (hidden on the last) | ✅ | `removeColumn` |
| Per-gap variance (Δ) toggle — "Show change vs. prior" (Δ opens **left** of the newer column; absent on leftmost) | ✅ | `toggleColumnVariance` → `varianceLeft`; `columnSlots` |
| Δ$ / Δ% (— when prior 0); format $/%/both in View menu; green up/red down | ✅ | `formatVariance`; `varianceFormat`; `.gv.up/.down` |
| Per-column footer verification (BS/TB) / net income (IS) | ✅ | `grid-foot` per slot (variance shown for net income; blank for BS verification) |

### Filters, saved reports, export (accounts-view.md § Display Filters / User Actions; export.md)
| Requirement | Status | Implementation |
|---|---|---|
| ⚙ View menu: hide zero-balance; show closed accounts; variance format | ✅ | `toggleHideZeroBalance`/`toggleShowClosedAccounts`/`setVarianceFormat` |
| ⭐ Reports: Save current view…; list → load / delete | ✅ | `confirmSaveReport`/`applySavedReport`/`deleteReport`; saved config = mode + columns(bases/variance) + filters + format |
| Relative-basis saved reports auto-adjust on load | ✅ | stored as `{basis,fixedDate}`; resolved at load |
| Export ▾: native `.json` (real); CSV / XLSX / structured PDF (stubbed); Print / Save-as-PDF (browser) | ✅ / ⛔ | `exportNative`; CSV/XLSX/PDF disabled; `printReport` + `@media print` |
| Persist mode / columns / expand / filters / format per entity | ✅ | `persistViewState` + load `$effect` |
| Cross-link ⚙ Manage Accounts | ✅ | header link → `/entities/[id]/accounts` |

### Empty & error states (accounts-view.md § Empty/Error States; 04-reporting.md variants)
| Requirement | Status | Implementation |
|---|---|---|
| No accounts → message | ⚠️ Partial | `.empty-state` copy; no wired "Create accounts / Import" actions (Manage Accounts now exists to link to) |
| Empty entity still renders valid ($0 = $0 balanced) | ✅ | all totals default 0 |
| No transactions → $0 balances | ✅ | balances default 0 |
| Failed to load → error + Retry | ⛔ Deferred | `loadEntityData` catch logs only; no error/retry UI |
| Date range invalid (From > To) | ⛔ Deferred | no validation |

---

## Deferred / Notes (demanded by stories/specs, not yet built)

- **Cash Flow mode** — selectable but unimplemented; intended as a convention-based group→activity map
  (Operating / Investing / Financing), no Custom mode required.
- **Custom mode** — removed from the selector pending scope for user-selected group sets.
- **Real CSV / XLSX / structured-PDF export** — stubbed (menu items disabled); layout in export.md.
- **Load-error + Retry UI** and **From ≤ To date validation** — error states in the spec, not implemented.
- **Full group→account path tooltip** on account rows — currently the name only.
- **Balance-sheet footer variance** (net-worth Δ) — left blank; Δ shown only for the Income Statement footer.
- **Saved-reports polish** — Manage Reports modal, rename/duplicate (today: save under a new name).
- **Sticky top header row** on vertical scroll (only the name column sticks horizontally today).
- **Future (spec):** graphs/charts, drill-down on variance, report sharing / scheduling / templates.

---
dependsOn:
  - design/specs/web/screens/search.md
  - design/stories/web/06-search.md
depHashes:
  design/specs/web/screens/search.md: 57f7f50bb05e63843ce0183127fb63a59425b079f968f75da6d149b55ab8ca04
  design/stories/web/06-search.md: 1d867a0c6ad9399593830444fe68c41cafc9643371bc48db7b2c10407880320e
provides:
  - screen:Search
  - component:TransactionResultsTable
needs:
  - service:DataService
  - util:export
  - store:notifications
generated: 2026-07-22
lastUpdated: 2026-07-22
component: apps/web/src/routes/search/+page.svelte
status: partial
---

# Consolidation: Transaction Search Screen

**Route:** `/search`
**Component:** `apps/web/src/routes/search/+page.svelte` (also
`apps/web/src/lib/components/TransactionResultsTable.svelte`)
**Generated:** 2026-07-22 · reconciled to the implementation (the built screen is the source of truth for
this consolidation).

---

## Purpose

Cross-entity **"show all"** transaction browser — Phase 1 of the search story. A single button loads every
entry across every entity into a shared results table for balance verification, data debugging, and
export. The story's Phase 2 (query builder, saved searches, filtering) is not built. Data comes from
`DataService.getAllTransactions`, which was rewritten for scale (single-table indexed reads joined in JS
instead of a cross-entity SQL JOIN — see `tmp/quereus-join-index-perf.md`); "show all" loads everything
with no pagination. See [search.md](../../../specs/web/screens/search.md) and
[06-search.md](../../../stories/web/06-search.md).

## Architecture

- **Screen** (`+page.svelte`): holds `entries`, `loading`, `showExportMenu`. `loadAllTransactions` calls
  the service; on failure it raises a toast via `notifyError` (no inline error state). Renders the header
  (load + export) and delegates all display to the table.
- **Table** (`$lib/components/TransactionResultsTable.svelte`): reusable. Groups flat `LedgerEntry[]` by
  transaction (`transactionGroups`), renders a header row + indented split rows, computes debit/credit
  `totals` + balance verification. Props: `entries`, `showEntity`, `showTotals`, `emptyMessage`.
- **Data** (`DataService.getAllTransactions`): flattens `entry`/`txn`/`account`/`entity` in JS, ordered
  date DESC; decorates each entry with `entityName`, `accountName`, `accountPath`.
- **Export** (`$lib/utils/export.ts`): `exportToCSV` / `exportToExcel` (xlsx), same grouping + totals;
  Excel failure falls back to CSV.

---

## Source Requirements Verification

### specs/web/screens/search.md — Phase 1

#### Initial state & loading
| Requirement | Status | Implementation |
|---|---|---|
| Title + "Show All Transactions" button | ✅ | `page-header`; `btn-primary` → `loadAllTransactions` |
| Empty message before load | ✅ | Table `empty-state` (`search.empty`) |
| Loading indicator while fetching | ⚠️ Partial | Button label flips to "Loading..." + `disabled`; no "Loading transactions..." spinner |
| Cross-entity (all entities together) | ✅ | `getAllTransactions` spans all `entity` rows |

#### Transaction display (table)
| Requirement | Status | Implementation |
|---|---|---|
| Txn header row: date, entity link, memo, ref ("—" if empty) | ✅ | `txn-header-row`; `<a href="/entities/{id}">`; `memo/reference \|\| '—'` |
| Split rows indented, all shown as splits (no 2-entry offset shortcut) | ✅ | `split-row` per `txnGroup.entries`; `↳` account, `.split-account` |
| Account link → ledger, full path on hover | ✅ | `<a href="/ledger/{accountId}" title={accountPath}>` |
| Debit if amount > 0, credit if < 0 (abs), never both | ✅ | `amount > 0` / `amount < 0` cell guards |
| Entry-level note shown | ✅ | `.split-note` when `entry.note` |
| Header visually distinct | ✅ | `.txn-header-row` background/weight (CSS) |
| Date formatted per user preference | ⚠️ Partial | Raw `txnGroup.date` rendered; no locale/pref formatting |

#### Totals footer
| Requirement | Status | Implementation |
|---|---|---|
| Entry count | ⛔ | No entry-count cell rendered; only debit/credit totals + verification |
| Total debits / total credits | ✅ | `totals()` sums by sign; `totals-row` |
| ✓ Balanced / ⚠ Imbalance within $0.01 | ✅ | `isBalanced = imbalance < 0.01`; `verification-row` balanced/imbalanced |

#### Export
| Requirement | Status | Implementation |
|---|---|---|
| Export button appears after load, CSV + Excel menu | ✅ | `export-dropdown` shown when `entries.length > 0`; `handleExportCSV/Excel` |
| Filename `transactions-YYYY-MM-DD.{csv,xlsx}` | ✅ | ISO date slice in both handlers |
| Content: header, txn rows, split rows, totals, verification | ✅ | `exportToCSV` / `exportToExcel` row builders |
| Amounts as decimal (cents ÷ 100, 2 dp) | ✅ | `formatAmountForExport` |
| Excel failure falls back to CSV | ✅ | `handleExportExcel` catch → `handleExportCSV` |

#### Navigation & errors
| Requirement | Status | Implementation |
|---|---|---|
| Entity name → `/entities/[id]` | ✅ | Table header-row link |
| Account name → `/ledger/[accountId]`, path tooltip | ✅ | Table split-row link `title` |
| "Failed to load" error shown | ⚠️ Partial | Now a global toast (`notifyError`), not the spec's inline `Error loading transactions:` block |
| Retry button on failure | ⛔ | No retry control (user re-clicks "Show All") |
| Distinct "No transactions found" vs initial-empty message | ⛔ | Single `emptyMessage`; no post-load empty variant |

#### Behavior the old doc claimed (not in current code)
| Requirement | Status | Implementation |
|---|---|---|
| Inline `error` state + `error-message` block | ⛔ | Removed — errors surface via the notifications store toast |
| Expand/Collapse per-txn + Expand All/Collapse All | ⛔ | Splits always expanded; no expand state or buttons |
| Table props `showAccount`, `allowExpand` | ⛔ | Not on component; props are `showEntity`/`showTotals`/`emptyMessage` |

### stories/web/06-search.md
| Requirement | Status | Notes |
|---|---|---|
| Results across entities, expandable, debit/credit totals + balance | ✅ | Phase 1 table (expansion is static-all, not per-txn) |
| Export results to CSV | ✅ | Alt Path C |
| Search builder (fields, operators, AND/OR grouping, preview) | ⛔ Deferred | Phase 2, not built |
| Saved searches (persist, run/edit/duplicate/delete) | ⛔ Deferred | Phase 2, not built; screen has no saved-search list |
| Date-range filtering / presets | ⛔ Deferred | Phase 2, not built |
| Invalid-criterion validation (bad regex / non-numeric) | ⛔ Deferred | No criteria to validate yet |
| ≥100 results efficiently (pagination/virtual scroll) | ⛔ Deferred | Loads + renders everything; see below |

---

## Deferred / Notes (demanded by stories/specs, not yet built)

- **Query builder + saved searches (Phase 2).** The entire story flow (criteria fields, boolean
  grouping, human-readable preview, named saved searches with run/edit/duplicate/delete) is
  unimplemented. Phase 1 is a fixed "show all" with no filtering. This is the biggest gap.
- **Pagination / virtual scroll.** "Show all" loads every entry and renders it in one table — no
  `LIMIT`. `getAllTransactions` was rewritten (JS-side joins) so large loads finish, but rendering
  thousands of rows remains the follow-up.
- **Expand/collapse controls** absent — every transaction's splits render inline; no per-txn toggle.
- **Entry-count total** — spec footer shows "N entries"; the table renders only debit/credit totals.
- **Retry-on-error** — failures raise a toast; no inline error block or Retry button.
- **Distinct post-load "No transactions found"** message — only the single pre-load empty message.
- **Date/locale formatting** — dates render as stored strings, not per user preference.

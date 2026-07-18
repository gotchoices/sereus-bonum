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
generated: 2026-07-18
lastUpdated: 2026-07-18
component: apps/web/src/routes/search/+page.svelte
---

# Consolidation: Transaction Search Screen

**Route:** `/search`
**Component:** `apps/web/src/routes/search/+page.svelte`
**Generated:** 2026-07-18

---

## Purpose

Cross-entity **"show all"** transaction browser (Phase 1 of the search story). One button loads every
entry across every entity into a shared results table for balance verification, data debugging, and
export. The story's Phase 2 (query builder, saved searches) is not built. Data comes from
`DataService.getAllTransactions`, which was rewritten for scale (single-table reads joined in JS
instead of a cross-entity SQL JOIN); "show all" loads everything with no pagination.

## Architecture

- **Screen** (`+page.svelte`): holds `entries`, `loading`, `error`, `showExportMenu`. `loadAllTransactions`
  calls the service; renders header (load + export) and delegates all display to the table.
- **Table** (`$lib/components/TransactionResultsTable.svelte`): reusable. Groups flat `LedgerEntry[]` by
  transaction (`transactionGroups`), renders header row + split rows, computes debit/credit `totals`.
  Props: `entries`, `showEntity`, `showTotals`, `emptyMessage`.
- **Data** (`DataService.getAllTransactions`): flattens `entry`/`txn`/`account`/`entity` in JS, ordered
  date DESC; decorates each entry with `entityName`, `accountName`, `accountPath`.
- **Export** (`$lib/utils/export.ts`): `exportToCSV` / `exportToExcel` (xlsx), same grouping + totals.

---

## Source Requirements Verification

### specs/web/screens/search.md — Phase 1

#### Initial state & loading
| Requirement | Status | Implementation |
|---|---|---|
| Title + "Show All Transactions" button | ✅ | `page-header`; `btn-primary` → `loadAllTransactions` |
| Empty message before load | ✅ | Table `empty-state` (`search.empty`) |
| Loading indicator while fetching | ⚠️ | Button label flips to "Loading..." + `disabled`; no spinner |
| Cross-entity (all entities together) | ✅ | `getAllTransactions` iterates all `entity` rows |

#### Transaction display (table)
| Requirement | Status | Implementation |
|---|---|---|
| Txn header row: date, entity link, memo, ref ("—" if empty) | ✅ | `txn-header-row`; `<a href="/entities/{id}">`; `memo/reference \|\| '—'` |
| Split rows indented, all shown as splits (no offset shortcut) | ✅ | `split-row` per `txnGroup.entries`; `↳` account, `split-account` |
| Account link → ledger, full path on hover | ✅ | `<a href="/ledger/{accountId}" title={accountPath}>` |
| Debit if amount > 0, credit if < 0 (abs), never both | ✅ | `amount > 0` / `amount < 0` cell guards |
| Entry-level note shown | ✅ | `split-note` when `entry.note` |
| Header visually distinct | ✅ | `txn-header-row` background/weight (CSS) |
| Date formatted per user preference | ⚠️ | Raw `txnGroup.date` rendered; no locale/pref formatting |

#### Totals footer
| Requirement | Status | Implementation |
|---|---|---|
| Entry count | ⚠️ | Totals/verification rows present; **no entry-count cell** rendered |
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
| "Failed to load" error shown | ✅ | `error-message` block from `error` state |
| Retry button on failure | ⛔ | Error message only; no retry control |
| Distinct "No transactions found" vs initial-empty message | ⚠️ | Single `emptyMessage`; no post-load empty variant |

#### Behavior the old doc claimed (not in current code)
| Requirement | Status | Implementation |
|---|---|---|
| Expand/Collapse per-txn + Expand All/Collapse All | ⛔ | Splits always expanded; no expand state or buttons |
| Table props `showAccount`, `allowExpand` | ⛔ | Not on component; props are `showEntity`/`showTotals`/`emptyMessage` |

### stories/web/06-search.md
| Requirement | Status | Notes |
|---|---|---|
| Results across entities, expandable, debit/credit totals + balance | ✅ | Phase 1 table (expansion is static-all) |
| Export results to CSV | ✅ | Alt Path C |
| Search builder (fields, operators, AND/OR grouping, preview) | ⛔ Deferred | Phase 2, not built |
| Saved searches (persist, run/edit/duplicate/delete) | ⛔ Deferred | Phase 2, not built |
| ≥100 results efficiently (pagination/virtual scroll) | ⛔ Deferred | Loads + renders everything; see below |

---

## Deferred / Notes
- **Query builder + saved searches (Phase 2).** The entire story flow (criteria fields, boolean
  grouping, named searches) is unimplemented; Phase 1 is a fixed "show all".
- **Pagination / virtual scroll.** "Show all" loads every entry (feeds export-all) and renders it
  in one table — no `LIMIT`. `getAllTransactions` was rewritten (JS-side joins) to make large loads
  finish, but rendering thousands of rows remains the follow-up.
- **Expand/collapse controls** absent — every transaction's splits render inline. No per-txn toggle.
- **Entry-count total** and **retry-on-error** are minor spec items not yet wired.
- **Date/locale formatting** — dates render as stored strings, not per user preference.

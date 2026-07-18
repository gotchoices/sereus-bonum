---
dependsOn:
  - design/specs/web/screens/accounts-view.md
  - design/stories/web/01-firstlook.md
  - design/stories/web/04-reporting.md
depHashes:
  design/specs/web/screens/accounts-view.md: 47c819078fb5a996e8b72b050a26ee7c36d3b23493ea8fda578cb4dc65ca0f68
  design/stories/web/01-firstlook.md: a383e823aa5e362529d07d75688744556ef21848e59b20fa76986ba214169f06
  design/stories/web/04-reporting.md: 9f2e90d7cefd3e1d23787b6edaafe84cddb6d39c556c1c08c21dd92ff18f90c5
provides:
  - screen:EntityAccounts
needs:
  - service:DataService
  - service:native-books
  - store:entities
  - store:accounts
generated: 2026-07-18
lastUpdated: 2026-07-18
component: apps/web/src/routes/entities/[id]/+page.svelte
---

# Consolidation: Entity Accounts View

**Route:** `/entities/[id]`
**Component:** `apps/web/src/routes/entities/[id]/+page.svelte`
**Generated:** 2026-07-18

---

## Purpose

An entity's accounts rendered as one of several report modes (Balance Sheet, Trial Balance, Income
Statement; Cash Flow / Custom are future). Hierarchical Type → Group → Account tree with expand/collapse,
mode-appropriate date inputs, per-entity persistence, and per-account links to the ledger. All balances
come from a single `DataService.getBalanceSheet(entityId, endDate, startDate?)` call; the screen holds no
balance math beyond netIncome/verification derivations. See
[specs/web/screens/accounts-view.md](../../../specs/web/screens/accounts-view.md).

## Architecture

- **Screen** (`+page.svelte`): mode + date state, `loadEntityData` fetch, and the type/group/account
  render tree. Visible types per mode via `getVisibleTypes`; totals via `getTypeTotal` / `getGroupTotal` /
  `getAccountBalance`.
- **Data** (`$lib/data` `getBalanceSheet`): returns `BalanceSheetData` (`totalAssets/Liabilities/Equity/
  Income/Expense`, `accountBalances[]`, `groupBalances[]`). Production impl loads single-table indexed
  reads and joins in JS (not a 3-way SQL `JOIN`) — ~140× faster on the IndexedDB store; balance math and
  output shape unchanged. Renders ~5 s at 20k txns.
- **Export** (`$lib/import/native.ts` `exportBooks`): header Export button `exportNative` dumps the
  entity's full books to a re-importable native `.json` download.
- **Persistence** (`$lib/stores/viewState` `loadViewState`/`saveViewState`): mode, dates, expand map, and
  RE-expanded flag, keyed per entity.

---

## Source Requirements Verification

### Report modes
| Requirement | Status | Implementation |
|---|---|---|
| Balance Sheet: A/L/E only, "As of" single date, cumulative | ✅ | `getVisibleTypes` `balance_sheet`; `requiresDateRange` false |
| Balance Sheet: RE expandable under Equity, I/E breakdown, in Equity total | ✅ | `retainedEarningsExpandable`; RE breakdown block; `getTypeTotal('EQUITY')` adds `netIncome` |
| Trial Balance: all 5 types as sections | ✅ | `getVisibleTypes` `trial_balance` |
| Trial Balance: RE non-expandable line, in Equity total | ✅ | non-expandable RE branch; `getTypeTotal('EQUITY')` |
| Trial Balance: verification line (balanced / imbalance) | ✅ | `isBalanced` / `imbalanceAmount`; verification-row |
| Income Statement: I/E only, From/To required, period-filtered | ✅ | `getVisibleTypes` `income_statement`; `requiresDateRange`; `startDate` passed to `getBalanceSheet` |
| Income Statement: default Jan 1 → today | ✅ | `$effect` sets `startDate` to `${year}-01-01` when required |
| Income Statement: Net Income line | ✅ | `netIncome`; net-income-row footer |
| Cash Flow (future) | ⚠️ Placeholder | Dropdown option + `requiresDateRange`; falls to `getVisibleTypes` default (all 5), no Operating/Investing/Financing grouping |
| Custom (future) | ⚠️ Placeholder | Dropdown option only; default all-5 render, no group selection |

### Date inputs
| Requirement | Status | Implementation |
|---|---|---|
| Single "As of" vs stacked From/To per mode | ✅ | `requiresDateRange` toggle; `date-range-stack` |
| Persist dates per entity | ✅ | `accounts-dates-{entityId}` via `persistViewState` |
| Reload on blur, not per keystroke | ✅ | `handleDateInput` sets `needsReload`; `handleDateBlur` refetches |

### Account display
| Requirement | Status | Implementation |
|---|---|---|
| Type → Group → Account hierarchy, indented | ✅ | `topLevelGroupsByType` / `childGroupsByParent`; `.account-row(.child)` CSS |
| Expand/collapse header + Expand All / Collapse All | ✅ | `toggleGroup`; `expandAll` / `collapseAll` |
| Account names link to `/ledger/[id]` | ✅ | `.account-name` anchor `href="/ledger/{account.id}"` |
| Hover tooltip with full account path | ⛔ Missing | No `title` on account link |
| Hide empty/zero-balance groups (future preference) | ⚠️ Partial | `hasAccounts`/`hasKids` guard hides accountless groups; no zero-balance toggle |

### User actions & persistence
| Requirement | Status | Implementation |
|---|---|---|
| Change mode (dropdown) | ✅ | `setMode`; persists `accounts-mode-{entityId}` |
| Navigate to ledger | ✅ | account-name links |
| Export → native re-importable `.json` | ✅ | `exportNative` → `exportBooks` (native books round-trip) |
| Add Column (future) | ✅ Placeholder | disabled `+` button |
| Save Report (future) | ✅ Placeholder | disabled `⭐` button |
| Persist mode / dates / expand state per entity | ✅ | `loadViewState` on mount; `saveViewState` on each mutation |

### Empty & error states
| Requirement | Status | Implementation |
|---|---|---|
| No accounts message | ⚠️ Partial | `.empty-state` text (`no_accounts` + `create_prompt`); no Create/Import action buttons |
| No transactions → $0.00 balances | ✅ | `getAccountBalance` defaults to 0 |
| Failed to load → error + Retry | ⛔ Missing | `loadEntityData` catch only logs; no error UI / retry |
| Date range invalid (From after To) | ⛔ Missing | No validation |

---

## Deferred / Notes
- **Cash Flow & Custom modes** are selectable but not implemented — they render the default all-5 view
  with no cash-flow categorization or custom group selection.
- **Error handling** (load-failure UI + retry, date-range validation) and the **account-path tooltip**
  are unimplemented.
- **Empty-state actions** (Create accounts / Import) are copy-only, not wired buttons.
- Future per spec: multi-column comparison, saved reports, charts (Add Column / Saved Reports are inert
  placeholders today).

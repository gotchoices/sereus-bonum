# Spec: Entity Accounts View

**Route:** `/entities/[id]`  
**Stories:** [01-firstlook.md](../../../stories/web/01-firstlook.md), [04-reporting.md](../../../stories/web/04-reporting.md)

## Purpose

Display an entity's accounts in various reporting formats (Balance Sheet, Trial Balance, Income Statement, Cash Flow). Users can expand/collapse account groups, change date ranges, and navigate to account ledgers.

## Report Modes

The user selects a report mode from a dropdown. The selected mode determines which accounts appear and how dates are handled.

### Balance Sheet
**What it shows:** Financial position snapshot at a point in time  
**Date input:** "As of" (single date, defaults to today)  
**Accounts shown:** Assets, Liabilities, Equity only  
**How dates work:** All accounts show cumulative totals from the beginning through the "As of" date  

**Retained Earnings:**
- Appears as an expandable line under Equity
- Click to expand and see Income/Expense breakdown
- Included in Equity total
- Represents accumulated profit/loss (Income minus Expenses)

### Trial Balance
**What it shows:** All account balances to verify books are balanced  
**Date input:** "As of" (single date) - future: optional "From/To" range  
**Accounts shown:** All 5 types (Assets, Liabilities, Equity, Income, Expenses) as separate sections  
**How dates work:** Cumulative from beginning through "As of" date  

**Retained Earnings:**
- Appears as a non-expandable line under Equity (Income/Expense already shown separately)
- Shows Net Income (Income - Expenses)
- Included in Equity total

**Verification line:** Shows at bottom whether accounts balance:
- `Assets $150,000 = Liabilities + Equity $150,000 ✓` (balanced)
- `Assets $150,000 ≠ Liabilities + Equity $147,350 ⚠ Imbalance: $2,650` (not balanced)

### Income Statement (P&L)
**What it shows:** Profitability over a period  
**Date input:** "From/To" (both dates required)  
**Accounts shown:** Income and Expenses only  
**How dates work:** Only transactions within the date range are included  
**Net Income:** Total Income minus Total Expenses shown at bottom

### Cash Flow Statement (Future)
**What it shows:** Cash movements by activity type (Operating, Investing, Financing)  
**Date input:** "From/To" (both dates required)  
**Accounts shown:** Pre-selected account groups categorized by cash flow type  
**How dates work:** Changes in balances during the period (not cumulative)

### Custom (Future)
**What it shows:** User-selected account groups  
**Date input:** "As of" or "From/To" depending on selection  
**Accounts shown:** User picks which groups to include  
**How dates work:** Balance Sheet accounts cumulative, Income/Expense accounts period-based

## Date Inputs

**Visual layout:** Dates are stacked vertically above the data column (prepares for future multi-column comparisons)

**Balance Sheet & Trial Balance:**
```
┌─────────────────┐
│ As of:          │
│ [YYYY-MM-DD ▼] │
└─────────────────┘
```
Single date selector. All accounts show totals from beginning of time through this date.

**Income Statement & Cash Flow:**
```
┌─────────────────┐
│ From:           │
│ [YYYY-MM-DD ▼] │
│ To:             │
│ [YYYY-MM-DD ▼] │
└─────────────────┘
```
Date range required. Income/Expense accounts only show transactions within this range.

**Behavior:**
- Dates persist per entity (saved in local storage)
- Changing date triggers data reload
- Only reloads on blur (not on every keystroke)

## Account Display

**Hierarchy:** Type → Account Group (nested to any depth) → Account (nested by parent account to any
depth). Accounts appear under their real parent, beside their siblings; a parent's amount is the rolled-up
subtotal of itself and its descendants. Applies to **every report mode** (Balance Sheet, Trial Balance,
Income Statement, …) — they share one presentation.

**Dual indentation (names forward, amounts reverse):** the 5 top-level account types sit at level 0 with
their amounts flush to the **right** column. Each level deeper indents the **name forward** by a fixed
step and the **amount in reverse** (rightward-origin) by a fixed small step (~2–3 characters) — so deeper
detail steps left in the number column while its label steps right. This keeps deep hierarchies compact
and leaves room for additional period columns (multi-period reports). Amounts use accounting sign
convention (credit-normal balances read positive; see [rules.md](../../domain/rules.md)).

**Expand/Collapse:**
- Click type or group header to expand/collapse its contents
- "Expand All" and "Collapse All" buttons at top
- Expansion state persists per entity

**Account Names:**
- All account names are hyperlinks
- Click account name → navigates to that account's ledger
- Hover shows tooltip with full account path

**Parent account with its own postings AND children:** an account may carry direct postings *and* be the
parent of sub-accounts. Its own row shows the **rolled-up subtree total**; its direct postings appear on a
synthetic, non-clickable child row labelled **`(direct)`** indented one level beneath it (so the parent
total reads as `(direct) + children`). The `(direct)` row is only emitted when the parent has both child
accounts and a non-zero own balance.

## Display Filters (⚙ View menu)

A **⚙ View** menu on the toolbar holds display filters and relative-date presets. Filter state persists per
entity (local storage).

**Hide zero-balance accounts:** when on, accounts and groups whose rolled-up total is $0 are suppressed
(a group is kept if any descendant survives). Account-type sections (Assets/Liabilities/…) always remain as
the report skeleton. Off by default.

**Show closed accounts:** *closed/retired* accounts (`isActive = false`, which requires a zero balance to
set — see [rules.md](../../domain/rules.md)) are **hidden by default**; this toggle reveals them. This is
distinct from two other concepts the UI must not conflate:
- **Zero-balance** — an active account that happens to total $0 (governed by "Hide zero-balance" above).
- **Closed-out period** — a per-account `closedThrough` date (a posting lock), unrelated to visibility.

**Relative date presets:** Today, This month, Last month, This quarter, This year, Last year, All time.
Selecting one sets the report date(s) — the end date for "as of" modes, both bounds for period modes — and
reloads. Manual date entry (above) still works alongside presets.

## User Actions

**Change Report Mode:** Dropdown at top-left

**Change Dates:** Date picker(s) at top-right, vertically stacked

**Expand/Collapse:** Click any group/type header, or use "Expand All"/"Collapse All" buttons

**Navigate to Ledger:** Click any account name

**Export:** An **Export ▾** menu. *Native Bonum `.json` dump* (the entity's full books, re-importable — see
[domain/export.md](../../domain/export.md) and the native restore in [domain/import.md](../../domain/import.md))
is implemented; *CSV* and *Excel (.xlsx)* of the current view are stubbed (disabled, "coming soon").

**Print / PDF:** A **🖨 Print** button opens the browser print dialog with a print stylesheet that drops app
chrome (nav, toolbar, assistant) and prints just the report. "Save as PDF" in that dialog is the initial PDF
path; a dedicated PDF pipeline is future.

**Add Column:** (stubbed, disabled) - Adds another date range column for period comparison
([saved-reports-ux.md](./saved-reports-ux.md))

**Save Report:** (stubbed, disabled) - Saves current view configuration as named report
([saved-reports-ux.md](./saved-reports-ux.md))

## Persistence

The following persist per entity in browser local storage:
- Selected report mode
- Date range (start/end dates)
- Expanded/collapsed state of each group

When user returns to this entity, the view looks exactly as they left it.

## Empty States

**No accounts:** 
```
No accounts in this entity
[Create accounts] or [Import from another program]
```

**No transactions:**
- Accounts show with $0.00 balances
- No warning or special message

## Error States

**Failed to load:**
```
Error loading accounts: [error message]
[Retry button]
```

**Date range invalid:**
- "From" date must be before "To" date
- Show validation error below date inputs

## Future Enhancements

**Multi-Column Reports:**
- Side-by-side period comparisons
- Each column has its own date range
- Variance columns ($ change and % change)

**Saved Reports:**
- Name and save current view configuration
- Dropdown menu to quickly load saved reports

**Custom Account Selection:**
- Checkboxes to select specific groups
- Save as custom report template

**Hierarchical Columns:**
- Export with Type/Group/Account in separate spreadsheet columns
- Enables proper formulas in Excel

**Graphs & Charts:**
- Visual representation of account balances
- Trend lines for period comparisons

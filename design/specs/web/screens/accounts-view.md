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

**Hierarchy:** Type → Group → Account

**Indentation:** Visual hierarchy using indentation
- Type header: No indentation (e.g., "Assets")
- Account group: 2 spaces (e.g., "  Current Assets")
- Individual account: 4 spaces (e.g., "    Checking Account")

**Expand/Collapse:**
- Click type or group header to expand/collapse its contents
- "Expand All" and "Collapse All" buttons at top
- Expansion state persists per entity

**Account Names:**
- All account names are hyperlinks
- Click account name → navigates to that account's ledger
- Hover shows tooltip with full account path

**Empty Groups:**
- Groups with zero balance can be hidden (user preference - future)

## User Actions

**Change Report Mode:** Dropdown at top-left

**Change Dates:** Date picker(s) at top-right, vertically stacked

**Expand/Collapse:** Click any group/type header, or use "Expand All"/"Collapse All" buttons

**Navigate to Ledger:** Click any account name

**Export:** Export button (future) - exports to CSV/Excel with current view

**Add Column:** (future) - Adds another date range column for period comparison

**Save Report:** (future) - Saves current view configuration as named report

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

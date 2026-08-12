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

### Custom (Deferred — pending scope)
**Status:** Removed from the mode selector for now; the model/UI for user-selected group sets isn't scoped.
Re-add once we decide how selection + persistence work (and whether Cash Flow needs it — see below).
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

**Date selector lives above its number column.** Each report column's date field(s) sit in the header row
directly **above that column's numbers** (basis dropdown stacked over the fixed picker / resolved date). No
separate "Column N" title — the date *is* the column header. The **[+]** to add a column is at the left of
the header row (columns grow leftward into the past).

**Fixed vs. relative dates (basis selector).** Each date field's basis is **Fixed date** (a literal picker)
or a **relative token** from the vocabulary **Start/End · current/previous · month/quarter/year** (plus
**Today** for the rightmost column). "as of"/"to" fields offer the *End* variants; "from" fields the *Start*
variants.

**Chained relative resolution (multi-column).** The **rightmost** column resolves against **today**. Each
column to its **left** resolves against **its right neighbour's resolved date**, and offers only the
**"previous"** tokens — so putting "End previous year" on each left column yields a descending sequence
(2026, 2025, 2024 …), reaching arbitrarily far back *abstractly*. ("current" is excluded from left columns
because it would just duplicate the neighbour.) A Fixed-date column acts as an absolute anchor for the
columns to its left. Stored as `{ basis, fixedDate }` per field, so saved reports auto-adjust. When a relative basis is chosen,
the date input is replaced by the **resolved date** (read-only), recomputed against the current date at
load/render time. This is what lets a **saved report auto-adjust**: a report saved as "End of this year"
always resolves to the current year's end, not a frozen date. The stored value is
`{ basis, fixedDate }` per field (see [saved-reports-ux.md](./saved-reports-ux.md)).

**Behavior:**
- Date fields (basis + fixed date) persist per entity in local storage
- Changing the basis reloads immediately; editing a fixed date reloads on blur (not per keystroke)

## Display Unit

Reports are rendered **in a unit of the user's choosing**. A set of books is never bound to one unit —
`Entity.baseUnit` is only the default selection. The rules are in
[domain/units.md](../../domain/units.md#rendering-reports-in-a-chosen-unit).

**Selector:** a unit picker sits on the toolbar beside the date inputs, defaulting to the entity's base
unit and persisting per entity (local storage). It offers every unit the entity actually holds, plus any
unit with a reference rate reaching one of them.

```
┌─────────────────┐  ┌─────────────────┐
│ As of:          │  │ Display in:     │
│ [2026-08-11 ▼] │  │ [USD ▼]         │
└─────────────────┘  └─────────────────┘
```

**Facts first, estimates second.** An account's balance in its own unit is a recorded fact. A figure
converted into a different display unit is an estimate. Both appear, and they are never confusable:

```
  Investments                                         310,400
    Prospect Capital        2,500.0000 PSEC    ≈       18,750
    Viper Networks      2,000,000.0000 VPER    ≈        2,400
    iShares Silver          1,200.0000 SLV     ≈       35,600
    Cash — Schwab                                     102,500
```

- Accounts whose unit **is** the display unit show a single plain figure — no marker, nothing changes
  for single-unit books.
- Accounts in another unit show the **native quantity** with its unit, then the converted estimate
  marked with `≈`.
- The rate behind any estimate is inspectable (hover/expand): its value, date, and source.
- Rolled-up subtotals and group totals are in the display unit and are estimates whenever any
  descendant was converted; they carry the same marker.

**Rates are as of the report date, not today.** A balance sheet as of last December values holdings at
December rates. Changing the "As of" date re-selects rates as well as re-summing entries.

**Missing rates are flagged, never silently dropped.** If an account's unit has no path to the display
unit as of the report date, its native balance still shows, it is marked (⚠), it is **excluded** from
converted totals, and the report states that totals are partial. It is never treated as zero.

## Unrecognized Gain/Loss

Converted balance sheets do not balance on their own: holdings are revalued at report-date rates while
the equity that funded them was recorded at historical cost. Bonum closes the difference with a derived
equity line.

```
  Equity
    Owner's Equity                                    280,300
    Retained Earnings                                  41,300
    Unrecognized Gain/Loss  (derived, estimate)        51,300
```

- **Computed at render, never posted.** No transaction is written; it recomputes whenever the display
  unit or report date changes.
- Labelled as both **derived** and an **estimate**, and not clickable — it has no ledger.
- **Absent (not zero-rendered) when every account's unit is the display unit** — single-unit books never
  see this line.
- It appears on Balance Sheet and Trial Balance. The Income Statement, whose accounts are almost always
  already in the display unit, shows it only if income/expense accounts were themselves converted.
- A user who wants a valuation locked into the books posts an ordinary revaluation transaction instead;
  this line then measures only movement since that posting.

## Account Display

**Hierarchy — one logical path:** Type → Account Group (nested to any depth) → Account (nested by parent
account to any depth). The group-path and the account-path concatenate into a **single seamless path** to
each leaf; groups and accounts are just two flavours of node on that path and differ only by colour/weight
(groups bold, accounts lighter) — the same indentation ladder, toggles, and rolled-up subtotals apply to
both. A nested account always lives in its parent account's group (enforced by the schema — see
[domain/schema.md](../../domain/schema.md)), so the path can never fork. A parent's amount is the rolled-up
subtotal of itself and its descendants. Applies to **every report mode** — they share one presentation.

**Dual indentation (names forward, amounts reverse):** the 5 top-level account types sit at level 0 with
their amounts flush to the **right** column. Each level deeper indents the **name forward** by a fixed
step and the **amount in reverse** (rightward-origin) by a fixed small step (~2–3 characters) — so deeper
detail steps left in the number column while its label steps right. The reverse-indent funnel applies **per
column** in multi-column reports (each number column funnels independently, and the columns stay aligned).
Amounts use accounting sign convention (credit-normal balances read positive; see
[rules.md](../../domain/rules.md)).

**Layout — one aligned grid, content-sized columns.** The report is a single grid: a name column plus one
number column per report column. Each number column **sizes to its own content** (its widest figure + the
funnel range); the page sizes to the columns it contains, and if the whole grid is wider than the viewport
it **scrolls horizontally** (rather than cramming numbers together).

**Expand/Collapse:**
- Every node with children is collapsible — **account groups AND parent accounts** (the toggle extends all
  the way down the account path, not just the group path). Collapsed → the node shows only its rolled-up
  subtotal; expanded → its children (and, for a parent account, its `(direct)` row).
- Click a node's toggle to expand/collapse; "Expand All" / "Collapse All" cover groups and parent accounts.
- Expansion state persists per entity (keyed by group id or account id).

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

A **⚙ View** menu on the toolbar holds display filters and the variance-column format. State persists per
entity (local storage). (Relative dates live on each date field's basis selector — see § Date Inputs — not
here.)

**Hide zero-balance accounts:** when on, accounts and groups whose rolled-up total is zero are suppressed
(a group is kept if any descendant survives). Account-type sections (Assets/Liabilities/…) always remain as
the report skeleton. Off by default.

**Show closed accounts:** *closed/retired* accounts (`isActive = false`, which requires a zero balance to
set — see [rules.md](../../domain/rules.md)) are **hidden by default**; this toggle reveals them. This is
distinct from two other concepts the UI must not conflate:
- **Zero-balance** — an active account that happens to total $0 (governed by "Hide zero-balance" above).
- **Closed-out period** — a per-account `closedThrough` date (a posting lock), unrelated to visibility.

**Change (Δ) columns format:** picks how variance columns display — **$**, **%**, or **Both** (see § User
Actions → Columns & variance).

## User Actions

**Change Report Mode:** Dropdown at top-left

**Change Dates:** Each report column's date field(s) sit in the header row directly above that column — a
basis selector stacked over the fixed picker / resolved date (see § Date Inputs).

**Expand/Collapse:** Click any group/type header, or use "Expand All"/"Collapse All" buttons

**Navigate to Ledger:** Click any account name

**Export / Print:** An **Export ▾** menu holds all output. *Native Bonum `.json` dump* (the entity's full
books, re-importable — see [domain/export.md](../../domain/export.md) and the native restore in
[domain/import.md](../../domain/import.md)) is implemented; *CSV*, *Excel (.xlsx)*, and *structured PDF* of
the current view are stubbed. The menu's **Print / Save as PDF…** item opens the browser print dialog (a
print stylesheet drops nav/toolbar/assistant and prints just the report; "Save as PDF" there is the casual
PDF path). Print lives under Export rather than as its own icon — casual printing is the browser's job; a
structured PDF is the future *PDF (.pdf)* export (download, then print).

**Save Report:** A **⭐ Reports ▾** menu — "Save current view…" captures the current mode, date fields
(bases), and display filters as a named report; the saved list loads a report on click (auto-adjusting its
relative dates) or deletes it. See [saved-reports-ux.md](./saved-reports-ux.md).

**Columns & variance:** Each column header has a **☰ menu** (left of its date selector) with:
- **Insert older column** — inserts a period to the *left* (older). Insert-left is uniform: it never
  disturbs the today-anchor rightmost column and lets you reach further into the past; you target any
  interior gap by opening the menu on the column to its right. (Up to 12 columns.)
- **Show change vs. prior** — toggles a **variance (Δ) column** in the gap to *this* column's **left** — the
  change *into* this (newer) column from its older/left neighbour. Absent on the **leftmost** column (nothing
  before it to compare). Δ$ = newer − older, Δ% = (newer − older)/|older| (`—` when older is $0), green up /
  red down. The **View menu** picks the format: **$**, **%**, or **Both**.
- **Remove column** — (hidden on the last remaining column).

Columns (dates + variance flags) and the variance format persist per entity and are saved with reports.
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

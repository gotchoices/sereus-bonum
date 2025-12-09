# Spec: Accounts View

**Route:** `/entities/[id]`
**Stories:** 01-firstlook (step 6.5), 03-entries (step 2-4), 04-reporting (all)

## Purpose

The Accounts View is the primary interface for viewing an entity's financial position. It displays accounts organized by type and group, with balances. It supports multiple report modes and date filtering.

---

## Report Modes

The view supports multiple modes, selectable via a mode dropdown:

| Mode | Shows | Date Input | Notes |
|------|-------|------------|-------|
| **Balance Sheet** | Assets, Liabilities, Equity | Single date (as of) | I/E rolled into RE under Equity (expandable) |
| **Trial Balance** | All 5 types (A/L/E/I/E) | Date range | All sections visible at top level |
| **Income Statement** | Income, Expenses only | Date range | Net Income line at bottom |
| **Cash Flow** | Pre-selected groups | Date range | Operating, Investing, Financing |
| **Custom** | User-selected groups | Depends on groups | Checkbox per group |

---

## Balance Sheet Mode

**Purpose:** Financial position snapshot at a specific point in time

**Shows:** Assets, Liabilities, Equity sections

**Date:** Single "as of" date

**Retained Earnings:**
- Appears as a line under Equity section
- Shows calculated value: `(Income - Expenses)` from inception to "as of" date
- Has expand/collapse toggle
- When expanded: Shows Income and Expense as subcategories beneath it
- When collapsed: Shows single RE line with net figure

**Example (collapsed):**
```
EQUITY
├─ Owner's Capital          $80,000
├─ Retained Earnings        $40,000
└─ Total Equity            $120,000
```

**Example (expanded):**
```
EQUITY
├─ Owner's Capital                    $80,000
├─▼ Retained Earnings                 $40,000
│   ├─ Income (total)               ($60,000)  ← Credits shown as negative
│   │   ├─ Service Revenue          ($50,000)
│   │   └─ Interest Income          ($10,000)
│   └─ Expenses (total)               $20,000  ← Debits shown as positive
│       ├─ Rent                       $12,000
│       └─ Utilities                   $8,000
└─ Total Equity                      $120,000
```

---

## Trial Balance Mode

**Purpose:** Verification and detailed review of all accounts

**Shows:** All five account types as separate top-level sections:
- Assets
- Liabilities  
- Equity
- Income
- Expenses

**Date:** Date range (From/To)
- A/L/E balances shown as of the "To" date
- Income/Expense totals for the date range

**Key Difference from Balance Sheet:** Income and Expense are NOT hidden under Equity. They appear as their own top-level sections, making all activity visible at once.

**Why date range?** Income and Expense are period-based. For proper verification, you need to see them for a specific period (e.g., "fiscal year to date").

**Retained Earnings in Trial Balance:**
- Still appears as a line under Equity
- Shows the net accumulation from inception through the "To" date
- Does NOT expand (Income/Expense already visible as top-level sections)

---

## Income Statement Mode

**Purpose:** Profit & Loss report

**Shows:** Income and Expense sections only (A/L/E hidden)

**Date:** Date range (From/To)

**Net Income Line:**
At the bottom, show calculated line:
```
Net Income: Total Income - Total Expenses = $XXX,XXX
```

Example:
```
INCOME
├─ Service Revenue          $50,000
├─ Interest Income          $10,000
└─ Total Income             $60,000

EXPENSES
├─ Rent                     $12,000
├─ Utilities                 $8,000
└─ Total Expenses           $20,000

─────────────────────────────────────
Net Income                  $40,000
```

---

## Balance Verification Line

Display a verification line at the bottom of Balance Sheet and Trial Balance modes:

```
                             Assets    Liabilities + Equity
Verification:              $150,000              $150,000 ✓
```

If values don't match, show warning:
```
Verification:              $150,000              $149,500 ⚠ Imbalance: $500
```

This helps users verify the accounting equation: **Assets = Liabilities + Equity**

---

## Expand/Collapse Behavior

### Per-Group Controls
- Each account group has an expand/collapse toggle (▶/▼)
- Clicking toggles visibility of accounts within that group

### Global Controls
Add toolbar buttons:
- **Expand All** — Expands all groups
- **Collapse All** — Collapses all groups

### State Persistence

**Key requirement:** Expand/collapse state persists across sessions.

Implementation:
- Store in localStorage: `bonum-expand-state-{entityId}`
- Structure: `{ groupId: boolean, ... }`
- When visiting entity's Accounts View, restore previous expand state
- Default state: all collapsed

**Pattern note:** This persistence pattern applies app-wide. Any user-customized view state should persist. Consider a generalized `ViewState` storage service.

---

## Account Hyperlinks

**From stories:** Story 02 (step 9.7), Story 03 (step 4)

All account names displayed in the Accounts View should be hyperlinks to that account's ledger:

| Location | Link Target |
|----------|-------------|
| Individual accounts in expanded groups | `/ledger/{accountId}` |
| Child accounts in hierarchical groups | `/ledger/{accountId}` |
| Income accounts (when RE expanded, Trial Balance) | `/ledger/{accountId}` |
| Expense accounts (when RE expanded, Trial Balance) | `/ledger/{accountId}` |

**Behavior:**
- Click account name → Navigate to ledger in current window
- Future enhancement: Ctrl/Cmd+Click → Open ledger in new window
- Account code (if present) is not clickable, only the account name

**Visual indicator:** Account names should appear as links (underline on hover, pointer cursor)

---

## Date Selection

### Balance Sheet Mode (single date)
```
As of: [December 31, 2024 ▼]
```

### Trial Balance / Income Statement / Cash Flow (date range)
```
From: [January 1, 2024] To: [December 31, 2024]
```

**Defaults:**
- Balance Sheet: Today
- Trial Balance: Current fiscal year (or Jan 1 to today if no fiscal year set)
- Income Statement: Current fiscal year
- Cash Flow: Current fiscal year

---

## Multi-Column Reports

From story 04 (Alt E):
- "Add Column" button adds another date period
- Each column has its own date range
- Supports up to 12 columns (for monthly reports)
- Optional variance columns ($ change, % change)

**Deferred to future slice.**

---

## Saved Reports

From story 04:
- User can save current configuration with a name
- Saves: mode, date(s), expanded groups, selected groups (custom mode)
- Reports recalled from a "Saved Reports" dropdown/list
- Reports persist across sessions (localStorage or database)

**Deferred to future slice.**

---

## Print/PDF

From story 04 (step 4):
- Print icon renders current view to PDF
- Opens in new browser tab for printing/saving
- PDF should be clean, printable format

**Deferred to future slice.**

---

## Layout Refinement

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Back to Home                                                           │
│                                                                          │
│ Entity Name                                          [Mode: Balance ▼]  │
│ As of: [December 31, 2024]                    [Expand All] [Collapse]   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ ASSETS                                                        $150,000  │
│ ├─▼ Current Assets                                             $50,000  │
│ │    1010 Checking - Bank of America                           $25,000  │
│ │    1020 Savings - Credit Union                               $25,000  │
│ ├─▶ Fixed Assets                                              $100,000  │
│                                                                          │
│ LIABILITIES                                                    $30,000  │
│ ├─▶ Current Liabilities                                        $10,000  │
│ ├─▶ Long-term Liabilities                                      $20,000  │
│                                                                          │
│ EQUITY                                                        $120,000  │
│ ├─▶ Owner's Capital                                            $80,000  │
│ ├─▶ Retained Earnings                                          $40,000  │  ← Pseudo-account
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ NET WORTH (Assets - Liabilities)                              $120,000  │
│                                                                          │
│ Verification: Assets $150,000 = L+E $150,000 ✓                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

### MVP (Current Slice)
- [ ] Balance Sheet mode displays A/L/E with balances
- [ ] Groups are expandable/collapsible
- [ ] Expand/collapse state persists in localStorage
- [ ] Expand All / Collapse All buttons work
- [ ] Retained Earnings pseudo-account displays correctly
- [ ] Verification line shows Assets = L + E comparison
- [ ] Date picker changes balance calculations

### Future Slices
- [ ] Trial Balance mode with Retained Earnings expansion
- [ ] Income Statement mode
- [ ] Cash Flow mode
- [ ] Custom mode with group selection
- [ ] Multi-column comparison
- [ ] Saved reports
- [ ] Print/PDF export


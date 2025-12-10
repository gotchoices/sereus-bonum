# Entity Accounts View Specification

**Route:** `/entities/[id]`  
**Stories:** [01-firstlook.md](../../../stories/web/01-firstlook.md), [04-reporting.md](../../../stories/web/04-reporting.md)

---

## Purpose

Display an entity's accounts in various reporting modes (Balance Sheet, Trial Balance, Income Statement, Cash Flow) with hierarchical grouping and expandable sections.

---

## Report Modes

### Balance Sheet
- **Purpose:** Snapshot of financial position at a point in time
- **Date Input:** "As of" (single date, defaults to today)
- **Accounts Shown:** Assets, Liabilities, Equity only
- **Date Behavior:** All accounts cumulative from inception through "As of" date
- **Income/Expense:** Rolled into Retained Earnings under Equity
- **Retained Earnings:** 
  - Shown as expandable line item under Equity
  - Click to expand and see Income/Expense breakdown
  - Included in Equity total

### Trial Balance
- **Purpose:** Verify books are balanced, show all account types
- **Date Input:** "As of" (single date) OR "Period" (start + end dates)
- **Accounts Shown:** All 5 types (A/L/E/I/E) as separate sections
- **Date Behavior:**
  - **A/L/E:** Cumulative from inception through end date
  - **I/E:** If period specified, sum for period; otherwise cumulative
- **Retained Earnings:**
  - Shown as non-expandable line item under Equity
  - Displays Net Income (Income - Expense)
  - Included in Equity total
  - Not expandable (I/E already shown separately at top level)
- **Verification:** Shows "Assets = Liabilities + Equity ✓" at bottom
- **Use Case:** Month-end/year-end balancing, debugging

### Income Statement (P&L)
- **Purpose:** Show profitability over a period
- **Date Input:** "Period" (start + end dates, both required)
- **Accounts Shown:** Income and Expense only
- **Date Behavior:** Sum entries within date range only
- **Net Income:** Total Income - Total Expense at bottom

### Cash Flow Statement
- **Purpose:** Track cash movements by activity type
- **Date Input:** "Period" (start + end dates, both required)
- **Accounts Shown:** Selected groups pre-categorized as Operating, Investing, Financing
- **Date Behavior:** Sum entries within date range
- **Special Logic:** Balance sheet accounts show change in balance, not cumulative

### Custom
- **Purpose:** Ad-hoc reporting, user selects specific groups/accounts
- **Date Input:** "As of" OR "Period" depending on selection
- **Accounts Shown:** User-selected
- **Date Behavior:** Hybrid (B/S accounts cumulative, I/E accounts period-based)

---

## Date Handling Rules

### Balance Sheet Accounts (A/L/E)
**Always cumulative from inception:**
```sql
WHERE t.date <= asOfDate
```
- No start date
- All transactions from the beginning of time through end date

### Income Statement Accounts (I/E)
**Period-based when report requires it:**
```sql
WHERE t.date >= startDate AND t.date <= endDate
```
- Requires both start and end dates
- Only transactions within the range

### Mixed Reports (Trial Balance, Custom)
- **Default behavior:** Cumulative (no start date)
- **Optional period mode:** User specifies start + end dates
  - A/L/E still cumulative through end date
  - I/E filtered to period only

---

## UI Elements

### Report Mode Selector
- Dropdown: Balance Sheet | Trial Balance | Income Statement | Cash Flow | Custom
- Persisted per entity in `viewState`

### Date Inputs

**Layout Strategy:**
- Date inputs are **vertically stacked** above the data column
- This layout prepares for future multi-column reports (period comparisons)
- Each column will have its own vertically-stacked date range

**For Balance Sheet & Trial Balance:**
```
┌─────────────────┐
│ As of:          │
│ [YYYY-MM-DD ▼] │
└─────────────────┘
     ↓
[Account data...]
```
- Single "As of" date
- All accounts cumulative from inception through this date

**For Income Statement & Cash Flow:**
```
┌─────────────────┐
│ From:           │
│ [YYYY-MM-DD ▼] │
│ To:             │
│ [YYYY-MM-DD ▼] │
└─────────────────┘
     ↓
[Account data...]
```
- Date range required (both fields)
- Income/Expense accounts filtered to this period
- Balance sheet accounts (if shown) still cumulative through "To" date

**Future: Multi-Column View:**
```
┌─────────┬─────────┬─────────┐
│ From:   │ From:   │ From:   │
│   To:   │   To:   │   To:   │
├─────────┼─────────┼─────────┤
│ $50,000 │ $60,000 │ $70,000 │
│ $30,000 │ $35,000 │ $40,000 │
└─────────┴─────────┴─────────┘
```

### Display

- **Account hierarchy:** Type → Group → Account
- **Expand/collapse:** Per group, persisted
- **"Expand All" / "Collapse All" buttons**
- **Account hyperlinks:** Click account name → go to ledger
- **Indentation:** Visual hierarchy using indentation (2 spaces per level)
  - Type: No indentation
  - Group: 2 spaces
  - Account: 4 spaces
  - Sub-account: 6 spaces (if hierarchical accounts implemented)

**Note:** Current implementation shows all values in a single balance column. Future enhancement will implement logical column structure (Type | Group | Account | Balance) to enable proper spreadsheet formulas in exports. See "Future Enhancements" section below.

### Verification Line (Trial Balance only)

At the bottom:
```
Assets $150,000 = Liabilities + Equity $150,000 ✓
```

Or if imbalanced:
```
Assets $150,000 ≠ Liabilities + Equity $147,350 ⚠ Imbalance: $2,650
```

---

## Backend Requirements

### DataService Method Signature

```typescript
interface BalanceSheetOptions {
  endDate: string;           // End date (YYYY-MM-DD) - always required
  startDate?: string;        // Optional start date for period-based filtering
  // When startDate is provided:
  //   - Balance sheet accounts (A/L/E): cumulative through endDate (ignore startDate)
  //   - Income/Expense accounts: sum entries where startDate <= date <= endDate
}

getBalanceSheet(
  entityId: string, 
  endDate: string,           // Renamed from 'asOf' for clarity
  startDate?: string         // Optional for period-based reports
): Promise<BalanceSheetData>
```

**Backward Compatibility:**
- Existing calls with single `asOf` parameter work as before
- New calls can provide `startDate` for period filtering

### SQL Query Logic

**Single query approach with conditional date filtering:**

```sql
SELECT 
  a.id, a.name, a.code,
  g.id as group_id, g.name as group_name, g.account_type,
  COALESCE(SUM(e.amount), 0) as balance
FROM account a
JOIN account_group g ON g.id = a.account_group_id
LEFT JOIN entry e ON e.account_id = a.id
LEFT JOIN txn t ON t.id = e.txn_id 
  AND (
    -- Balance sheet accounts: cumulative through endDate
    (g.account_type IN ('ASSET', 'LIABILITY', 'EQUITY') AND t.date <= ?)
    OR
    -- Income/Expense: period-based if startDate provided, else cumulative
    (g.account_type IN ('INCOME', 'EXPENSE') 
      AND t.date <= ?  -- endDate
      AND (? IS NULL OR t.date >= ?)  -- startDate if provided
    )
  )
WHERE a.entity_id = ? AND a.is_active = 1
GROUP BY a.id, a.name, a.code, g.id, g.name, g.account_type
ORDER BY g.display_order, a.code
```

**Parameters:** `[endDate, endDate, startDate, startDate, entityId]`

**Logic:**
- **Balance Sheet mode** (no startDate): All accounts cumulative through endDate
- **Income Statement mode** (with startDate): 
  - A/L/E: cumulative through endDate (startDate ignored)
  - I/E: only transactions within startDate to endDate range

---

## Calculation Rules

### Net Income
```typescript
// Income is stored as negative (credit), expense as positive (debit)
const netIncome = Math.abs(totalIncome) - totalExpense;
// OR: const netIncome = -totalIncome - totalExpense;
```

### Retained Earnings (Pseudo-Account)
```typescript
const retainedEarnings = netIncome; // For current period
// Or cumulative: all I/E from inception
```

### Balance Verification
```typescript
const totalDebits = totalAssets + totalExpense;
const totalCredits = Math.abs(totalLiabilities) + Math.abs(totalEquity) + Math.abs(totalIncome);
const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;
```

---

## Example Scenarios

### Scenario 1: Balance Sheet as of Dec 31, 2024
- Mode: Balance Sheet
- Date: As of 2024-12-31
- Query: All accounts, transactions ≤ 2024-12-31
- Display: A/L/E only, I/E rolled into RE under Equity

### Scenario 2: Trial Balance for December 2024
- Mode: Trial Balance (period mode)
- Dates: From 2024-12-01, To 2024-12-31
- Query:
  - A/L/E: cumulative through 2024-12-31
  - I/E: only transactions in Dec 2024
- Display: All 5 types, verification line

### Scenario 3: Income Statement for Q4 2024
- Mode: Income Statement
- Dates: From 2024-10-01, To 2024-12-31
- Query: I/E accounts only, transactions in Q4
- Display: Income and Expense with Net Income at bottom

---

## Balance Verification Formula

**Backend returns:**
- `totalEquity` — equity accounts ONLY (does not include net income)
- `totalIncome` — income accounts (positive value)
- `totalExpense` — expense accounts (positive value)

**Frontend calculates:**
- Net Income = `totalIncome - totalExpense`
- Retained Earnings = Net Income (accumulated)

**Verification:**
```typescript
Assets = Liabilities + Equity + Net Income
```

**Why Net Income is added:**
- Backend `totalEquity` does not include net income
- In Balance Sheet mode, Retained Earnings is shown under Equity but needs to be added to verification
- In Trial Balance mode, Income/Expense shown separately, but net income still needs to be added because Equity doesn't include it

**Resolved Issues:**
- ✅ Equity total now correctly includes Retained Earnings in Balance Sheet mode
- ✅ Verification formula works for both Balance Sheet and Trial Balance modes
- ✅ Net Worth display removed (redundant with Equity)

---

## Future Enhancements

### Hierarchical Column Structure (High Priority)
**Problem:** Current implementation shows all balances in a single column, making group/type totals appear incorrect and breaking Excel SUM formulas.

**Solution:** Implement logical column structure:
- **Display:** Use indentation to show hierarchy (current approach)
- **Export:** Separate physical columns (Type | Group | Account | Balance)

**Benefits:**
- Excel exports have working SUM() formulas
- Clearer separation of totals at each level
- Enables proper multi-column comparative reports

**Example Export Format:**
```csv
Type,Group,Account,Balance
Assets,,,500000.00
,Current Assets,,300000.00
,,Checking,150000.00
,,Savings,150000.00
,Fixed Assets,,200000.00
,,Equipment,200000.00
```

**See also:** `design/specs/web/global/export.md` for export implementation details

### Other Enhancements
- **Comparative columns:** Multiple periods side-by-side
- **Budget vs Actual:** Compare to budget amounts
- **Saved reports:** Name and recall configurations
- **Print/PDF export:** Formatted for printing
- **Drill-down:** Click totals to see transactions

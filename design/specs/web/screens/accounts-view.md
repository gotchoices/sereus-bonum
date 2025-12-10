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
- **Retained Earnings:** Expandable to show I/E breakdown

### Trial Balance
- **Purpose:** Verify books are balanced, show all account types
- **Date Input:** "As of" (single date) OR "Period" (start + end dates)
- **Accounts Shown:** All 5 types (A/L/E/I/E) as separate sections
- **Date Behavior:**
  - **A/L/E:** Cumulative from inception through end date
  - **I/E:** If period specified, sum for period; otherwise cumulative
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

**For Balance Sheet & Trial Balance (default):**
```
[As of: YYYY-MM-DD ▼]
```

**For Income Statement & Cash Flow:**
```
[From: YYYY-MM-DD ▼]  [To: YYYY-MM-DD ▼]
```

**For Trial Balance (period mode toggle):**
```
☐ Period mode
[From: YYYY-MM-DD ▼]  [To: YYYY-MM-DD ▼]
```

### Display

- **Account hierarchy:** Type → Group → Account
- **Expand/collapse:** Per group, persisted
- **"Expand All" / "Collapse All" buttons**
- **Account hyperlinks:** Click account name → go to ledger

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

### DataService Method Signature (Updated)

```typescript
interface BalanceSheetOptions {
  asOf: string;              // End date (YYYY-MM-DD)
  startDate?: string;        // Optional start date for period-based
  includeIncome?: boolean;   // Include I/E in result (default: true)
  includeExpense?: boolean;  // Include I/E in result (default: true)
}

getBalanceSheet(entityId: string, options: BalanceSheetOptions): Promise<BalanceSheetData>
```

### SQL Query Logic

```sql
SELECT 
  a.id, a.name, a.code,
  g.id as group_id, g.name as group_name, g.account_type,
  COALESCE(SUM(
    CASE 
      -- For B/S accounts: cumulative through asOf
      WHEN g.account_type IN ('ASSET', 'LIABILITY', 'EQUITY') 
        THEN e.amount
      -- For I/E accounts: period-based if startDate provided
      WHEN g.account_type IN ('INCOME', 'EXPENSE') 
        AND ? IS NOT NULL  -- startDate parameter
        THEN CASE WHEN t.date >= ? THEN e.amount ELSE 0 END
      -- Otherwise cumulative
      ELSE e.amount
    END
  ), 0) as balance
FROM account a
JOIN account_group g ON g.id = a.account_group_id
LEFT JOIN entry e ON e.account_id = a.id
LEFT JOIN txn t ON t.id = e.txn_id AND t.date <= ?  -- asOf date
WHERE a.entity_id = ? AND a.is_active = 1
GROUP BY a.id, a.name, a.code, g.id, g.name, g.account_type
```

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

- **Comparative columns:** Multiple periods side-by-side
- **Budget vs Actual:** Compare to budget amounts
- **Saved reports:** Name and recall configurations
- **Print/PDF export:** Formatted for printing
- **Drill-down:** Click totals to see transactions

# Transaction Search Screen

**Route:** `/search`  
**Story:** [06-search.md](../../../stories/web/06-search.md)  
**Status:** Phase 1 (Show All) - In Development

---

## Purpose

Provide a global view of all transactions across all entities to support debugging, data exploration, and (future) complex queries.

---

## Phase 1: Transaction Browser

Show all transactions with full splits, debit/credit columns, and balance verification.

### Header
- **Title:** "Transaction Search"
- **Primary Button:** "Show All Transactions" — loads all transactions across all entities
- **Export Button:** 📥 "Export" (appears after transactions are loaded)
  - Dropdown menu with options:
    - 📄 Export to CSV
    - 📊 Export to Excel (XLSX)

### Results Display Format

#### Transaction Header Row
Each transaction is displayed as a header row with:
- **Date** (YYYY-MM-DD or formatted)
- **Entity** (which entity this transaction belongs to) — hyperlink to `/entities/[id]`
- **Memo/Description** (transaction-level memo)
- **Reference** (check number, invoice number, etc.)

Style: Bold or distinct background to separate from split rows

#### Split Rows (Indented under header)
Each entry in the transaction is displayed as a subordinate row:
- **Account** — hyperlink to `/ledger/[accountId]`, showing full path on hover
- **Debit** — amount in debit column (if entry amount > 0)
- **Credit** — amount in credit column (if entry amount < 0, displayed as absolute value)
- **Note** (entry-level note, if any)

Style: Indented or slightly subdued to indicate hierarchy

#### Key Requirements
- **All transactions displayed as splits** — even simple 2-entry transactions show both entries as split rows (no "offset account" shortcut)
- **Debit/Credit columns** — amounts always in correct column based on sign
  - Positive amount → Debit column
  - Negative amount → Credit column (absolute value)
- **No running balance** — not applicable in cross-transaction view
- **Expand/Collapse** — Optional for future, but for Phase 1, show all splits expanded by default

### Totals Footer

Display at the bottom:
- **Left side:** Entry count (e.g., "42 entries")
- **Right side:**
  - **Total Debits:** Sum of all positive amounts
  - **Total Credits:** Sum of absolute values of all negative amounts
  - **Verification:** 
    - ✓ **Balanced** (if debits = credits within 0.01 tolerance)
    - ⚠ **Imbalance: $X.XX** (if debits ≠ credits)

### Empty State
- Message: "Click 'Show All Transactions' to view all entries."

### Export Functionality

**See:** [Export Specification](../global/export.md)

**File Formats:**
- **CSV:** Plain text, comma-separated values
- **Excel (XLSX):** Microsoft Excel format with formatted columns

**Filename:** `transactions-YYYY-MM-DD.{csv|xlsx}`

**Amount Formatting:**
- All amounts displayed as decimal with 2 decimal places
- Example: 5000000 (stored in cents) → `50000.00` (exported)

**Export Structure:**
- Header row with column names
- Transaction header rows
- Indented split rows
- Totals row at bottom
- Verification row (balanced/imbalance status)

**CSV Format:**
```
Date,Entity,Memo,Reference,Account,Debit,Credit,Note
2024-01-15,Home Finance,Opening balances,,,,,
,,,,Checking Account,50000.00,,
,,,,Equity,,50000.00,
,,,,Totals:,150000.00,150000.00,
,,,,Balanced,,,
```

**Implementation:**
- Uses native browser Blob API for CSV download
- Uses `xlsx` library (SheetJS) for Excel generation
- Handles special characters (quotes, commas) in CSV
- Amounts formatted via `formatAmountForExport()` (divide by 100, 2 decimals)
- Graceful fallback to CSV if Excel export fails

---

## Future: Phase 2 (Query Builder)

- Visual query builder with field selection
- AND/OR logic with grouping (indentation for sub-groups)
- Operators: <, >, =, !=, contains, wildcard, regexp
- Saved named searches with edit/delete
- Export to CSV

---

## Component Architecture

### `TransactionResultsTable.svelte` (Reusable)

**Props:**
```typescript
{
  entries: LedgerEntry[];        // Grouped by transaction
  showEntity?: boolean = true;   // Show entity column in header
  showTotals?: boolean = true;   // Show debit/credit totals footer
  emptyMessage?: string;         // Custom empty state
}
```

**Usage:**
- `/search` — all transactions, cross-entity
- Future: reconciliation, report drill-downs

### Data Structure

Transactions should be grouped by `transactionId` before rendering:
```typescript
interface TransactionGroup {
  transactionId: string;
  date: string;
  entityId: string;
  entityName: string;
  memo?: string;
  reference?: string;
  entries: Array<{
    entryId: string;
    accountId: string;
    accountName: string;
    accountPath: string;
    amount: number;      // Raw amount (+ for debit, - for credit)
    note?: string;
  }>;
}
```

---

## Styling

- **Transaction header row:** Slightly bolder, distinct background (e.g., `--card-bg`)
- **Split rows:** Indented (padding-left), lighter text for hierarchy
- **Debit/Credit columns:** Right-aligned, tabular-nums font
- **Totals footer:** Bold, distinct background, clear visual separation

---

## i18n Keys

```typescript
search: {
  title: 'Transaction Search',
  show_all: 'Show All Transactions',
  empty: 'Click "Show All Transactions" to view all entries.',
  date_col: 'Date',
  entity_col: 'Entity',
  memo_col: 'Memo',
  ref_col: 'Ref',
  account_col: 'Account',
  debit_col: 'Debit',
  credit_col: 'Credit',
  note_col: 'Note',
  total_entries: '{count} entries',
  total_debits: 'Total Debits',
  total_credits: 'Total Credits',
  balanced: 'Balanced',
  imbalance: 'Imbalance',
}
```

---

## Acceptance Criteria

- ✅ All transactions displayed as transaction header + split rows
- ✅ Debits in debit column, credits in credit column (absolute value)
- ✅ Entity hyperlinks to Accounts View
- ✅ Account hyperlinks to Ledger
- ✅ Full account path on hover
- ✅ Totals footer with balance verification
- ✅ Imbalance displayed with exact amount if totals don't match
- ✅ Works across multiple entities


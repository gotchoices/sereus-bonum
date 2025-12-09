# Transaction Search Screen

**Status:** Phase 1 Consolidation (Transaction Browser)  
**Stories:** [06-search.md](../../../stories/web/06-search.md) (Phase 1 only)  
**Route:** `/search`

---

## Purpose

Provide a global view of all transactions across all entities. Phase 1 focuses on "show all" to support debugging and data exploration. Phase 2 (future) will add query builder functionality.

---

## Layout

### Header
- **Title:** "Transaction Search"
- **"Show All Transactions" button** — loads all transactions across all entities

### Results Area

#### Empty State
- Message: "Click 'Show All Transactions' to view all entries, or wait for query builder (future feature)."

#### Results Table (when populated)
- **Columns:**
  - Expand icon (if transaction has splits)
  - Date
  - Entity (which entity this transaction belongs to)
  - Account (which account the entry affects)
  - Ref
  - Memo
  - Debit (amount or blank)
  - Credit (amount or blank)
  - Running Balance (omitted in cross-account view)

- **Expandable Rows:**
  - Top-level row shows transaction header
  - Clicking expand shows all splits as indented rows
  - Split rows show: account (as hyperlink to ledger), memo, debit/credit

- **Controls:**
  - "Expand All" / "Collapse All" buttons

#### Totals Footer
- **Left side:** Total count of entries
- **Right side:**
  - Total Debits: $X.XX
  - Total Credits: $X.XX
  - Status: ✓ Balanced (if equal) or ⚠ Imbalance: $X.XX (if not)

---

## Components

### `TransactionResultsTable.svelte`
**Reusable component** for displaying transaction lists.

**Props:**
```typescript
{
  entries: LedgerEntry[];
  showEntity?: boolean = true;      // Show entity column
  showAccount?: boolean = true;     // Show account column
  allowExpand?: boolean = true;     // Allow split expansion
  showTotals?: boolean = true;      // Show debit/credit totals
  emptyMessage?: string;            // Custom empty state
}
```

**Usage:**
- `/search` — shows all transactions with entity + account columns
- `/ledger/[accountId]` — could refactor to use this (account column hidden)
- Future: reconciliation, report drill-downs

---

## Behavior

### Data Loading
- "Show All Transactions" button calls `DataService.getAllTransactions()`
- Returns all entries across all entities
- Client-side display (Phase 1 is simple)

### Expand/Collapse
- Per-transaction expand state (stored in local component state)
- "Expand All" / "Collapse All" buttons

### Hyperlinks
- Entity name → `/entities/[id]` (Accounts View)
- Account name → `/ledger/[accountId]`

### Balance Verification
- Sum all debits
- Sum all credits
- Compare: should always be equal (double-entry)
- If not: display imbalance warning with amount

---

## Future (Phase 2)

- Query builder UI (field selection, operators, AND/OR logic, grouping)
- Save/recall named searches
- Export to CSV

---

## i18n Keys

Add to `en.ts`:

```typescript
search: {
  title: 'Transaction Search',
  show_all: 'Show All Transactions',
  empty: 'Click "Show All Transactions" to view all entries.',
  expand_all: 'Expand All',
  collapse_all: 'Collapse All',
  entity_col: 'Entity',
  account_col: 'Account',
  date_col: 'Date',
  ref_col: 'Ref',
  memo_col: 'Memo',
  debit_col: 'Debit',
  credit_col: 'Credit',
  total_entries: '{count} entries',
  total_debits: 'Total Debits',
  total_credits: 'Total Credits',
  balanced: 'Balanced',
  imbalance: 'Imbalance',
}
```


# Spec: Transaction Search

**Route:** `/search`  
**Story:** [06-search.md](../../../stories/web/06-search.md)  
**Status:** Phase 1 (Show All) - In Development

## Purpose

Provide a global view of all transactions across all entities. Users can:
- View all transactions in one place (not filtered to a single account)
- Verify that books are balanced (total debits = total credits)
- Debug data issues or find specific transactions
- Export results for analysis in spreadsheet programs

**Note:** This is cross-entity — transactions from all entities appear together.

## Phase 1: Show All Transactions

This is the MVP implementation. Future phases will add filtering and search capabilities.

### Initial State

Screen shows:
- Title: "Transaction Search"
- Large button: "Show All Transactions"
- Empty message: "Click 'Show All Transactions' to view all entries."

### After Loading Transactions

**Button changes:**
- "Show All Transactions" remains visible
- Export button appears: 📥 "Export" with dropdown:
  - 📄 Export to CSV
  - 📊 Export to Excel

**Transaction Display:**

Each transaction appears as a collapsible group:

```
──────────────────────────────────────────────────────────
2024-01-15 | Home Finance | Opening balances | Ref: —
  Checking Account                        $50,000.00  |
  Equity                                  |  $50,000.00
──────────────────────────────────────────────────────────
2024-01-16 | Home Finance | Grocery store | Ref: 1001
  Checking Account                        |     $125.50
  Groceries                                  $125.50  |
──────────────────────────────────────────────────────────
```

**Transaction Header Row:**
- Date (formatted per user's date preference)
- Entity name (hyperlink to that entity's Accounts View)
- Memo/Description
- Reference (check #, invoice #, etc.) or "—" if empty
- Visually distinct (bold or background color)

**Split Entry Rows:**
- Indented underneath transaction header
- Account name (hyperlink to that account's ledger)
  - Hover shows full account path tooltip
- Debit amount (if positive) in left column
- Credit amount (if negative, shown as positive) in right column
- Entry-level note (if any) appears below or beside
- All transactions show full splits (no shortcuts for 2-entry transactions)

**Columns:**
- Date | Entity | Memo | Ref | Account | Debit | Credit | Note

**Key Visual Rules:**
- **Debits always in Debit column** (right side of account name)
- **Credits always in Credit column** (far right)
- Never show an amount in both columns for same entry
- Empty cells where no amount applies

### Totals Footer

At the bottom of the transaction list:

```
──────────────────────────────────────────────────────────
42 entries                    Total Debits:  $150,000.00
                             Total Credits:  $150,000.00
                             ✓ Balanced
──────────────────────────────────────────────────────────
```

**Shows:**
- Entry count (left side)
- Total of all debits (sum of positive amounts)
- Total of all credits (sum of absolute values of negative amounts)
- Balance status:
  - **"✓ Balanced"** (green) if debits = credits (within $0.01)
  - **"⚠ Imbalance: $X.XX"** (red) if debits ≠ credits

**Purpose:** Verify data integrity — if imbalanced, indicates a data error.

### Export Behavior

**Trigger:** Click "Export" button

**Options:**
- Export to CSV (universal, plain text)
- Export to Excel (formatted, native Excel support)

**Filename:** `transactions-YYYY-MM-DD.{csv|xlsx}` (current date)

**Content:**
- Header row with column names
- Transaction header rows with date, entity, memo, reference
- Indented split rows with account, debit, credit, note
- Totals row: "Totals:" label, sum of debits, sum of credits
- Verification row: "Balanced" or "Imbalance: $X.XX"

**Amount Format:**
- All amounts show as decimal with 2 decimal places
- Example: $50,000.00 (not 5000000)
- CSV: `50000.00`
- Excel: `50,000.00` (with comma formatting)

**CSV Example:**
```
Date,Entity,Memo,Reference,Account,Debit,Credit,Note
2024-01-15,Home Finance,Opening balances,,,,,
,,,,Checking Account,50000.00,,
,,,,Equity,,50000.00,
2024-01-16,Home Finance,Grocery store,1001,,,
,,,,Checking Account,,125.50,
,,,,Groceries,125.50,,
,,,,Totals:,50125.50,50125.50,
,,,,Balanced,,,
```

**See also:** [Export Specification](../global/export.md) for detailed format rules.

### Navigation Links

**Entity Names:**
- Click entity name → navigates to `/entities/[id]` (Accounts View)

**Account Names:**
- Click account name → navigates to `/ledger/[accountId]`
- Hover shows tooltip with full account path (e.g., "Assets : Current Assets : Checking Account")

### Error States

**Failed to Load:**
```
Error loading transactions: [error message]
[Retry] button
```

**No Transactions:**
```
No transactions found.
Create your first transaction by visiting an account ledger.
```

### Performance Considerations

**Large Datasets:**
- For hundreds of transactions, page may take a few seconds to load
- Show loading spinner while fetching: "Loading transactions..."
- Once loaded, display is instant (no pagination in MVP)

**Future Enhancement:** Pagination or virtual scrolling for thousands of transactions.

## Phase 2: Query Builder (Future)

Not in MVP. Planned features:

**Visual Query Interface:**
- Field selection dropdowns (Date, Entity, Account, Memo, Amount, etc.)
- Comparison operators (<, >, =, !=, contains, wildcard)
- AND/OR logic with grouping (parentheses)
- Example: "(Account contains 'Checking' OR Account contains 'Savings') AND Amount > 1000"

**Saved Searches:**
- Name and save query configurations
- Dropdown menu to load saved searches
- Edit/delete saved searches
- Example: "Large Cash Transactions", "Q4 Income Entries"

**Date Range Filtering:**
- From/To date pickers
- Quick presets (This Month, Last Quarter, Year to Date)

**Export Filtered Results:**
- Export button exports only matching transactions

## Reusable Component

The transaction results table is designed to be reusable:
- Used here for global search
- Can be used in reconciliation workflows (future)
- Can be used in report drill-downs (future)
- Can show/hide entity column depending on context

## Keyboard Shortcuts (Future)

- Ctrl+F: Focus search/query builder
- Ctrl+E: Open export menu
- Enter on transaction: Expand/collapse splits
- Arrow keys: Navigate between transactions

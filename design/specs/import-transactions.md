# Spec: Import Transactions

**Purpose:** Import transactions from bank exports and other sources into an existing Entity's accounts.

## Supported Formats

| Format | Extension | Common Sources | Status |
|--------|-----------|----------------|--------|
| CSV | `.csv` | Bank exports, spreadsheets, accounting software | Planned |
| QIF | `.qif` | Quicken, older banking exports | Planned |
| OFX | `.ofx` | Most modern banks (download format) | Planned |
| QFX | `.qfx` | Quicken Web Connect (OFX variant) | Planned |

**Key Differences:**
- **CSV:** Universal but requires column mapping
- **QIF:** Structured text, auto-maps columns, legacy format
- **OFX/QFX:** Modern banking standard, includes transaction IDs for duplicate detection

## Use Cases

**When to use Transaction Import vs Book Import:**
- **Transaction Import:** Add new transactions to existing Entity (e.g., monthly bank statement)
- **Book Import:** Create new Entity with complete chart of accounts and history

**Common scenarios:**
- Download monthly bank transactions from online banking
- Import credit card statement
- Bulk-add transactions from spreadsheet
- Catch up after being away from books for a while

## Import Workflow

### Step 1: Initiate Import

**Trigger:** Right-click entity → "Import Transactions" from context menu

**Dialog appears:**
```
┌─────────────────────────────────────┐
│ Import Transactions            [X]  │
├─────────────────────────────────────┤
│ Entity: Home Finance                │
│                                     │
│ Target Account:                     │
│ [Checking Account         ▼]        │
│                                     │
│ Source File:                        │
│ ┌─────────────────────────────┐     │
│ │ Drag & drop file here       │     │
│ │         or                  │     │
│ │    [Browse Files...]        │     │
│ └─────────────────────────────┘     │
│                                     │
│ Supported: .csv, .qif, .ofx, .qfx   │
│                                     │
│              [Cancel] [Next]        │
└─────────────────────────────────────┘
```

**User Actions:**
- Select target account (which account these transactions belong to)
- Drop or browse to select file
- Click "Next" to proceed

### Step 2: Column Mapping (CSV Only)

**For CSV files, user must map columns:**

```
┌──────────────────────────────────────────────────────┐
│ Map CSV Columns                                      │
├──────────────────────────────────────────────────────┤
│ Sample data from file (first 3 rows):                │
│ ┌───────────────────────────────────────────────────┐│
│ │ 01/15/2024 | Grocery Store | -125.50 | 1001      ││
│ │ 01/16/2024 | Gas Station   | -45.00  | 1002      ││
│ │ 01/17/2024 | Paycheck      | 2500.00 | DEP       ││
│ └───────────────────────────────────────────────────┘│
│                                                      │
│ Column 1: [Date              ▼]  Format: [MM/DD/YYYY▼]│
│ Column 2: [Description       ▼]                      │
│ Column 3: [Amount (signed)   ▼]                      │
│ Column 4: [Reference         ▼]                      │
│                                                      │
│ ☑ File has header row                                │
│ ☑ Negative amounts are expenses/debits               │
│                                                      │
│                         [Back] [Next]                │
└──────────────────────────────────────────────────────┘
```

**User Actions:**
- Map each column to a field (Date, Description, Amount, Reference, etc.)
- Specify date format if ambiguous
- Indicate whether amounts are signed (+/-) or separate debit/credit columns
- Indicate if first row is header

**Automatic Detection:**
- System attempts to auto-detect column types based on content
- Suggests most likely mappings
- User confirms or adjusts

### Step 3: Transaction Preview

**User sees all transactions that will be imported:**

```
┌──────────────────────────────────────────────────────┐
│ Review Transactions (78 found)                       │
├──────────────────────────────────────────────────────┤
│ Date       Description      Amount    Offset Account │
├──────────────────────────────────────────────────────┤
│ 2024-01-15 Grocery Store   -$125.50  [Groceries  ▼] │
│ 2024-01-16 Gas Station     -$45.00   [Auto: Gas  ▼] │
│ 2024-01-17 Paycheck      +$2,500.00  [Salary Inc ▼] │
│ 2024-01-18 Electric Co     -$150.00  [Utilities  ▼] │
│ ⚠ 2024-01-19 Unknown        -$50.00  [Imbalance  ▼] │
│ ...                                                  │
├──────────────────────────────────────────────────────┤
│ 73 transactions auto-categorized                     │
│ 5 transactions need review (⚠)                       │
│                                                      │
│ [Select All] [Deselect All] [Back] [Import]         │
└──────────────────────────────────────────────────────┘
```

**Auto-Categorization:**
- System attempts to match description to existing accounts
- Based on previous transactions with similar descriptions
- Confidence indicated by icon (✓ high, ~ medium, ⚠ needs review)

**User Actions:**
- Review auto-categorized transactions
- Adjust offset account for any transaction (click dropdown)
- Deselect transactions to skip (won't be imported)
- Click "Import" to proceed

### Step 4: Duplicate Detection

**If potential duplicates found:**

```
┌──────────────────────────────────────────────────────┐
│ Possible Duplicates Found                            │
├──────────────────────────────────────────────────────┤
│ The following transactions may already exist:        │
│                                                      │
│ ☑ 2024-01-15 Grocery Store    $125.50               │
│   Matches existing transaction on same date/amount  │
│                                                      │
│ ☐ 2024-01-16 Gas Station      $45.00                │
│   Similar but not exact match (off by 2 days)       │
│                                                      │
│ [Import checked only] [Import all] [Cancel]         │
└──────────────────────────────────────────────────────┘
```

**Duplicate Detection Rules:**
- **Exact match:** Same date + amount + description
- **OFX files:** Uses transaction ID (FITID) for precise matching
- **Near match:** Same amount within 3 days, similar description

**User Actions:**
- Check/uncheck transactions to import
- "Import checked only" skips unchecked (likely duplicates)
- "Import all" imports everything (overrides duplicate warnings)

### Step 5: Import Execution

**User sees progress:**
```
┌─────────────────────────────────────┐
│ Importing...                        │
├─────────────────────────────────────┤
│ [████████████████░░░░] 72%          │
│                                     │
│ Imported: 56 of 78 transactions     │
│ Skipped: 5 duplicates               │
└─────────────────────────────────────┘
```

### Step 6: Completion

**Success:**
```
┌─────────────────────────────────────┐
│ Import Successful            ✓      │
├─────────────────────────────────────┤
│ 73 transactions imported            │
│ 5 duplicates skipped                │
│                                     │
│ Date range: 2024-01-15 to 2024-03-10│
│ Target account: Checking Account    │
│                                     │
│     [View Ledger] [Close]           │
└─────────────────────────────────────┘
```

**With Warnings:**
```
┌─────────────────────────────────────┐
│ Import Complete (with warnings) ⚠   │
├─────────────────────────────────────┤
│ 70 transactions imported            │
│ 5 duplicates skipped                │
│                                     │
│ Warnings:                           │
│ • 3 transactions to Imbalance       │
│   (no category matched)             │
│ • 2 date format issues              │
│   (assumed MM/DD/YYYY)              │
│                                     │
│ [View Warnings] [View Ledger] [Close]│
└─────────────────────────────────────┘
```

## Account Mapping

**How offset accounts are determined:**

1. **Explicit category (QIF, OFX):** File specifies category, matched to account name
2. **Description matching:** System searches for similar past transactions
3. **Payee matching:** If description matches a known Partner, use their default account
4. **User rules (future):** Custom rules like "Gas Station → Auto: Gas"
5. **Imbalance fallback:** If no match, posts to Imbalance account (user fixes later)

**Example:**
- Transaction: "Grocery Store" -$125.50
- System finds previous transaction with "Grocery" → "Expenses : Groceries"
- Pre-fills offset account with this suggestion
- User can accept or change

## Error Handling

### Invalid File Format

**User sees:**
```
Import Failed
Unable to read file. The file may be corrupted or in an unsupported format.
Supported formats: CSV, QIF, OFX, QFX
[Try Again] [Cancel]
```

### Parse Errors

If some lines can't be parsed:
```
78 transactions found
2 lines skipped (malformed data)
[View Skipped Lines] [Continue]
```

User can view skipped lines to manually add if needed.

### Date Format Ambiguous

If date format is unclear (e.g., `01/02/2024` could be Jan 2 or Feb 1):
```
Ambiguous Date Format
Found dates like: 01/02/2024, 03/04/2024
Is this:
  ( ) MM/DD/YYYY (US format)
  ( ) DD/MM/YYYY (European format)
  ( ) YYYY-MM-DD (ISO format)
[Proceed] [Cancel]
```

### Missing Required Fields

If transactions lack essential data:
```
5 transactions missing date or amount
These will be skipped.
[View Issues] [Continue] [Cancel]
```

## Post-Import

**What happens after import:**
- Transactions appear in target account's ledger
- All transactions marked as "unreconciled"
- Offset accounts populated as determined
- Any Imbalance entries flagged for review

**User can:**
- Review ledger to verify transactions
- Edit any transactions (change offset account, split, etc.)
- Reconcile account against statement
- Fix any Imbalance entries

**Transactions preserve:**
- Original date
- Original description/payee
- Reference/check number
- Amount

## Transaction States

**After import, transactions are:**
- **Unreconciled:** Default state, not yet verified against statement
- **Posted to Imbalance:** If no offset account could be determined
- **Editable:** User can modify any imported transaction

**User workflow:**
1. Import transactions
2. Review ledger
3. Fix Imbalance entries (assign correct offset accounts)
4. Reconcile against statement
5. Mark as reconciled

## Import Profiles (Future)

Save column mappings and rules for repeated imports:

**Example:**
- "Chase Checking CSV" profile
  - Column 1 = Date (MM/DD/YYYY)
  - Column 2 = Description
  - Column 3 = Amount (signed)
  - Auto-categorization rules enabled

**User can:**
- Save current mapping as profile
- Select profile when importing from same source
- Edit/delete profiles in Settings

## Limitations

**Not Supported:**
- Multi-currency transactions in single import (use separate imports per currency)
- Split transactions in source file (only 2-entry transactions)
- Transfers between accounts in same entity (may appear as two separate transactions)

**Workarounds:**
- Multi-currency: Import separately to each currency's account
- Splits: Import as simple transactions, manually split afterward
- Transfers: Match and merge manually after import

## Future Enhancements

**Smart Categorization:**
- Machine learning from user corrections
- Industry-specific categorization (e.g., "dental" → Medical Expenses)
- Payee database with common categorizations

**Connected Accounts:**
- Automatic download from bank (with user permission)
- Scheduled imports (daily/weekly)
- Real-time transaction notifications

**Import Rules Engine:**
- "If description contains X, then offset account Y"
- Regular expression matching
- Conditional logic (amount thresholds, date ranges)

**Batch Import:**
- Import multiple files at once
- Map to multiple target accounts
- Consolidated review screen

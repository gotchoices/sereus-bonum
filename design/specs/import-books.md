# Spec: Import Books

**Purpose:** Import complete accounting books from other programs, creating a new Entity with full chart of accounts and transaction history.

## Supported Formats

| Format | File Extension | Source Program | Status |
|--------|----------------|----------------|--------|
| GnuCash XML | `.gnucash` | GnuCash (uncompressed or gzipped) | Planned |
| GnuCash SQLite | `.gnucash` | GnuCash (SQLite storage mode) | Planned |
| QuickBooks IIF | `.iif` | QuickBooks Desktop export | Planned |

**Note:** Native QuickBooks files (`.QBW`, `.QBB`) are proprietary and cannot be imported directly. User must export to IIF format first.

## What Gets Imported

**Creates a new Entity containing:**
- All accounts with their hierarchy and names
- All transactions with original dates
- Transaction descriptions, memos, and references
- Currencies/commodities as Units
- Opening balances (via special transactions)
- Historical data (all dates preserved)

**Not imported:**
- Scheduled/recurring transaction templates
- Reports and custom views
- User preferences
- Attachments or linked documents

## Import Workflow

### Step 1: Initiate Import

**Trigger:** User selects "Import Books" from global menu

**Dialog appears:**
```
┌─────────────────────────────────────┐
│ Import Accounting Books        [X]  │
├─────────────────────────────────────┤
│ Entity Name:                        │
│ [_____________________________]     │
│                                     │
│ Source File:                        │
│ ┌─────────────────────────────┐     │
│ │ Drag & drop file here       │     │
│ │         or                  │     │
│ │    [Browse Files...]        │     │
│ └─────────────────────────────┘     │
│                                     │
│ Supported: .gnucash, .iif           │
│                                     │
│              [Cancel] [Next]        │
└─────────────────────────────────────┘
```

**User Actions:**
- Enter name for new entity
- Drop or browse to select file
- Click "Next" to proceed

### Step 2: File Processing

**User sees:**
```
┌─────────────────────────────────────┐
│ Processing file...                  │
├─────────────────────────────────────┤
│ [████████████░░░░░░░░] 60%          │
│                                     │
│ Reading accounts...                 │
│ Found 45 accounts, 1,234 transactions│
└─────────────────────────────────────┘
```

**What's happening:**
- File is parsed and validated
- Accounts, transactions, and currencies are extracted
- Data structure is analyzed
- Automatic mapping is attempted

### Step 3: Account Mapping Preview

**User sees a preview of accounts and proposed mappings:**

```
┌──────────────────────────────────────────────────────┐
│ Review Account Mapping                               │
├──────────────────────────────────────────────────────┤
│ Source (GnuCash)       → Bonum Mapping              │
├──────────────────────────────────────────────────────┤
│ √ Checking (BANK)      → Asset : Cash & Bank        │
│ √ Savings (BANK)       → Asset : Cash & Bank        │
│ √ Credit Card (CREDIT) → Liability : Credit Cards   │
│ ⚠ Investment (STOCK)   → Asset : Investments        │
│ √ Salary (INCOME)      → Income : Wages & Salaries  │
│ ...                                                  │
├──────────────────────────────────────────────────────┤
│ 42 accounts mapped automatically                     │
│ 3 accounts flagged for review                       │
│                                                      │
│               [Back] [Review] [Import]               │
└──────────────────────────────────────────────────────┘
```

**Indicators:**
- **√ Green check:** Confidently mapped
- **⚠ Yellow warning:** Uncertain mapping, review recommended
- **✗ Red X:** Could not map automatically, user must specify

**User Actions:**
- **Accept:** Click "Import" to proceed with automatic mappings
- **Review:** Click "Review" to manually adjust mappings
- **Back:** Return to file selection

### Step 4: Manual Mapping (Optional)

If user clicks "Review" or any accounts couldn't be auto-mapped:

```
┌──────────────────────────────────────────────────────┐
│ Account: Investment Portfolio                        │
├──────────────────────────────────────────────────────┤
│ Source Type: STOCK                                   │
│ Source Parent: Assets                                │
│                                                      │
│ Bonum Name: [Investment Portfolio____________]      │
│ Type:       [Asset                    ▼]            │
│ Group:      [Investments              ▼]            │
│ Parent:     [None - top level         ▼]            │
│                                                      │
│            [Previous] [Skip] [Next] [Save All]       │
└──────────────────────────────────────────────────────┘
```

**User can:**
- Rename account
- Assign to different account group
- Set up hierarchy (parent accounts)
- Skip account (won't be imported)

### Step 5: Import Execution

**User sees progress:**
```
┌─────────────────────────────────────┐
│ Importing...                        │
├─────────────────────────────────────┤
│ [██████████████████░░] 85%          │
│                                     │
│ Creating accounts...      45/45 ✓   │
│ Importing transactions... 1050/1234 │
└─────────────────────────────────────┘
```

**Steps:**
1. Create entity
2. Create accounts with hierarchy
3. Import transactions in chronological order
4. Calculate account balances
5. Verify totals match source

### Step 6: Completion

**Success:**
```
┌─────────────────────────────────────┐
│ Import Successful            ✓      │
├─────────────────────────────────────┤
│ Entity "Home Finance" created       │
│ 45 accounts imported                │
│ 1,234 transactions imported         │
│                                     │
│ Date range: 2010-01-01 to 2024-12-10│
│                                     │
│        [View Entity] [Close]        │
└─────────────────────────────────────┘
```

**With Warnings:**
```
┌─────────────────────────────────────┐
│ Import Complete (with warnings) ⚠   │
├─────────────────────────────────────┤
│ Entity "Home Finance" created       │
│ 45 accounts imported                │
│ 1,230 transactions imported         │
│                                     │
│ Warnings:                           │
│ • 4 unbalanced transactions         │
│   → Posted to Imbalance account     │
│ • 2 unknown currencies              │
│   → Mapped to USD                   │
│                                     │
│ [View Warnings] [View Entity] [Close]│
└─────────────────────────────────────┘
```

## Account Type Mapping

GnuCash and other programs use different account type names. These are mapped automatically:

| Source Type | Bonum Type | Notes |
|-------------|------------|-------|
| BANK, ASSET | Asset | Bank accounts and general assets |
| STOCK, MUTUAL | Asset | Investment holdings |
| CASH | Asset | Petty cash |
| CREDIT, LIABILITY, PAYABLE | Liability | Credit cards, loans, payables |
| EQUITY | Equity | Owner's equity, retained earnings |
| INCOME | Income | Revenue streams |
| EXPENSE | Expense | Costs and expenses |
| ROOT | (skip) | Top-level container, not imported |

## Error Handling

### Invalid or Corrupted File

**User sees:**
```
Import Failed
Unable to read file. The file may be corrupted or in an unsupported format.
[Try Again] [Cancel]
```

### Unbalanced Transactions

Transactions where debits ≠ credits:
- Imported with balancing entry to "Imbalance" account
- Flagged with warning message
- User can fix later by editing transactions

### Unknown Account Types

Accounts with unfamiliar types:
- Mapped to closest equivalent (best guess)
- Flagged for review in preview step
- User can correct mapping before import

### Duplicate Entity Names

**User sees:**
```
An entity named "Home Finance" already exists.
Would you like to:
  ( ) Rename new entity: [Home Finance (2)_____]
  ( ) Replace existing entity (all data will be lost)
  ( ) Cancel import

[Proceed] [Cancel]
```

## Multi-Currency Support

**If source file contains multiple currencies:**
- Each currency maps to a Bonum Unit
- Accounts retain their original currency
- Exchange rates imported if available
- Multi-currency transactions preserved

**User sees notification:**
```
Multi-Currency Import
Found 3 currencies: USD, EUR, GBP
Each will be created as a separate Unit.
Transactions will preserve original currencies.
```

## Post-Import

**What user can do:**
- View imported entity in Accounts View
- Review and edit transactions if needed
- Fix any imbalanced transactions
- Reconcile accounts
- Continue adding new transactions

**What's preserved:**
- All original dates
- Transaction memos and descriptions
- Check/reference numbers
- Account hierarchy and organization

**What may need adjustment:**
- Account group assignments (if auto-mapping wasn't perfect)
- Imbalance account entries (if source had errors)
- Currency assignments (if exotic currencies weren't recognized)

## Limitations

**File Size:**
- Large files (10,000+ transactions) may take 1-2 minutes to import
- Progress indicator keeps user informed

**Duplicate Detection:**
- No automatic detection of duplicate imports
- User must manage entity names to avoid confusion

**Partial Import:**
- Cannot import subset of accounts or date range
- It's all-or-nothing (entire book is imported)

**No Merge:**
- Import creates new entity only
- Cannot merge into existing entity (future feature)

## Future Enhancements

**Additional Formats:**
- QuickBooks Online (via QBO export)
- Wave Accounting (via CSV export)
- Sage 50 (via IIF or custom format)

**Smart Mapping:**
- Learn from previous imports
- Suggest mappings based on account names
- Industry-specific templates

**Partial Import:**
- Select specific accounts to import
- Filter by date range
- Skip old/inactive accounts

**Merge Import:**
- Add accounts to existing entity
- Append transactions to existing data
- Detect and skip duplicates

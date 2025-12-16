# Spec: Import Strategy

**Type:** Global Feature  
**Status:** Planned

---

## Purpose

Import accounting data from external sources - either complete books (creates new entity) or transaction files (adds to existing entity).

---

## Two Import Modes

### Import Books
- **Creates:** New entity with full chart of accounts + transaction history
- **Sources:** GnuCash (XML/SQLite), QuickBooks IIF
- **Use Case:** Migrate from another accounting program

### Import Transactions
- **Adds to:** Existing entity
- **Sources:** CSV, QIF, OFX, QFX (bank/credit card statements)
- **Use Case:** Regular data entry from bank downloads

---

## Supported Formats

| Format | Extension | Books | Transactions | Auto-Categorization | Duplicate Detection |
|--------|-----------|-------|--------------|---------------------|---------------------|
| GnuCash XML | `.gnucash` | ✓ | ✓ | N/A | GUID-based |
| GnuCash SQLite | `.gnucash` | ✓ | ✓ | N/A | GUID-based |
| QuickBooks IIF | `.iif` | ✓ | ✗ | N/A | N/A |
| CSV | `.csv` | ✗ | ✓ | Description matching | Fuzzy match |
| QIF | `.qif` | ✗ | ✓ | Category field | Fuzzy match |
| OFX/QFX | `.ofx`, `.qfx` | ✗ | ✓ | Category field | Transaction ID |

---

## Multi-Step Workflow

### Step 1: Upload File

**Books Mode:**
- User enters new entity name
- Drops or browses for file
- Supported formats shown

**Transactions Mode:**
- User selects target account (dropdown)
- Drops or browses for file
- Supported formats shown

### Step 2: File Processing

**User sees progress indicator:**
- "Reading accounts..." (Books) or "Reading transactions..." (Transactions)
- Count discovered: "Found 45 accounts, 1,234 transactions"
- Progress bar or spinner

**System analyzes:**
- Parses file format
- Extracts accounts, transactions, currencies
- Attempts automatic mapping

### Step 3: Preview & Mapping

**Books Mode - Account Mapping:**

User sees list of source accounts with proposed Bonum mappings:

**Confidence Indicators:**
- ✓ Green check: High confidence (e.g., "BANK" → Asset : Cash & Bank)
- ⚠ Yellow warning: Uncertain (e.g., "STOCK" → Asset : Investments - review recommended)
- ✗ Red X: No mapping found - user must specify

**User Actions:**
- Accept all auto-mappings → click "Import"
- Review specific accounts → click "Review" to adjust individually
- Per-account editor allows:
  - Rename account
  - Change type (Asset/Liability/etc.)
  - Assign account group
  - Set parent (hierarchy)
  - Skip account (won't import)

**Transactions Mode - Transaction Preview:**

User sees list of transactions with proposed offset accounts:

**Auto-Categorization:**
- System matches description to previous similar transactions
- If no match, defaults to Imbalance account
- User can adjust any transaction's offset account via dropdown

**CSV-Specific: Column Mapping Step:**
- Shows sample rows from file
- User maps columns: Date, Description, Amount, Reference
- Specifies date format (if ambiguous)
- Indicates if amounts are signed or separate debit/credit columns
- Checkboxes: "Has header row", "Negative = expense"

**User Actions:**
- Review all transactions
- Adjust offset accounts as needed
- Deselect transactions to skip
- Click "Import" to proceed

### Step 4: Duplicate Detection (Transactions Only)

**If potential duplicates found:**

System flags transactions that may already exist:
- **Exact match:** Same date + amount + description
- **OFX files:** Uses transaction ID (FITID) for precise matching
- **Near match:** Same amount within 3 days, similar description

**User sees:**
- List of suspected duplicates with checkboxes
- Match confidence explanation
- Options:
  - Import checked only (skip suspected duplicates)
  - Import all (override warnings)
  - Cancel

### Step 5: Import Execution

**Progress indicator shows:**
- Percentage complete with progress bar
- Current operation:
  - Books: "Creating accounts... 45/45 ✓" → "Importing transactions... 850/1,234"
  - Transactions: "Imported: 56 of 78 transactions" → "Skipped: 5 duplicates"
- Cannot cancel during execution (data integrity)

### Step 6: Completion Summary

**Success:**
- Checkmark icon
- Summary stats:
  - Books: Entity name, account count, transaction count, date range
  - Transactions: Transaction count, duplicates skipped, date range, target account
- Action buttons (see `screens/import.md` for navigation)

**With Warnings:**
- Warning icon
- Same summary plus issues list:
  - "X unbalanced transactions → Posted to Imbalance"
  - "X unknown currencies → Mapped to USD"
  - "X transactions to Imbalance (no category matched)"
  - "X date format issues (assumed MM/DD/YYYY)"
- "View Warnings" button to expand details
- Still allows proceeding to view imported data

---

## Account Mapping

### Books: Type Mapping

Source account types mapped to Bonum types:

| Source Type (GnuCash/QB) | Bonum Type | Account Group Examples |
|--------------------------|------------|------------------------|
| BANK, ASSET, CASH | Asset | Cash & Bank, Investments |
| STOCK, MUTUAL | Asset | Investments |
| CREDIT, LIABILITY, PAYABLE | Liability | Credit Cards, Loans |
| EQUITY | Equity | Owner's Equity, Retained Earnings |
| INCOME | Income | Wages, Sales |
| EXPENSE | Expense | Rent, Utilities, Groceries |
| ROOT | (skipped) | Top-level container |

### Transactions: Auto-Categorization

**How offset accounts determined:**
1. **Explicit category:** File specifies (QIF/OFX), matched to account name
2. **Description matching:** Search previous transactions with similar description
3. **Payee matching:** If description matches Partner, use default account
4. **Imbalance fallback:** User reviews/fixes later

**Example:**
- "Grocery Store" -$125.50 → Finds previous "Grocery" transaction → "Expenses : Groceries"

---

## Idempotence & Duplicate Handling

### GnuCash Files (Books & Transactions)
- Match by GUID (stored in account/entry tables)
- Skip exact duplicates automatically
- No user interaction needed

### Transaction Files (CSV/QIF/OFX)
- **OFX:** Uses transaction ID (FITID) for exact matching
- **Others:** Fuzzy match (date + amount + account within $0.01)
- **User reviews:** Suspected duplicates shown with checkboxes

### Account Handling (Transactions Mode)
- Match by name or GUID
- Create missing accounts automatically
- Show mapping UI if ambiguous

---

## Error Handling

### Invalid File
**User sees:**
- "Import Failed: Unable to read file"
- "File may be corrupted or in unsupported format"
- Options: Try Again, Cancel

### Parse Errors
**User sees:**
- "78 transactions found, 2 lines skipped (malformed data)"
- "View Skipped Lines" to see details
- Can continue with successful rows

### Ambiguous Date Format
**User chooses:**
- MM/DD/YYYY (US)
- DD/MM/YYYY (European)
- YYYY-MM-DD (ISO)

### Missing Required Fields
**User sees:**
- "5 transactions missing date or amount - will be skipped"
- "View Issues" to see which ones
- Can continue or cancel

### Unbalanced Transactions (Books)
**Automatic handling:**
- Import with balancing entry to "Imbalance" account
- Flag with warning icon
- User fixes later by editing transactions

### Duplicate Entity Name (Books)
**User chooses:**
- Rename new entity (suggested: "Name (2)")
- Replace existing entity (warns: all data lost)
- Cancel import

---

## Multi-Currency Support

### Books Mode
- Each currency → separate Bonum Unit
- Accounts retain original currency
- Exchange rates imported if available
- User notified: "Found 3 currencies: USD, EUR, GBP - each will be created as a Unit"

### Transactions Mode
- Single currency per import
- Multi-currency transactions not supported (use separate imports)

---

## Post-Import Data State

### Books
**What's created:**
- New entity (appears in sidebar)
- All accounts with hierarchy
- All transactions with original dates
- Units for each currency

**What's preserved:**
- Transaction dates, descriptions, memos
- Check/reference numbers
- Account structure and organization

**What may need adjustment:**
- Account group assignments (if auto-mapping wasn't perfect)
- Imbalance entries (if source had errors)

### Transactions
**What's created:**
- New transactions in target account's ledger
- All marked "unreconciled"
- Offset accounts as determined by auto-categorization

**User workflow after:**
1. Review ledger
2. Fix Imbalance entries (assign correct offset accounts)
3. Edit/split transactions if needed
4. Reconcile against statement
5. Mark as reconciled

---

## What's NOT Imported

**Books:**
- Scheduled/recurring transaction templates
- Custom reports and views
- User preferences
- Attachments or linked documents

**Transactions:**
- Split transactions (import as simple 2-entry, split manually after)
- Transfers between accounts (may appear as separate transactions)

---

## Limitations

**File Size:**
- Large files (10,000+ transactions) may take 1-2 minutes
- Progress indicator keeps user informed

**Partial Import:**
- Books: All-or-nothing (cannot select subset of accounts/dates)
- Transactions: Can deselect individual transactions before import

**No Merge (Books):**
- Always creates new entity
- Cannot merge into existing entity (future feature)

---

## Future Enhancements

**Additional Formats:**
- QuickBooks Online (QBO export)
- Wave Accounting (CSV)
- Sage 50

**Smart Categorization:**
- Machine learning from user corrections
- Industry-specific rules
- Shared payee database

**Connected Accounts:**
- Automatic bank downloads
- Scheduled imports (daily/weekly)
- Real-time notifications

**Import Profiles:**
- Save CSV column mappings
- Auto-categorization rules ("Gas Station" → Auto: Gas)
- Reusable configurations

**Partial/Filtered Import:**
- Select specific accounts (Books)
- Filter by date range
- Skip old/inactive accounts

---

## References

- Entry points & navigation: `screens/import.md`
- Implementation details: Consolidations (generated)

---

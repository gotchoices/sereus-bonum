# Import Transactions Spec

Import transactions from bank exports and other sources into an existing Entity's accounts.

## Supported Formats

| Format | Extension | Source | Status |
|--------|-----------|--------|--------|
| CSV | `.csv` | Bank exports, spreadsheets | planned |
| QIF | `.qif` | Quicken Interchange Format | planned |
| QFX | `.qfx` | Quicken Web Connect (OFX variant) | planned |
| OFX | `.ofx` | Open Financial Exchange | planned |

## Format Details

### CSV

Comma-separated values with configurable column mapping:
- Date
- Description/Memo
- Amount (or separate Debit/Credit columns)
- Reference/Check number
- Category (optional, maps to offset account)

User must specify:
- Target account (which account transactions post to)
- Column mappings
- Date format
- Whether amounts are signed or split into debit/credit

### QIF (Quicken Interchange Format)

Text-based format with record markers:
- `D` - Date
- `T` - Amount
- `P` - Payee
- `M` - Memo
- `N` - Check number
- `L` - Category (offset account)

### OFX / QFX (Open Financial Exchange)

XML-based format used by banks for download:
- Statement info (account, date range, balance)
- Transaction list with:
  - Transaction ID (FITID)
  - Date posted
  - Amount
  - Payee/description
  - Type (debit, credit, check, etc.)

QFX is Intuit's branded version of OFX with minor extensions.

## Import Workflow

1. User selects "Import" from entity context menu
2. User selects target account and drops/selects file
3. For CSV: User maps columns
4. System parses file, displays transaction preview
5. System attempts auto-categorization based on:
   - Payee matching to existing Partners
   - Memo patterns matching previous transactions
   - User-defined rules (future)
6. User reviews and adjusts offset accounts
7. User approves import
8. System creates transactions

## Duplicate Detection

Prevent re-importing same transactions:
- Match on date + amount + payee/memo
- For OFX: Use FITID (Financial Institution Transaction ID)
- Show potential duplicates, let user decide

## Account Mapping

For each imported transaction:
- One side posts to the selected target account
- Other side posts to:
  - Matched offset account (from categorization)
  - Imbalance account (if no match, user fixes later)

## Error Handling

- Invalid file format: Show error, abort
- Parse errors: Skip malformed lines, report count
- Date format issues: Attempt auto-detection, ask user if ambiguous
- Missing required fields: Skip transaction, report

## Future Enhancements

- Import rules/profiles (remember column mappings per source)
- Auto-categorization learning
- Scheduled import from connected accounts

## Notes

- Import adds to existing Entity; use "Import books" for new Entity
- Transactions import as unreconciled
- Original payee text preserved in memo for matching


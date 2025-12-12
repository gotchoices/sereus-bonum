# Spec: Data Export

## Purpose

Users need to export financial data (transactions, reports) to external programs for analysis, backup, or sharing with accountants/partners.

## Supported Formats

**CSV (Comma-Separated Values):**
- Opens in any spreadsheet program (Excel, Google Sheets, Numbers, LibreOffice)
- Plain text format - can be imported to other accounting systems
- No formatting - columns may need manual width adjustment
- Best for: data analysis, importing to other systems, universal compatibility

**Excel (XLSX):**
- Opens natively in Microsoft Excel
- Includes column formatting and proper number display
- Larger file size
- Best for: professional reports, sharing formatted spreadsheets, Excel users

## Amount Formatting

All monetary amounts display as decimal currency with 2 decimal places:

- Internal storage: cents (e.g., 5000000 = $50,000.00)
- Export display: `50000.00` (CSV) or `50,000.00` (Excel with comma separators)

This ensures amounts are readable and can be used in spreadsheet calculations.

## File Naming

Files are automatically named with the context and current date:

- Transactions: `transactions-2024-12-09.csv` or `transactions-2024-12-09.xlsx`
- Balance Sheet: `balance-sheet-2024-12-09.csv`
- Income Statement: `income-statement-2024-12-09.xlsx`

Date format: `YYYY-MM-DD` (sortable, unambiguous)

## Transaction Export Layout

When exporting transactions (from Search or Ledger screens):

**Header Row:**
`Date | Entity | Memo | Reference | Account | Debit | Credit | Note`

**Transaction Rows:**
- Main transaction line shows date, entity, memo, and reference
- Split lines show each account involved with amounts
- Debits appear in Debit column, credits in Credit column
- Each split can have an optional note

**Totals Row:**
`Totals: | [sum of debits] | [sum of credits]`

**Verification Row:**
`Balanced` (if debits = credits) or `Imbalance: $X.XX` (if not balanced)

**Example:**
```
Date       | Entity        | Memo         | Ref  | Account          | Debit    | Credit   | Note
2024-01-15 | Home Finance  | Opening      |      |                  |          |          |
           |               |              |      | Checking Account | 50000.00 |          |
           |               |              |      | Equity           |          | 50000.00 |
2024-01-16 | Home Finance  | Grocery      | 1001 |                  |          |          |
           |               |              |      | Checking Account |          | 125.50   |
           |               |              |      | Groceries        | 125.50   |          |
           |               |              |      | Totals:          | 50125.50 | 50125.50 |
           |               |              |      | Balanced         |          |          |
```

## Report Export Layout (Future)

When exporting reports (Balance Sheet, Income Statement, Trial Balance):

**Columns:**
- Account Code (if applicable)
- Account Name (indented for hierarchy)
- Debit or Balance
- Credit (if applicable)

**Structure:**
- Account type headers (Assets, Liabilities, etc.)
- Account groups (indented)
- Individual accounts (further indented)
- Subtotals per type
- Grand total at bottom

## Excel Enhancements

Excel exports include additional formatting:

- **Header row:** Bold text
- **Amount columns:** Formatted as numbers with 2 decimal places and comma separators
- **Totals row:** Bold text with border line above
- **Verification row:** Color-coded (green for balanced, red for imbalance)
- **Column widths:** Auto-sized for readability

## Export Behavior

**Export Button:**
- Shows icon + "Export" text (or dropdown if multiple formats)
- Disabled if no data to export

**When Clicked:**
- File generates immediately
- Browser prompts to save/open file (standard browser behavior)
- No loading spinner needed (exports are fast)

**If Export Fails:**
- Excel export may fail if browser memory is exhausted
- Automatically falls back to CSV export
- User sees a brief notification

## Special Data Handling

**Text containing commas:** Wrapped in quotes (spreadsheet standard)
**Empty values:** Left blank (no placeholder text like "N/A")
**Large numbers:** Always show full precision (never scientific notation)
**Dates:** ISO format (YYYY-MM-DD) for consistency

## Future Enhancements

- PDF export for formatted reports
- Print-friendly HTML (browser print → PDF)
- Custom column selection (user chooses which columns)
- Date range filtering
- Multi-sheet workbooks (summary + details + notes)
- Saved export templates

# Export Specification

**Applies to:** All web screens with export functionality  
**Current implementations:** Transaction Search

---

## Purpose

Provide consistent export functionality across the application for financial data, supporting both CSV and Excel formats.

---

## Supported Formats

### CSV (Comma-Separated Values)
- **Pros:** Universal compatibility, plain text, no dependencies
- **Cons:** No formatting, manual column width adjustment
- **Use case:** Data analysis in any spreadsheet program, importing to other systems

### Excel (XLSX)
- **Pros:** Formatted columns, proper number formatting, native Excel support
- **Cons:** Requires `xlsx` library (~13 MB)
- **Use case:** Professional reports, formatted spreadsheets

---

## Number Formatting

**Storage:** All monetary amounts stored in smallest unit (cents)
- Example: $50,000.00 stored as 5000000

**Export:** All monetary amounts displayed as decimal currency
- **Format:** `#,##0.00` (US format with 2 decimal places)
- **Example:** 5000000 → `50000.00` (CSV) or `50,000.00` (Excel with formatting)

**Implementation:**
```typescript
// Always divide by 100 and format to 2 decimals
function formatAmountForExport(amount: number): string {
  return (amount / 100).toFixed(2);
}
```

**CSV:** Use string format `"50000.00"`  
**Excel:** Use numeric format with 2 decimal places (cell formatting)

---

## File Naming Convention

**Pattern:** `{context}-{YYYY-MM-DD}.{ext}`

**Examples:**
- `transactions-2024-12-09.csv`
- `transactions-2024-12-09.xlsx`
- `balance-sheet-2024-12-09.csv`
- `income-statement-2024-12-09.xlsx`

**Date:** Use ISO date format (YYYY-MM-DD) from current date

---

## CSV Format Specification

### Header Row
- First row contains column names
- No special formatting

### Data Rows
- One row per data item
- Hierarchical data shown with indentation or blank leading columns

### Special Characters
- **Commas in data:** Wrap field in double quotes: `"Account A, LLC"`
- **Quotes in data:** Escape with double quotes: `"He said ""Hello"""`
- **Newlines in data:** Wrap field in double quotes (preserve newlines)

### Empty Values
- Use empty string (no placeholder text)
- Example: `,,` for two empty columns

### Totals and Verification
- Include totals row at bottom
- Include verification/status row (e.g., "Balanced", "Imbalance: $X.XX")

---

## Excel (XLSX) Format Specification

### Column Widths
Set appropriate widths for readability:
- **Date:** 12 characters
- **Entity/Account:** 20-30 characters
- **Memo/Description:** 30 characters
- **Reference:** 12 characters
- **Amount columns:** 12 characters
- **Note:** 30 characters

### Number Formatting
- **Currency columns:** Apply number format with 2 decimal places
- **Date columns:** Apply date format (YYYY-MM-DD or locale-specific)

### Styling (Optional)
- **Header row:** Bold
- **Transaction header rows:** Bold or distinct background
- **Totals row:** Bold, optional border-top
- **Verification row:** Bold, color-coded (green for balanced, red for imbalance)

### Multiple Sheets (Future)
- Default sheet name: context (e.g., "Transactions")
- Additional sheets for summaries, details, etc.

---

## Transaction Export Structure

### Transaction-based exports (Search, Ledger)

**CSV Structure:**
```csv
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

**Excel Structure:**
- Same layout as CSV
- Numeric columns formatted with 2 decimal places
- Transaction header rows with bold text
- Totals row with bold text and border-top

---

## Account-based Export Structure (Future)

For exports from Accounts View (Balance Sheet, Trial Balance, Income Statement):

**Columns:**
- Account Code (optional)
- Account Name
- Debit (or Balance)
- Credit (if applicable)

**Hierarchy:**
- Account type headers (Assets, Liabilities, etc.)
- Account group rows (indented or styled)
- Individual accounts (further indented)
- Subtotals per group
- Grand totals at bottom

---

## Error Handling

### Export Failures
- **CSV:** Should never fail (uses native browser APIs)
- **Excel:** May fail if `xlsx` library not available or memory issues

### Fallback Strategy
- If Excel export fails, automatically fall back to CSV export
- Log warning to console
- Notify user if appropriate

### Empty Data
- Button disabled or hidden if no data to export
- Or show empty state message in export file

---

## Implementation

### Export Utilities
Location: `src/lib/utils/export.ts`

**Functions:**
- `exportToCSV(data, filename)` — Generate and download CSV
- `exportToExcel(data, filename)` — Generate and download XLSX
- Helper functions for formatting, escaping, grouping

### UI Components
- **Export button:** Icon + "Export" text
- **Export dropdown:** Multiple format options
- **Click outside to close:** Dropdown auto-closes

### Dependencies
- **CSV:** None (native browser Blob API)
- **Excel:** `xlsx@^0.18.5` (SheetJS)

---

## Testing

### Test Cases
1. **Empty data:** Button disabled or shows empty export
2. **Single transaction:** Exports correctly with header and totals
3. **Multiple transactions:** Grouped correctly with splits
4. **Special characters:** Commas, quotes, newlines handled correctly
5. **Large datasets:** 1000+ transactions export without hanging
6. **Currency formatting:** All amounts show 2 decimal places
7. **Totals verification:** Balanced/imbalance status correct
8. **Excel fallback:** Falls back to CSV if Excel fails

### Manual Testing
1. Export to CSV, open in Excel/Google Sheets
2. Verify amounts show as `50000.00` not `5000000`
3. Export to Excel, open in Microsoft Excel
4. Verify columns are properly formatted
5. Verify totals are correct

---

## Future Enhancements

- **PDF export:** For formatted reports
- **Print-friendly HTML:** Browser print → PDF
- **Custom column selection:** User chooses which columns to export
- **Date range filter:** Export only transactions in date range
- **Multi-sheet workbooks:** Separate sheets for summary, details, notes
- **Templates:** Saved export configurations
- **Scheduled exports:** Automatic periodic exports


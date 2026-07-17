# Export Contract

The shared rules for what exported financial data contains and how it's formatted. Applies to every
target; how the file is delivered (download, share sheet) is a per-target concern described in the
screen that offers export.

## Formats

- **CSV** — plain text, opens in any spreadsheet or accounting program. Universal, unformatted.
- **XLSX** — Excel workbook with formatting (bold header, number columns, color-coded verification,
  auto-sized widths). For polished, shareable reports.

## Amounts

Stored as integers in the smallest unit; exported as decimals using the unit's precision (e.g.
`50000.00` for USD). Full precision always — never scientific notation.

## File Naming

`{context}-{YYYY-MM-DD}.{ext}` — e.g. `transactions-2024-12-09.csv`,
`balance-sheet-2024-12-09.xlsx`. ISO date, sortable and unambiguous.

## Transaction Layout

Columns: `Date | Entity | Memo | Reference | Account | Debit | Credit | Note`

- One line per transaction (date/entity/memo/reference), followed by one indented line per split
  entry (account, amount, optional note).
- Each amount appears in Debit **or** Credit, never both.
- **Totals row:** sum of debits, sum of credits.
- **Verification row:** `Balanced`, or `Imbalance: $X.XX` when debits ≠ credits.

## Report Layout (future)

Account hierarchy indented under account-type headers → groups → accounts, with subtotals per type
and a grand total. Columns: account code (if any), name, balance/debit, credit.

## Data Handling

- Text containing commas is quoted (spreadsheet standard).
- Empty values are left blank (no `N/A` placeholder).
- Dates use ISO format (`YYYY-MM-DD`).

## Future

PDF export, custom column selection, date-range filtering, multi-sheet workbooks, saved templates.

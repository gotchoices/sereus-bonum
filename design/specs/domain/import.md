# Import Contract

The shared rules for bringing external accounting data into Bonum — the formats accepted, how source
accounts map to Bonum's structure, and how duplicates are handled. Applies to every target; the
per-target import wizard UI lives in its screen spec (web: [import screen](../web/screens/import.md)).

## Purpose

Import accounting data from external sources — either complete books (creates a new entity) or
transaction files (adds to an existing entity).

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

## Account Mapping

### Books: Type Mapping

Source account types mapped to [Bonum groups](./account-groups.md):

| Source Type (GnuCash/QB) | Bonum Type | Account Group Examples |
|--------------------------|------------|------------------------|
| BANK, ASSET, CASH | Asset | Cash & Bank, Investments |
| STOCK, MUTUAL | Asset | Investments |
| CREDIT, LIABILITY, PAYABLE | Liability | Credit Cards, Loans |
| EQUITY | Equity | Owner's Equity, Retained Earnings |
| INCOME | Income | Wages, Sales |
| EXPENSE | Expense | Rent, Utilities, Groceries |
| ROOT | (skipped) | Top-level container |

---

## Idempotence & Duplicate Handling

### GnuCash Files (Books & Transactions)
- Match by GUID (stored in account/entry tables)
- Skip exact duplicates automatically
- No user interaction needed

### Transaction Files (CSV/QIF/OFX)
- **OFX:** Uses transaction ID (FITID) for exact matching
- **Others:** Fuzzy match (date + amount + account within $0.01)
- Suspected duplicates are surfaced for the user to review and confirm before import.

### Account Handling (Transactions Mode)
- Match by name or GUID
- Create missing accounts automatically
- Prompt the user to resolve ambiguous matches

---

## References

- Entry points, wizard UI & navigation: [web import screen](../web/screens/import.md)
- Account taxonomy: [account-groups.md](./account-groups.md)
- Implementation details: consolidations (generated)

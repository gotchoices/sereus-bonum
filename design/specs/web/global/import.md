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

There will be a module specific to each import type (gnucash, QB, etc) with all code specific to that format contained in the module.  The is also a generic import module with code common to all formats.  The generic module can contain no code specific to a particular file type.

---

## Account Mapping (brand specific)

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
- **User reviews:** Suspected duplicates shown with checkboxes

### Account Handling (Transactions Mode)
- Match by name or GUID
- Create missing accounts automatically
- Show mapping UI if ambiguous

---

## References

- Entry points & navigation: `screens/import.md`
- Implementation details: Consolidations (generated)

---

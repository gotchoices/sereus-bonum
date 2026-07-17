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
- **Target:** a new entity on first import, or an **existing** entity to merge in updates (re-import).
- **Sources:** GnuCash (XML/SQLite), QuickBooks IIF
- **Use Case:** Migrate from another program — or keep both programs running and sync periodically
  (import again as the external books change; only new activity is merged in).

### Import Transactions
- **Adds to:** Existing entity
- **Sources:** CSV, QIF, OFX, QFX (bank/credit card statements)
- **Use Case:** Regular data entry from bank downloads

Whatever the source or mode, import is a **merge** (see below): source accounts are resolved to Bonum
accounts, source transactions are classified against the target's current books, and only genuinely
new transactions are written.

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

## Merge Model & Idempotence

Import is a **merge**, not a bulk insert. The importer resolves each source account to a Bonum account,
then classifies each source transaction against the **target entity's current books** and writes only
the ones that are genuinely new. Re-importing the same source is therefore safe (idempotent) — which
is what lets a user keep an external program and Bonum in sync with periodic imports.

### Transaction disposition

Each source transaction is classified as one of:

- **Already imported (exists):** a matching transaction is already in the target's books — **skipped**.
  Matched by GnuCash GUID, OFX transaction id (FITID), or a fuzzy match (date + amount + account within
  $0.01) for other formats.
- **New:** no match, with enough information to create a balanced transaction — **created**.
- **Incomplete:** no match, but missing or ambiguous information (an unresolved offset account, a
  missing amount or date, or entries that don't sum to zero) — must be **completed** before it can be
  created.

Duplicates are **detected and surfaced** for review (auto-classified), not silently dropped; the user
can override a classification. The per-target preview UI lives in the screen spec.

### Merge contract

- Only **New** (and user-completed) transactions are written; **Already-imported** and user-**excluded**
  transactions are skipped.
- Accounts required by the resolved mapping that don't yet exist are created first.
- The whole merge is atomic — on failure nothing is written and the review is preserved for retry.
- Re-importing an unchanged source writes nothing.

### Identity persistence

Source identities are stored with the records Bonum creates, so later imports classify correctly:
- **Transaction identity** (GnuCash GUID / OFX FITID) stored with each created transaction.
- **Account identity** (source account GUID) stored with each created account — so a repeat import
  finds every source account already resolved and **skips the mapping step**.

### Account resolution

- Match source accounts by stored identity, then by name.
- Create missing accounts as needed (respecting the type mapping above).
- If a source account can't be resolved automatically, the mapping step collects the user's choice.

---

## References

- Entry points, wizard UI & navigation: [web import screen](../web/screens/import.md)
- Account taxonomy: [account-groups.md](./account-groups.md)
- Implementation details: consolidations (generated)

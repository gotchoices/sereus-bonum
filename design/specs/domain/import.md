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

### Books: Hierarchy Mapping

Source programs (GnuCash) keep one deep account tree; Bonum splits nesting into a globally-shared
**group catalog** and per-entity **account parent-child** links. An import maps the two apart:

- **General source levels** whose names match a Bonum catalog group (e.g. `Fixed Assets`,
  `Current Assets`, `Income`) map to that **shared group** and create no account — **but only if the node
  has no direct postings of its own.** A node that is posted to directly must become an account (a group
  can't hold a balance), even if its name matches a catalog group; its children then nest under it.
- **Specific source levels** below the nearest such group become **entity accounts**, preserving the
  source nesting via account `parentId`. Intermediate nodes are created even if they hold no
  transactions of their own.

Example: `Assets:Fixed Assets:Jeppson:AOF Loan` → group **Fixed Assets**, account **Jeppson** with child
account **AOF Loan**. This keeps per-entity names (`Jeppson`) out of the shared catalog. The group for
an account is the nearest self-or-ancestor whose name matches the catalog; if none matches, the
top-level type group (below) is used.

**Catalog name + own balance:** if a source node matches a catalog group name *and* is posted to (e.g.
`Vehicles` with its own balance plus sub-accounts `Acura`, `Eagle Cap`), it becomes a single **account**
in its parent group — its own balance shows on its `(direct)` row and the sub-accounts nest under it —
rather than splitting into a catalog group *plus* a same-named sibling account. This preserves the single
logical path (see [schema.md](./schema.md#hierarchy)).

### Books: Units & Multi-Unit Transactions

Source books carry their own commodities (currencies, stocks, funds). Import maps them onto Bonum
units and entry values per [units.md](./units.md):

- **Commodities → Units.** Each source commodity becomes a `Unit`. Currencies keep their bare code
  (`USD`); everything else is **namespaced by its source space** (`NYSE:VPER`, `FUND:VWLUX`) because
  tickers collide across markets. The source `fraction` becomes `displayDivisor` (securities are
  typically 10000), and the space determines `unitType`. Missing units are created before accounts.
- **Account commodity → `Account.unit`.** Not the entity's base unit — a stock account holds shares.
- **Entity base unit** is the source book's *currency* (never the first commodity encountered, which
  in an investment file is usually a stock).
- **Split quantity → `Entry.amount`, split value → `Entry.value`.** GnuCash stores both: quantity in
  the account's commodity, value in the transaction's currency. These map directly onto Bonum's
  amount/value pair. Both are exact rationals in the source and must be rescaled to the target unit's
  divisor **without rounding through a fixed denominator** — a share count at 1/10000 forced through
  1/100 is corrupted, not rounded.
- **Transaction currency → `Transaction.valueUnit`,** but only when the transaction actually spans
  units; a single-unit transaction leaves `valueUnit` and every `value` null, exactly as if entered
  by hand.
- **Price history → Exchange reference rates.** Source price databases (GnuCash keeps one) import as
  `source: MARKET` quotes, preserving the exact rational rate and its date.

Imported multi-unit transactions are **not** re-prompted for rates — the source already recorded the
values the user approved at the time.

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

## Native Books (dump / restore)

Separate from the external importers (GnuCash, CSV), Bonum can **dump one entity's full books to a
native JSON file and restore it** — a lossless round-trip of a single entity.

- **File shape:** `{ format: "bonum-books", version, entity, units, accounts, transactions }` — the
  entity metadata; the units and accounts it uses; and every transaction with its entries. Accounts
  carry a local `ref` so entries point at them by ref; account **groups** are referenced by their
  shared catalog id (the catalog is global).
- **Restore** creates a **fresh** entity from the file (new ids) and recreates its accounts and
  transactions. It is **import-only (not a merge)** and **non-interactive** — no account mapping,
  no preview. Missing units are created; the account-group catalog is assumed present.
- Use it to create and reload books quickly (e.g. test datasets at any scale). The merge/preview
  flow above is for external sources, not native restore.

## References

- Entry points, wizard UI & navigation: [web import screen](../web/screens/import.md)
- Account taxonomy: [account-groups.md](./account-groups.md)
- Implementation details: consolidations (generated)

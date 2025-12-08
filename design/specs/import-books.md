# Import Books Spec

Import complete accounting books from other programs, creating a new Entity with full chart of accounts and transaction history.

## Supported Formats

| Format | Extension | Source | Status |
|--------|-----------|--------|--------|
| GnuCash XML | `.gnucash` | GnuCash (uncompressed) | planned |
| GnuCash SQLite | `.gnucash` | GnuCash (SQLite mode) | planned |
| QuickBooks IIF | `.iif` | QuickBooks Desktop export | planned |

## Format Details

### GnuCash XML

GnuCash's native format is a gzip-compressed XML file (typically 10-30MB uncompressed for a personal book).

**Top-level structure:**
```xml
<gnc-v2>
  <gnc:book>
    <gnc:count-data cd:type="commodity">N</gnc:count-data>
    <gnc:count-data cd:type="account">N</gnc:count-data>
    <gnc:count-data cd:type="transaction">N</gnc:count-data>
    <gnc:commodity>...</gnc:commodity>
    <gnc:account>...</gnc:account>
    <gnc:transaction>...</gnc:transaction>
    <gnc:template-transactions>...</gnc:template-transactions>
  </gnc:book>
</gnc-v2>
```

**Commodity (Unit):**
```xml
<gnc:commodity version="2.0.0">
  <cmdty:space>CURRENCY</cmdty:space>    <!-- CURRENCY, NYSE, NASDAQ, AMEX, FUND, template -->
  <cmdty:id>USD</cmdty:id>               <!-- Currency code or ticker symbol -->
  <cmdty:name>US Dollar</cmdty:name>     <!-- Optional display name -->
  <cmdty:fraction>100</cmdty:fraction>   <!-- Smallest unit (100 = cents) -->
</gnc:commodity>
```

**Account:**
```xml
<gnc:account version="2.0.0">
  <act:name>Checking</act:name>
  <act:id type="guid">abc123...</act:id>
  <act:type>BANK</act:type>              <!-- See account types below -->
  <act:description>Main checking</act:description>
  <act:commodity>
    <cmdty:space>CURRENCY</cmdty:space>
    <cmdty:id>USD</cmdty:id>
  </act:commodity>
  <act:commodity-scu>100</act:commodity-scu>  <!-- Smallest currency unit -->
  <act:parent type="guid">parent-guid...</act:parent>
</gnc:account>
```

**Account Types:**
| GnuCash Type | Bonum Mapping | Notes |
|--------------|---------------|-------|
| ROOT | (skip) | Container only |
| ASSET | Asset | General assets |
| BANK | Asset | Bank accounts |
| STOCK | Asset | Stock holdings |
| MUTUAL | Asset | Mutual fund holdings |
| LIABILITY | Liability | General liabilities |
| CREDIT | Liability | Credit cards |
| PAYABLE | Liability | Accounts payable |
| EQUITY | Equity | Owner's equity |
| INCOME | Income | Revenue |
| EXPENSE | Expense | Costs |

**Transaction:**
```xml
<gnc:transaction version="2.0.0">
  <trn:id type="guid">txn-guid...</trn:id>
  <trn:currency>
    <cmdty:space>CURRENCY</cmdty:space>
    <cmdty:id>USD</cmdty:id>
  </trn:currency>
  <trn:date-posted><ts:date>2024-01-15 12:00:00 +0000</ts:date></trn:date-posted>
  <trn:date-entered><ts:date>2024-01-15 14:30:00 +0000</ts:date></trn:date-entered>
  <trn:description>Paycheck deposit</trn:description>
  <trn:num>1234</trn:num>                <!-- Optional: check number -->
  <trn:splits>
    <trn:split>...</trn:split>
  </trn:splits>
</gnc:transaction>
```

**Split (Entry):**
```xml
<trn:split>
  <split:id type="guid">split-guid...</split:id>
  <split:account type="guid">account-guid...</split:account>
  <split:value>150000/100</split:value>   <!-- Rational: 1500.00 -->
  <split:quantity>150000/100</split:quantity>
  <split:memo>Direct deposit</split:memo>
  <split:reconciled-state>y</split:reconciled-state>  <!-- n/c/y -->
  <split:reconcile-date><ts:date>2024-01-31...</ts:date></split:reconcile-date>
</trn:split>
```

**Key observations:**
- Values are stored as rational numbers (numerator/denominator) for precision
- All GUIDs are hex strings without dashes
- Accounts form a hierarchy via parent references
- Reconciliation state: `n` = unreconciled, `c` = cleared, `y` = reconciled
- Template transactions contain scheduled/recurring transaction templates

### GnuCash SQLite

GnuCash can also store data in SQLite format. Contains the same logical entities as XML but in relational tables:

| Table | Purpose |
|-------|---------|
| `accounts` | Account definitions |
| `commodities` | Currencies and securities |
| `transactions` | Transaction headers |
| `splits` | Transaction line items |
| `slots` | Key-value metadata |
| `prices` | Historical price quotes |
| `schedxactions` | Scheduled transactions |

Same data model as XML — parser can share entity types.

### QuickBooks IIF

Intuit Interchange Format is a tab-delimited text format that QuickBooks can export. It includes:
- Account list
- Transaction list
- Customer/vendor lists

Note: Native `.QBW` and `.QBB` files are proprietary and not supported.

<!-- TODO: Document IIF structure -->

## Import Workflow

1. User selects "Import books" from global menu
2. User provides entity name and drops/selects file
3. System parses file, displays account mapping preview
4. User can rename accounts and adjust account group assignments
5. User approves import
6. System creates Entity with accounts and transactions

## Account Mapping

Source accounts must be mapped to Bonum's account structure:
- Account type (Asset, Liability, Equity, Income, Expense)
- Account group (from Account Catalog)
- Account name (can be renamed)
- Parent account (for hierarchy)

## Error Handling

- Invalid or corrupted file: Show error, abort
- Unknown account types: Map to closest equivalent, flag for review
- Unbalanced transactions: Import to Imbalance account, flag for review
- Duplicate detection: Check for existing entity with same name

## Implementation

Parser test: `test/manual/gnucash-parser.ts`
- Run with: `cd test/manual && yarn gnucash ../../tmp/<file>.gnucash`
- Reports commodities, accounts, transactions, and any parse errors

Production library: `packages/import/` (planned)

## Notes

- Import creates a new Entity; does not merge into existing
- All transactions import with original dates
- Multi-currency accounts import with exchange rates if available
- Commodities (stocks, currencies) map to Bonum Units


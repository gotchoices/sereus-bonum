# Bonum Data Schema

This document defines the core data entities, their fields, and relationships.

---

## Entity Overview

```
┌─────────────────┐       ┌─────────────────┐
│     Entity      │       │   AccountType   │
│                 │       │   (enum)        │
└────────┬────────┘       └────────┬────────┘
         │                         │
         │ 1:N                     │ 1:N
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│    Account      │◄──────│  AccountGroup   │
└────────┬────────┘       └─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐       ┌─────────────────┐
│     Entry       │──────►│   Transaction   │
└────────┬────────┘       └────────┬────────┘
         │                         │
         │                         │ 1:N
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│ Reconciliation  │       │    Exchange     │
└─────────────────┘       └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│      Tag        │       │      Unit       │
└─────────────────┘       └─────────────────┘

┌─────────────────┐
│    Partner      │
└─────────────────┘
```

---

## AccountType (Enum)

The five fundamental account classifications from double-entry bookkeeping:

| Value | Normal Balance | Description |
|-------|----------------|-------------|
| `ASSET` | Debit | Resources owned |
| `LIABILITY` | Credit | Obligations owed |
| `EQUITY` | Credit | Owner's stake (Assets − Liabilities) |
| `INCOME` | Credit | Revenue earned |
| `EXPENSE` | Debit | Costs incurred |

*Note: An `IMBALANCE` pseudo-type (or null) is used for a system account that holds unclassified/partial entries. Each Entity should have an Imbalance account. Periods cannot be closed while this account has a balance.*

---

## Entity

A distinct financial entity for which separate books are kept. This could be a business, a personal household, a nonprofit, or any unit requiring its own set of books.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `name` | String | Yes | Display name |
| `description` | String | No | Extended description |
| `fiscalYearEnd` | MonthDay | No | e.g., "12-31" or "06-30" |
| `baseUnit` | Unit | Yes | Default unit for display (e.g., "USD") |
| `defaultCostingMethod` | Enum | No | FIFO, LIFO, or AVERAGE |
| `createdAt` | Timestamp | Yes | Creation timestamp |
| `updatedAt` | Timestamp | Yes | Last modification |

---

## AccountGroup

A classification grouping for accounts, shared across all business units.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `name` | String | Yes | e.g., "Current Assets", "Cost of Goods Sold" |
| `accountType` | AccountType | Yes | Which of the 5 types this group belongs to |
| `description` | String | No | Extended description |
| `displayOrder` | Integer | No | For sorting in reports |

**Examples:**
- Current Assets → ASSET
- Capital Assets → ASSET
- Jobs in Process → ASSET
- Inventory → ASSET
- Current Liabilities → LIABILITY
- Amortized Debt → LIABILITY
- Member Capital → EQUITY
- Sales → INCOME
- Cost of Goods Sold → EXPENSE
- Overhead → EXPENSE
- Tax → EXPENSE
- Interest → EXPENSE

**Constraint:** Transactions cannot be posted directly to an AccountGroup; they must target a specific Account.

---

## Account

A specific ledger account within an entity.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `entityId` | UUID | Yes | FK → Entity |
| `accountGroupId` | UUID | Yes | FK → AccountGroup (determines account type) |
| `parentId` | UUID | No | FK → Account (for hierarchy within entity) |
| `code` | String | No | Account number or alpha code (unique within entity) |
| `name` | String | Yes | Account title |
| `description` | String | No | Extended description |
| `unit` | Unit | Yes | Unit of measure for this account (e.g., "USD", "widget") |
| `costingMethod` | Enum | No | Override: FIFO, LIFO, AVERAGE |
| `closedDate` | Date | No | No new/modified entries on or before this date |
| `partnerId` | UUID | No | FK → Partner (for AR/AP accounts) |
| `linkedAccountId` | UUID | No | FK → Account in another Entity (for inter-entity tracking) |
| `isActive` | Boolean | Yes | Whether account accepts new entries |
| `createdAt` | Timestamp | Yes | Creation timestamp |
| `updatedAt` | Timestamp | Yes | Last modification |

**Hierarchy:**
- `parentId` enables nesting accounts (e.g., "Bank of America" → "BofA Checking", "BofA Savings")
- Parent must be in same Entity and same AccountGroup
- Entries can be posted to any level (unlike AccountGroup)
- Roll-up balances use Exchange rates for mixed-unit children

**Per-entity categorization:** Users who want custom account groupings within an entity (beyond the global AccountGroups) can use parent accounts for this purpose. For example, create "Current Assets" and "Fixed Assets" as parent accounts under the global "Assets" group, then nest specific accounts beneath them.

**Inter-Entity Linking:**
- `linkedAccountId` connects counterpart accounts across entities (e.g., "Due to Entity B" ↔ "Due from Entity A")
- Advisory only — helps track but doesn't enforce balance
- Consolidation reports can flag mismatches

**Derived:** `accountType` is derived from the linked AccountGroup.

**Numbering Convention (encouraged, not enforced):**
- Assets: 1xxx
- Liabilities: 2xxx
- Equity: 3xxx
- Income: 4xxx
- Expense: 5xxx

---

## Transaction

A complete accounting transaction consisting of multiple balanced entries.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `entityId` | UUID | Yes | FK → Entity |
| `date` | Date | Yes | Transaction date |
| `memo` | String | No | Description of transaction |
| `reference` | String | No | Check number, invoice number, etc. |
| `createdAt` | Timestamp | Yes | Creation timestamp |
| `updatedAt` | Timestamp | Yes | Last modification |

**Constraint:** The sum of all Entry amounts (debits positive, credits negative) for a Transaction must equal zero.

---

## Entry

A single debit or credit line within a transaction.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `transactionId` | UUID | Yes | FK → Transaction |
| `accountId` | UUID | Yes | FK → Account |
| `amount` | Integer | Yes | In smallest unit. Positive = debit, negative = credit. |
| `note` | String | No | Line-specific detail |
| `tagId` | UUID | No | FK → Tag |
| `reconciliationId` | UUID | No | FK → Reconciliation (if reconciled) |

**Conventions:**
- Positive = debit, negative = credit. UI may present as separate columns.
- Amount is in smallest indivisible unit (e.g., cents for USD). Use `Unit.decimalPlaces` for display.

---

## Tag

An orthogonal classification for entries, independent of account structure.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `name` | String | Yes | e.g., "Travel", "Utilities", "Phone" |
| `description` | String | No | Extended description |
| `parentId` | UUID | No | FK → Tag (for hierarchy) |

**Examples:** Travel, Fuel, Lodging, Materials, Utilities, Phone

**Rationale:** Tags provide classification orthogonal to accounts. A tag like "Travel" can apply to:
- Expense accounts (direct business expenses)
- Jobs in Process (costs allocated to projects)
- Capital Equipment (travel to acquire equipment)

---

## Reconciliation

A record of an external statement used to verify account balances.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `accountId` | UUID | Yes | FK → Account |
| `statementDate` | Date | Yes | e.g., "2024-02-28" |
| `endingBalance` | Integer | Yes | Balance per external statement (in smallest unit) |
| `reconciledAt` | Timestamp | No | When reconciliation was completed |
| `notes` | String | No | Any discrepancies or comments |

**Usage:** Individual Entry records link to a Reconciliation once verified.

---

## Partner

A vendor, customer, or other external party. Partners are global and can link to multiple accounts across entities.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `name` | String | Yes | Display name |
| `type` | PartnerType | No | VENDOR, CUSTOMER, BOTH (advisory only) |
| `email` | String | No | Contact email |
| `phone` | String | No | Contact phone |
| `address` | String | No | Mailing address |
| `notes` | String | No | Extended notes |
| `isActive` | Boolean | Yes | Whether partner is active |
| `createdAt` | Timestamp | Yes | Creation timestamp |
| `updatedAt` | Timestamp | Yes | Last modification |

**Note:** A partner can link to multiple accounts (AR, AP, across entities). The `type` field is advisory — the actual relationship is defined by which accounts link to the partner.

---

## Unit

A unit of measure for account balances. Can represent currencies, inventory items, securities, etc.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | String | Yes | Primary key. e.g., "USD", "EUR", "widget" |
| `name` | String | Yes | Display name (e.g., "US Dollar", "Widget") |
| `symbol` | String | No | Display symbol (e.g., "$", "€") |
| `unitType` | Enum | Yes | FIAT, CRYPTO, COMMODITY, SECURITY, INVENTORY, OTHER |
| `displayDivisor` | Integer | Yes | Divide stored amount by this for display |

**Note:** All amounts are stored as integers in the smallest unit. Divide by `displayDivisor` for display. Examples: USD uses 100 (cents → dollars), labor-minutes uses 60 (minutes → hours).

See [Units-and-Exchange.md](Units-and-Exchange.md) for the full model.

---

## Exchange

A record of the exchange rate between two units, either linked to a transaction (cost basis) or standalone (reference rate).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `transactionId` | UUID | No | FK → Transaction. Null for reference rates. |
| `date` | Date | Yes | When this rate applies |
| `unitA` | String | Yes | FK → Unit |
| `unitB` | String | Yes | FK → Unit |
| `rateNumerator` | Integer | Yes | 1 unitA = (num/denom) unitB |
| `rateDenominator` | Integer | Yes | |
| `source` | Enum | Yes | TRANSACTION, MARKET, or MANUAL |
| `notes` | String | No | Explanation of rate source |

**Interpretation:** `1 unitA = (rateNumerator / rateDenominator) unitB`

See [Units-and-Exchange.md](Units-and-Exchange.md) for balancing algorithm and usage.

---

## Open Questions

See [STATUS.md](STATUS.md) for unresolved schema decisions.


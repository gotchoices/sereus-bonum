# Units and Exchange Model

This document defines how Bonum handles multiple units of measure — currencies, inventory, securities, and alternative currencies like CHIPs.

---

## Core Insight

**Currencies are just units. A balance sheet is an inventory of units, valued at render time.**

| Concept | Traditional View | Generalized View |
|---------|------------------|------------------|
| What an account holds | A currency | A unit (any measurable thing) |
| What an entry records | Amount in currency | Quantity of units |
| Exchange rate | Baked into transaction | Derived from transaction, applied at render |
| Balance sheet | Fixed to one currency | Renderable in any unit |

---

## Design Principle: No Overhead for Single-Unit Users

If an Entity operates entirely in one unit (e.g., USD), the Exchange table simply never gets populated. Transactions balance the traditional way: sum of entries = 0.

The generalized model adds no complexity unless you need it. Foreign currencies, inventory, or alternative units like CHIPs only require exchange rates when they're introduced.

---

## Unit Types

A `Unit` can represent:

| Category | Examples |
|----------|----------|
| Fiat currency | USD, EUR, GBP, JPY |
| Alternative currency | CHIP (MyChips), local currencies |
| Cryptocurrency | BTC, ETH |
| Commodity | oz-gold, barrel-oil |
| Security | shares-AAPL, shares-VTSAX |
| Inventory item | widget, bag-of-parts, labor-hour |

All are treated uniformly in the schema. The distinction is in how rates are obtained:
- Market-quoted units: rates from external feeds
- Inventory/internal units: rates from transaction history (cost basis)

---

## The Inventory Parallel

**Purchasing inventory:**
```
Transaction: "Buy parts from supplier"
  Entry: { account: "Checking",         amount: -500, unit: USD }
  Entry: { account: "Parts Inventory",  amount: +10,  unit: widget }
  
Exchange: { unitA: "USD", unitB: "widget", rateNum: 1, rateDenom: 50 }
          // 1 USD = 1/50 widget, i.e., 1 widget = 50 USD
```

**Purchasing foreign currency:**
```
Transaction: "Exchange at bank"
  Entry: { account: "USD Cash",  amount: -1000, unit: USD }
  Entry: { account: "EUR Cash",  amount: +850,  unit: EUR }
  
Exchange: { unitA: "USD", unitB: "EUR", rateNum: 85, rateDenom: 100 }
          // 1 USD = 0.85 EUR
```

**These are structurally identical.** Both establish a "price" for something in terms of something else.

---

## Transaction Balancing

### Principle

Every transaction with entries in different units **implicitly establishes exchange rates** between those units. The Exchange record captures the rate the user approved.

### Definition

A transaction is **balanced** when all entry amounts, converted to any single unit via the attached Exchange records, sum to zero.

### Mathematical Property

If a transaction balances in one unit, it balances in all units. Converting all entries to a different unit multiplies the entire sum by a constant (the exchange rate). Zero times any non-zero constant is still zero.

### Algorithm

1. **Group entries by unit**, sum each group
2. **If all entries are same unit:** Check sum = 0 (no Exchange needed)
3. **If multiple units:** Build a conversion graph from attached Exchange records
4. **Verify connectivity:** All units must be reachable from each other
5. **Pick any unit as base**, convert all sums to that unit using the graph
6. **Check if total = 0**

### Example

```
Transaction: "Job supplies plus lunch"
  Entry: { account: "Checking",        amount: -250, unit: USD }
  Entry: { account: "Meals Expense",   amount: +50,  unit: USD }
  Entry: { account: "Parts Inventory", amount: +10,  unit: widget }

Exchange: { unitA: "USD", unitB: "widget", rateNum: 1, rateDenom: 20 }
          // 1 USD = 1/20 widget, i.e., 1 widget = 20 USD

Step 1: Group by unit
  USD: -250 + 50 = -200
  widget: +10

Step 2: Multiple units → use Exchange graph

Step 3: Convert to USD
  USD sum: -200
  widget sum in USD: 10 × 20 = +200
  Total: 0 ✓
```

### Edge Cases

| Case | Handling |
|------|----------|
| **Only one unit** | Traditional sum = 0; no Exchange needed |
| **Two units** | One Exchange required between them |
| **Three+ units** | Exchanges must form a connected graph |
| **Missing exchange** | Transaction invalid — cannot verify balance |
| **Disconnected units** | Transaction invalid — some units unreachable |

---

## The Risk: Hidden Errors

### The Problem

If we auto-calculate exchange rates from transaction entries, a missing entry distorts the rate rather than causing an error.

**Intended transaction:**
```
Buy €850 for $1000, plus $30 wire fee

  Entry: { account: "USD Checking",  amount: -1030, unit: USD }
  Entry: { account: "EUR Cash",      amount: +850,  unit: EUR }
  Entry: { account: "Bank Fees",     amount: +30,   unit: USD }  // OOPS - user forgot this
```

**What user actually entered:**
```
  Entry: { account: "USD Checking",  amount: -1030, unit: USD }
  Entry: { account: "EUR Cash",      amount: +850,  unit: EUR }
```

**Result:** System calculates rate of $1.212/EUR instead of $1.176/EUR. The $30 error is hidden in a distorted rate.

### Resolution

This is a **UI/UX problem**, not a schema problem. The schema stores the explicit Exchange record with the rate the user approved. The UI should:

1. Calculate the implied rate from entries
2. Show it prominently to the user
3. Require acknowledgment before saving
4. Warn if rate differs significantly from market/historical norms

---

## Two Types of Exchange Records

| Type | transactionId | Purpose |
|------|---------------|---------|
| **Transaction-linked** | Set | Cost basis for that specific transaction. Authoritative. |
| **Reference rate** | Null | Market or manual rate for rendering reports. Not tied to a transaction. |

**Example: Reference Rate**

You hold 500 CHIPs from a transaction months ago. You want to render your balance sheet in USD, but you have no recent CHIP transactions. You look up a current CHIP/USD rate and log it:

```
Exchange: {
  transactionId: null,
  date: "2024-03-15",
  unitA: "CHIP",
  unitB: "USD",
  rateNum: 5,
  rateDenom: 4,      // 1 CHIP = 1.25 USD
  source: MARKET,
  notes: "From mychips.org daily rate"
}
```

Now the system can convert CHIP balances to USD for display.

---

## Rendering a Balance Sheet

To display a balance sheet in a chosen `displayUnit`:

1. For each account, get the balance (sum of entries) in the account's native unit
2. Find the most recent Exchange involving that unit and the displayUnit
3. Convert: `displayAmount = balance × (rateNum / rateDenom)`
4. Sum by AccountGroup and AccountType

### Rate Selection for Rendering

When converting an account balance to the display unit:

1. **Look for the most recent Exchange** between the account's unit and the display unit (or a transitive path)
2. **Prefer transaction-linked rates** if rendering historical reports (cost basis)
3. **Use reference rates** for current balance sheets (market value)

### Transitive Conversion

If no direct exchange exists between a unit and the displayUnit, traverse the graph:

```
widget → USD → CHIP

Exchange: { unitA: "widget", unitB: "USD", rateNum: 20, rateDenom: 1 }  // 1 widget = 20 USD
Exchange: { unitA: "USD", unitB: "CHIP", rateNum: 4, rateDenom: 5 }     // 1 USD = 0.8 CHIP

Combined: 1 widget = 20 × 0.8 = 16 CHIP
```

### Missing Rates

If an account's unit has no path to the display unit:
- Warn the user
- Exclude from totals, or
- Show in native units with a note

---

## Cost Basis and Costing Policy

### How It Works

1. **Debits (acquiring units):** Exchange record captures cost basis — unambiguous
2. **Credits (disposing units):** UI calculates suggested rate based on policy
3. **User confirms:** The Exchange record captures the actual rate used
4. **Audit trail:** Auditor can replay transactions and verify policy compliance

### Policy Storage

```
Entity: { defaultCostingMethod: FIFO | LIFO | AVERAGE }
Account: { costingMethod: ... }  // Optional override
```

### Policies

- **FIFO** (first in, first out) — most common for inventory
- **LIFO** (last in, first out) — sometimes used for tax purposes
- **Average cost** — simpler, common for fungible goods
- **Specific identification** — for securities, user documents in notes field

### What We're NOT Doing

- Explicit Lot entity (too complex, implies rigid bundle sizes)
- Blocking policy overrides (user can deviate, auditor can flag)
- Forcing bundles to match acquisition sizes (inventory doesn't work that way)

The notes field on Exchange handles special cases and auditor explanations.

---

## Schema Definitions

### Unit

```
Unit: {
  code: String           // Primary key. e.g., "USD", "EUR", "widget"
  name: String           // Display name
  symbol: String         // Optional display symbol
  unitType: Enum         // FIAT, CRYPTO, COMMODITY, SECURITY, INVENTORY, OTHER
  displayDivisor: Int    // Divide stored amount by this for display
}
```

**Integer Storage:** All amounts are stored as integers in the smallest indivisible unit. Divide by `displayDivisor` for display.

| Unit | displayDivisor | Stored | Displayed |
|------|----------------|--------|-----------|
| USD | 100 | 1050 | $10.50 |
| BTC | 100000000 | 100000000 | 1.00000000 |
| JPY | 1 | 500 | ¥500 |
| widget | 1 | 10 | 10 widgets |
| labor-minute | 60 | 150 | 2.5 hours |
| egg | 12 | 36 | 3 dozen |

### Exchange

```
Exchange: {
  id: UUID
  transactionId: UUID       // FK → Transaction (OPTIONAL — null for reference rates)
  date: Date                // When this rate applies
  unitA: String             // FK → Unit
  unitB: String             // FK → Unit
  rateNumerator: Integer    // 1 unitA = (rateNumerator / rateDenominator) unitB
  rateDenominator: Integer
  source: Enum              // TRANSACTION, MARKET, MANUAL
  notes: String             // Optional: explanation of rate source
}
```

**Interpretation:** `1 unitA = (rateNumerator / rateDenominator) unitB`

**Example:** 100 USD buys 3 widgets
- unitA: "USD", unitB: "widget"
- rateNumerator: 3, rateDenominator: 100
- Meaning: 1 USD = 0.03 widgets (or equivalently, 1 widget = 33.33 USD)

### Changes to Other Entities

**Account:**
```
Account: {
  ...
  unit: String              // FK → Unit (replaces "currency")
  costingMethod: Enum       // Optional override: FIFO, LIFO, AVERAGE
  ...
}
```

**Entity (renamed from BusinessUnit):**
```
Entity: {
  ...
  baseUnit: String          // FK → Unit. Default display unit (e.g., "USD")
  defaultCostingMethod: Enum // FIFO, LIFO, AVERAGE
  ...
}
```

---

## Resolved Design Questions

### U1: Partial unit matching

The Exchange records just need to form a connected graph between all units in the transaction. The system groups entries by unit, then uses the graph to convert everything to a common base for validation. The user doesn't pair specific entries; the math handles it.

### U2: Exchange directionality

Store `unitA`, `unitB`, and rate where rate means "1 unitA = (rateNum/rateDenom) unitB". The inverse is trivially computed. No need to store both directions.

### U3: Cost basis and lot tracking

No explicit Lot entity. Policy-based calculation at credit time. The Exchange record captures the actual rate used, and auditors can replay transactions to verify policy compliance.

### U4: Base unit per Entity

Entity has a `baseUnit` for default display. Reports can override to render in any unit.

### U5: Non-exchange multi-unit transactions

Treat as one transaction with imputed exchanges. Example: receiving a gift of cash and stock. The gift has a fair market value, which establishes the "rate" even though no actual exchange occurred. Use `source: MARKET` or `source: MANUAL`.

---

## See Also

- [Schema.md](Schema.md) — Core entity definitions
- [STATUS.md](STATUS.md) — Open questions tracker

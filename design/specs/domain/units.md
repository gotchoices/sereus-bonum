# Units & Exchange — Rules

The concrete rules for handling multiple units of measure (currencies, inventory, securities,
alternative currencies) and the exchange rates between them. Applies to every target.

Field-level definitions for `Unit` and `Exchange` live in [schema.md](./schema.md); the *why* behind
the generalized-unit model is in [docs/Units-and-Exchange.md](../../../docs/Units-and-Exchange.md).
This file is the tactics: how amounts are stored, how transactions balance across units, and how
balances render in a chosen unit.

## Amounts & Display

All amounts are stored as integers in the smallest indivisible unit, and divided by the unit's
`displayDivisor` for display. This avoids floating-point drift.

| Unit | displayDivisor | Stored | Displayed |
|------|----------------|--------|-----------|
| USD | 100 | 1050 | $10.50 |
| BTC | 100000000 | 100000000 | 1.00000000 |
| JPY | 1 | 500 | ¥500 |
| widget | 1 | 10 | 10 widgets |
| labor-minute | 60 | 150 | 2.5 hours |
| egg | 12 | 36 | 3 dozen |

## Transaction Balancing

**A transaction is balanced when all entry amounts, converted to any single unit via the transaction's
attached Exchange records, sum to zero.** If it balances in one unit it balances in all — converting
every entry to another unit multiplies the whole sum by a constant, and zero stays zero.

**Single-unit transactions** need no Exchange record: the entries simply sum to zero the traditional
way. The Exchange table stays empty until a multi-unit transaction is entered — no overhead for
single-currency users.

**Algorithm:**
1. Group entries by unit; sum each group.
2. If all entries share one unit → check sum = 0 (no Exchange needed).
3. If multiple units → build a conversion graph from the attached Exchange records.
4. Verify connectivity: every unit must be reachable from every other.
5. Pick any unit as base; convert all group sums to it via the graph.
6. Check the total = 0.

**Example** — "Job supplies plus lunch": entries of −250 USD, +50 USD, +10 widget, with an Exchange
of 1 widget = 20 USD. USD group sums to −200; widget group is +10 → +200 USD; total 0. ✓

| Case | Handling |
|------|----------|
| Only one unit | Traditional sum = 0; no Exchange needed |
| Two units | One Exchange required between them |
| Three+ units | Exchanges must form a connected graph |
| Missing exchange | Transaction invalid — cannot verify balance |
| Disconnected units | Transaction invalid — some units unreachable |

**Guard against hidden errors:** when entries imply an exchange rate, the UI must calculate that
implied rate, show it prominently, require acknowledgment before saving, and warn if it deviates
significantly from market/historical norms. Otherwise a forgotten entry (e.g. a wire fee) silently
distorts the rate instead of surfacing as an imbalance. The stored Exchange record always holds the
rate the user approved.

## Two Kinds of Exchange Record

| Type | `transactionId` | Purpose |
|------|-----------------|---------|
| Transaction-linked | Set | Cost basis for that specific transaction. Authoritative. |
| Reference rate | Null | Market or manual rate used only for rendering reports. |

A reference rate lets a balance render in a unit for which there's no recent transaction (e.g. hold
CHIPs, log a current CHIP/USD market rate to show the balance in USD).

## Rendering a Balance in a Chosen Unit

To display balances in a chosen `displayUnit`:
1. For each account, take its balance (sum of entries) in the account's native unit.
2. Find the most recent Exchange between that unit and the display unit (or a transitive path).
3. Convert: `displayAmount = balance × (rateNumerator / rateDenominator)`.
4. Sum by AccountGroup and AccountType.

**Rate selection:** prefer transaction-linked rates for historical reports (cost basis); use
reference rates for current balance sheets (market value); always prefer the most recent applicable
rate.

**Transitive conversion:** if no direct rate exists, traverse the graph — e.g. `widget → USD → CHIP`
combines 1 widget = 20 USD and 1 USD = 0.8 CHIP into 1 widget = 16 CHIP.

**Missing rates:** if an account's unit has no path to the display unit, warn the user and either
exclude it from totals or show it in native units with a note — never silently drop it.

## Cost Basis & Costing Policy

- **Acquiring units (debits):** the Exchange record captures cost basis directly — unambiguous.
- **Disposing units (credits):** the UI suggests a rate from the account's/entity's costing policy;
  the user confirms; the Exchange record stores the actual rate used.
- **Policy:** `Entity.defaultCostingMethod` with optional `Account.costingMethod` override —
  FIFO, LIFO, or AVERAGE. Specific-identification (e.g. securities) is documented in the Exchange
  `notes` field.
- Policy overrides are **not** blocked — a user may deviate and an auditor can flag it by replaying
  the transactions. There is no explicit Lot entity and no requirement that dispositions match
  acquisition sizes.

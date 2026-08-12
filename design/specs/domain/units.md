# Units & Exchange — Rules

The concrete rules for handling multiple units of measure (currencies, inventory, securities,
alternative currencies) and the exchange rates between them. Applies to every target.

Field-level definitions for `Unit` and `Exchange` live in [schema.md](./schema.md); the *why* behind
the generalized-unit model is in [docs/Units-and-Exchange.md](../../../docs/Units-and-Exchange.md).
This file is the tactics: how amounts are stored, how transactions balance across units, and how
balances render in a chosen unit.

## Naming Units

`Unit.code` is the primary key, so it must be globally unambiguous. Bare codes are reserved for
currencies (`USD`, `EUR`, `CHIP`); everything else is **namespaced** with its issuing market or
domain:

| Kind | Code | Symbol |
|------|------|--------|
| Currency | `USD` | `$` |
| Security | `NYSE:VPER` | `VPER` |
| Security (same ticker, other market) | `NASDAQ:VPER` | `VPER` |
| Fund | `FUND:VWLUX` | `VWLUX` |
| Inventory | `INV:widget` | `widget` |

This is not cosmetic: real books contain the same ticker on two exchanges (`VPER` trades on both
NYSE and NASDAQ in Kyle's investment books). `symbol` carries the short form for display; `code` keeps
them distinct.

## Amounts & Display

All amounts are stored as integers in the smallest indivisible unit, and divided by the unit's
`displayDivisor` for display. This avoids floating-point drift.

| Unit | displayDivisor | Stored | Displayed |
|------|----------------|--------|-----------|
| USD | 100 | 1050 | $10.50 |
| BTC | 100000000 | 100000000 | 1.00000000 |
| JPY | 1 | 500 | ¥500 |
| NYSE:VPER | 10000 | 1752110000 | 175,211 shares |
| INV:widget | 1 | 10 | 10 widgets |
| labor-minute | 60 | 150 | 2.5 hours |
| egg | 12 | 36 | 3 dozen |

Securities routinely need fractional shares, so their divisor is large (10000 is the usual source
convention). A unit's divisor is fixed once chosen — changing it would reinterpret every stored
amount.

---

## Value and the Reckoning Unit

An entry records **how much of the account's own unit moved** — 100 shares, $290, 5 CHIPs. That is
the fact. But a transaction only *balances* if its entries can be compared, and quantities in
different units can't be compared directly.

So each transaction nominates a **reckoning unit**: the unit in which that transaction's values are
expressed. Every entry then carries a `value` — the same entry restated in the reckoning unit — and:

> **A transaction is balanced when the values of its entries sum to zero.**

That is the whole rule. There is no rate graph to build, no connectivity to verify.

**The reckoning unit is not a currency.** It is any unit the transaction touches. Traditional systems
force it to be a national currency (GnuCash calls it the transaction's *currency* and will not let
you pick a stock); Bonum does not. A barter is reckoned in whatever the parties actually reckoned in:

```
Acquire stock A, paying in stock B, with a fee in CHIPs
Reckoning unit: NYSE:B

  Assets:Stock A     +100 sh A        value  +249.9 B
  Assets:Stock B     −250 sh B        value  −250.0 B
  Expenses:Fees        +5 CHIP        value    +0.1 B
                                      ─────────────────
                                                 0.0 B  ✓
```

Nothing here is denominated in dollars, and nothing needs to be. The dollar figure for this
acquisition is an *estimate*, produced later at report time (see Rendering) — never a recorded fact.

**Why any unit works.** Value is defined only up to a scale factor: multiply every entry's value by a
constant and the sum is still zero. Choosing a reckoning unit just fixes that scale. Nominating stock
B instead of dollars is a change of gauge, not a change of meaning. This is what lets Bonum record
books that never touch a national currency.

### Choosing the reckoning unit

The transaction is stored with whichever unit was nominated; the UI proposes one, the user can
change it.

1. The entity's `baseUnit`, if the transaction touches it. (Covers nearly every ordinary transaction.)
2. Otherwise the unit with the finest `displayDivisor` among the legs — rounding happens in the
   reckoning unit's smallest increment, so the finest-grained leg loses the least.
3. Ties break toward the largest-magnitude leg.

### Storage rules — no overhead for single-unit books

| Situation | `txn.valueUnit` | `entry.value` |
|-----------|-----------------|---------------|
| Every entry's account shares one unit | **null** | **null** — balance is simply Σ amount = 0 |
| Multiple units | set | null where the account's unit *is* the reckoning unit (value = amount); set otherwise |

A purely USD entity never populates either column. The multi-unit machinery costs nothing until a
transaction actually spans units.

### Rates are per entry, not per transaction

Because value is recorded on each entry, the implied rate (`value ÷ amount`) is also per entry. This
matters in real books: a single sale often fills at several prices.

```
"Sell VPER 324789 @ 0.0132-0.0135"   reckoning unit: USD

  Assets:Schwab              +4200.19 USD              (value = amount)
  Income:Broker Credit         +30.01 USD              (value = amount)
  Assets:Stock VPER      −12800.0000 sh   value  −172.80   → $0.01350/sh
  Assets:Stock VPER       −7700.0000 sh   value  −101.64   → $0.01320/sh
  Assets:Stock VPER     −304289.0000 sh   value −3955.76   → $0.01300/sh
                                          ─────────────
                                                  0.00  ✓
```

Three different VPER/USD rates in one transaction. A single rate attached to the transaction cannot
express this; per-entry value expresses it without special-casing. 42 transactions in Kyle's
investment books are of this shape.

### Validation

1. If `valueUnit` is null → every entry's account must share one unit, and Σ amount = 0.
2. Otherwise → Σ value = 0, taking `value = amount` where an entry's account unit is the reckoning
   unit.
3. Every unit in the transaction must be reachable — i.e. every entry in a non-reckoning unit must
   carry an explicit `value`. A missing value is an incomplete transaction, not a zero.

**Guard against hidden errors:** when the user enters a quantity and a total (or a quantity and a
price), the UI must show the resulting **implied rate** prominently and require acknowledgment before
saving, warning when it deviates sharply from recent reference rates. Otherwise a forgotten leg — a
wire fee, a commission — silently distorts the rate instead of surfacing as an imbalance. Buying €850
for $1000 while forgetting a $30 fee yields an implied $1.212/EUR instead of $1.176/EUR, hiding the
$30 in plain sight.

---

## Cost Basis

An entry's cost basis is the triple **(value, reckoning unit, transaction date)** — inherited from
its transaction. It is stored, not derived, and it is a fact: *100 shares of A cost 249.9 units of
B on this date.* No currency is implied.

Expressing that basis in dollars is a separate, later, estimating step that consults reference rates
for B→USD around that date. Reports must present it as an estimate.

- **Acquiring units (debits):** the entry's value *is* the cost basis — unambiguous.
- **Disposing units (credits):** the UI suggests a value from the account's/entity's costing policy;
  the user confirms; the entry stores the value actually used.
- **Policy:** `Entity.defaultCostingMethod` with optional `Account.costingMethod` override — FIFO,
  LIFO, or AVERAGE. Specific-identification (e.g. securities) is documented in the entry `note`.
- Policy overrides are **not** blocked — a user may deviate and an auditor can flag it by replaying
  the transactions. There is no explicit Lot entity and no requirement that dispositions match
  acquisition sizes.

---

## Reference Rates (the Exchange table)

Transaction rates live on entries, so the `Exchange` table serves exactly one purpose: **observed
rates between units, for valuing holdings at report time.** Every row is a standalone quote —
`transactionId` is always null.

| Field | Meaning |
|-------|---------|
| `unitA`, `unitB` | the pair |
| `rateNumerator` / `rateDenominator` | 1 unitA = (num/denom) unitB, exact rational |
| `date` | when the rate was observed |
| `source` | MARKET (a feed) or MANUAL (user-asserted) |

Rates are stored as exact rationals, never decimals — a share price of 0.0132 and a divisor of 10000
must survive round-tripping.

A reference rate lets a balance render in a unit for which there's no recent transaction: hold CHIPs,
log a CHIP/USD quote, see the balance in dollars. Imported price histories (GnuCash keeps one — 279
quotes in the investment books) land here.

---

## Rendering Reports in a Chosen Unit

A report picks a **display unit**. The entity's `baseUnit` is the default; the user may choose any
unit, and no set of books is bound to one. The report is *as of* a date, and conversions use rates
**as of that date**, not today's — a balance sheet for last December values holdings at December
rates.

### Facts first, estimates second

Every amount whose native unit differs from the display unit shows **both**: the native quantity is
the fact, the converted figure is an estimate.

```
Assets : Investments
  Apple Computer          1,240.0000 sh      ≈    229,400   USD
  Prospect Capital       15,000.0000 sh      ≈     72,150   USD
  Cash — Schwab                                   102,500   USD
```

Estimates must be visually marked (the `≈` above, or equivalent) and the rate's date and source must
be inspectable. Never present an estimate as though it were recorded.

### Conversion procedure

1. Take each account's balance in its native unit (Σ entry amounts).
2. If native = display unit, done — it's a fact.
3. Otherwise find a rate native → display as of the report date: the most recent reference rate at or
   before that date, or a transitive path through other units (`INV:widget → USD → CHIP` combines
   1 widget = 20 USD and 1 USD = 0.8 CHIP into 1 widget = 16 CHIP).
4. Convert with exact rational arithmetic; round once, at display.
5. Roll up into groups and types.

**Missing rates:** if an account's unit has no path to the display unit as of the report date, show
the native balance, flag it, and exclude it from the converted totals with a visible note — never
silently drop it and never silently treat it as zero.

### Unrecognized Gain/Loss

Converted balances do not balance. Assets are revalued at report-date rates while the equity that
funded them was recorded at historical cost, so the two sides differ by the amount holdings have
moved since acquisition.

Bonum closes that gap with a derived equity line, **Unrecognized Gain/Loss**:

```
Balance Sheet — display unit USD, as of 2026-08-11

  Assets                                    412,900
    Investments (est. at 2026-08-11 rates)  310,400
    Cash                                    102,500
  Liabilities                              ( 40,000)
  Equity
    Owner's Equity                          280,300
    Retained Earnings                        41,300
    Unrecognized Gain/Loss  (derived)        51,300
                                           ────────
                                            412,900  ✓
```

Rules:

- It is **computed at render time, never posted.** No transaction is written, nothing enters the
  ledger, and it recomputes whenever the report date or display unit changes.
- It is the plug that makes the converted statement balance, and it is labelled as derived and as an
  estimate — because it is.
- It is **zero** when every account's native unit is the display unit. Single-unit books never see
  this line.
- A user who wants a valuation locked into the books posts an ordinary revaluation transaction
  instead; the derived line then measures only the movement since that posting.

This mirrors the cumulative translation adjustment of conventional consolidated reporting, generalized
to arbitrary units.

### Two valuations, distinguished

| View | Basis | Rates consulted? | Balances exactly? |
|------|-------|------------------|-------------------|
| **Cost** (default) | Σ entry values — what was actually paid | **None** | Yes — no derived line |
| **Market** | native quantity × report-date rate | Yes | Only with Unrecognized Gain/Loss |

**Cost is the default, because it is a fact.** Every entry already carries its value in the
transaction's reckoning unit, so when the entity's transactions all reckon in the display unit the
whole statement is exact: no rate is consulted, nothing is marked as an estimate, no holding is
unvaluable, and the Unrecognized Gain/Loss line is absent. A set of books imported from a
conventional program is exactly this case — every transaction was denominated in a currency at the
time it was written.

Cost even values holdings that Market cannot: a security with no quote in the price history still has
a known acquisition cost.

Where an entity's transactions *don't* all reckon in the display unit, each transaction's values must
themselves be converted at its own date's rate, and cost figures become estimates too — flagged the
same way. Reports must say which valuation produced the numbers.

---

## Entry UX in a Multi-Unit Account

In an account ledger the **default entry unit is the account's own unit** — a stock account asks for
shares, not dollars. Each split row exposes three fields, of which the user fills any two and Bonum
computes the third:

```
  Account            Quantity        Price        Value
  Stock VPER      12,800.0000  ×  0.013500  =    172.80
```

The three-way relationship (quantity × price = value) is the same one GnuCash presents, but it
belongs **inline in the split row**, not behind a modal transfer dialog — the modal is the actual
source of GnuCash's friction, not the arithmetic. The reckoning unit is shown on the transaction and
is editable; the implied rate is surfaced for confirmation per the guard above.

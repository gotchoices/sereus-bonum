# Units and Exchange — Objectives & Strategy

The *why* behind Bonum's generalized handling of multiple units of measure — currencies, inventory,
securities, and alternative currencies like CHIPs. The concrete rules (balancing algorithm, rendering,
costing tactics) live in the domain contract:

➡️ **[design/specs/domain/units.md](../design/specs/domain/units.md)** — the rules.
Field definitions for `Unit` and `Exchange` are in
**[design/specs/domain/schema.md](../design/specs/domain/schema.md)**.

---

## Core Insight

**Currencies are just units. A balance sheet is an inventory of units, valued at render time.**

| Concept | Traditional View | Generalized View |
|---------|------------------|------------------|
| What an account holds | A currency | A unit (any measurable thing) |
| What an entry records | Amount in currency | Quantity of units |
| What a transaction reckons in | A national currency | Any unit it touches |
| Exchange rate | One rate per transaction | One rate per entry, implied by its value |
| Balance sheet | Fixed to one currency | Renderable in any unit, as of any date |

## The Second Insight: Value Is a Gauge

A transaction only balances if its entries can be compared, and quantities in different units can't
be compared directly. Every accounting system solves this by restating each line in one common unit —
GnuCash calls it the transaction's *currency*, Beancount calls the restated figure a posting's
*weight*. Bonum calls it the transaction's **reckoning unit** and draws the conclusion the others
stop short of:

> The reckoning unit doesn't have to be money.

Value is defined only up to a scale factor — multiply every entry's value by a constant and the sum
is still zero. Choosing a reckoning unit merely fixes that scale. So a transaction can be reckoned in
stock B just as validly as in dollars:

```
Acquire 100 shares of A, paying with 250 shares of B, plus a 5-CHIP fee
Reckoned in B:   +249.9 B  −250.0 B  +0.1 B  =  0  ✓
```

Nothing here is denominated in a national currency, and nothing needs to be. The dollar figure for
that acquisition is an *estimate* produced at report time, never a recorded fact. This is the step
past traditional wisdom: conventional books cannot record a cost that isn't countable in a currency.
Bonum can.

## The Third Insight: Rates Belong to Entries

A rate attached to a *transaction* assumes one price per unit-pair per transaction. Real books
violate that constantly — a single stock sale fills at several prices, and 42 transactions in Kyle's
own investment books do exactly this. Putting `value` on each entry makes the rate per entry
(`value ÷ amount`), which represents multi-fill trades with no special case and removes an entire
class of bug: a stored rate that disagrees with the entries it claims to describe.

## Design Principle: No Overhead for Single-Unit Users

If an Entity operates entirely in one unit (e.g., USD), the Exchange table simply never gets
populated and transactions balance the traditional way (sum of entries = 0). The generalized model
adds no complexity unless foreign currencies, inventory, or alternative units are actually
introduced.

## What a Unit Can Be

| Category | Examples |
|----------|----------|
| Fiat currency | USD, EUR, GBP, JPY |
| Alternative currency | CHIP (MyChips), local currencies |
| Cryptocurrency | BTC, ETH |
| Commodity | oz-gold, barrel-oil |
| Security | shares-AAPL, shares-VTSAX |
| Inventory item | widget, bag-of-parts, labor-hour |

All are treated uniformly. The only real difference is where rates come from: market-quoted units get
rates from external feeds; inventory/internal units get rates from transaction history (cost basis).

## The Inventory Parallel

Buying inventory and buying foreign currency are **structurally identical** — both establish a
"price" for one unit in terms of another:

```
Buy parts:      -500 USD  →  +10 widget   (1 widget = 50 USD)
Buy euros:    -1000 USD  →  +850 EUR      (1 USD = 0.85 EUR)
```

Recognizing this is what lets one model handle currencies, inventory, and securities without special
cases.

## Facts vs. Estimates

The line Bonum refuses to blur: **what was recorded is a fact; what was converted is an estimate.**

An entry says 100 shares moved and cost 249.9 units of B on this date. That is permanent. Asking
"what is that worth in dollars today?" produces a number that depends on a rate someone quoted, and
that number is never written to the ledger. Reports therefore show the native quantity first and the
converted figure alongside it, visibly marked, with the rate's date and source inspectable.

A consequence worth stating plainly: **converted balance sheets don't balance.** Assets get revalued
at report-date rates while the equity that funded them sits at historical cost. Bonum closes the gap
with a derived equity line — *Unrecognized Gain/Loss* — computed at render time and never posted. It
is the same device as the cumulative translation adjustment in conventional consolidated reporting,
generalized to arbitrary units, and it is zero for single-unit books.

## The Risk We're Designing Against: Hidden Errors

If exchange rates are auto-derived from entries, a *missing* entry doesn't cause an error — it
silently distorts the rate. Example: buying €850 for $1000 plus a forgotten $30 wire fee yields an
implied $1.212/EUR instead of $1.176/EUR, hiding the $30. This is a **UI/UX problem, not a schema
problem**: the schema stores the explicit rate the user approved, and the UI must surface the implied
rate for confirmation. The concrete requirement is in
[domain/units.md](../design/specs/domain/units.md#transaction-balancing).

## Resolved Design Questions

- **How transactions balance:** each entry carries a `value` in the transaction's reckoning unit;
  balance is Σ value = 0. Supersedes the earlier "connected graph of Exchange records" model, which
  could not represent one sale filling at several prices.
- **What the reckoning unit may be:** any unit the transaction touches — a stock, a CHIP, a widget —
  not necessarily a currency. Books are never bound to a national currency.
- **Books are not fixed to one unit:** `Entity.baseUnit` is only the *default* display choice.
  Reckoning is per transaction; display is per report.
- **Where transaction rates live:** on the entries, implied by `value ÷ amount`. The Exchange table
  holds *reference rates only* (market/manual quotes for report-time valuation).
- **Directionality:** store `unitA`, `unitB`, and one rate ("1 unitA = rate unitB"); the inverse is
  computed. Rationals, never decimals.
- **Cost basis / lots:** no explicit Lot entity. Basis is the entry's (value, reckoning unit, date)
  triple; disposal follows a policy the user can override, and auditors replay to verify.
- **Report conversions are as-of the report date,** not today — a December balance sheet uses
  December rates.
- **Unit codes are namespaced** (`NYSE:VPER` vs `NASDAQ:VPER`) because tickers collide across markets.
- **Non-exchange multi-unit transactions:** treat as one transaction with imputed values (e.g. a gift
  of cash and stock has a fair market value that establishes the entry values).

---

## See Also

- [Schema.md](Schema.md) — data-model objectives
- [design/specs/domain/units.md](../design/specs/domain/units.md) — the concrete rules
- [STATUS.md](STATUS.md) — open questions tracker

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
| Exchange rate | Baked into transaction | Derived from transaction, applied at render |
| Balance sheet | Fixed to one currency | Renderable in any unit |

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

## The Risk We're Designing Against: Hidden Errors

If exchange rates are auto-derived from entries, a *missing* entry doesn't cause an error — it
silently distorts the rate. Example: buying €850 for $1000 plus a forgotten $30 wire fee yields an
implied $1.212/EUR instead of $1.176/EUR, hiding the $30. This is a **UI/UX problem, not a schema
problem**: the schema stores the explicit rate the user approved, and the UI must surface the implied
rate for confirmation. The concrete requirement is in
[domain/units.md](../design/specs/domain/units.md#transaction-balancing).

## Resolved Design Questions

- **Partial unit matching:** Exchange records only need to form a connected graph across the units in
  a transaction; the math converts to a common base. Users don't pair specific entries.
- **Directionality:** store `unitA`, `unitB`, and one rate ("1 unitA = rate unitB"); the inverse is
  computed. No need to store both directions.
- **Cost basis / lots:** no explicit Lot entity. Policy-based calculation at disposal time; the
  Exchange record captures the actual rate; auditors replay to verify policy compliance.
- **Base unit per Entity:** each Entity has a `baseUnit` for default display; reports can render in
  any unit.
- **Non-exchange multi-unit transactions:** treat as one transaction with imputed exchanges (e.g. a
  gift of cash and stock has a fair market value that establishes the rate). Use `source: MARKET` or
  `MANUAL`.

---

## See Also

- [Schema.md](Schema.md) — data-model objectives
- [design/specs/domain/units.md](../design/specs/domain/units.md) — the concrete rules
- [STATUS.md](STATUS.md) — open questions tracker

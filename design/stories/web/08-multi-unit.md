# User Story: Multiple Units of Account

## Story Overview
As a user whose books hold more than one unit — foreign currencies, inventory items, or community
currencies like CHIPs — I want to record transactions across units and still see one coherent balance
sheet.

Context: Priya runs a small import business. Most of her books are in USD, but she also holds euros,
some inventory measured in units, and a balance of CHIPs. Bonum treats every currency, commodity, and
inventory item as a **unit**, so a single set of books can carry many units of account — potentially
far more than a traditional accounting program contemplates, especially once integrated with MyCHIPs,
Taleus, and the wider Sereus fabric. The domain rules live in
[domain/units.md](../../specs/domain/units.md).

## Sequence
1. Priya exchanges $1,000 for €850 at her bank. In her USD checking ledger she credits $1,000 and, on
   the offset line, debits her EUR Cash account for €850.
2. Because the two entries are in different units, they can't balance on their own. Bonum shows the
   **implied exchange rate** prominently (1 USD = 0.85 EUR) and asks her to confirm it.
3. She confirms. The transaction saves, with an attached Exchange record capturing the rate she
   approved.
4. Her EUR Cash account now carries a euro balance. Her balance sheet still shows a single net-worth
   figure, because account balances are converted to her chosen display unit at render time.
5. None of this machinery appears for her purely-USD entities — the exchange prompt only shows up when
   a transaction actually spans units.

Alternative Path A: Inventory (Structurally Identical)
6.1. Priya buys 10 widgets from a supplier for $500. She credits Checking $500 and debits Parts
    Inventory 10 widgets.
6.2. Bonum recognizes the two units and shows the implied rate (1 widget = $50) for confirmation —
    exactly as it did for the currency exchange.
6.3. Parts Inventory now holds a balance measured in widgets.

Alternative Path B: Reference Rate for Idle Holdings
7.1. Priya holds 500 CHIPs from a transaction months ago and has no recent CHIP activity.
7.2. To see them valued in USD, she records a **reference rate** (a CHIP/USD rate not tied to any
    transaction), noting its source.
7.3. Her balance sheet now converts the CHIP balance to USD for display.

Alternative Path C: Buying Stock — Shares, Cash, and a Fee
7.4. Priya buys 100 shares of a stock for $290 cash plus a $7 broker fee. In the stock account's
    ledger the default entry unit is **shares**, so she types 100 shares and the $290 total; Bonum
    computes the $2.83/share price in the row.
7.5. The transaction is reckoned in USD: +100 sh (value −283.00 offsetting), +7.00 fee, −290.00 cash
    — the values sum to zero.
7.6. Later she sells a large block that fills at three different prices in one order. Each fill is
    its own entry with its own value, so all three rates are recorded exactly; nothing is averaged
    away.

Alternative Path D: A Trade With No Currency In It
7.7. Priya swaps 250 shares of one holding for 100 shares of another, paying a 5-CHIP fee. No dollars
    change hands.
7.8. Bonum asks which unit to **reckon** the transaction in and proposes the stock she paid with.
    She accepts; the entries balance in shares-of-that-stock.
7.9. Her books record what actually happened. The dollar value of the acquisition is never invented —
    it appears only later, as a marked estimate, when she runs a report in USD.

Alternative Path E: Choosing the Display Unit
8.1. Priya switches her balance sheet's display unit between USD, EUR, and CHIP.
8.2. Each account shows its **native balance as the fact**, with a converted estimate beside it,
    marked as an estimate, using rates as of the report date — not today's.
8.3. Because holdings are revalued while the equity that funded them sits at historical cost, the
    converted statement carries a derived **Unrecognized Gain/Loss** line in equity that makes it
    balance. It is computed for the report, never posted to her books, and recomputes when she
    changes the date or display unit.
8.4. Any unit with no conversion path to the chosen display unit is flagged (shown in its native unit
    with a note), never silently dropped from the totals.

Alternative Path D: Many Units in One Book (The Limit)
9.1. As Priya connects to MyCHIPs/Taleus/Sereus partners, a single entity may come to hold dozens of
    units of account.
9.2. The books still balance one transaction at a time, and reports render in whatever unit she
    chooses.
9.3. Where a held unit has no rate path to the display unit, Bonum surfaces it so she can add a
    reference rate — turning "unvaluable" holdings into visible ones on her terms.

## Acceptance Criteria
- [ ] A transaction spanning multiple units shows its implied rate for confirmation and stores the value the user approved on each entry.
- [ ] A multi-unit transaction balances when its entry values sum to zero in the reckoning unit; otherwise it's rejected with a clear reason naming the unit that still needs a value.
- [ ] The reckoning unit may be **any** unit the transaction touches — a stock or a CHIP, not only a currency — so a trade with no currency in it can be recorded.
- [ ] One transaction can carry several different rates for the same unit (a multi-fill trade), each on its own entry.
- [ ] In an account's ledger the default entry unit is that account's own unit; quantity, price, and value are inline in the split row, with any two computing the third.
- [ ] Reports render in any chosen unit, showing native quantity as fact plus a marked estimate, converted at rates **as of the report date**.
- [ ] Reference rates (market or manual quotes) can be recorded to value holdings that have no recent activity.
- [ ] A converted balance sheet balances via a derived **Unrecognized Gain/Loss** equity line that is computed at render time and never posted.
- [ ] Units with no conversion path to the display unit are flagged, never silently omitted from totals.
- [ ] Single-unit entities incur no reckoning prompts, no stored values, and no Unrecognized Gain/Loss line.

## Variants
- **happy:** A multi-unit transaction with a confirmed rate saves and renders correctly in any display unit, with native amounts and estimates clearly distinguished.
- **empty:** An entity operating in a single unit shows an ordinary balance sheet — no reckoning prompt, no estimate markers, no Unrecognized Gain/Loss line.
- **error:** A multi-unit transaction with an entry whose value is missing can't be saved — Bonum names the unit that still needs one. When the implied rate deviates sharply from known reference rates, Bonum warns before saving, catching a forgotten entry (e.g. a missing wire fee) that would otherwise hide inside a distorted rate.

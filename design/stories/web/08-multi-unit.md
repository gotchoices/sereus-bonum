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

Alternative Path C: Choosing the Display Unit
8.1. Priya switches her balance sheet's display unit between USD, EUR, and CHIP.
8.2. Every account converts using the most recent applicable rate.
8.3. Any unit with no conversion path to the chosen display unit is flagged (shown in its native unit
    with a note), never silently dropped from the totals.

Alternative Path D: Many Units in One Book (The Limit)
9.1. As Priya connects to MyCHIPs/Taleus/Sereus partners, a single entity may come to hold dozens of
    units of account.
9.2. The books still balance one transaction at a time, and reports render in whatever unit she
    chooses.
9.3. Where a held unit has no rate path to the display unit, Bonum surfaces it so she can add a
    reference rate — turning "unvaluable" holdings into visible ones on her terms.

## Acceptance Criteria
- [ ] A transaction spanning multiple units prompts for, shows, and stores an explicit exchange rate the user confirms.
- [ ] Entries in different units balance when their attached rates form a connected set; otherwise the transaction is rejected with a clear reason.
- [ ] The balance sheet can be rendered in any chosen unit, converting each account at its most recent applicable rate.
- [ ] Reference rates (not tied to a transaction) can be recorded to value holdings that have no recent activity.
- [ ] Units with no conversion path to the display unit are flagged, never silently omitted from totals.
- [ ] Single-unit entities incur no exchange prompts or overhead.

## Variants
- **happy:** A multi-unit transaction with a confirmed rate saves and renders correctly in any display unit.
- **empty:** An entity operating in a single unit shows an ordinary balance sheet with no exchange prompts.
- **error:** A multi-unit transaction whose units don't form a connected set of rates can't be saved — Bonum explains which unit still needs a rate. When the implied rate deviates sharply from known norms, Bonum warns before saving, catching a forgotten entry (e.g. a missing wire fee) that would otherwise hide inside a distorted rate.

# Bonum Data Schema — Objectives & Strategy

This document captures the **high-level objectives** behind Bonum's data model — the *why*. The
concrete, field-level contract (entities, types, relationships, invariants) lives in the domain spec:

➡️ **[design/specs/domain/schema.md](../design/specs/domain/schema.md)** — the authoritative schema.

Keep this file focused on strategy and design goals; add or change field definitions in the domain
spec, not here.

---

## Design Goals

1. **True double-entry integrity.** Every transaction is a set of balanced entries that sum to zero
   (debits positive, credits negative). Single-sided entry is never possible; a simple "one offset
   account" transaction is still stored as two entries. This is what lets the books always prove
   `Assets = Liabilities + Equity`.

2. **Balance-sheet thinking, not checkbook thinking.** The model treats assets, liabilities, and
   equity as first-class — buying an asset moves wealth between forms rather than "spending" it. See
   [Vision.md](./Vision.md).

3. **Multiple entities, shared taxonomy.** A user keeps separate books for many entities (household,
   businesses, years), but all entities draw from one shared **AccountGroup** taxonomy so reports and
   navigation feel consistent. Accounts belong to an entity; groups are global. See
   [design/specs/domain/account-groups.md](../design/specs/domain/account-groups.md).

4. **Generalized units, not just currency.** Balances are measured in **Units** — fiat, crypto,
   commodities, securities, or inventory items. Amounts are stored as integers in the smallest unit
   and divided for display, so there is no floating-point drift. Cross-unit transactions are balanced
   via **Exchange** rates. See [Units-and-Exchange.md](./Units-and-Exchange.md).

5. **Orthogonal classification via Tags.** Tags classify entries independently of the account
   structure (e.g., "Travel" can span expenses, jobs-in-process, and capital equipment), so users get
   cross-cutting analysis without distorting their chart of accounts.

6. **Verifiability against the outside world.** Reconciliation records tie internal entries to
   external statements, and an Imbalance account absorbs unclassified amounts so nothing is silently
   lost — periods can't close while it carries a balance.

7. **Advisory inter-entity links.** Counterpart accounts across entities can reference each other for
   consolidation, without hard-enforcing balance between separate sets of books.

## Core Entities (at a glance)

Entity · AccountGroup · Account · Transaction · Entry · Tag · Reconciliation · Partner · Unit ·
Exchange. Full definitions and relationships: **[domain/schema.md](../design/specs/domain/schema.md)**.

## Open Questions

Unresolved schema decisions are tracked in [STATUS.md](./STATUS.md).

---

*Historical note: an earlier draft of the field-level schema is preserved in
[Schema-original.md](./Schema-original.md).*

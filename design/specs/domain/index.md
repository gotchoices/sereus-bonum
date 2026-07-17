# Domain Contract

The **shared domain contract** for Bonum: the data model, rules, and interfaces that every target
(web, mobile) and every backend (mock, Sereus/Quereus) must honor. Human-readable and
outcome-focused — implementation/adapter mapping lives in generated consolidations.

Relationship to `docs/`: **docs/ holds objectives and high-level strategy** (vision, philosophy,
design goals); **domain/ holds the specific strategy and tactics** (the concrete contract). Where a
topic appears in both, docs stays narrative and links here for the specifics.

## Files

| Area | File | What it covers |
|------|------|----------------|
| Schema | [schema.md](./schema.md) | Entities, fields, relationships, invariants (the data model) |
| Account groups | [account-groups.md](./account-groups.md) | Shared account taxonomy: 5 types, seed hierarchy, rules |
| Rules | [rules.md](./rules.md) | Double-entry integrity, imbalance account, closed periods, reconciliation, audit trail |
| Units & exchange | [units.md](./units.md) | Multi-unit balancing, rendering in a chosen unit, costing policy |
| Interfaces | [interfaces.md](./interfaces.md) | Storage & sync model (mock ↔ Sereus/Quereus), selective sharing |
| Import | [import.md](./import.md) | Formats accepted, source→Bonum type mapping, duplicate handling |
| Export | [export.md](./export.md) | Export formats, layout, amount formatting |

## What stays per-target (not domain)

These are view/target-specific and remain under `design/specs/web/`:

- `web/global/navigation.md`, `web/global/ui.md`, `web/global/toolchain.md` — web presentation & tooling
- `web/global/i18n.md` — web i18n wiring (shared principles inlined)
- `web/global/view-state.md` — browser-local view persistence
- `web/screens/*`, `web/components/*` — screens and components

The per-target import **wizard UI** lives in `web/screens/import.md`; its shared behavior (formats,
mapping, dedup) is here in [import.md](./import.md).

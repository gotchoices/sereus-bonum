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

## Planned (migration in progress)

These concerns are currently under `design/specs/web/global/` and should move here (they transcend
web/mobile). Tracked in `docs/STATUS.md`:

| Area | Current location | Target |
|------|------------------|--------|
| Storage & sync | `web/global/backend.md` | `domain/interfaces.md` (strip env-var/config detail) |
| Import contract | `web/global/import.md` | `domain/import.md` (format matrix, type mapping, dedup rules) |
| Export contract | `web/global/export.md` | `domain/export.md` (formats, layout, amount rules) |
| Units & exchange | `docs/Units-and-Exchange.md` | `domain/units.md` (concrete unit/exchange tactics; keep rationale in docs) |
| Balancing rules | (implicit in schema + stories) | `domain/rules.md` (double-entry invariants, imbalance account, period close) |

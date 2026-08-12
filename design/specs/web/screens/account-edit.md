# Spec: Manage Accounts (per-entity account editor)

**Route:** `/entities/[id]/accounts`
**Story:** [01-firstlook.md](../../../stories/web/01-firstlook.md) (Alternative Path E)

The visual design (flat list, "Add" affordance, inline edit pane, copy, empty/error presentation) follows the
story and is left to the generation pass. This spec pins only what can't be inferred: the route/entry points,
the editable field set, and the domain invariants that constrain the UI.

## Purpose

Add and edit an entity's own accounts (the thing the entity view *reports on*). Distinct from the **Catalog**
(`catalog.md`), which manages the shared account-*group* taxonomy, and from the **Accounts View**
(`accounts-view.md`), which is the read-only balance-sheet/statements view.

## Entry points

- Entity context menu → **Accounts** opens this screen.
- The entity-*name* link still opens the **Accounts View** (reports). Cross-link both directions.

## Data

- `DataService`: `getAccounts(entityId)`, `createAccount`, `updateAccount`, `deleteAccount`.
- Stores: `stores/accounts`, `stores/entities`.

## Editable properties

Fields come from the Account entity ([domain/schema.md](../../domain/schema.md) § Account).

| Field | Editable | Notes |
|-------|----------|-------|
| `name` | yes | required |
| `code` | yes | **unique within the entity** (`uq_account_code`) — reject duplicates |
| `description` | yes | |
| `accountGroupId` (group) | yes | see re-parent invariant below |
| `parentId` (parent account) | yes | null = directly in a group; see invariant |
| `unit` | yes* | The unit this account holds — a currency, a security (`NYSE:VPER`), a CHIP, an inventory item. Picker lists existing units and allows **creating a new one** (code, name, symbol, type, display divisor). *Changing the unit of an account that already has entries re-denominates history — restrict / warn |
| `costingMethod` | yes | FIFO / LIFO / AVERAGE |
| `partnerId`, `linkedAccountId` | yes | optional |
| `isActive` (status) | yes | retire = `false`; see retire invariant |
| current balance | read-only | show as context (helps decide retire/delete), **in the account's own unit** |
| `id`, `entityId`, `sourceId`, `createdAt`, `updatedAt` | read-only | system / import identity |
| `closedThrough` | out of scope | period close-out is a separate flow (see [rules.md](../../domain/rules.md#closing)) |

## Invariants that constrain the UI

These are enforced by the domain and must shape the editor (they can't be designed away):

1. **Single logical path** (schema § Hierarchy): a nested account must live in its **parent account's group**.
   So the group *derives from* the chosen parent (the direct-group picker applies only when parent is null),
   and **changing an account's parent or group moves its whole descendant subtree into that group** (the
   composite FK enforces it). Re-parenting an account that has children must be confirmed.
2. **Retire requires a zero balance** ([rules.md](../../domain/rules.md#closing)) — setting `isActive=false`
   is refused on a non-zero balance.
3. **Delete is guarded** — refuse (or require reassignment first) when the account has entries or child
   accounts; deletion otherwise cascades per the delete rules.

## Out of scope (this pass)

Bulk actions, account merge/reassign, drag-to-reparent / tree view, and period close-out (`closedThrough`).

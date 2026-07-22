---
dependsOn:
  - design/stories/web/01-firstlook.md
  - design/specs/web/screens/account-edit.md
  - design/specs/domain/schema.md
  - design/specs/domain/rules.md
depHashes:
  design/stories/web/01-firstlook.md: 11e9c354253b25afbcbaee117a3cc645ba53348eaf9c46a831127520807a3222
  design/specs/web/screens/account-edit.md: 492010eefd2c288097f5e85ecfbd943c77ff928b5ef4f33eb171c0c7b143abf7
  design/specs/domain/schema.md: 44ec79253286e31c446d1238de03d3282379e50a04969629998d59753f6a4d80
  design/specs/domain/rules.md: fb5f4acfe557b963423b354d66c89b5fcf5f37364de3b03ef2096f03d5b09244
provides:
  - screen:ManageAccounts
needs:
  - service:DataService
  - store:accounts
  - store:entities
generated: 2026-07-21
lastUpdated: 2026-07-21
component: apps/web/src/routes/entities/[id]/accounts/+page.svelte
status: planned
---

# Consolidation: Manage Accounts

**Route:** `/entities/[id]/accounts`
**Component (planned):** `apps/web/src/routes/entities/[id]/accounts/+page.svelte`
**Generated:** 2026-07-21
**Status:** ⬜ Planned — not yet implemented. This consolidation is the build checklist.

---

## Purpose

Add and edit an entity's own accounts. Distinct from the **Catalog** (`/catalog`, shared account-*group*
taxonomy) and the **Accounts View** (`/entities/[id]`, read-only balance-sheet / statements). Reached from
the entity context menu → **Accounts**; the entity *name* link continues to open the Accounts View, and the
two cross-link. See [account-edit.md](../../../specs/web/screens/account-edit.md).

## Architecture (planned)

- **Screen** (`+page.svelte`): loads the entity's accounts via `DataService.getAccounts(entityId)`, renders a
  flat list (each row showing code, name, and group path); an **Add** control appends a new account; clicking
  a row expands an **inline edit pane** over the Account fields. Create/update/delete via `DataService`
  `createAccount` / `updateAccount` / `deleteAccount`.
- **Stores**: `$lib/stores/accounts` (accounts + group tree, for the group/parent pickers), `$lib/stores/entities`.
- **Reused pickers**: group selection can reuse `AccountGroupTreeSelector` / `AccountGroupAutocomplete`;
  parent-account selection can reuse `AccountAutocomplete`.

The *visual* design (list layout, Add affordance, inline-pane presentation, copy) is inferred from the story;
this doc pins the requirements + domain rules to satisfy.

---

## Source Requirements Verification

### stories/web/01-firstlook.md (Alt Path E)

| # | Requirement | Status | Implementation |
|---|-------------|--------|----------------|
| 6.1 | Context menu **Accounts** → flat list of the entity's accounts (code, name, group path) | ⬜ Planned | route `/entities/[id]/accounts` |
| 6.2 | **Add account** → blank entry; set name, code, group, optional parent | ⬜ Planned | `createAccount` |
| 6.3 | Click account → **inline pane** with all editable properties | ⬜ Planned | expandable row |
| 6.4 | Change **parent** → account (and sub-accounts) move into parent's group; confirm | ⬜ Planned | see Invariant 1 |
| 6.5 | Delete refused when it has transactions; retire requires zero balance | ⬜ Planned | see Invariants 2–3 |
| 6.6 | Cross-link to the entity's **Accounts View** (reports) and back | ⬜ Planned | link `/entities/[id]` |

### specs/web/screens/account-edit.md — editable properties

| Field | Editable | Rule | Status |
|-------|----------|------|--------|
| `name` | yes | required | ⬜ |
| `code` | yes | unique within entity (`uq_account_code`) — reject dupes | ⬜ |
| `description` | yes | | ⬜ |
| `accountGroupId` | yes | derives from parent when nested (Invariant 1) | ⬜ |
| `parentId` | yes | null = directly in a group; else Invariant 1 | ⬜ |
| `unit` | yes* | warn/restrict when the account already has entries | ⬜ |
| `costingMethod` | yes | FIFO / LIFO / AVERAGE | ⬜ |
| `partnerId`, `linkedAccountId` | yes | optional | ⬜ |
| `isActive` | yes | retire = false (Invariant 2) | ⬜ |
| current balance | read-only | shown as context | ⬜ |
| `id`, `entityId`, `sourceId`, `createdAt`, `updatedAt` | read-only | system / import identity | ⬜ |
| `closedThrough` | out of scope | separate period-close flow | — |

### Domain invariants (must be enforced)

| # | Invariant | Source | Status |
|---|-----------|--------|--------|
| 1 | Single logical path: a nested account shares its parent's group; changing parent/group **moves the whole subtree** (composite FK); confirm when it has children | [schema.md § Hierarchy](../../../specs/domain/schema.md) | ⬜ |
| 2 | Retire (`isActive=false`) requires a **zero balance** | [rules.md § Closing](../../../specs/domain/rules.md#closing) | ⬜ |
| 3 | Delete guarded — refuse / reassign when the account has entries or children; else cascade per delete rules | schema.md / service | ⬜ |

---

## Deferred / Notes

- **Not built yet** — data layer is ready (`createAccount` / `updateAccount` / `deleteAccount` exist); this
  screen is the missing UI. Accounts are currently created only via import.
- **Out of scope** (per spec): bulk actions, account merge/reassign, drag-to-reparent / tree view, and period
  close-out (`closedThrough`).
- **Naming**: the context-menu "Accounts" now opens this manager; the report view keeps the "Accounts View"
  name via the entity-name link. Confirm before build if a "Reports" vs "Accounts" menu split is preferred.

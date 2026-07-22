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
status: implemented
---

# Consolidation: Manage Accounts

**Route:** `/entities/[id]/accounts`
**Component:** `apps/web/src/routes/entities/[id]/accounts/+page.svelte`
**Generated:** 2026-07-21 · reconciled to the implementation.

---

## Purpose

Add and edit an entity's own accounts. Distinct from the **Catalog** (`/catalog`, shared account-*group*
taxonomy) and the **Accounts View** (`/entities/[id]`, read-only balance-sheet / statements). Reached from the
entity context menu → **Accounts**; the entity *name* link opens the Accounts View, and the two cross-link.

## Architecture

- **Screen** (`+page.svelte`): loads the entity's accounts (`loadAccounts`), groups (`loadAccountGroups`),
  units (`getUnits`), and per-account balances (from `getBalanceSheet`, the optimized JS-join path). Renders a
  flat, path-sorted list; an **Add** control opens a blank editor; clicking a row expands an inline editor.
- **Data**: `DataService.createAccount` / `updateAccount` / `deleteAccount` / `moveAccountSubtree`.
- **Stores**: `$lib/stores/accounts`, `$lib/stores/entities`.

---

## Source Requirements Verification

### stories/web/01-firstlook.md (Alt Path E)

| # | Requirement | Status | Implementation |
|---|-------------|--------|----------------|
| 6.1 | Context menu **Accounts** → flat list (code, name, group path) | ✅ | route + `sortedAccounts` / `pathOf`; EntityList link → `/entities/[id]/accounts` |
| 6.2 | **Add account** → blank entry (name, code, group, optional parent) | ✅ | `startAdd` / `editor(true)` → `createAccount` |
| 6.3 | Click account → inline pane, all editable properties | ✅ | `startEdit` / `editor(false)` |
| 6.4 | Change parent → account + sub-accounts move into parent's group; confirm | ✅ | `moveAccountSubtree`; `confirm()` when it has children |
| 6.5 | Delete refused when it has transactions; retire needs zero balance | ✅ | delete via `entry` FK; retire checks loaded balance |
| 6.6 | Cross-link to the Accounts View and back | ✅ | header back-link + a "⚙ Manage Accounts" link on the report view |

### specs/web/screens/account-edit.md — editable properties

| Field | Editable | Status |
|-------|----------|--------|
| name (required), code (unique/entity), description | ✅ | `updateAccount`; code dup rejected in `save` |
| group / parent (single-path) | ✅ | group derives from parent; `effectiveGroupId`; `moveAccountSubtree` |
| unit | ✅ | select of `getUnits` |
| costingMethod | ✅ | select (FIFO/LIFO/AVERAGE) |
| isActive (retire) | ✅ | checkbox; zero-balance guard |
| balance / id / entityId / sourceId / timestamps | read-only | shown as context / not exposed |
| partnerId, linkedAccountId | ⛔ Deferred | not in the editor yet |
| closedThrough | out of scope | period-close flow |

### Domain invariants

| # | Invariant | Status | Implementation |
|---|-----------|--------|----------------|
| 1 | Nested account shares its parent's group; changing parent/group moves the whole subtree | ✅ | `DataService.moveAccountSubtree` (FK-off batch); confirm on children |
| 2 | Retire requires zero balance | ✅ | `save` checks `balances[id]` before `isActive=false` |
| 3 | Delete guarded (entries / children) | ✅ | child check in JS; `entry.account_id` FK rejects on transactions |

---

## Deferred / Notes

- **Performance choices**: retire uses the pre-loaded `getBalanceSheet` balances and delete relies on the
  `entry` FK — both avoid the slow `txn⋈entry` JOIN (`getAccountBalance` / `getTransactions`) on the store.
- **Deferred**: partner / linked-account fields, bulk actions, account merge/reassign, tree/drag-reparent
  view, and period close-out (`closedThrough`).
- **Naming**: context-menu "Accounts" opens this manager; the report view keeps the "Accounts View" name via
  the entity-name link.

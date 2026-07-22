---
dependsOn:
  - design/stories/web/01-firstlook.md
  - design/specs/web/screens/catalog.md
  - design/specs/domain/account-groups.md
depHashes:
  design/stories/web/01-firstlook.md: 11e9c354253b25afbcbaee117a3cc645ba53348eaf9c46a831127520807a3222
  design/specs/web/screens/catalog.md: d4058d119342f8768e04a34840e11f2fcf92df419054ad2a3c7d54d56d56b565
  design/specs/domain/account-groups.md: 8026245538f1513fcca128a634a6addff329d7ce35e02c4388a0f3726a84c0af
provides:
  - screen:Catalog
needs:
  - store:accounts
  - service:i18n
  - data:seed
generated: 2026-07-22
lastUpdated: 2026-07-22
component: apps/web/src/routes/catalog/+page.svelte
status: partial
---

# Consolidation: Account Groups Catalog

**Route:** `/catalog`
**Component:** `apps/web/src/routes/catalog/+page.svelte`
**Generated:** 2026-07-22 · reconciled to the implementation (the built screen is the source of truth for
this consolidation).

---

## Purpose

Manage the shared classification taxonomy (account groups) used to organize accounts across all
entities. This is the template structure itself — not the Accounts View, which shows entity accounts
with balances. Five type panes (Asset, Liability, Equity, Income, Expense), each rendering its
top-level groups and unlimited nested children, with per-group CRUD via a context menu + modal. See
[catalog.md](../../../specs/web/screens/catalog.md), [account-groups.md](../../../specs/domain/account-groups.md),
and story [01-firstlook.md](../../../stories/web/01-firstlook.md) (Alt Path C).

## Architecture

- **Screen** (`+page.svelte`): loads groups via `loadAccountGroups` (`onMount`, only when empty),
  renders a `.catalog-grid` of five `.type-section` cards keyed off `accountTypes`. Recursive
  `groupRow` snippet renders the tree with depth-based inline `padding-left`; parent rows toggle,
  leaf rows render arrow-less.
- **Store** (`$lib/stores/accounts`): `accountGroups`, `accountGroupsLoading`, derived
  `topLevelGroupsByType` / `childGroupsByParent`, `hasChildren`, and CRUD
  (`createAccountGroup`, `updateAccountGroup`, `deleteAccountGroup`).
- **Expand state**: `expandedGroups` `Set<string>`, persisted in `localStorage['bonum-catalog-expand']`.
  A one-time `$effect` (`hasInitialized`) restores saved state or falls back to `collapseAll` (top-level
  only) on first visit. `expandAll`/`collapseAll` header buttons; `saveExpandedState` on every toggle.
- **Modal** (`showModal`/`modalMode` = `add`|`edit`|`addChild`): shared form
  (`formName`/`formType`/`formParentId`/`formDescription`); `handleSave` routes to create vs update.
- **Context menu** (`contextMenu`): right-click a group row → Edit / Add Child / Delete; closed on
  window click.
- **i18n** (`$lib/i18n` `t`): all visible copy via translation keys (`catalog.*`, `common.*`,
  `account_types.*`).
- **Seed** (`$lib/data/mock/seed.ts` `ACCOUNT_GROUPS`): fresh-install taxonomy.

---

## Source Requirements Verification

### stories/web/01-firstlook.md (Alt Path C)

| # | Requirement | Status | Implementation |
|---|-------------|--------|----------------|
| 6.1 | Account Catalog option (trial-balance-like, no accounts) | ✅ | Route `/catalog`; five type sections, groups only |
| 6.2 | Sections for 5 account types | ✅ | `accountTypes` / `typeInfo`; `.type-section` per type |
| 6.3 | Groups hierarchically arranged | ✅ | Recursive `groupRow` via `childGroupsByParent` |
| 6.4 | Context menu: Edit, Add child, Delete | ✅ | `contextMenu` block |
| 6.5 | Rearrange order of child groups | ⛔ Deferred | No drag/reorder; groups render by store order |
| 6.6 | Add new child (and move it to last) | ⚠️ Partial | Add child works (`openAddChildModal`); reposition not implemented |

### specs/web/screens/catalog.md — Display Layout

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Five separate panes/cards | ✅ | `.type-section` per `accountType` |
| Type shown by icon only, tooltip reveals name | ✅ | `.type-icon` `title={info.label}` |
| Icons 💰📋📊📈📉 | ✅ | `typeInfo` |
| Top-level groups always visible | ✅ | `topLevelGroupsByType` rendered per section |
| Parent expand/collapse icon (▶/▼) | ✅ | `expand-icon` span; `isExpanded` |
| Child groups indented beneath parents | ✅ | `padding-left` from `depth` in `groupRow` |
| Leaf groups show no arrow | ✅ | `leaf` branch (no expand icon) |
| Count of groups per type | ✅ | `countGroups()` (counts all, incl. nested) |
| Expand All | ✅ | `expandAll()` (all parents with children) |
| Collapse All except top-level | ✅ | `collapseAll()` keeps `!parentId` groups |
| Initial state = Collapse All (top-level expanded) | ✅ | one-time `$effect` calls `collapseAll` on first visit |
| User expansion state persists | ✅ | `localStorage['bonum-catalog-expand']` |

### specs/web/screens/catalog.md — Add New Group

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Name required | ✅ | `handleSave` guard; Save `disabled` until non-empty |
| Type optional, defaults to parent type | ✅ | `formType`; set by `handleParentChange` |
| Type disabled when parent selected | ✅ | `disabled={formParentId !== null}` |
| Type updates when parent changes | ✅ | `handleParentChange` |
| Parent dropdown lists only groups of the selected type | ⚠️ Partial | Dropdown iterates **all** `accountGroups` (labels type); `getParentOptions(type)` filter exists but is unwired |
| Parent dropdown updates when Type changes | ⚠️ Partial | Parent list is static (all groups); not re-filtered on type change |
| Description optional | ✅ | `formDescription` |
| Save creates + refreshes; Cancel closes | ✅ | `createAccountGroup`; `closeModal` |

### specs/web/screens/catalog.md — Edit Group (+ account-groups.md § Constraints)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Right-click → Edit, pre-filled | ✅ | `openEditModal` |
| Cannot change Type | ✅ | Type rendered as disabled input; `handleSave` updates name/description only |
| Change Name & Description | ✅ | `updateAccountGroup` |
| Block parent change to incompatible type when children exist | ⛔ Deferred | Edit modal exposes no parent field; not enforced |

### specs/web/screens/catalog.md — Add Child Group

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Right-click → Add Child | ✅ | `openAddChildModal` (offered on all groups, superset of "parent only") |
| Type & Parent locked (inherited) | ✅ | Both rendered as disabled inputs |

### specs/web/screens/catalog.md — Delete Group (+ account-groups.md § Deletion)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Right-click → Delete with confirmation | ✅ | `handleDeleteGroup` → `confirm()` |
| Confirmation shows group name + entity-usage warning | ⚠️ Partial | Generic `catalog.delete_confirm` string; no name/usage count |
| Block delete when entities use the group (or a child); show "N entities…" | ⛔ Deferred | Deletes unconditionally; no usage check or reassignment gate |

### specs/web/screens/catalog.md — Empty States & Context Menu

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| "No groups of a type" message | ✅ | `empty-type` (`catalog.no_groups_type`) |
| Fresh install seeds standard groups | ✅ | `seed.ts` `ACCOUNT_GROUPS` |
| Context menu Edit / Add Child / Delete | ✅ | `contextMenu` menu items |

---

## Deferred / Notes (demanded by stories/specs, not yet built)

- **Reorder child groups** (story 6.5–6.6, spec Future). No drag-to-reorder; render order follows the
  store. This blocks "add Special Inventory and move it to last".
- **Delete safety** (spec Delete restrictions, account-groups.md § Deletion). Deletion is unconditional
  and the confirm dialog is a generic string — no group name, no "N entities have accounts in this
  group" count, no reassignment gate.
- **Parent-dropdown type filtering** (spec Add). The Add modal's parent `<select>` lists every group
  rather than only those of the selected type, and does not re-filter when Type changes.
  `getParentOptions` implements the intended filter but is not wired to the template. Selecting a parent
  still forces the correct type via `handleParentChange`, so created hierarchies remain type-consistent.
- **Edit parent re-parenting guard** (spec Edit / account-groups.md). Edit exposes no parent field, so
  the "cannot re-parent to an incompatible type when children exist" rule is neither offered nor enforced.
- **Import/Export and Search/Filter** (spec Future) — not started.

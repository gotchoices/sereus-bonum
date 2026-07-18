---
dependsOn:
  - design/stories/web/01-firstlook.md
  - design/specs/web/screens/catalog.md
  - design/specs/domain/account-groups.md
depHashes:
  design/stories/web/01-firstlook.md: a383e823aa5e362529d07d75688744556ef21848e59b20fa76986ba214169f06
  design/specs/web/screens/catalog.md: d4058d119342f8768e04a34840e11f2fcf92df419054ad2a3c7d54d56d56b565
  design/specs/domain/account-groups.md: 8026245538f1513fcca128a634a6addff329d7ce35e02c4388a0f3726a84c0af
provides:
  - screen:Catalog
needs:
  - store:accountGroups
  - data:seed
generated: 2026-07-18
lastUpdated: 2026-07-18
component: apps/web/src/routes/catalog/+page.svelte
---

# Consolidation: Account Groups Catalog

**Route:** `/catalog`
**Component:** `apps/web/src/routes/catalog/+page.svelte`
**Generated:** 2026-07-18

---

## Purpose

Manage the shared classification taxonomy (account groups) used to organize accounts across all
entities. This is the template structure itself — not the Accounts View, which shows entity accounts
with balances. Five type panes (Asset, Liability, Equity, Income, Expense), each rendering its
top-level groups and unlimited nested children. See
[domain/account-groups.md](../../../specs/domain/account-groups.md).

## Architecture

- **Screen** (`+page.svelte`): loads groups via `loadAccountGroups`, renders a per-type
  `.type-section` card. Recursive `groupRow` snippet renders the tree with depth-based indentation.
- **Store** (`$lib/stores/accounts`): `accountGroups`, derived `topLevelGroupsByType` /
  `childGroupsByParent`, and CRUD (`createAccountGroup`, `updateAccountGroup`, `deleteAccountGroup`).
- **Seed** (`$lib/data/mock/seed.ts`): `ACCOUNT_GROUPS` provides the fresh-install taxonomy.

---

## Source Requirements Verification

### stories/web/01-firstlook.md (Alt Path C)

| # | Requirement | Status | Implementation |
|---|-------------|--------|----------------|
| 6.1 | Account Catalog option | ✅ | Route `/catalog` |
| 6.2 | Sections for 5 account types | ✅ | `accountTypes` / `typeInfo`; `.type-section` per type |
| 6.3 | Groups hierarchically arranged | ✅ | Recursive `groupRow` snippet via `childGroupsByParent` |
| 6.4 | Context menu: Edit, Add child, Delete | ✅ | `contextMenu` block |
| 6.5 | Rearrange order of child groups | ⛔ Deferred | No drag/reorder; groups render by store order |
| 6.6 | Add new child (and move to last) | ⚠️ | Add child works (`openAddChildModal`); reposition not implemented |

### specs/web/screens/catalog.md

#### Display Layout
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Five separate panes/cards | ✅ | `.type-section` per `accountType` |
| Type shown by icon only, tooltip reveals name | ✅ | `.type-icon` `title={info.label}` |
| Icons 💰📋📊📈📉 | ✅ | `typeInfo` |
| Top-level groups always visible | ✅ | `topLevelGroupsByType` rendered per section |
| Parent expand/collapse icon (▶/▼) | ✅ | `expand-icon` span, `isExpanded` |
| Child groups indented | ✅ | `padding-left` from `depth` in `groupRow` |
| Leaf groups show no arrow | ✅ | `leaf` branch (no expand icon) |
| Count of groups per type | ✅ | `countGroups()` (counts all, incl. nested) |
| Expand All | ✅ | `expandAll()` (all parents) |
| Collapse All except top-level | ✅ | `collapseAll()` keeps `!parentId` groups |
| Initial state = Collapse All (top-level expanded) | ✅ | `$effect` calls `collapseAll` on first visit |
| User expansion state persists | ✅ | `localStorage` key `bonum-catalog-expand` |

#### Add New Group
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Name required | ✅ | `handleSave` guard; Save `disabled` until non-empty |
| Type optional, defaults to parent type | ✅ | `formType`; set by `handleParentChange` |
| Type disabled when parent selected | ✅ | `disabled={formParentId !== null}` |
| Type updates when parent changes | ✅ | `handleParentChange` |
| Parent dropdown lists only groups of selected type | ⚠️ | Dropdown iterates all `accountGroups` (labels type); `getParentOptions` filter exists but is unused |
| Parent dropdown updates when Type changes | ⚠️ | Parent list is static (all groups); not re-filtered on type change |
| Description optional | ✅ | `formDescription` |
| Save creates + refreshes; Cancel closes | ✅ | `createAccountGroup`; `closeModal` |

#### Edit Group
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Right-click → Edit, pre-filled | ✅ | `openEditModal` |
| Cannot change Type | ✅ | Type rendered as disabled input; `handleSave` updates name/description only |
| Change Name & Description | ✅ | `updateAccountGroup` |
| Block parent change to incompatible type when children exist | ⛔ Deferred | Edit modal exposes no parent field; not enforced |

#### Add Child Group
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Right-click → Add Child | ✅ | `openAddChildModal` (offered on all groups, superset of "parent only") |
| Type & Parent locked (inherited) | ✅ | Both rendered as disabled inputs |

#### Delete Group
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Right-click → Delete with confirmation | ✅ | `handleDeleteGroup` → `confirm()` |
| Confirmation shows group name + entity-usage warning | ⚠️ | Generic `catalog.delete_confirm` string; no name/usage count |
| Block delete when entities use the group (or a child) | ⛔ Deferred | Deletes unconditionally |

#### Empty States
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| "No groups of a type" message | ✅ | `empty-type` (`catalog.no_groups_type`) |
| Fresh install seeds standard groups | ✅ | `seed.ts` `ACCOUNT_GROUPS` |

#### Context Menu
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Edit / Add Child / Delete | ✅ | `contextMenu` menu items |

---

## Deferred / Notes

- **Reorder child groups** (story 6.5–6.6, spec Future). No drag-to-reorder; render order follows the
  store. This blocks "move Special Inventory to last".
- **Delete safety** (spec Delete restrictions). Deletion is unconditional and the confirm dialog is a
  generic string — no group name, no "N entities have accounts in this group" count, no reassignment
  gate.
- **Parent-dropdown type filtering** (spec Add). The Add modal's parent `<select>` lists every group
  rather than only those of the selected type, and does not re-filter when Type changes. `getParentOptions`
  implements the intended filter but is not wired to the template. Selecting a parent still forces the
  correct type via `handleParentChange`, so created hierarchies remain type-consistent.
- **Import/Export and Search/Filter** (spec Future) — not started.

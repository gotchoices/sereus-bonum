---
dependsOn:
  - design/stories/web/01-firstlook.md
  - design/specs/web/screens/catalog.md
  - design/specs/web/global/account-groups.md
depHashes:
  design/specs/web/screens/catalog.md: 019afc464ddad3cd33ae166cac708c6bcfa61209fe6ae6f6f8236e3d3579ecfc
  design/specs/web/global/account-groups.md: 2cb5757a1e8c2bbf732941a7d5c83532b503bf3eadc2557026fa4340d45266d4
  design/stories/web/01-firstlook.md: 4a2e1ab0116f02c46bffa08d709f535054645e687c054ebbc14d1260705cefcd
implementationHash:
  apps/web/src/routes/catalog/+page.svelte: 9b4e5a26b525ccd325b7c909f1e950ad7303ec71549f7698e8b53bfc9541dfc1
provides:
  - screen:Catalog
needs:
  - store:accountGroups
generated: 2024-12-16
lastUpdated: 2024-12-16
component: apps/web/src/routes/catalog/+page.svelte
---

# Consolidation: Account Groups Catalog

**Route:** `/catalog`  
**Component:** `apps/web/src/routes/catalog/+page.svelte`  
**Generated:** 2024-12-16  

---

## Purpose

Manage the shared classification structure for organizing accounts across all entities. This is the taxonomy itself, not the Accounts View which shows entity accounts with balances.

---

## Source Requirements Verification

### Story 01-firstlook.md (Alt Path C)

| # | Requirement | Status | Implementation |
|---|-------------|--------|----------------|
| 6.1 | Account Catalog option | ✅ | Route `/catalog` |
| 6.2 | See 5 basic account types | ✅ | Lines 191-275 (type sections) |
| 6.3 | Groups hierarchically arranged | ✅ | Recursive `groupRow` snippet |
| 6.4 | Context menu: Edit, Add child, Delete | ✅ | Lines 280-299 |
| 6.5 | Rearrange child order | ⏳ | Not in MVP (spec line 124) |
| 6.6 | Add new child | ✅ | `openAddChildModal()` |

### specs/web/screens/catalog.md

#### Display Layout (Lines 16-50)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Five separate panes/cards | ✅ | `.type-section` cards per type |
| Icon only with tooltip | ✅ | `title="{info.label}"` on icon span |
| Icons: 💰📋📊📈📉 | ✅ | `typeInfo` constant |
| Top-level groups always visible | ✅ | Assets, Liabilities, etc. as top-level |
| Expand/collapse icon (▶/▼) | ✅ | Line 217 |
| Child groups indented | ✅ | Dynamic `padding-left` in snippet |
| Leaf groups no arrow | ✅ | Line 230 (leaf class) |
| Count shows groups per type | ✅ | `countGroups()` function |
| Initial state: top-level expanded | ✅ | Effect on mount, localStorage fallback |

#### User Actions (Lines 53-107)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Add New Group button | ✅ | Header action button |
| Modal: Name required | ✅ | Form field with placeholder |
| Modal: Parent dropdown (before Type) | ✅ | Shows all groups with type label |
| Modal: Type dropdown | ✅ | Optional, defaults to parent type |
| Modal: Type disabled if parent selected | ✅ | `disabled={formParentId !== null}` |
| Modal: Type updates when parent changes | ✅ | `handleParentChange()` function |
| Modal: Description optional | ✅ | Optional text field |
| Edit Group via context menu | ✅ | "Edit" menu item |
| Edit: Cannot change Type | ✅ | Type shown as disabled input |
| Add Child Group | ✅ | "Add Child" menu item (all groups) |
| Add Child: Type/Parent locked | ✅ | Both shown as disabled inputs |
| Delete Group | ✅ | "Delete" menu item |
| Delete confirmation | ✅ | `confirm()` dialog |
| Expand/Collapse toggle | ✅ | `toggleGroup()` function |
| Icon changes on toggle | ✅ | ▶ ↔ ▼ |
| **State persists in localStorage** | ✅ | Key: `bonum-catalog-expand` |
| **Initial state: top-level expanded** | ✅ | Effect checks localStorage first |

#### Empty States (Lines 101-109)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| "No groups" empty state | ✅ | Lines 234-236 |
| Fresh install seeds groups | ✅ | `seed.ts` ACCOUNT_GROUPS |

#### Context Menu (Lines 113-119)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Edit option | ✅ | Line 287 |
| Add Child option | ✅ | **FIXED: Available for all groups** |
| Delete option | ✅ | Lines 293-297 |

---

## Changes Made (2024-12-16)

### 1. Added localStorage Persistence for Expand/Collapse State (Spec Line 97)

**Before:** Expanded state reset on page refresh  
**After:** 
- Saves to `localStorage` key `bonum-catalog-expand`
- Restores on page load
- Updates on every toggle/expandAll/collapseAll

**Implementation:**
```typescript
const EXPAND_STORAGE_KEY = 'bonum-catalog-expand';

function saveExpandedState() {
  localStorage.setItem(EXPAND_STORAGE_KEY, JSON.stringify([...expandedGroups]));
}
```

### 2. Fixed "Add Child" Context Menu (Spec Line 118)

**Before:** Only available for top-level groups  
**After:** Available for all groups (multi-level nesting supported)

### 3. Added Multi-Level Nesting Support (Spec Line 36)

**Before:** Only 2 levels (parent → child)  
**After:** Recursive rendering via Svelte snippet supports unlimited nesting

**Implementation:**
```svelte
{#snippet groupRow(group: AccountGroup, depth: number)}
  <!-- Recursive rendering with depth-based indentation -->
  {#each children as child}
    {@render groupRow(child, depth + 1)}
  {/each}
{/snippet}
```

### 4. Fixed Group Count (Spec Line 41)

**Before:** Counted only top-level groups per type  
**After:** Counts ALL groups per type (including nested children)

### 5. Updated Seed Data to Match New Spec

Updated `apps/web/src/lib/data/mock/seed.ts` to match `specs/web/global/account-groups.md`:

**Assets (16 groups):**
- Current Assets: Cash, Bank, Private Credit, Reimbursements, Receivables
- Fixed Assets: Real Property, Equipment, Vehicles
- Product: Inventory, Jobs in Process, Work in Process
- Other Assets

**Liabilities (9 groups):**
- Current Liabilities: Credit Cards, Accounts Payable, Payroll Payable
- Deposits
- Long-term Debt: Loans, Mortgages
- Other Liabilities

**Equity (3 groups):**
- Adjustments
- Member Capital
- Net Income Allocations

**Income (4 groups):**
- Sales
- Employment
- Reimbursements
- Adjustments

**Expenses (4 groups):**
- Fixed
- Variable
- Interest
- Tax

---

## Visual Structure

```
┌─────────────────────────────────────────────────────────┐
│ Account Groups Catalog    [Expand All] [Collapse] [+ Add] │
├─────────────────────────────────────────────────────────┤
│ 💰 Assets                                    (16 groups) │
│   ▼ Current Assets                                    5 │
│       Cash                                              │
│       Bank                                              │
│       Private Credit                                    │
│       Reimbursements                                    │
│       Receivables                                       │
│   ▶ Fixed Assets                                      3 │
│   ▶ Product                                           3 │
│   Other Assets                                          │
├─────────────────────────────────────────────────────────┤
│ 📋 Liabilities                               (9 groups) │
│   ...                                                   │
└─────────────────────────────────────────────────────────┘
```

---

## User Interactions

| Action | Trigger | Result |
|--------|---------|--------|
| Expand/Collapse | Click parent row | Toggle children, save to localStorage |
| Add Group | Click [+ Add Group] | Open modal with all fields |
| Edit Group | Right-click → Edit | Open modal, Type/Parent locked |
| Add Child | Right-click → Add Child | Open modal, Type/Parent inherited |
| Delete Group | Right-click → Delete | Confirm, then delete |
| Expand All | Click [Expand All] | Expand all parent groups |
| Collapse All | Click [Collapse All] | Collapse all groups |

---

## Future Enhancements (Not in MVP)

- **Drag to Reorder:** Reorder within same parent/type (spec line 124)
- **Delete restrictions:** Show entity usage count (spec lines 86-88)
- **Import/Export:** JSON export, standard templates
- **Search/Filter:** Search by name, filter by type

---

## Dependencies

### Stores
- `accountGroups` - All account groups
- `accountGroupsLoading` - Loading state
- `topLevelGroupsByType` - Derived: top-level groups by account type
- `childGroupsByParent` - Derived: child groups by parent ID

### Functions
- `loadAccountGroups()` - Fetch from database
- `createAccountGroup()` - Create new group
- `updateAccountGroup()` - Update existing group
- `deleteAccountGroup()` - Delete group

### Types
- `AccountGroup` - Group data structure
- `AccountType` - Enum: ASSET, LIABILITY, EQUITY, INCOME, EXPENSE

---

## Testing Checklist

- [ ] Load catalog → verify all 5 type sections shown
- [ ] Verify group counts match total groups per type
- [ ] Expand parent group → verify children shown with correct indentation
- [ ] Collapse parent group → verify children hidden
- [ ] Expand All → verify all parents expanded
- [ ] Collapse All → verify all parents collapsed
- [ ] Refresh page → verify expand state preserved
- [ ] Right-click group → verify context menu appears
- [ ] Context menu → Edit → verify modal opens with data
- [ ] Context menu → Add Child → verify modal opens with type locked
- [ ] Context menu → Delete → verify confirmation dialog
- [ ] Add Group modal → save → verify new group appears
- [ ] Verify multi-level nesting (grandchildren) displays correctly

---

## Files Modified

- `apps/web/src/routes/catalog/+page.svelte` - Main catalog component
- `apps/web/src/lib/data/mock/seed.ts` - Updated seed groups to match spec


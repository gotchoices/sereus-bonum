# Spec: Account Groups Catalog

**Route:** `/catalog`  
**Status:** Draft

---

## Purpose

Manage the shared classification structure for organizing accounts (see [Account Groups](../global/account-groups.md)).

**Note:** This is the taxonomy/template itself, not the Accounts View (which shows entity accounts with balances).

---

## Display Layout

```
┌─────────────────────────────────────────────────────────┐
│ Account Groups Catalog                      [+ Add Group] │
├─────────────────────────────────────────────────────────┤
│ 💰 Assets                                    (5 groups) │
│   ▶ Current Assets                                      │
│       Cash & Bank                                       │
│       Receivables                                       │
│   ▶ Fixed Assets                                        │
│       Property & Equipment                              │
│       Vehicles                                          │
│   Other Assets                                          │
├─────────────────────────────────────────────────────────┤
│ 📋 Liabilities                               (3 groups) │
│   ...                                                   │
└─────────────────────────────────────────────────────────┘
```

**Visual Structure:**
- Account Type headers (Assets, Liabilities, etc.) always visible
- Parent groups show expand/collapse icon (▶/▼)
- Child groups indented beneath parents
- Leaf groups (no children) show no arrow
- Count shows number of groups per type

---

## User Actions

### Add New Group

**Trigger:** Click "[+ Add Group]" button

**Modal fields:**
- **Name:** Required
- **Type:** Dropdown (Asset, Liability, Equity, Income, Expense)
- **Parent:** Optional dropdown (shows groups of selected type only, includes "None - top level")
- **Description:** Optional

**Behavior:**
- Parent dropdown updates when Type changes
- Save creates group and refreshes list
- Cancel closes without saving

### Edit Group

**Trigger:** Right-click group → "Edit"

**Modal:** Same as Add, pre-filled

**Restrictions:**
- Cannot change Type (would orphan children)
- Cannot change Parent (would break hierarchy)
- Can change Name and Description

### Add Child Group

**Trigger:** Right-click parent group → "Add Child"

**Modal:** Same as Add, but Type and Parent locked (inherited)

### Delete Group

**Trigger:** Right-click group → "Delete"

**Confirmation:** Shows group name, warns about entity usage

**Restrictions:**
- Cannot delete if entities have accounts in this group
- Shows count: "3 entities have accounts in this group"
- Must reassign accounts first

### Expand/Collapse

**Trigger:** Click parent group row

**Behavior:**
- Toggles child visibility
- Icon changes: ▶ ↔ ▼
- State persists in local storage (key: `bonum-catalog-expand-{typeId}`)

---

## Empty States

**No groups of a type:**
```
💰 Assets                                               (0 groups)
  No asset groups yet. Create one to get started.
```

**Fresh install:** System seeds with standard groups (see [Account Groups](../global/account-groups.md#initial-seed-groups))

---

## Context Menu

Right-click any group:
- **Edit** — Edit name/description
- **Add Child** — Create child (inherits type)
- **Delete** — Remove (with usage warnings)

---

## Future Enhancements

**Drag to Reorder:** Reorder within same parent/type (not in MVP)

**Import/Export:** JSON export, standard templates (GAAP, IFRS), share custom catalogs

**Search/Filter:** Search by name, filter by type, show only groups with accounts

---

## References

- Account Groups structure: [global/account-groups.md](../global/account-groups.md)
- Schema: [AccountGroup](../../../docs/schema.md#accountgroup)

---

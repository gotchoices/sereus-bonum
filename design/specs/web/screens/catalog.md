# Spec: Account Groups Catalog

**Route:** `/catalog`

## Purpose

The Account Groups Catalog manages the shared classification structure for organizing accounts. This is the taxonomy that all entities use when creating their chart of accounts.

**Note:** This is *not* the Accounts View (which shows an entity's accounts with balances). This is the template/taxonomy itself.

## What Are Account Groups?

**Account Groups** are categories for organizing accounts:
- Examples: "Cash & Bank", "Current Assets", "Credit Cards", "Payroll Expenses"
- Every group belongs to one of five **Account Types**: Asset, Liability, Equity, Income, Expense
- Groups can have **child groups** for finer classification
  - "Current Assets" → "Cash & Bank", "Receivables"
  - "Fixed Assets" → "Property & Equipment", "Vehicles"
- Groups are shared across all entities — they're the organizational structure, not the accounts themselves
- When an entity creates an account, they select which group it belongs to

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
│   Investments                                           │
│   Other Assets                                          │
├─────────────────────────────────────────────────────────┤
│ 📋 Liabilities                               (3 groups) │
│   ...                                                   │
└─────────────────────────────────────────────────────────┘
```

**Hierarchy:**
- Account Type headers (Assets, Liabilities, etc.) always visible
- Parent groups can be expanded/collapsed (show ▶ or ▼ icon)
- Child groups indented underneath parents
- Leaf groups (no children) show no expand arrow
- Count shows number of groups per type

## User Actions

### Add New Group

**Trigger:** Click "[+ Add Group]" button in header

**Modal appears:**
```
┌─────────────────────────────────────────┐
│ Add Account Group                    ✕  │
├─────────────────────────────────────────┤
│ Name:        [________________________] │
│ Type:        [Assets            ▼]      │
│ Parent:      [Current Assets    ▼]      │
│              (or "None - top level")    │
│ Description: [________________________] │
├─────────────────────────────────────────┤
│                    [Cancel] [Save]      │
└─────────────────────────────────────────┘
```

**Fields:**
- **Name:** Required, text input
- **Type:** Dropdown (Asset, Liability, Equity, Income, Expense)
- **Parent:** Optional dropdown showing groups of selected type only
  - Includes "None - top level" option
- **Description:** Optional, multi-line text

**Behavior:**
- Parent dropdown updates when Type changes (only shows groups of that type)
- Save creates the group and refreshes the list
- Cancel closes modal without saving

### Edit Existing Group

**Trigger:** Right-click group → "Edit" from context menu

**Modal appears:** Same as Add, but pre-filled with current values

**Restrictions:**
- Cannot change Type (would orphan child groups)
- Cannot change Parent (would break hierarchy)
- Can change Name and Description

### Add Child Group

**Trigger:** Right-click parent group → "Add Child" from context menu

**Modal appears:** Same as Add, but:
- Type is pre-selected and locked (inherits from parent)
- Parent is pre-selected and locked (the group you right-clicked)
- Only Name and Description are editable

### Delete Group

**Trigger:** Right-click group → "Delete" from context menu

**Confirmation dialog:**
```
Delete "Cash & Bank"?

This will remove the group from the catalog.
Entities cannot assign accounts to deleted groups.

[Cancel] [Delete]
```

**Restrictions:**
- Cannot delete if any entity has accounts assigned to this group
- Shows warning with count: "3 entities have accounts in this group"
- Must reassign or delete those accounts first

### Expand/Collapse Groups

**Trigger:** Click parent group row

**Behavior:**
- Toggles visibility of child groups
- Icon changes: ▶ (collapsed) ↔ ▼ (expanded)
- Leaf groups (no children) have no icon and no click action
- Expansion state persists (saved in local storage)

## Example Hierarchy

```
Assets (type header)
├── Current Assets (parent, expandable)
│   ├── Cash & Bank (child, leaf)
│   └── Receivables (child, leaf)
├── Fixed Assets (parent, expandable)
│   ├── Property & Equipment (child, leaf)
│   └── Vehicles (child, leaf)
├── Investments (top-level, leaf)
└── Other Assets (top-level, leaf)

Liabilities (type header)
├── Current Liabilities (parent, expandable)
│   ├── Credit Cards (child, leaf)
│   └── Payables (child, leaf)
└── Long-term Debt (parent, expandable)
    └── Loans & Mortgages (child, leaf)
```

## Empty States

**No groups of a type:**
```
💰 Assets                                               (0 groups)
  No asset groups yet. Create one to get started.
```

**Fresh install:**
- System should seed with standard chart of accounts template
- User can modify/extend as needed

## Context Menu

Right-click any group shows:
- **Edit** — Edit name/description
- **Add Child** — Create child group (inherits type)
- **Delete** — Remove group (with warnings if in use)

## Persistence

**Expansion state:**
- Saved per user in browser local storage
- Key pattern: `bonum-catalog-expand-{typeId}`
- Survives page refresh

## Future Enhancements

**Drag to Reorder:**
- Drag groups to change display order
- Can only reorder within same parent and type
- Not in MVP

**Import/Export:**
- Export catalog as JSON
- Import standard templates (GAAP, IFRS)
- Share custom catalogs

**Search/Filter:**
- Search groups by name
- Filter by type
- Show only groups with accounts assigned

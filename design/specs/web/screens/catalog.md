# Account Catalog Screen

Route: `/catalog`

## Purpose

This screen displays the **Account Groups Catalog** — the shared classification structure for organizing accounts. Account groups are hierarchical and apply across all entities.

This is *not* the Accounts View (which shows an entity's accounts with balances). This is the taxonomy itself.

## Key Concepts

- **Account Groups** are categories for organizing accounts (e.g., "Cash & Bank", "Current Assets")
- Groups belong to one of five **Account Types**: Asset, Liability, Equity, Income, Expense
- Groups can have **child groups** for finer classification (e.g., "Current Assets" → "Cash & Bank", "Receivables")
- Groups with children are expandable; **leaf groups show no expand arrow**
- Groups are shared across all entities — they define the chart of accounts structure

## Layout

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

## Interactions

### Add Group (header button)
- Opens inline modal/popup
- Fields: Name (required), Account Type (dropdown), Parent Group (optional dropdown, filtered by selected type)
- On save: Creates group, refreshes list, closes modal

### Context Menu (right-click on any group)
- **Edit**: Opens edit modal with current values
- **Add Child**: Opens add modal with parent pre-selected and type locked
- **Delete**: Confirms, then deletes (prevented if group has accounts assigned)

### Expand/Collapse
- Click parent group row to toggle children visibility
- No arrow shown for leaf groups (groups with no children)

### Future: Drag to Reorder
- Drag groups to reorder within same parent
- Not implemented in MVP

## Add/Edit Modal

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

- Type dropdown disabled when adding a child (inherited from parent)
- Parent dropdown only shows groups of the selected type
- Parent dropdown disabled when editing (can't move groups between parents)

## Data Model

```typescript
interface AccountGroup {
  id: string;
  name: string;
  accountType: AccountType;
  parentId?: string;        // If set, this is a child group
  description?: string;
  displayOrder?: number;
}
```

## Sample Hierarchy

```
Assets (type)
├── Current Assets (parent group)
│   ├── Cash & Bank (child)
│   └── Receivables (child)
├── Fixed Assets (parent group)
│   ├── Property & Equipment (child)
│   └── Vehicles (child)
├── Investments (leaf - no children)
└── Other Assets (leaf - no children)

Liabilities (type)
├── Current Liabilities (parent)
│   ├── Credit Cards (child)
│   └── Payables (child)
└── Long-term Debt (parent)
    └── Loans & Mortgages (child)
```

## Notes

- This screen manages the taxonomy, not the accounts themselves
- Changes here affect all entities that use these groups
- Deleting a group with assigned accounts should warn/prevent

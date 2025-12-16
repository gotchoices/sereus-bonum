# Spec: Account Groups

**Type:** Global Data Structure  
**Status:** Draft

---

## Purpose

Account Groups are shared classification categories that organize accounts across all entities. They provide the taxonomy that entities use when creating their chart of accounts.

---

## Structure

**Account Groups:**
- Shared across all entities (not entity-specific)
- Every group belongs to one of five **Account Types**
- Groups can have **parent-child hierarchy** for finer classification
- Transactions post to Accounts (which belong to groups), never directly to groups

**Account Types (5 fundamental types):**
- **Asset:** Resources owned (debit increases)
- **Liability:** Obligations owed (credit increases)
- **Equity:** Owner's stake (credit increases)
- **Income:** Revenue earned (credit increases)
- **Expense:** Costs incurred (debit increases)

---

## Hierarchy

**Rules:**
- Groups can have `parentId` pointing to parent group
- Parent and child must share same Account Type
- Multiple nesting levels supported
- Top-level groups have no parent

**Full Path Notation:**
- Colon-separated: "Assets:Current Assets:Cash & Bank"
- Used in dropdowns, imports, and display

---

## Initial Seed Groups

**Fresh Install:**
System seeds with standard hierarchy:

```
Assets (top-level, type: ASSET)
├── Current Assets
│   ├── Cash
│   ├── Bank
│   ├── Private Credit
│   ├── Reimbursements
│   └── Receivables
├── Fixed Assets
│   ├── Real Property
│   ├── Equipment
│   └── Vehicles
├── Product
│   ├── Inventory
│   ├── Jobs in Process
│   └── Work in Process
└── Other Assets

Liabilities (top-level, type: LIABILITY)
├── Current Liabilities
│   ├── Credit Cards
│   ├── Accounts Payable
│   └── Payroll Payable
├── Deposits
├── Long-term Debt
│   ├── Loans
│   └── Mortgages
└── Other Liabilities

Equity (top-level, type: EQUITY)
├── Adjustments
├── Member Capital
└── Net Income Allocations

Income (top-level, type: INCOME)
├── Sales
├── Employment
├── Reimbursements
└── Adjustments

Expenses (top-level, type: EXPENSE)
├── Fixed
├── Variable
├── Interest
└── Tax
```

**User can:**
- Modify/delete seed groups (except if accounts exist in them)
- Add new groups at any level
- Customize for their needs (business vs personal)

---

## Constraints

**Creation:**
- Name required (unique within parent + type)
- Type required (one of 5)
- Parent optional (must match type if specified)

**Modification:**
- Cannot change Type (would orphan children)
- Cannot change Parent (would break hierarchy)
- Can change Name and Description

**Deletion:**
- Cannot delete if any entity has accounts in this group
- Shows count of affected entities
- Must reassign accounts first

---

## References

- Schema: [AccountGroup](../../../docs/schema.md#accountgroup)
- UI: [Catalog Screen](../screens/catalog.md)

---


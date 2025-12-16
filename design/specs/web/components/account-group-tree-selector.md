# Spec: Account Group Tree Selector

**Type:** Reusable Component  
**Scope:** Web  
**Status:** Draft

---

## Purpose

Hierarchical tree selector for choosing account groups from the shared taxonomy (see [Account Groups](../global/account-groups.md)).

---

## What User Sees

**Display:**
- Expandable tree organized by account type (Asset, Liability, etc.)
- Parent groups with expand/collapse icon (▶/▼)
- Child groups indented beneath parents
- Full hierarchical path shown on hover

**Interaction:**
- Click parent → expand/collapse children
- Click leaf → select and close
- Type to filter visible options
- Selected group highlighted

---

## Usage Context

- Import mapping screen (selecting target group)
- Account creation/editing (assigning to group)
- Any flow requiring group selection

---

## References

- Account Groups structure: [global/account-groups.md](../global/account-groups.md)
- Used in: [Import Screen](../screens/import.md)
- Used in: [Catalog Screen](../screens/catalog.md)

---

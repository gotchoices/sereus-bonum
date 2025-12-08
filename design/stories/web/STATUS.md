# Web Stories Status

## Active Stories (MVP)

| # | Story | Status |
|---|-------|--------|
| 01 | [First Look](./01-firstlook.md) | draft |
| 02 | [GnuCash Import](./02-gnucash.md) | draft |
| 03 | [Manual Entries](./03-entries.md) | draft |
| 04 | [Reports and Views](./04-reporting.md) | draft |
| 05 | [Reconciliation](./05-reconciliation.md) | draft |

---

## Future Stories (Post-MVP)

These are placeholder outlines for features not in initial scope. They will be expanded into full stories when prioritized.

---

### F1: Partners (Vendors, Customers, Employees)

**Status:** Stub — not in MVP

**Overview:**
Manage external parties the entity does business with.

**Key Points:**
- Create/edit partner records with name, contact info, tax ID
- Partner types: Vendor, Customer, Employee, Other (advisory, not restrictive)
- Link partners to AR/AP accounts
- Tax ID required for 1099 reporting (not enforced, but flagged if missing)

**Open Questions:**
- Should Partners and Entities share a common table (internal vs external parties)?
- Or keep Partners as a separate table with different semantics?

**Screens Implied:**
- Partner list
- Partner detail/edit form
- Partner selector (in account and transaction contexts)

---

### F2: Invoices (Bills)

**Status:** Stub — not in MVP

**Overview:**
Track invoices received from vendors (accounts payable).

**Key Points:**
- Invoice record: number, date, due date, partner, total amount
- Links to an AP account and creates a transaction (credit AP, debit expense/asset accounts)
- Invoice can have multiple line items (split transaction)
- Attach scanned/photographed invoice image to record
- Track payment status: unpaid, partial, paid

**Data Model Notes:**
- Invoice entity with FK to Partner and Transaction
- Attachment storage (defer to Sereus file handling or external reference)

**Screens Implied:**
- Invoice list (filterable by status, partner, date)
- Invoice entry form
- Invoice detail with attached image

---

### F3: Paying Vendors

**Status:** Stub — not in MVP

**Overview:**
Record payments to vendors against outstanding invoices.

**Key Points:**
- Select vendor, see outstanding invoices
- Create payment transaction: credit Cash/Bank, debit AP
- Link payment to one or more invoices
- Partial payments supported
- Future: integrate with electronic payment systems (ACH, bill pay)

**Screens Implied:**
- Pay vendor wizard
- Outstanding invoices selector
- Payment confirmation

---

### F4: 1099 Vendor Summary Report

**Status:** Stub — not in MVP

**Overview:**
Generate annual summary of payments to vendors for tax reporting (1099-MISC, 1099-NEC).

**Key Points:**
- Sum all payments to each vendor with AP activity for the year
- Filter by minimum amount (e.g., $600 threshold)
- Flag vendors missing tax ID
- Include: vendor name, tax ID, total paid, address
- Export to CSV or PDF

**Screens Implied:**
- Report configuration (year, minimum amount filter)
- Report view with flagged issues
- Export options

---

## Notes

- These stubs capture intent and key points only
- Full stories with sequences and acceptance criteria will be written when features are prioritized
- Schema implications (Partner entity, Invoice entity) should be considered during design phase


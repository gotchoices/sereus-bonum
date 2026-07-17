# Web Stories Status

This file is the single source of truth for **which web stories exist and their reading order**.
Keep it in sync whenever a story is added, renamed, or promoted.

## Stories

| # | Story | Scope | Status |
|---|-------|-------|--------|
| 01 | [First Look](./01-firstlook.md) | MVP | draft |
| 02 | [GnuCash Import](./02-gnucash.md) | MVP | draft |
| 03 | [Manual Entries](./03-entries.md) | MVP | draft |
| 04 | [Reports and Views](./04-reporting.md) | MVP | draft |
| 05 | [Reconciliation](./05-reconciliation.md) | MVP | draft |
| 06 | [Transaction Search](./06-search.md) | MVP | draft |
| 07 | [AI Assistant](./07-ai-assistant.md) | Post-MVP (phased) | draft |
| 08 | [Multiple Units of Account](./08-multi-unit.md) | Core capability | draft |
| 09 | [AI-Assisted Capture & Import](./09-ai-capture-import.md) | Post-MVP | draft / exploratory |

---

## Known Gaps (tracked)

Findings from the July 2026 review, with current status.

1. ✅ **Acceptance criteria filled for stories 01–03** (a few basics each, harmonious with the
   narrative). 04–07 already had them.
2. **Keep this index in sync.** Any new/renamed story must be reflected in the table above.
3. 🔄 **Variants / error coverage — template established.** Stories 01–03 and 08–09 now carry a
   `happy / empty / error` Variants section demonstrating how errors read (user-observable outcomes,
   not exhaustive). Remaining to extend the same pattern: **04, 06, 07** (05 already narrates
   mismatch paths). A dedicated **sync-conflict** path is still unwritten and belongs wherever
   multi-user sharing lands (see gap 4).
4. **Missing capability stories:**
   - ✅ **Multi-currency / units / exchange** — added as story 08 (to the many-units limit:
     CHIPs/Taleus/Sereus).
   - ✅ **AI capture & import** — added as story 09 (receipts/bills + arbitrary-source import).
   - ⬜ **Multi-user / Sereus sharing** — still unwritten; the headline differentiator. Would also
     host the sync-conflict variant from gap 3.
   - ⬜ **Tags** — schema has a `Tag` entity and story 06 references them; no story introduces them.
5. **Mild "how" leakage.** A few stories drift into UI mechanics (belongs in specs) — most notably
   the AI conversation-interface detail in story 07. Trim toward "what happens" when revising.
6. ✅ **Fixed:** story 07 pointed to `components/ai-wizard.md`; corrected to `components/ai-assistant.md`.

---

## Future Stories (Post-MVP)

Placeholder outlines for features not in initial scope. Expanded into full stories when prioritized.

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

- These stubs capture intent and key points only.
- Full stories with sequences and acceptance criteria will be written when features are prioritized.
- Schema implications (Partner entity, Invoice entity) should be considered during design phase.

# Web Stories Status

This file is the single source of truth for **which web stories exist and their reading order**.
Keep it in sync whenever a story is added, renamed, or promoted.

## Stories

| # | Story | Scope | Status |
|---|-------|-------|--------|
| 01 | [First Look](./01-firstlook.md) | MVP | draft — acceptance criteria missing |
| 02 | [GnuCash Import](./02-gnucash.md) | MVP | draft — acceptance criteria missing |
| 03 | [Manual Entries](./03-entries.md) | MVP | draft — acceptance criteria missing |
| 04 | [Reports and Views](./04-reporting.md) | MVP | draft |
| 05 | [Reconciliation](./05-reconciliation.md) | MVP | draft |
| 06 | [Transaction Search](./06-search.md) | MVP | draft |
| 07 | [AI Assistant](./07-ai-assistant.md) | Post-MVP (phased) | draft |

---

## Known Gaps (tracked)

Findings from the July 2026 review. These are **not yet fixed** — captured here so they aren't lost.

1. **Acceptance criteria are placeholder stubs in stories 01–03.** They still contain the
   template bullets (`<specific, testable criterion>`). Stories 04–07 have real, testable
   criteria; back-fill 01–03 to match. Highest priority.
2. **Keep this index in sync.** The prior version listed only 01–05; stories 06 and 07 existed
   but were absent. Any new/renamed story must be reflected here.
3. **No Variants / error + empty coverage.** No story has a `happy / empty / error` Variants
   section, and error paths are largely unnarrated. This is out of step with the
   Production/Industrial-strength posture in `design/specs/project.md`, which explicitly requires
   graceful handling of corrupted imports, partial data, and sync conflicts. Add at least:
   corrupt/malformed import file (story 02), and a sync-conflict path.
4. **Missing capability stories** (schema/specs assume them, but no narrative exists to infer UI):
   - **Multi-currency / units / exchange** — a core pillar (see `docs/Units-and-Exchange.md`), but
     no story exercises a foreign-currency or inventory entry, or setting an exchange rate.
   - **Multi-user / Sereus sharing** — the headline differentiator (story 02 overview mentions
     "multi-user access"; settings mentions cadre/partner nodes) but no story dramatizes sharing
     books with an accountant/partner.
   - **Tags** — schema has a `Tag` entity and story 06 references them ("when tags are
     implemented"), but no story introduces them.
5. **Mild "how" leakage.** A few stories drift into UI mechanics (belongs in specs) — most notably
   the AI conversation-interface detail in story 07. Trim toward "what happens" when revising.
6. **Fixed:** story 07 pointed to `components/ai-wizard.md`; corrected to `components/ai-assistant.md`.

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

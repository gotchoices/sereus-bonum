# Bonum Project Status

## Legend
- ⬜ Todo
- 🔄 In Progress
- ✅ Completed
- ❓ Needs Discussion

---

## Immediate Next Steps

### ✅ SQLite Mock Backend for Web

Spec complete: `design/specs/web/global/backend.md`

Uses sql.js with localStorage persistence. Single config switch between mock/production. App code is backend-agnostic via DataService interface.

### ⬜ Generate Screen Index

Derive screen index from the 5 web stories. Create as consolidation in `design/generated/web/screens/index.md`. Human specs will be added in `design/specs/web/screens/` after reviewing first pass.

### ⬜ Generate Navigation Consolidation

Create navigation structure in `design/generated/web/navigation.md` based on story analysis. This is a multi-window desktop paradigm, not hierarchical mobile navigation.

**Navigation concepts to address:**
- Standard hyperlink following (replaces current view)
- Launch in new window/panel
- Launch in new window that is reactive to source (linked views)
- When/how reactive linking is valid

---

## Documentation

- ✅ Split original Schema.md into Vision, Requirements, Schema
- ✅ Create Glossary with key terms
- ✅ Create STATUS.md (this file)
- 🔄 Formalize all entity definitions in Schema.md
- ⬜ Enhance root README with proper structure

---

## Open Schema Questions

These items require decisions before the schema is finalized.


### 🔄 Q1: Generalized Units and Exchange Model

**Status:** Under active exploration in [Units-and-Exchange.md](Units-and-Exchange.md)

**Key insight:** Currencies are just units. A balance sheet is an inventory of units, valued at render time. This generalizes to inventory, crypto, securities, and alternative currencies like MyChips.

**Proposed approach:**
- Rename Currency → Unit (any measurable thing)
- Each Account has a `unit`
- Entries record quantity in the account's unit
- Multi-unit transactions generate explicit Exchange records
- Rates are derived from transactions (cost basis), not external feeds
- Balance sheets are rendered in a chosen display unit

**Sub-questions:** See U1–U5 in Units-and-Exchange.md

---

### ✅ Q2: Tag Hierarchy Depth

**Decision:** Allow arbitrary nesting via `parentId`. No depth limits enforced.

**Rationale:** Hierarchy is opt-in. If you never set `parentId`, tags are flat — zero overhead. When used, hierarchy enables roll-up reports and cleaner organization. Let usage patterns emerge.

---

### ✅ Q3: BusinessUnit vs. "Entity" Naming

**Decision:** Rename to `Entity`.

**Rationale:** "BusinessUnit" sounds corporate and awkward for personal finance. "Entity" is general, accurate, and commonly used in accounting ("reporting entity").

---

### ✅ Q4: AccountGroup Scope

**Decision:** AccountGroups are global (shared across all entities).

**Rationale:** Users can define a broad cross-section and use the ones they need in each entity. Simpler and ensures consistency.

---

### ✅ Q5: Partner Scope

**Decision:** Partners are global. Accounts (per-Entity) link to Partners.

**Rationale:** Define a partner once, link to multiple accounts as needed. A partner can:
- Link to accounts in multiple entities
- Have both AR and AP accounts (customer who is also a vendor)
- Have multiple roles (customer, employee, supplier)

The `Partner.type` field (VENDOR, CUSTOMER, BOTH) is advisory; the actual relationship is defined by which accounts link to the partner.

---


### ✅ Q6: Closed Date Semantics

**Decision:**
- `closedDate` blocks new entries on that date and all earlier dates (`date <= closedDate`)
- Modifications to existing entries on or before `closedDate` are also blocked
- No Entity-level `closedDate` field — derive it by scanning accounts (avoids source-of-truth conflict)

**Rationale:** Simple, clear rule. Entity closure is computed, not stored, so there's no risk of Account and Entity dates disagreeing.

---

### ✅ Q7: Imbalance Handling

**Decision:** Each Entity has a system "Imbalance" account (type IMBALANCE or null).

**Use cases:**
- Partial entries when user doesn't know the full story yet
- Imports that can't fully categorize transactions
- Quick entry with deferred classification

**Behavior:**
- Reports flag the Imbalance category prominently
- Business rule: cannot close a period if Imbalance account has a balance
- User cleans up by moving entries to proper accounts

**Note:** IMBALANCE may be a sixth pseudo-type, or Imbalance accounts can have `accountType: null` to distinguish them from the standard five.

---

### ✅ Q8: Audit Trail Requirements

**Decision:** Permissive for now; defer formal audit trail.

**Behavior:**
- Open periods: Entries can be freely edited
- Closed periods: Use reversing transactions (standard accounting practice)
- Discipline is left to the user

**Future option:** If audit trail is needed, implement via triggers (behind the scenes logging). Sereus/Quereus may provide transaction logs at the infrastructure level.

**Rationale:** Keep schema simple. Don't over-engineer. Add audit infrastructure when/if required.

---

## Completed Decisions

### ✅ D1: Entry Amount Representation

**Decision:** Use a single signed `amount` field.
- Positive values = debit
- Negative values = credit

**Rationale:** The two approaches are informationally equivalent. Signed amounts are more compact and simplify balance calculations (just sum). The UI can present traditional debit/credit columns as a display choice.

---

### ✅ D2: Entry-Level Tags (not Transaction-Level)

**Decision:** Tags are assigned at the Entry level, not the Transaction level.

**Rationale:** Supports split transactions where one disbursement covers multiple purposes. Example: an installer logs fuel, lodging, and parts on one reimbursement — all debits go to "Jobs in Process" but need separate tags for cost analysis.

---

### ✅ D3: Naming — "Tag" instead of "Category"

**Decision:** Rename "Category" to "Tag" to distinguish from "AccountGroup."

**Rationale:** Both "AccountGroup" and "Category" could be called categories in plain English. "Tag" is clearly distinct, short, and universally understood as a classification label.

---

### ✅ D4: Field Naming — memo vs note

**Decision:** Use `memo` for Transaction-level description, `note` for Entry-level detail.

**Rationale:** Distinguishes the two fields clearly. Transaction.memo = "what is this transaction about"; Entry.note = "specifics about this line item."

---

### ✅ D5: Integer Amounts with displayDivisor

**Decision:** Store all amounts as integers in the smallest indivisible unit. `Unit.displayDivisor` tells the UI how to render (divide stored value by this for display).

**Examples:**
- USD (displayDivisor: 100): $10.50 stored as 1050
- BTC (displayDivisor: 100000000): 1 BTC stored as 100000000
- widget (displayDivisor: 1): 10 widgets stored as 10
- labor-minute (displayDivisor: 60): 2.5 hours stored as 150 minutes
- egg (displayDivisor: 12): 3 dozen stored as 36

**Rationale:** Exact integer arithmetic. Using a divisor (not decimalPlaces) supports non-base-10 units like time (60) or dozens (12).

---

## Future Design Questions

These emerged from our discussion but are deferred for future iterations.

### ❓ F1: Attachments

**Issue:** Users will want to attach receipts, invoices, and scanned documents to transactions.

**Options:**
- Attachment entity with FK to Transaction (or Entry)
- Defer to Sereus file handling
- Just store external URLs/references

### ❓ F2: Recurring Transactions

**Issue:** Monthly rent, subscriptions, payroll need templates that generate transactions.

**Possible schema:**
- RecurringTemplate entity with schedule, accounts, amounts
- System generates Transactions on schedule or prompts user

### ❓ F3: Job/Project Entity

**Issue:** "Jobs in Process" is an AccountGroup, but proper job costing may need a Job entity to:
- Group related transactions across accounts
- Calculate profit per job
- Track percent completion

**Alternative:** Use Tags to group job-related entries. May be sufficient.

### ❓ F4: Invoice/Bill Entity

**Issue:** For formal AR/AP, an Invoice entity might be needed:
- Line items, due date, payment terms
- Status tracking (draft, sent, paid, overdue)
- Link payments to invoices

**Alternative:** Just use Transactions with metadata in reference/memo. May be sufficient for simple cases.

### ❓ F5: Opening Balances

**Issue:** How do you set initial balances when starting the system mid-year?

**Options:**
- Special "Opening Balance" transaction type
- Just use a regular transaction dated to period start
- Opening balance field on Account (but this conflicts with derived balances)

### ❓ F6: Default Accounts per Entity

**Issue:** Some accounts are special:
- Main checking/operating account
- Imbalance/suspense account
- Default income account
- Retained earnings

Should Entity have fields pointing to these, or just use naming conventions?

### ❓ F7: Transaction to Partner Shortcut

**Issue:** Currently Partner links to Account (for AR/AP). Should Transaction also have an optional `partnerId` for quick reference on any transaction?

**Trade-off:** Convenience vs. redundancy (partner already accessible via Entry → Account → Partner).

### ✅ F8: Account Hierarchy (not AccountGroup)

**Decision:** Added `parentId` to Account (not AccountGroup).

**Rationale:** Accounts are per-entity and benefit from hierarchy (e.g., "Bank of America" → checking, savings). AccountGroups are global/generic and stay flat.

**Constraints:**
- Parent must be same Entity, same AccountGroup
- Entries can post to any level
- Roll-up uses Exchange rates for mixed-unit children

### ❓ F9: Multi-Entity Consolidation

**Issue:** Requirements mention rolling up multiple entities into combined reports.

**Analysis:**

**Basic consolidation (no schema change needed):**
- Query across multiple entities, sum balances
- Exchange model handles currency conversion
- This is purely UI/UX — user selects which entities to consolidate

**Inter-entity elimination:**
- When consolidating, inter-entity balances should net to zero
- Added `linkedAccountId` to Account for tracking counterparts
- Consolidation report can:
  - Identify linked account pairs
  - Verify they balance (flag if not)
  - Eliminate them from consolidated totals

**Open questions:**
- Should we have an EntityGroup for defining consolidation sets?
- Should elimination be automatic or user-reviewed?

**Current approach:** `linkedAccountId` provides tracking; consolidation logic is in UI/reporting layer.

### ❓ F10: Inter-Entity Transactions

**Issue:** When Entity A owes Entity B money:
- Entity A: Liability "Due to Entity B"
- Entity B: Asset "Due from Entity A"

These SHOULD balance, but how do we ensure accuracy?

**Current approach (advisory):**
- `linkedAccountId` connects the two accounts
- User posts to each entity separately
- Consolidation report flags mismatches

**Future option (enforced):**
- Inter-entity transaction type that auto-creates entries in both entities
- Would require Transaction to span multiple entities (schema change)
- More complex but guarantees balance

**Best practice for now:**
1. Create linked accounts with clear naming
2. When posting inter-entity, post to both immediately
3. Run consolidation report to verify linked accounts balance
4. Resolve discrepancies before closing periods

---

### ❓ F11: Import Mapping

**Issue:** When importing from banks/CSV:
- Remember column mappings
- Auto-categorization rules (merchant → account/tag)
- Duplicate detection

Probably needs ImportProfile and ImportRule entities.

---

### ❓ F12: EntityGroup for Consolidation

**Issue:** Should there be an EntityGroup entity to define which entities consolidate together?

**Use case:** A user has 5 entities but only wants to consolidate 3 of them for a "family" report.

**Options:**
- EntityGroup entity with many-to-many relationship
- Just let UI handle ad-hoc selection at report time
- Entity has optional `parentEntityId` for formal hierarchy

Deferred — UI can handle ad-hoc selection for now.

---

## Import Implementation

### 🔄 GnuCash Import

**Status:** Parser prototype complete

**Completed:**
- ✅ Explored GnuCash XML format structure
- ✅ Created parser test at `test/manual/gnucash-parser.ts`
- ✅ Successfully parsed sample files (17K+ transactions)
- ✅ Documented format in `design/specs/import-books.md`

**TODO:**
- ⬜ Handle scheduled transactions (`gnc:template-transactions`)
- ⬜ Handle price database for multi-currency/securities
- ⬜ Handle lots (for cost basis tracking)
- ⬜ Add GnuCash SQLite format support (same entities, different storage)
- ⬜ Move parser to production library (`packages/import/`)
- ⬜ Build account mapping UI logic
- ⬜ Map GnuCash account types to Bonum account groups

**Account Type Mapping (draft):**
| GnuCash | Bonum |
|---------|-------|
| ROOT | (skip) |
| ASSET, BANK, STOCK, MUTUAL | Asset |
| LIABILITY, CREDIT, PAYABLE | Liability |
| EQUITY | Equity |
| INCOME | Income |
| EXPENSE | Expense |

### ⬜ QuickBooks IIF Import

- ⬜ Research IIF format structure
- ⬜ Create parser
- ⬜ Document format in `design/specs/import-books.md`

### ⬜ Transaction Import (CSV, QIF, QFX, OFX)

- ⬜ CSV with column mapping
- ⬜ QIF parser
- ⬜ OFX/QFX parser
- ⬜ Duplicate detection
- ⬜ Auto-categorization rules

See `design/specs/import-transactions.md` for format notes.

---

## Notes

- Original design document preserved at: `docs/Schema-original.md`
- UI/UX decisions are deferred to app-specific development
- Import specs at `design/specs/import-*.md`


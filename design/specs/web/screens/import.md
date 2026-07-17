# Spec: Import Screen

**Route:** `/import`  
**Status:** Draft

---

## Purpose

Entry point for importing data into Bonum - either creating new entities from external books or adding transactions to existing entities.

---

## Entry Points

### Import Books (New Entity or Re-Import/Merge)

**Trigger:** Global menu → "Import Books..."

**Context:** The target is either a **new** entity (first import) or an **existing** entity chosen by
the user (re-import to merge in updates — see [domain/import.md](../../domain/import.md) Merge Model).

### Import Transactions (Adds to Existing Entity)

**Trigger:** Entity context menu → "Import Transactions..."

**Context:** Requires entity selection, pre-fills target entity

---

## Workflow

### Step 1: File Selection Dialog

**User sees:**
- Target: a name field for a **new** entity, or a picker to choose an **existing** entity to merge into
  (Import Transactions always targets the pre-filled existing entity)
- File drop zone with browse button
- Indication of supported file types
- "Next" button (disabled until target + file provided)

**User action:**
- Name a new entity or choose an existing one to merge into
- Drag file or browse to select
- Click "Next" when ready

### Step 2: Account Mapping Review (conditional)

**Purpose:** User reviews and adjusts how imported accounts map to Bonum structure.

**When shown:** Only when one or more source accounts don't already resolve to a Bonum account. On a
repeat import where every source account is already resolved (by stored identity — see
[domain/import.md](../../domain/import.md) Identity persistence), this step is **skipped** and the user
goes straight to the transaction preview.

**Display Structure:**
- Scrollable list showing all accounts from import
- **Hierarchical organization:**
  - Top-level accounts at left edge
  - Sub-accounts indented beneath parents
  - Multi-level nesting preserved from import
  - Each account can be hovered over to reveal the full path and GUID.  This hover uses the same presentation method as hovering over an account in the [ledger](./ledger.md).
- **Columns shown:**
  - Source account path (from import file)
  - Transaction Count: how many transactions directly in this account (-, N/A, or similar for explicit placeholder accounts).  Right justified.
  - Proposed Target Group: Full account group path (hierarchical, see [Catalog](../screens/catalog.md) and [Schema](../../domain/schema.md#accountgroup))
  - Proposed Target Account: Entity-specific account path only (excluding group components)
  - Resolution status with visual indicator (non-interactive)
- **Excluded Accounts:**
  - Do not present the "Root Account" from specifically Gnucash import
  - Exclude any other account which does not contain transactions or children (can be done at parse time)

**Automatic Matching:**
- Placeholder accounts matching existing groups → mapped to group, no account.  Mark as resolved.
- Accounts under matched placeholders placed under the matched groups.  Use same account name for new account, mark as resolved.
- Accounts with no perfect match for a group → placed under partial-match group (e.g., "Assets") with account path preserved, mark as unresolved.
- GUID from import tracked behind scenes (not shown in UI).

**User Actions:**
- **Pick different group:** User can click on the selected target group and either type with [completion](../components/account-autocomplete.md) or optionally select a nearby pull-down icon to get a hierarchical expandable tree selector (see [Account Group Tree Selector](../components/account-group-tree-selector.md)) to search for a desired account group.  If the user types in a path for an account group that doesn't exist, the system will prompt for confirmation and then create it immediately (not waiting for import transaction).  Warn that this will affect all entities.  Manual selection of a target account group marks the line as resolved.
- **Change Account Path:** User can edit the path of the target account.  Typing validates account path syntax only (no autocomplete, as these accounts may not exist yet).  Resolved status blocked and shows visual warning until typed path is syntactically complete (colon-separated segments, no leading/trailing colons).
- **Mark rows as settled:** As long as selections are valid, user can toggle individual or multiple rows to indicate "I'm satisfied with this mapping"
  - Settled rows show checkmark on right
  - Prevents "Rescan" from modifying these rows
- **Rescan button:** Re-attempts automatic matching for unsettled rows only
  - Useful after user creates new account groups in separate window
- **"Import" button:** Enabled only when all accounts resolved

**Multi-Window Support:**
- User might have a separate Bonum window open to create new account groups
- A re-scan operation should pick up these changes from the database

### Step 3: Transaction Preview & Merge Review

**Purpose:** Before anything is written, show every source transaction and what the import will do
with it, so the user reviews and adjusts an effective **merge** into the target entity. Shown on every
import (on a first import into a new entity, everything is simply "new").

**Disposition** — each transaction is classified against the target's current books (rules in
[domain/import.md](../../domain/import.md) Merge Model):
- **Already imported** — a matching transaction already exists; will be skipped.
- **New** — no match, complete and balanced; will be created.
- **Incomplete** — no match, but missing/ambiguous info (unresolved offset account, missing amount or
  date, or entries that don't balance); must be completed before it can be created.

**Display:**
- Transactions grouped by disposition (**Incomplete** first, then **New**, then **Already imported**),
  with a count per group.
- **Already-imported transactions are hidden by default** — the preview shows only what will change
  (Incomplete + New), with the already-imported count summarized. A toggle ("Show already imported")
  reveals them so the full set can be inspected. Example: re-importing a 1,000-transaction file after
  adding 3 shows just the 3 new by default, and 1,003 when toggled on.
- Each row shows date, reference/memo, and amount; expandable to show its entries (same split
  presentation as the [ledger](./ledger.md)).
- Incomplete rows are flagged with what's missing.

**User actions:**
- **Complete an incomplete transaction:** edit it inline — assign the missing account via
  [autocomplete](../components/account-autocomplete.md), set amount/date — until it balances; it then
  moves to **New**.
- **Exclude / include:** a New transaction can be excluded from this import; an Already-imported one
  can be force-included (rare).
- **Import (Proceed):** enabled only when no **Incomplete** transactions remain unresolved (each must
  be completed or excluded).

### Step 4: Import Execution (Merge)

**Merge semantics:**
- Only **New** (and user-completed) transactions are written; **Already-imported** and **Excluded**
  are skipped.
- Any accounts the resolved mapping needs that don't yet exist are created first.
- Re-importing an unchanged source writes nothing (idempotent).

**Atomic:**
- The whole merge runs as a single database transaction.
- If any step fails, it rolls back; the preview/mappings are preserved so the user can fix and retry.
- The database is never left in a partial state.

**Identity persistence:**
- Source **transaction** identities (GnuCash GUID / OFX FITID) are stored with created transactions, so
  future imports classify them as already-imported.
- Source **account** identities (GUID) are stored with created accounts, so future imports resolve them
  automatically and skip the mapping step.

---

## Post-Completion Navigation

### Import Books Success

**User sees:**
- Momentary toast: Entity <name> created
- User is navigated to the Entity page (Trial Balance mode) as though they had clicked on the new entity

---

## References

- Detailed import behaviors: [domain/import.md](../../domain/import.md)
- User story: [stories/web/02-gnucash.md](../../../stories/web/02-gnucash.md)

---

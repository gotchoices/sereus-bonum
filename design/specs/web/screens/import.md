# Spec: Import Screen

**Route:** `/import`  
**Status:** Draft

---

## Purpose

Entry point for importing data into Bonum - either creating new entities from external books or adding transactions to existing entities.

---

## Entry Points

### Import Books (Creates New Entity)

**Trigger:** Global menu → "Import Books..."

**Context:** No entity needs to be selected

### Import Transactions (Adds to Existing Entity)

**Trigger:** Entity context menu → "Import Transactions..."

**Context:** Requires entity selection, pre-fills target entity

---

## Workflow

### Step 1: File Selection Dialog

**User sees:**
- Input field for new entity name (Import Books only)
- File drop zone with browse button
- Indication of supported file types
- "Next" button (disabled until name + file provided)

**User action:**
- Enter entity name (Books) or target entity is pre-filled (Transactions)
- Drag file or browse to select
- Click "Next" when ready

### Step 2: Account Mapping Review

**Purpose:** User reviews and adjusts how imported accounts map to Bonum structure.

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
  - Proposed Target Group: Full account group path (hierarchical, see [Catalog](../screens/catalog.md) and [Schema](../../../docs/schema.md#accountgroup))
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

### Step 3: Import Execution

**Atomic Transaction:**
Import executes as single database transaction:
1. Create entity
2. Create entity-specific account tree
3. Create all transactions

**Critical Constraint:**
- If any step fails, entire import rolls back
- Import dialog remains intact with user's mappings
- User can fix issue (e.g., adjust mappings) and retry "Import"
- Database never left in partial state (e.g., entity created but accounts missing)

**GUID Persistence:**
- GUIDs from imported book stored with created accounts
- Enables future "Import Transactions" from same source to auto-map without remapping

---

## Post-Completion Navigation

### Import Books Success

**User sees:**
- Momentary toast: Entity <name> created
- User is navigated to the Entity page (Trial Balance mode) as though they had clicked on the new entity

---

## References

- Detailed import behaviors: `global/import.md`
- User story: `stories/web/02-gnucash.md`

---

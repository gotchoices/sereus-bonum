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
- **Columns shown:**
  - Source account path (from import file)
  - Placeholder indicator (explicit or implicit)
  - Proposed target: account group + account (or group only)
  - Resolution status with visual indicator

**Automatic Matching:**
- Placeholder accounts matching existing groups → mapped to group (no account)
- Accounts with no perfect match → placed under partial-match group (e.g., "Assets") with account path preserved
- GUID from import tracked behind scenes (not shown in UI)

**User Actions:**
- **Mark rows as settled:** User can toggle individual or multiple rows to indicate "I'm satisfied with this mapping"
  - Settled rows show checkmark on right
  - Prevents "Rescan" from modifying these rows
- **Rescan button:** Re-attempts automatic matching for unsettled rows only
  - Useful after user creates new account groups in separate window
- **Edit mappings:** User can adjust target group/account for any row
- **"Import" button:** Enabled only when all accounts resolved

**Multi-Window Support:**
- User can open separate Bonum window to create new account groups
- Return to import screen and click "Rescan" to match against new groups

### Step 3: Import Execution

**Atomic Transaction:**
All operations execute as single database transaction:
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
- Entity name created
- Account count
- Transaction count
- Date range

**Buttons:**
- **"View Entity"** → Navigate to entity's accounts view
- **"Close"** → Dismiss dialog, stay on current screen

### Import Transactions Success

**User sees:**
- Transaction count imported
- Duplicates skipped (if any)
- Target account name

**Buttons:**
- **"View Ledger"** → Navigate to target account's ledger
- **"Close"** → Dismiss dialog, refresh current view

### With Warnings/Errors

**Additional option:**
- **"View Warnings"** → Expand panel showing details
- User can still proceed to view results or close

---

## References

- Detailed import behaviors: `global/import.md`
- User story: `stories/web/02-gnucash.md`

---

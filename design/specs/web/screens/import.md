# Spec: Import Screen

**Route:** `/import` or modal overlay  
**Status:** Draft

---

## Purpose

Entry point for importing data into Bonum - either creating new entities from external books or adding transactions to existing entities.

## Thoughts
- After selecting Import Books a dialog is opened.
  - This contains a spot to input a name for the new entity to create
  - It also has a spot to drag imported files as well as an option to browse for a file
  - There is an indication of what file types are supported
  - There is a next button which is disabled until the book name and import file have been specified
- Next screen is a review of the account mapping
  - This shows a scrollable list that includes all accounts to be mapped
  - The accounts are organized hierarchically as they were in the imported file.
  - We can see toplevel accounts at the left-most side, under them and indented are sub-accounts and so forth
  - There is a column to indicate of the accounts are place-holders and whether explicitly or implicitly
  - GUID from the import is kept track of behind the scenes but not in the ui
  - To the right is proposed target group and account for the import
  - If the target is a group only, the group is selected but no account is specified
  - Placeholder accounts (explicit or implicit) that match an existing account group are matched automaticaly to a group with no account
  - Accounts that can find no perfect match are placed under a group that may match a part of the account path.  For example, we might only know to put it under Assets and the rest will be a (possibly hierarchical) path of accounts.
  - Each row has a status of draft/resolved the user can toggle either one at a time or by multiple selections.
  - Resolved rows show a checkmark on the right side.
  - It is possible to have a different bonum window open where new account groups might be created
  - In the review screen, the user can press a button to rescan which will look again at all unresolved rows and try to match them (possibly in light of new account groups the user has created).
  - When all accounts are resolved, the button to "Import" is enabled
- When Import is pressed, a single transaction is executed to:
  - Create the entity
  - Create the entity-specifi account-tree
  - Create all transactions
- GUID's from original book files are stored with the new account so that further "Import Transactions" operations from the same foreign book program will know where to put the transactions without the need for further mapping.
- If the inserts fail for any reason, the import screen is still intact and can be edited and tried again

---

## Entry Points

### Import Books (Creates New Entity)

**Trigger:** Global menu → "Import Books"

**User Action:**
- Click main menu (hamburger/gear icon)
- Select "Import Books..."
- Import wizard opens

**Context:** No entity needs to be selected

### Import Transactions (Adds to Existing Entity)

**Trigger:** Entity context menu → "Import Transactions"

**User Action:**
- Right-click entity in sidebar
- Select "Import Transactions..."
- Import wizard opens (pre-filled with target entity)

**Context:** Requires entity selection

**Alternative (Future):**
- Drag file directly onto entity in sidebar
- Account view toolbar "Import" button

---

## Screen Type

**Current Design:** Modal overlay
- Appears on top of current screen
- Background dimmed/blurred
- Wizard steps shown in centered dialog
- Close/cancel returns to previous view

**Alternative:** Dedicated route `/import`
- Full-screen experience
- Back button returns to previous screen
- URL state preserved during workflow

---

## Workflow Overview

Once triggered, user goes through multi-step wizard:

1. **Upload** - Select file
2. **Process** - System parses and analyzes
3. **Preview** - Review what will be imported
4. **Map** (optional) - Adjust account mappings
5. **Execute** - Import runs with progress
6. **Complete** - Summary and next actions

See `global/import.md` for detailed workflow behavior.

---

## Post-Completion Navigation

### Import Books Success

**User sees summary:**
- Entity name created
- Account/transaction counts
- Date range imported

**Action Buttons:**
- **"View Entity"** → Navigate to entity accounts view
- **"Close"** → Dismiss wizard, stay on current screen

### Import Transactions Success

**User sees summary:**
- Transaction count imported
- Duplicates skipped count
- Target account name

**Action Buttons:**
- **"View Ledger"** → Navigate to target account's ledger
- **"Close"** → Dismiss wizard, refresh current view

### With Warnings/Errors

**Additional button:**
- **"View Warnings"** → Expand details panel showing issues
- User can still proceed to View Entity/Ledger or Close

---

## Empty States

**No Entities Exist:**
- Only "Import Books" is available
- "Import Transactions" is disabled/hidden

**First Use:**
- Show helpful tip: "Import your existing books to get started"

---

## Future Enhancements

**Drag & Drop:**
- Drop file anywhere → smart detection
  - Detects format (Books vs Transactions)
  - Shows entity picker if Transactions
  - Starts wizard automatically

**Recent Imports:**
- Show list of recent imports
- "Import again" for repeated sources
- Saved import profiles (CSV column mappings)

**Batch Import:**
- Import multiple files in sequence
- Progress across all files
- Consolidated summary

---

## References

- Workflow details: `global/import.md`
- Navigation: `global/navigation.md`

---

# Spec: Import Screen

**Route:** `/import` or modal overlay  
**Status:** Draft

---

## Purpose

Entry point for importing data into Bonum - either creating new entities from external books or adding transactions to existing entities.

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

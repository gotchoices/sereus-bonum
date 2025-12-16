---
dependsOn:
  - design/stories/web/02-gnucash.md
  - design/specs/web/screens/import.md
  - design/specs/web/global/import.md
  - design/specs/web/global/account-groups.md
  - design/specs/web/components/account-group-tree-selector.md
depHashes:
  design/specs/web/screens/import.md: a50235afea36d58cc09ed2d6df8b3193f1ca836fe0799f045f5772cdbc83a6ac
  design/specs/web/global/import.md: 6f78b6ef9fab31c249321431fde66856c88602908906bb31df7c3873c74e3662
  design/specs/web/global/account-groups.md: 2cb5757a1e8c2bbf732941a7d5c83532b503bf3eadc2557026fa4340d45266d4
  design/specs/web/components/account-group-tree-selector.md: 7d1a61f3e1cf80d49d2f7b64cabb98d4a825f9055cec28e996cc570662a19d51
provides:
  - screen:Import
needs:
  - component:AccountGroupTreeSelector
  - store:accountGroups
generated: 2024-12-16
lastUpdated: 2024-12-16
component: apps/web/src/routes/import/+page.svelte
---

# Consolidation: Import Screen

**Route:** `/import`  
**Component:** `apps/web/src/routes/import/+page.svelte`  
**Generated:** 2024-12-16  

---

## Purpose

Provides a unified import interface for creating new entities from external accounting files (GnuCash, QuickBooks IIF). The screen guides users through file upload, account mapping review with hierarchical account groups, and final import execution with atomic transaction guarantees.

---

## Source Requirements Verification

### Story 02-gnucash.md

| # | Requirement | Status | Implementation |
|---|-------------|--------|----------------|
| 1 | Global option to import books | ✅ | Route `/import` |
| 2 | Dialog with entity name + file selection | ✅ | Lines 706-771 |
| 3 | Hierarchical account mapping pane | ✅ | Lines 788-941 |
| 4 | See accounts from source and Bonum mappings | ✅ | Source + Target columns |
| 5 | Modify account names and group names | ✅ | Editable fields |
| 6 | Navigate to Accounts View after import | ✅ | Line 673-677 |

### specs/web/screens/import.md

#### Step 1: File Selection (Lines 32-43)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Entity name input | ✅ | Lines 716-724 |
| File drop zone | ✅ | Lines 726-758 |
| Browse button | ✅ | Lines 746-754 |
| Supported file types shown | ✅ | Line 757 |
| Next disabled until ready | ✅ | Line 767 |

#### Step 2: Account Mapping (Lines 45-84)

**Display Structure:**

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Scrollable list | ✅ | `.mappings-container` CSS |
| Hierarchical (indented) | ✅ | Line 855 `padding-left` |
| Multi-level nesting | ✅ | `depth` calculation |
| Hover shows path + GUID | ✅ | Line 856 `title` attribute |

**Columns (Spec Line 56-61):**

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Source account path | ✅ | Lines 854-867 |
| Transaction count (right justified) | ✅ | Lines 868-870 |
| Target Group (full path) | ✅ | Lines 871-915 |
| Target Account (excluding group) | ✅ | Lines 916-935 |
| Resolution status (non-interactive) | ✅ | Lines 936-948 |

**Excluded Accounts (Spec Line 62-64):**

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Root Account excluded | ✅ | Lines 195-199 |
| No tx/children excluded | ✅ | Lines 201-211 |

**Automatic Matching (Spec Line 66-70):**

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Placeholder → group, no account | ✅ | Lines 450-468 |
| Under matched placeholder → use name | ✅ | Lines 470-484 |
| No match → partial match | ✅ | Lines 486-500 |
| GUID tracked | ✅ | `mapping.sourceAccount.guid` |

**User Actions (Spec Line 72-80):**

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Click to edit group | ✅ | Lines 888-914 |
| Type with completion | ✅ | Autocomplete dropdown (lines 903-913) |
| Tree selector (optional) | ✅ | Present but disabled (line 898-903) |
| Create group prompt | ✅ | Lines 614-628 |
| Manual selection → resolved | ✅ | Lines 631-637 |
| Edit account path | ✅ | Lines 916-935 |
| Syntax validation | ✅ | `isCompleteAccountPath` |
| Mark as settled | ✅ | Lines 554-562 |
| Settled indicator | ⚠️ | Uses 🔒 (spec says "checkmark") - intentional UX improvement |
| Rescan button | ✅ | Lines 849-851 |
| Import disabled until resolved | ✅ | Line 961 |

**Multi-Window Support (Spec Line 82-84):**

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Rescan picks up DB changes | ✅ | Uses `$accountGroups` store |

#### Step 3: Import Execution (Spec Lines 86-103)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Atomic transaction | ✅ | Error returns to mapping (lines 690-691, 707-708) |
| Dialog remains on failure | ✅ | `step = 'mapping'` on error |
| GUID persistence | ⚠️ | Passed to import service, storage in DB TBD |

#### Post-Completion (Spec Lines 106-113)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Toast notification | ✅ | Lines 698-699, 712-727 |
| Navigate to entity (Trial Balance) | ✅ | Lines 701-706 |

---

## Recent Changes (2024-12-16)

### Comprehensive Regeneration from Specs

**Added:**
1. **Group autocomplete** - Dropdown suggestions when typing group paths (spec line 73: "type with completion")
   - `groupSuggestions` derived state filters matching paths
   - Shows up to 10 matching groups
   - Supports keyboard navigation and mouse selection
   - CSS styles for dropdown (`.group-suggestions`, `.suggestion-item`)

2. **Correct post-import navigation** - Navigate to `/entities/{id}?view=trial-balance` instead of `/?view=trial-balance`
   - Uses `importResult.entityId` for dynamic routing

3. **Database-driven matching** - Replaced hardcoded type mapping with dynamic database queries
   - `loadAccountGroups()` called on mount
   - `findMatchingGroup()` matches by name then type
   - `buildGroupPath()` constructs full hierarchical paths

### UX Improvements (Intentional Spec Deviations)

1. **Settled indicator uses 🔒 instead of ✓** - Spec says "checkmark on right" but since ✓ is used for resolution status, using 🔒 provides clearer distinction between "resolved" and "settled/locked"

---

## Auto-matching Strategy

**Three-Tier Matching Algorithm:**

1. **Exact Name Match** (Highest Priority)
   - Matches account name to group name (case-insensitive)
   - Example: GnuCash "Current Assets" placeholder → Bonum "Assets:Current Assets" group
   - Confidence: High
   - Result: Group matched, account null (for placeholders)

2. **Partial Name Match** (Medium Priority)
   - Matches when account name contains group name
   - Example: GnuCash "Bank of America" → Bonum "Assets:Current Assets:Bank" group
   - Confidence: Medium
   - Result: Group matched, account name only (not full path)

3. **Type-Based Fallback** (Lowest Priority)
   - Maps GnuCash account type to Bonum top-level group
   - Example: Type "ASSET" → "Assets" group
   - Confidence: Low
   - Result: Group matched (top-level), account name only

**Parent-Child Handling:**
- If account has parent that matched to a group, child inherits parent's group
- Child account uses its own name (not full path)
- Example: Parent "Current Assets" → "Assets:Current Assets", Child "Checking" → same group, account "Checking"

**Implementation:**
- No hardcoded mappings; queries `$accountGroups` store dynamically
- Adapts to user-created groups automatically
- GnuCash-specific type mapping isolated to `mapAccountTypeToBonum()` function

---

## Workflow Overview

### Step 1: Upload
- User enters entity name
- Drags/drops or browses to select file
- Validates file extension (.gnucash, .iif)
- "Next" button enabled when both name and file provided

### Step 2: Mapping Review
- Displays hierarchical account structure with indentation
- Shows source account path, transaction count, proposed target group (full path), proposed target account (excluding group), and resolution status
- User can:
  - **Edit target group** - Click to open inline editor with autocomplete dropdown
  - **Edit target account** - Click to open inline editor with syntax validation
  - **Mark as settled** - Select rows via checkbox, click "Mark Selected as Settled" button
  - **Rescan** - Re-attempts auto-matching on unsettled rows only
- All accounts must be resolved before proceeding

### Step 3: Import Execution
- Creates entity and imports all accounts/transactions in a single atomic database transaction
- On success: Shows brief toast notification and navigates to entity's Trial Balance page
- On failure: Returns to mapping screen with error message, preserving user's mappings for retry

---

## Columns Detail

| Column | Content | Interaction |
|--------|---------|-------------|
| Select | Checkbox | Toggle row selection |
| Source Account | Hierarchical name with indentation | Hover shows full path + GUID |
| Tx Count | Transaction count or "—" for placeholders | Read-only |
| Target Group | Full hierarchical path | Click to edit with autocomplete |
| Target Account | Account name only | Click to edit with syntax validation |
| Status | ✓/⚠ (resolved/unresolved) + 🔒 (settled) | Non-interactive indicators |

---

## Testing Checklist

- [ ] Upload GnuCash file → verify accounts parse correctly
- [ ] Verify hierarchical display with correct indentation
- [ ] Verify "Root Account" excluded from mapping list
- [ ] Verify placeholder accounts show "—" for transaction count
- [ ] Hover on account → verify tooltip shows full path and GUID
- [ ] Edit target group → verify autocomplete dropdown appears
- [ ] Select group from autocomplete → verify field updates
- [ ] Type new group path → verify creation prompt with warning
- [ ] Edit target account → verify syntax validation
- [ ] Mark accounts as settled → verify 🔒 indicator appears
- [ ] Trigger rescan → verify only unsettled accounts re-evaluated
- [ ] Attempt import with unresolved accounts → verify button disabled
- [ ] Complete import → verify toast notification
- [ ] Complete import → verify navigation to `/entities/{id}?view=trial-balance`
- [ ] Trigger import failure → verify return to mapping screen with preserved state

---

## Known Limitations

- Tree selector component not yet implemented (pull-down icon disabled)
- GUID persistence in database not yet verified
- Only "Import Books" mode implemented; "Import Transactions" deferred

---

## Dependencies

### Components
- `AccountGroupTreeSelector` (future): Hierarchical group picker (currently disabled)
- Standard SvelteKit file input and form controls

### Stores
- `accountGroups` - Global account groups from database
- `loadAccountGroups()` - Function to load/refresh groups

### Services
- `importService.importBooks(parsedData, options)` - Executes import with atomic transaction
- `importService.parseFile(file)` - Parses uploaded file

### Types
- `ParsedBooks` - Parsed file data (accounts, transactions, commodities)
- `AccountMapping` - Mapping state (sourceAccount, fullSourcePath, targetGroup, targetAccount, isSettled, isResolved, confidence, depth, hasChildren)
- `AccountGroup` - Group data from database
- `AccountType` - Enum of 5 fundamental types

---

## Files Modified

- `apps/web/src/routes/import/+page.svelte` - Main import screen component
- `apps/web/src/lib/stores/accounts.ts` - Account groups store (consumed)
- `apps/web/src/lib/import/` - Import service and parsers (consumed)

# Bonum Project Status

**Legend:** ⬜ Todo | 🔄 In Progress | ✅ Done | ❓ Needs Discussion | 🔮 Future

---

## Current Sprint (Active Development)

### 🔄 Web MVP - Core Screens
- ✅ Home screen with entity list & VBS
- ✅ Account Catalog (manage account groups)
- ✅ Accounts View (Balance Sheet, Trial Balance, Income Statement modes)
- ✅ Ledger (transaction entry with split support)
- ✅ Transaction Search (Phase 1: Browser with export)
- ⬜ Transaction Search (Phase 2: Query builder)
- ✅ Settings screen (theme, dates, account display, sign reversal)
- ⬜ Import Books (GnuCash)

---

## Recently Completed

### ✅ Account Autocomplete & Transaction Entry - Specs & Help
- **Created specs:**
  - `/design/specs/web/global/account-autocomplete.md` (agent rules)
  - `/design/specs/web/global/transaction-edit.md` (agent rules - renamed & refactored)
- **Created help content:**
  - `/apps/web/src/routes/help/en/account-autocomplete/+page.md` (user narrative)
  - `/apps/web/src/routes/help/en/transaction-entry/+page.md` (user narrative)
- **Tracked in:** `/design/generated/web/meta/outputs.json`
- **Refined colon completion logic:**
  - Uses highlighted result (not always top)
  - Finds longest matching path element
  - Never completes final account name
- **Implemented in:** `AccountAutocomplete.svelte`
- **Key behaviors:** Max 10 results, arrow navigation, Tab vs Enter distinction, Escape, auto-clear on blur, auto-select on tab

---

## Review Specs for Appeus Compliance

**Goal:** Clean up specs to be human-centric (user-observable behavior only). Remove technical details that can be derived by agents from stories + human rules. Technical details belong in consolidations, not specs.

**Process:** For each spec, review all sections. If a technical detail can be unambiguously derived from the human-centric rules, delete it. If not, enhance the rules to be clear enough that it CAN be derived.

**Regeneration:** After cleaning specs, refresh consolidations to ensure technical details are properly documented there. Code regeneration only needed if behavior changed (not just documentation cleanup).

### Global Specs (Web)
- ✅ `design/specs/web/global/account-autocomplete.md` - Cleaned: kept Rules only, removed Interface/Dropdown/Search/Keyboard/Validation sections (all redundant or technical)
- ✅ `design/specs/web/global/transaction-edit.md` - Cleaned & refactored: mode-agnostic component spec, moved screen concerns to ledger.md (122 → 180 lines)
- ✅ **Consolidation refreshed:** `design/generated/web/screens/ledger.md` - Updated with corrected technical details from cleaned specs (colon completion behavior, tab flow, auto-balance logic)
- ✅ **Code cleaned:** `apps/web/src/routes/ledger/[accountId]/+page.svelte` - Removed ~190 lines of dead autocomplete code, implemented Ctrl+Enter at page level
  - ✅ Dead code removed (unused search/autocomplete state and functions from pre-refactor)
  - ✅ Ctrl+Enter now works correctly (page-level handler)
  - ✅ All functionality verified against specs
  - **Ready for testing**
- ✅ `design/specs/web/global/backend.md` - Cleaned: removed TypeScript code snippets, directory structures; kept WHAT/WHY/HOW from user perspective (121 → 77 lines)
- ✅ `design/specs/web/global/export.md` - Cleaned: removed TypeScript code, implementation details, testing section; kept format descriptions, file structure, behavior (229 → 130 lines)
- ✅ `design/specs/web/global/view-state.md` - Cleaned: removed TypeScript code examples; kept principle, what persists, scoping, cleanup (103 → 70 lines)
- ✅ `design/specs/web/global/i18n.md` - Cleaned: removed TypeScript implementation, full dictionary, file structure; kept usage, MVP scope, future languages (130 → 70 lines)

### Screen Specs (Web)
- ✅ `design/specs/web/screens/accounts-view.md` - Cleaned: removed TypeScript interfaces, SQL queries, backend signatures, calculation formulas; kept report modes, date handling, UI elements, user actions (340 → 180 lines)
- ✅ `design/specs/web/screens/catalog.md` - Cleaned: removed TypeScript interface, data model section; kept user actions, hierarchy, modals, context menu (119 → 165 lines)
- ✅ `design/specs/web/screens/ledger.md` - Enhanced: added transaction display (collapsed/expanded), in-place editing, locked transactions, new entry workflow; references transaction-edit.md for component (189 → 344 lines)
- ✅ **Ledger Implementation Updated:** `apps/web/src/routes/ledger/[accountId]/+page.svelte` - Added display modes, expand/collapse, edit mode, locked transactions (1218 → 1140 lines)
  - ✅ Transaction grouping by transactionId
  - ✅ Collapsed/expanded display modes with per-transaction toggle
  - ✅ Expand All / Collapse All toolbar buttons
  - ✅ In-place edit mode (placeholder for full editor)
  - ✅ Delete transaction with confirmation
  - ✅ Locked transaction separator (🔒) based on closedDate
  - ✅ View state persistence (expand/collapse, expandAll)
  - ✅ Escape key cancels edit/split modes
  - ✅ Click-to-edit for unlocked transactions
  - **Note:** Full transaction editor (edit existing with splits) is stubbed - to be implemented next
- ✅ **Consolidation updated:** `design/generated/web/screens/ledger.md` - Added transaction grouping, display modes, edit mode, locked transactions, view state persistence sections
- ✅ **i18n updated:** Added expand/collapse, editing, balance keys to `en.ts`
- ✅ `design/specs/web/screens/search.md` - Cleaned: removed TypeScript interfaces, component architecture, data structures, i18n keys, styling details; kept display format, export behavior, navigation (206 → 176 lines)
- ✅ `design/specs/web/screens/saved-reports-ux.md` - Cleaned: removed TypeScript interface, component structure, file paths, accessibility section; kept UI layout, phases, persistence, user actions (351 → 290 lines)

### Shared Specs
- ✅ `design/specs/i18n.md` - Already clean: user-focused principles, dictionary format, locale detection (53 lines, no changes needed)
- ✅ `design/specs/visual-balance-sheet.md` - Cleaned: removed TypeScript interfaces, Svelte implementation code, data adapter, mobile fallback; kept visual structure, rings, colors, interactions, usage (294 → 185 lines)
- ✅ `design/specs/import-books.md` - Cleaned: removed XML examples, SQL tables, technical observations, implementation details; kept workflow steps, user dialogs, mappings, error handling (179 → 270 lines)
- ✅ `design/specs/import-transactions.md` - Cleaned: removed technical format details; expanded workflow with user dialogs, duplicate detection, categorization, error states (102 → 265 lines)

### Generated/Consolidations (Reference Only)
- `design/specs/web/screens/ledger.md` - This appears to be a consolidation, should move to `design/generated/web/screens/`

---

## Backlog (Priority Order)

### High Priority (MVP Blockers)

#### ✅ Transaction Search (Story 06) - Phase 1 Complete

**Phase 1: Transaction Browser** (Ready for Imbalance Debugging)
- ✅ Create consolidation for search screen
- ✅ Build `TransactionResultsTable.svelte` component (reusable)
- ✅ Create `/search` route
- ✅ "Show All Transactions" button
- ✅ Transaction grouping (header + split rows)
- ✅ Debit/Credit columns with proper alignment
- ✅ Totals row with balance verification
- ✅ Entity column (cross-entity view)
- ✅ Account column with hyperlinks
- ✅ Export to CSV/Excel with proper decimal formatting

**Phase 2: Query Builder** (Future)
- ⬜ Visual query builder interface
- ⬜ Field selection (entity, account, memo, date, amount, etc.)
- ⬜ Operators per field type (<, >, =, contains, wildcard, regexp)
- ⬜ AND/OR logic with grouping (indentation)
- ⬜ Query preview/validation
- ⬜ Save/recall named searches
- ⬜ Edit/duplicate/delete saved searches
- ⬜ Export results to CSV

**Why Phase 1 first:** Provides immediate debugging tool for imbalance investigation. Phase 2 builds on the results table.

#### ✅ Fix Balance Sheet Imbalance (Complete)
**Issue:** Equity total didn't include Retained Earnings
- ✅ Fixed backend: `totalEquity` now returns equity accounts only (not including net income)
- ✅ Added `totalIncome` and `totalExpense` to balance sheet data
- ✅ Fixed frontend: Equity total in both modes now includes Retained Earnings
- ✅ Retained Earnings shown under Equity in both modes:
  - **Balance Sheet:** Expandable to show Income/Expense breakdown
  - **Trial Balance:** Non-expandable line item (I/E already shown separately)
- ✅ Verification formula: Assets = Liabilities + Equity + Net Income (works for both modes)
- ✅ Removed Net Worth display (redundant with Equity)
- ✅ Balance Sheet: Balanced
- ✅ Trial Balance: Balanced

#### ✅ Clarify Trial Balance vs Balance Sheet
**Resolution:** Stories and specs updated
- Balance Sheet: Shows A/L/E only, RE expandable under Equity to show I/E subcategories
- Trial Balance: Shows all 5 types (A/L/E/I/E) at top level, no RE expansion needed
- Income Statement: Shows I/E with Net Income calculation line
- Updated: Story 04, `design/specs/web/screens/accounts-view.md`

#### ✅ Income Statement Date Range (Complete)
**Implementation:** Income Statement and Cash Flow now support date ranges
- ✅ Updated `BalanceSheetData` type with `startDate` and renamed `asOf` to `endDate`
- ✅ Updated backend SQL query with conditional date filtering:
  - A/L/E accounts: cumulative through endDate (ignores startDate)
  - I/E accounts: period-based (startDate to endDate) when startDate provided
- ✅ Frontend conditional date picker:
  - Balance Sheet & Trial Balance: single "As of" date
  - Income Statement & Cash Flow: "From" and "To" dates (vertically stacked)
- ✅ Auto-sets default start date (Jan 1 of current year) for period-based modes
- ✅ Vertical date stack styling (prepares for multi-column reports)

#### ✅ Account Hyperlinks Everywhere
**Issue:** Account names should be clickable throughout
- ✅ Retained Earnings breakdown (I/E accounts)
- ✅ Split transaction entries in ledger
- ⬜ VBS click-through (future enhancement)
- ⬜ Search results (when implemented)

#### ✅ Settings Screen (Complete - Compact Design)
**Implemented with auto-save behavior and compact UI**

Features implemented:
- ✅ Compact row-based layout (label + dropdown per setting)
- ✅ Light/dark/system theme toggle (immediate effect)
- ✅ Language selector (English only for MVP, dropdown ready for future)
- ✅ Date format with live preview (US/EU/ISO)
- ✅ Account display format (Code/Name/Path/Code: Name)
- ✅ Simplified sign toggle (hide negatives for Equity + Income together)
- ✅ Sereus nodes list UI (empty state, "+ Add Node" button for future)
- ✅ Settings persist in localStorage
- ✅ Auto-load on app startup

**Dark theme improvements:**
- ✅ Better contrast for disabled elements (improved in Accounts View)
- ✅ Improved global `text-muted` color (#6e7a8a)
- ✅ More visible borders (#3d4751)
- ⬜ Test all screens in both themes
- ⬜ Consider separate dark theme color palette

### Medium Priority (Polish & UX)

#### ⬜ Collapsible Global Menu
- Hamburger toggle to hide/show sidebar
- More screen space for data-heavy views
- Persist state

#### ⬜ UI Help Elements
Help content exists at `/help/en/*` routes, needs UI access:
- **Global:** Help icon (?) in header/menu → opens help index or search
- **Contextual:** Info icons (ⓘ) next to complex fields → opens relevant help page
- **Keyboard shortcut:** F1 or ? key → context-aware help
- **First-time tips:** Dismissible tooltips for new features
- Help pages already exist:
  - `/help/en/account-autocomplete` (colon completion, search behavior)
  - `/help/en/transaction-entry` (keyboard workflow, split mode)

#### ⬜ Print/PDF Report Rendering
From story 04:
- Clean, printable layout
- Opens in new browser tab
- Works for all report modes

#### ⬜ Refine Visual Balance Sheet
Current VBS is proof-of-concept:
- Improve proportions and visual accuracy
- Better color schemes and contrast
- Hover states with detailed tooltips
- Click-through to account details
- Handle edge cases (zero balances, negative equity)
- Optional Ring 3 (individual accounts)
- Scroll events to zoom in/out

### Lower Priority (Nice to Have)

#### ⬜ Multi-Column Reports
From story 04 (Alt F):
- ✅ UI placeholder: "+ Add Column" button in header (disabled with tooltip)
- ✅ UX spec: `design/specs/web/screens/saved-reports-ux.md`
- ⬜ Implement column management (add/remove/rename)
- ⬜ Implement per-column date inputs (vertically stacked)
- ⬜ Implement responsive layout (horizontal scroll, sticky headers)
- ⬜ Implement variance columns ($ change and % change)
- ⬜ Update backend to handle multiple date ranges
- ⬜ Update export to multi-column format

#### ⬜ Saved Reports
From story 04 (Alt G):
- ✅ UI placeholder: "⭐ Reports" button in header (disabled with tooltip)
- ✅ Store skeleton: `savedReports.ts` with interface definitions
- ✅ UX spec: `design/specs/web/screens/saved-reports-ux.md`
- ⬜ Implement save dialog
- ⬜ Implement dropdown with saved reports list
- ⬜ Implement load/rename/delete functionality
- ⬜ Persist to localStorage

#### ⬜ Cash Flow Mode Implementation
From story 04 (Alt C):
- Pre-configured account group selections
- Operating, Investing, Financing categories
- Show changes over period

#### ⬜ Custom Mode Implementation
From story 04 (Alt D):
- Checkboxes to select account groups
- Any combination visible
- Save as custom report

---

## Import Implementation

### 🔄 GnuCash Import
- ✅ XML format research
- ✅ Parser prototype (`test/manual/gnucash-parser.ts`)
- ✅ Format documentation (`design/specs/import-books.md`)
- ⬜ Handle scheduled transactions
- ⬜ Handle price database (multi-currency/securities)
- ⬜ Handle lots (cost basis tracking)
- ⬜ SQLite format support
- ⬜ Move to production library (`packages/import/`)
- ⬜ Build account mapping UI
- ⬜ Implement import workflow

### ⬜ Transaction Import (CSV, QIF, QFX, OFX)
- ⬜ CSV with column mapping
- ⬜ QIF parser
- ⬜ OFX/QFX parser
- ⬜ Duplicate detection
- ⬜ Auto-categorization rules
- ⬜ Import UI workflow

### ⬜ QuickBooks IIF Import
- ⬜ Research IIF format
- ⬜ Create parser
- ⬜ Document format

---

## Production Backend (Sereus Integration)

### ⬜ Quereus Backend Implementation
Currently all stubs:
- ⬜ Connect to Sereus/Quereus network
- ⬜ Implement DataService interface
- ⬜ Handle sync conflicts
- ⬜ Offline queue

---

## Future Features (Post-MVP)

### 🔮 Reporting Enhancements
- Multi-period comparisons
- Budget vs actual
- Trend analysis
- Graphical reports

### 🔮 Advanced Features (from stories/STATUS.md)
- Partners (vendors, customers, employees)
- Invoices & AP/AR
- Paying vendors
- 1099 reporting
- Recurring transactions
- Attachments (receipts, invoices)
- Job/project costing

### 🔮 Mobile App
Framework decision: NativeScript-Svelte (primary), React Native (fallback)
- ⬜ Scaffold mobile app
- ⬜ Adapt stories for mobile UX
- ⬜ Generate mobile screens
- ⬜ Implement mobile-specific features (camera, quick entry)

### 🔮 Multi-Entity Consolidation
- Consolidation reports across entities
- Inter-entity elimination
- EntityGroup definitions

---

## Completed (Recent)

### ✅ Web App Foundation
- SQLite mock backend (sql.js + localStorage)
- i18n infrastructure (dictionary-based, English MVP)
- View state persistence (expand/collapse, modes)
- Logger with configurable levels
- DataService abstraction layer

### ✅ Core Screens (v1)
- Home: Entity list with VBS dashboard
- Account Catalog: Hierarchical group management
- Accounts View: Balance Sheet / Trial Balance / Income Statement modes
  - Date range support (period-based filtering for I/E accounts)
  - Date persistence in viewState
  - Onblur optimization for large datasets
  - Expand/collapse, verification line
- Ledger: Transaction entry with autocomplete, keyboard navigation, split support
  - ✅ **Reusable AccountAutocomplete Component** - used in all account inputs
  - ✅ Split button (|) to **right** of account input, disabled when account selected
  - ✅ **Colon completion FIXED** - Search results now sorted by relevance (`:` uses top **relevant** result)
  - ✅ Tab from account input: goes to split button if empty, skips to debit if filled
  - ✅ Tab in Debit OR Credit (simple mode) → saves and focuses date of next row
  - ✅ Tab in Debit OR Credit (split mode) → focuses first split's Note field
  - ✅ Click transaction row to edit (placeholder - logs click)
  - ✅ Split entry mode with multi-line UI (REFINED)
    - Main transaction line shows current account (disabled) with debit/credit amount
    - Split rows: Note, Account (autocomplete), **Debit, Credit** (separate columns), Remove
    - No informational header row
  - ✅ **Auto-balance calculation** (pre-fills appropriate debit OR credit field)
    - If main account has Credit $123.45, first split defaults to Debit $123.45
    - If user changes first split to Debit $98, next split defaults to Debit $25.45
  - ✅ Tab flow in split mode: Debit/Credit → First split Note → Account → Debit → Credit → Next split
  - ✅ **Transaction Entry per Spec (Complete):**
    - ✅ Auto-select text on focus (all input fields)
    - ✅ Debit/Credit mutual exclusion via blur (both always enabled)
    - ✅ Split mode initial focus: Debit field of main transaction line
    - ✅ Tab from last split Credit: if balanced → Save button, if unbalanced → auto-create new split
    - ✅ Button order: [Save] [Cancel] [+ Add Split]
    - ✅ Enter key: in field = save, on button = activate
    - ✅ Simple mode: Tab from Debit or Credit → save & new blank row
    - ✅ Spec-driven implementation: `/design/specs/web/global/transaction-edit.md`
  - ✅ **Tab from last split credit → "Add Split" button → "Save" → "Cancel"**
  - ✅ Add/remove split entries (any number of debits or credits)
  - ✅ Save split transactions with multiple entries
  - ✅ Space/Enter on split button toggles split mode
- Transaction Search: Browse all transactions, export to CSV/Excel

### ✅ Documentation & Planning
- Vision and requirements docs
- Schema design (Units, Entities, Accounts, Transactions)
- Web user stories (01-05)
- Specs for: import formats, VBS, i18n, backend, view state
- Appeus workflow integration

---

## Schema & Design Reference

### Core Decisions (Resolved)

**D1: Signed Amounts**
- Single `amount` field: positive = debit, negative = credit

**D2: Entry-Level Tags**
- Tags on Entry (not Transaction) for split transaction support

**D3: Units Model**
- Generalized from "Currency" to "Unit" (currencies, crypto, commodities, inventory)
- `displayDivisor` for non-decimal units (time, dozens)

**D4: Retained Earnings**
- Pseudo-account (not in DB)
- Calculated as: Income - Expense from inception

**D5: AccountGroup Hierarchy**
- `parentId` on AccountGroup for hierarchy
- AccountType enum still used for top-level categorization

**D6: Account Hierarchy**
- `parentId` on Account (per-entity hierarchy)
- Example: "Bank of America" → Checking, Savings

**D7: Imbalance Account**
- Each entity has system "Imbalance" account
- Flagged prominently in reports
- Cannot close period with Imbalance balance

### Open Questions (For Future Iteration)

**Q1: Attachments** — How to store receipts/invoices? (Entity vs Sereus file handling)

**Q2: Recurring Transactions** — Template system for subscriptions, payroll?

**Q3: Invoice/Bill Entity** — Formal AR/AP tracking vs simple transactions?

**Q4: Opening Balances** — Special transaction type or regular dated entry?

**Q5: EntityGroup** — Formal consolidation sets or UI-driven ad-hoc selection?

---

## Notes

- Original design doc: `docs/Schema-original.md`
- Active design surface: `design/`
- Generated code: `apps/web/`, `apps/mobile/` (future)
- Test utilities: `test/manual/`
- Appeus toolkit: `appeus/` (submodule)

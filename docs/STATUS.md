# Bonum Project Status

**Legend:** ⬜ Todo | 🔄 In Progress | ✅ Done | ❓ Needs Discussion | 🔮 Future

---

## Dev Configuration

To enable the test data generator:
1. Create `apps/web/.env.local` (not tracked by git)
2. Add: `VITE_ENABLE_TEST_DATA=true`
3. Restart dev server: `npm run dev`
4. Generator appears in ledger header (top-right, above balance)

**Note:** When test data mode is enabled, localStorage persistence is **disabled** for:
- ✅ **Much faster** test data generation (no serialization overhead)
- ✅ **No storage quota errors** (localStorage has 5-10MB limit)
- ⚠️ **Data is ephemeral** - refreshing the page creates a fresh database

---

## Current Sprint (Active Development)

### 🔄 Web MVP - Core Screens
- ✅ Home screen with entity list & VBS
- ✅ Account Catalog (manage account groups)
- ✅ Accounts View (Balance Sheet, Trial Balance, Income Statement modes)
- ✅ Ledger (transaction entry with split support, scroll position persistence)
- ✅ Transaction Search (Phase 1: Browser with export)
- ⬜ Transaction Search (Phase 2: Query builder)
- ✅ Settings screen (theme, dates, account display, sign reversal)
- 🔄 Import Books (GnuCash) - Parser complete, account/transaction creation pending

### ⬜ Ledger Filtering & Search
- ⬜ **Quick Filter** (ephemeral, keyboard-driven)
  - Icon/input next to account title
  - Searches: Memo, Note, Reference (substring, case-insensitive)
  - Shortcut: Ctrl+F or `/` key
  - Clears on account change
- ⬜ **Rich Filters** (persistent, UI-driven)
  - Date range picker
  - Amount range
  - Show only open periods (transactions after closed date)
  - Show current year/month/quarter
  - Account dropdown (for split entries)
  - Combine filters with AND logic
- ⬜ **Filtered Display**
  - Show matching transactions only
  - Optional: Show filtered balance vs. total balance
  - Link to advanced search (/search) for boolean queries

**Key Design Questions:**
- Q1: Should quick filter persist in viewState or be truly ephemeral?
- Q2: Rich filters - where to place UI? (Header bar? Sidebar? Popup panel?)
- Q3: How to indicate filtered state? (Badge? Background color? Status bar?)
- Q4: Filtered balance - show both (filtered vs. total) or just suppress balance?
- Q5: Should "show only open periods" be a rich filter or a global toggle?

---

## Recently Completed

### ✅ Ledger Grid Refactor - Production-Ready Layout
**Implementation:** Replaced HTML tables with CSS Grid + ARIA for industrial-strength scalability
- **Motivation:** Enable virtual scrolling for 10K+ transactions (per production delivery posture)
- **Architecture:** CSS Grid with `display: contents` pattern for proper column alignment
- **Accessibility:** Full ARIA grid implementation (`role="grid"`, `role="row"`, `role="gridcell"`, `role="columnheader"`)
- **Performance:** CSS `content-visibility: auto` for browser-native virtualization
- **Components Refactored:**
  - `apps/web/src/routes/ledger/[accountId]/+page.svelte` - Main ledger page (table → grid)
  - `apps/web/src/lib/components/TransactionEditor.svelte` - Clean grid-first nested layout
- **Editor Design:** Nested grid architecture (spans parent columns, creates 8-column internal grid)
  - Container has border/background (not individual rows)
  - Rows use `display: contents` for cell alignment
  - Actions row spans full width with flexbox button layout
- **Maintains:** All existing functionality (expand/collapse, inline editing, locked transactions, keyboard nav, split mode)
- **Grid Layout:** 8 columns (40px, 135px, 100px, 1fr, 200px, 160px, 160px, 160px)
- **Dev Tools:** Compact test data generator (config-controlled)
  - **Location:** Top-right of ledger header (above balance display)
  - **UI:** Number input (default: 1000) + 🧪 button
  - **Config:** `VITE_ENABLE_TEST_DATA=true` in `.env.local` (DEV mode only)
  - **Persistence:** When enabled, localStorage is **disabled** for speed and to avoid quota errors
  - **Usage:** Generate transactions in small chunks for incremental performance testing
  - **Note:** Data is ephemeral - refresh creates a fresh database
- **Performance Testing Results:** 20,000 transactions tested - scrolling is fast and efficient with `content-visibility: auto`

### ✅ Ledger Scroll Position - Smart Viewport Management
**Implementation:** Scroll to latest date on load, persist viewport position per account, scroll after save
- **Default Behavior:** Scroll to blank entry row (adapts to sort order)
  - Newest first → blank entry at top (scroll to top)
  - Oldest first → blank entry at bottom (scroll to bottom)
- **After Saving Transaction:** Scroll to show the saved transaction
  - Uses `scrollIntoView({ block: 'nearest' })` for minimal scroll
  - If transaction already visible → No scroll (perfect for editing)
  - If transaction off-screen → Scroll to bring it into view
  - New transactions naturally appear near blank entry (both visible together)
- **After Test Data Generation:** Scroll to blank entry to show results (TODO: timing issue - may need refinement)
- **Viewport Persistence:** Saves `lastVisibleTransactionId` in `viewState`
  - Tracks topmost visible transaction (debounced during scroll)
  - Restores position on reload (falls back to blank entry if transaction not found)
- **Scroll Tracking:** 300ms debounce on scroll events to capture user's reading position
- **Benefits:** Users always see their work, viewport adapts intelligently to context

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
- ✅ **Ledger Implementation Updated:** `apps/web/src/routes/ledger/[accountId]/+page.svelte` - Added display modes, expand/collapse, edit mode, locked transactions (1218 → 1483 lines)
  - ✅ Transaction grouping by transactionId
  - ✅ Collapsed/expanded display modes with per-transaction toggle
  - ✅ Expand All / Collapse All toolbar buttons
  - ✅ In-place edit mode (placeholder for full editor)
  - ✅ Delete transaction with confirmation
  - ✅ Locked transaction separator (🔒) based on closedDate
  - ✅ View state persistence (expand/collapse, expandAll)
  - ✅ Escape key cancels edit/split modes
  - ✅ Click-to-edit for unlocked transactions
  - ✅ **Code Review Complete:** See `CODE_REVIEW_LEDGER.md` - 95% spec compliance
  - ✅ **Critical Fix:** Account display now shows name only, full path on hover (per spec ledger.md:42-68)
    - Backend: Added `offsetAccountPath` field to LedgerEntry
    - Both `getLedgerEntries()` and `getAllTransactions()` updated
    - Frontend: Split entries now compact and readable
  - ✅ **Fix:** Expand/collapse buttons now show for ALL transactions (spec ledger.md:214-218)
    - Removed conditional that hid buttons for simple transactions
    - All transactions are now expandable to show entry breakdown
  - ✅ **Fix:** Expanded view now shows BOTH entries correctly (spec ledger.md:194-212)
    - Shows current account entry line
    - Shows offset account entry line (or split entries for multi-entry transactions)
    - Matches spec example with proper debit/credit display
  - ✅ **CRITICAL FIX:** Expand/collapse reactivity completely rewritten (2024-12-12)
    - **Root cause:** Single `viewState` $state object wasn't triggering $derived recalculation
    - **Solution:** Split into individual $state variables (`expandedTransactions`, `expandAll`, `closedDate`)
    - **Result:** Svelte 5's fine-grained reactivity now properly tracks changes
    - Expand/collapse buttons now functional
    - "Expand All" / "Collapse All" now work
    - State persistence still functional
  - ✅ **IMPLEMENTED:** Full inline transaction editor (2024-12-13)
    - Click any unlocked transaction → full inline editor appears
    - Shows date, ref, memo, current account (read-only), and offset entries
    - Supports simple transactions (single offset) and split transactions (multiple entries)
    - Auto-balance calculation with visual indicator
    - Add/remove split entries dynamically
    - Debit/Credit mutual exclusion
    - Save updates transaction metadata (date, ref, memo)
    - Cancel discards changes
    - Delete with confirmation
    - **UI Layout per updated specs (2024-12-13):**
      - Actions footer: Single line under entry table
      - Left side: [Save] [Cancel] [+ Split] [Delete] buttons
      - Right side (split mode only): Debits total, Credits total, Balance (✓ green when balanced, ⚠ red when imbalanced)
      - Simple mode: No totals shown (auto-balances with single offset)
    - **Debug logging:** Extensive logging to diagnose data loading issues
    - **Limitation:** Currently updates only transaction metadata, not individual entries (requires additional DataService methods)
    - **Regenerated:** Consolidation and implementation updated per refined specs (2024-12-13)
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

#### ✅ Ledger Performance Optimization (Complete)
**Solution:** CSS Grid refactor + browser-native virtualization
- ✅ **Refactored to grid layout:** Replaced `<table>` with CSS Grid (maintains alignment, enables future virtual scrolling)
- ✅ **Added CSS `content-visibility: auto`:** Browser automatically virtualizes off-screen rows
- ✅ **Full ARIA support:** Accessible grid with proper roles for screen readers
- ✅ **Maintained all functionality:** Expand/collapse, inline editing, keyboard nav
- **Performance:** Should handle 10K+ transactions smoothly (to be validated with real import)
- **Fallback ready:** TanStack Virtual can be added if `content-visibility` insufficient
- **Package installed:** `@tanstack/svelte-virtual` (v3.13.13) - ready if needed

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
- ✅ **Import Strategy Spec** (`design/specs/web/global/import.md`)
  - Two entry points: "Import Books" (new entity) and "Import Transactions" (existing entity)
  - Single reusable import engine
  - GUID-based idempotence for GnuCash
- ✅ **Import Module Created** (`apps/web/src/lib/import/`)
  - `types.ts`: TypeScript interfaces
  - `gnucash-parser.ts`: GnuCash XML parser (accounts, transactions, commodities)
  - `import-service.ts`: Main import orchestration
  - `index.ts`: Public API
- ✅ **Import UI** (`apps/web/src/routes/import/+page.svelte`)
  - File upload with drag & drop
  - Progress indicator
  - Real GnuCash parsing (uncompressed XML)
  - Account/transaction count display
- ⬜ **Next Steps:**
  - Account creation with DataService
  - Transaction creation with DataService
  - Account mapping UI (for existing entity imports)
  - Duplicate detection (GUID-based)
  - Gzip decompression support
- ⬜ Handle scheduled transactions
- ⬜ Handle price database (multi-currency/securities)
- ⬜ Handle lots (cost basis tracking)
- ⬜ SQLite format support

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

## AI-Assisted Features

### Implementation Phasing

#### Phase 1: Settings & API Configuration
- ⬜ Settings screen integration for AI
  - API key management (per-provider: OpenAI, Anthropic, etc.)
  - Provider/model selection (dropdown)
  - Multiple agent configs (name, provider, model, key)
  - Active agent selection
  - User-specified rules files (text box per agent + global rules)
  - Rules scope: agent-specific and all-agents
- ⬜ Backend service layer for agent API calls
- ⬜ Credential storage/encryption strategy

#### Phase 2: UI & Conversation Interface
- ⬜ AI assistant component (initial design decision: sidebar pane)
  - Query input field
  - Scrollable dialog/conversation display
  - Export conversation (PDF, text)
  - Print conversation
  - Clear/reset conversation
  - Resizable/expandable for quick queries vs. involved discussions
- ⬜ Global activation (menu item, keyboard shortcut)
- ⬜ Context awareness foundation
  - Track active screen/route
  - Capture selected entity
  - Capture open account(s)
  - Multi-window/pane awareness (desktop: multiple screens open simultaneously)
- ⬜ **Post-MVP Refinements** (answer after first generation)
  - Placement alternatives (sidebar vs. overlay vs. top/bottom pane)
  - Optimal width/height for different query types
  - Docking behavior relative to global menu dock/undock
  - Conversation persistence strategy (per-screen, global, saved history)
  - State management across multi-tab/multi-window sessions

#### Phase 3: Q&A + Contextual Help
- ⬜ Fixed context bundle (app documentation)
  - How to use the app (navigation, screens, workflows)
  - Accounting concepts (debit/credit, accrual, balance sheet, etc.)
  - Common tasks (create entity, enter transaction, reconcile)
- ⬜ Agent can answer questions about:
  - General accounting principles
  - How to use Bonum features
  - Current entity/account context
- ⬜ Interactive setup workflows (see Story 07)

#### Phase 4: Non-Generative Actions (Read-Only)
- ⬜ Agent tool/function calling framework
- ⬜ Query data (accounts, transactions, balances)
- ⬜ Build and display reports (Balance Sheet, Income Statement, etc.)
- ⬜ Print ledgers
- ⬜ Open/configure screens
- ⬜ Search for transactions

#### Phase 5: Generative Actions (Data Writes)
- ⬜ Enter transactions (with user review/approval)
- ⬜ Assist in reconciliation
- ⬜ Assist in account generation
- ⬜ Account mapping during import (see Import Books section)
- ⬜ **Review/Approve Workflow** (design after Phase 3 testing)
  - How to display proposed changes (diff view? preview modal? inline highlights?)
  - Approve/reject controls (per-item? batch?)
  - Undo/rollback mechanism
- ⬜ **Privacy & Data Minimization** (design before Phase 5 implementation)
  - Define what data is sent to AI API (screen name? entity ID? full transactions?)
  - User visibility/consent for data sharing
  - Local-only vs. cloud-enhanced modes
  - Audit log of what was sent to AI
- ⬜ **Error Handling & Offline** (design in Phase 2/3)
  - Graceful degradation when API unavailable
  - Error messages for failures (rate limits, invalid key, network)
  - Offline mode behavior
- ⬜ **Cost Management** (design in Phase 2/3)
  - User awareness of API costs per interaction
  - Optional rate limiting
  - Token usage tracking/display

#### Phase 6: Advanced Features (Voice, OCR, Polish)
- 🔮 Voice input (Web Speech API)
  - Microphone icon in AI wizard
  - Browser speech-to-text → agent parsing
  - Examples: "I just paid $43.97 for lunch" → agent asks clarifying questions
- 🔮 Voice output (text-to-speech)
  - Digital toggle for reading responses aloud
  - Browser Speech Synthesis API
- 🔮 Invoice/Receipt OCR (Vision models)
  - Upload image of invoice or receipt
  - Agent extracts: date, vendor, amount, line items
  - Agent suggests categorization
  - User reviews/approves generated transaction
- 🔮 Custom report generation
  - Natural language: "Show me net worth over time"
  - Agent generates chart/report configuration
  - Renders using existing report components

### 🔄 Story & Spec Development
- **Story:** `design/stories/web/07-ai-assistant.md` (core Q&A and interactive setup)
- **Component Spec:** `design/specs/web/components/ai-assistant.md` (draft)
- **Integration:** Vercel AI SDK (`ai` npm package)
- **Status:** Ready for initial generation (Phases 1-3)

### Strategy
**Integration:** Vercel AI SDK (`ai` npm package) - TypeScript toolkit for structured AI output
**Approach:** Story-driven design → lightweight specs for UI → implementation
**Provider:** User-supplied API key (OpenAI/Anthropic/Google) in Settings

### 🔄 Planned AI Assistance Use Cases

#### Phase 1: Stories & Core Infrastructure
- ⬜ **Story:** New user needs help setting up account structure
- ⬜ **Story:** User unsure how to create starting balances
- ⬜ **Story:** User needs help categorizing transactions
- ⬜ **Story:** User unsure how to handle amortization/capitalization
- ⬜ **Story:** User mapping 100+ accounts during GnuCash import
- ⬜ Add AI provider settings (API key, provider choice, auto-apply confidence threshold)
- ⬜ Create AI service wrapper (`lib/ai/wizard.ts`)
- ⬜ Build reusable `AIWizardBubble.svelte` component (floating assistant)

#### Phase 2: Import Account Mapping (First Implementation)
- ⬜ Implement `generateObject()` for account mapping suggestions
- ⬜ UI: Show AI suggestions with confidence indicators (🟢 High, 🟡 Medium, 🔴 Low)
- ⬜ UI: Manual override dropdowns for low-confidence mappings
- ⬜ Store `gnucash_guid` in account table for future import detection
- ⬜ Complete import flow: parse → AI suggest → user review → create accounts/transactions

#### Phase 3: Additional AI Assistance
- ⬜ Context-aware help bubble on any screen
- ⬜ Transaction categorization suggestions
- ⬜ Setup wizard for new users

### Prerequisites
- ✅ Virtual scrolling (for large imports) - Complete! Grid refactor + CSS `content-visibility`
- ✅ Import parser complete (GnuCash XML)
- ⬜ Schema: Add `gnucash_guid TEXT` column to `account` table
- ⬜ Schema: Add `gnucash_guid TEXT` column to `entry` table (for transaction deduplication)

**Note:** Stories come first, specs minimal (UI pattern only). AI wizard is reusable across all use cases.

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

### 🔮 Performance Optimizations

#### Virtual Scrolling (Optional Enhancement)
**Status:** Deferred - Current implementation handles 20K+ transactions well
- **Trigger:** Only needed if user feedback indicates performance issues beyond 50K transactions
- **Implementation:** TanStack Virtual for Svelte (`yarn add @tanstack/svelte-virtual` when needed)
- **Approach:** JavaScript-driven windowing with precise buffer control
- **Settings Toggle:** Allow users to enable/disable (some prefer full scrollbar for jump-to-date)
- **Challenges to address:**
  - Dynamic row heights (collapsed vs. expanded vs. edit modes)
  - Keyboard navigation across virtual boundaries
  - Edit mode state persistence for off-screen rows
  - Scroll position tracking with virtualized items
- **Alternative:** Continue relying on CSS `content-visibility: auto` (browser-native, zero JS overhead)

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

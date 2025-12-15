# Consolidation: Account Ledger Screen

**Route:** `/ledger/[accountId]`  
**Component:** `apps/web/src/routes/ledger/[accountId]/+page.svelte`  
**Generated:** 2024-12-13  
**Sources:**
- Story 03 (Transaction Entry)
- Story 02 (GnuCash Import, step 9.7)
- `design/specs/web/screens/ledger.md`
- `design/specs/web/components/transaction-edit.md`
- `design/specs/web/components/account-autocomplete.md`

---

## Purpose

Primary transaction entry and viewing interface for a single account. Displays account ledger with running balance, supports rapid keyboard-centric data entry, transaction editing, and expansion/collapse of transaction details.

---

## Page Structure

### Layout Components

1. **Fixed Header** (does not scroll)
   - Back link to Accounts View
   - Entity and account context
   - Account balance
   - Column headers (single row, not repeated)

2. **Scrollable Transaction List**
   - Existing transactions (collapsed or expanded)
   - Locked transaction separator (if applicable)
   - New entry row (always at bottom)

3. **State Management**
   - Per-account view state in localStorage
   - Expand/collapse state
   - Expand-all toggle state
   - Closed date (for locked transactions)

---

## Grid Layout Implementation

### Technical Approach

The ledger uses CSS Grid (not HTML `<table>`) for the transaction list to enable:
- Virtual scrolling for large datasets (10K+ transactions)
- Variable-height rows (collapsed ~40px, expanded ~varies, edit mode ~varies)
- Absolute positioning compatibility
- Smooth inline editing without layout reflow

### Grid Structure

```html
<div class="ledger-grid" role="grid" aria-label="Account ledger">
  <!-- Each transaction/row -->
  <div class="ledger-row" role="row" aria-rowindex="{n}">
    <div class="col-expand" role="gridcell" aria-colindex="1">...</div>
    <div class="col-date" role="gridcell" aria-colindex="2">...</div>
    <div class="col-ref" role="gridcell" aria-colindex="3">...</div>
    <div class="col-memo" role="gridcell" aria-colindex="4">...</div>
    <div class="col-offset" role="gridcell" aria-colindex="5">...</div>
    <div class="col-debit" role="gridcell" aria-colindex="6">...</div>
    <div class="col-credit" role="gridcell" aria-colindex="7">...</div>
    <div class="col-balance" role="gridcell" aria-colindex="8">...</div>
  </div>
</div>
```

### CSS Grid Properties

```css
.ledger-grid {
  display: grid;
  grid-template-columns: 
    40px      /* Expand/collapse button */
    135px     /* Date */
    100px     /* Reference */
    1fr       /* Memo (flexible) */
    200px     /* Offset account */
    160px     /* Debit */
    160px     /* Credit */
    160px;    /* Running balance */
  gap: 0;
  align-items: start;
}

.ledger-row {
  display: contents; /* Children become grid items */
}
```

### ARIA Roles for Accessibility

- **Grid container:** `role="grid"` with `aria-label`
- **Rows:** `role="row"` with `aria-rowindex` (1-based)
- **Cells:** `role="gridcell"` with `aria-colindex` (1-based)
- **Edit mode:** `aria-expanded="true"` on row being edited
- **Locked transactions:** `aria-disabled="true"` on locked rows

### Performance Optimization

After grid refactor, apply CSS `content-visibility`:

```css
.ledger-row {
  content-visibility: auto;
  contain-intrinsic-size: auto 40px; /* Height hint */
}
```

This enables browser-native virtualization without JavaScript library overhead.

If `content-visibility` is insufficient for 10K+ transactions, integrate TanStack Virtual:
- Package: `@tanstack/svelte-virtual` (already installed)
- Only render visible rows + 5 overscan buffer
- Absolute positioning now compatible with grid layout

### Transaction Editor - Clean Grid Architecture

The `TransactionEditor` component (`design/specs/web/components/transaction-edit.md`) uses a **nested grid** design:

**Structure:**
```
<div class="editor-container">      ← grid-column: 1 / -1, creates 8-column nested grid, blue border
  <div class="editor-row">          ← display: contents (children align to parent grid)
    <div>...</div>                  ← Individual grid cells with padding
  </div>
  <div class="editor-actions">      ← Spans full width, contains button flexbox
    ...
  </div>
</div>
```

**Key Features:**
- **Wrapper Grid**: `.editor-container` spans all parent columns, creates nested 8-column grid (40px, 135px, 100px, 1fr, 200px, 160px, 160px, 160px)
- **Visual Grouping**: Blue 2px border and background applied to container (not individual rows)
- **Row Structure**: `.editor-row` uses `display: contents` so children align with grid
- **No Conflicts**: Designed grid-first, not adapted from tables
- **Maintains**: All functionality (simple/split modes, validation, keyboard nav, auto-balance)
- **ARIA**: Full accessibility (`role="row"`, `role="gridcell"`)

This architecture ensures clean alignment with the parent ledger grid while maintaining visual distinction for edit mode.

---

## Header Section

### Back Link
```
← Back to Accounts View
```
- Returns to `/entities/{entityId}`
- Standard navigation link

### Context Line
**Left side:**
```
Home Finance > Assets : Current Assets : Checking 1010
```
Format:
- Entity name (lighter, smaller)
- Full account path with separators
- Account code (if present)

**Right side:**
```
USD $12,345.67
```
- Unit symbol
- Current account balance (updates on transaction changes)

### Column Headers (Single Row)
```
>  | Date       | Ref  | Memo           | Account      | Debit    | Credit   | Balance
```

**Columns:**
- `>`: Expand/collapse icon (clicking header icon toggles all)
- Date: Transaction date
- Ref: Reference/check number
- Memo: Transaction description
- Account: Offset account name (or `[Split]` indicator)
- Debit: Debit amount (if applicable)
- Credit: Credit amount (if applicable)
- Balance: Running balance after transaction

**Note:** These headers are never repeated within transactions or editors - all rows align with these columns.

---

## Transaction Display

### Collapsed View (Default)

Single line per transaction:
```
>  | 2024-12-10 | 1234 | Grocery Store  | Groceries    | $125.50  |          | $5,234.00
>  | 2024-12-11 | 1235 | Salary         | Salary Inc   |          | $2,500.00| $7,734.00
>  | 2024-12-12 | 1236 | Bill payment   | [Split]      | $450.00  |          | $7,284.00
```

**Visual elements:**
- `>` icon: Click to expand
- Account column shows:
  - Offset account name (for simple transactions)
  - `[Split]` indicator (for split transactions with 3+ entries)
- Balance column shows running balance
- Hover on account name shows full path in tooltip

### Expanded View

Transaction header + entry lines:
```
v  | 2024-12-12 | 1236 | Bill payment   |                      |          |          | $7,284.00
   |            |      |                | Checking Account     |          | $450.00  |
   |            |      |                | Electric             | $150.00  |          |
   |            |      |                | Internet             | $100.00  |          |
   |            |      |                | Phone                | $200.00  |          |
```

**Structure:**
- Transaction header line: Date/Ref/Memo filled, Balance shows, Account/Debit/Credit empty
- Entry lines: Date/Ref/Memo empty (visual indentation), Account/Debit/Credit filled
- First entry: Current account (the one being viewed)
- Subsequent entries: Offset accounts or splits
- Entry lines have no balance value

**Controls:**
- Click `v` to collapse
- Clicking header `>` icon: Expands/collapses all transactions

### State Persistence

Saved per account in localStorage:
- `expandAll`: Boolean (all expanded vs. all collapsed)
- Individual transaction expansion not persisted (respects expandAll state on reload)
- `closedDate`: Date for locked transaction separator

---

## Locked Transactions

Transactions before the closed date cannot be edited.

### Visual Separator

```
>  | 2024-01-10 | 1001 | Old transaction    | Expenses  | $50.00   |          | $1,000.00
>  | 2024-01-15 | 1002 | Another old one    | Utilities | $100.00  |          | $900.00
═══════════════════════════════════════🔒═══════════════════════════════════════
>  | 2024-02-01 | 1003 | Editable entry     | Groceries | $75.00   |          | $825.00
```

**Visual treatment:**
- Separator line with 🔒 icon
- Transactions above: Subtle tint (dimmed)
- Transactions below: Normal appearance

**Behavior:**
- Click locked transaction: No response (or tooltip: "Cannot edit - period closed")
- Can still expand to view details
- Can still click account links to navigate

---

## New Transaction Entry

### Blank Entry Row

**Position:** Changes based on transaction sort order:
- **Oldest first** (default): Appears at **bottom** of ledger
- **Newest first**: Appears at **top** of ledger (after header)

This ensures the blank entry is always at the natural insertion point.

**Design:**
```
   | [Date   ] | [Ref] | [Memo         ] | [Account   ] [|] | [Debit  ] | [Credit ] |
```
- Contains real input fields (not placeholders)
- Fields styled subtly (muted, italic) until focused
- Fully keyboard-accessible via Tab navigation

**Behavior:**
- **Keyboard:** Tab to Date field → automatically activates transaction editor
- **Mouse:** Click any field → activates transaction editor
- Editor expands inline (same table row)
- Uses transaction-edit component
- On save: Creates transaction, refreshes ledger, new blank row appears, focus moves to Date of new blank row
- On cancel: Clears fields, blank row remains

---

## Editing Existing Transactions

### Entry to Edit Mode

- Click any unlocked transaction (collapsed or expanded)
- Transaction expands inline into edit container
- Blue border (2px solid primary-color) indicates edit mode

### Edit Container Layout

The editor aligns with the ledger table columns. Fields are positioned to match the column headers above.

**Simple Transaction Edit:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│   | [Date▼] | [Ref_] | [Memo___________] | [Account_____▼] [|] | [Debit__] | [Credit_] |
│   | [Save] [+ Split] [Cancel] [Delete]                                        |
└──────────────────────────────────────────────────────────────────────────────┘
```

**Actions Footer (Simple):**
- Left: [Save] [+ Split] [Cancel] [Delete] buttons
- Right: No totals (simple transactions auto-balance, no validation needed)

**Split Transaction Edit:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│   | [Date▼] | [Ref_] | [Memo___________] | [Checking_____▼] | [Debit__] | [Credit_] |
│   |         |        | Note: [Electric_] | [Utilities____▼] | [150.00 ] | [       ] | [×]
│   |         |        | Note: [Internet_] | [Business_____▼] | [100.00 ] | [       ] | [×]
│   |         |        | Note: [Phone____] | [Telecom______▼] | [200.00 ] | [       ] | [×]
│   ───────────────────────────────────────────────────────────────────────────
│   | [Save] [+ Split] [Cancel] [Delete]       Debits: $450.00  Credits: $450.00  Balance: $0.00 ✓ |
└──────────────────────────────────────────────────────────────────────────────┘
```

**Actions Footer (Split):**
- Left: [Save] [+ Split] [Cancel] [Delete] buttons
- Right: Debits total, Credits total, Balance with indicator
  - Green ✓ when $0.00
  - Red ⚠ and amount when imbalanced

**Main Transaction Line:**
- Date, Ref, Memo: Editable
- Current Account: Pre-filled, disabled/grayed (viewing ledger for this account)
- Debit/Credit: Amount for current account entry

**Split Entry Lines:**
- Note: Optional description for this split
- Account: Autocomplete for offset account
- Debit/Credit: Amount fields (only one can have value)
- Remove `[×]`: Removes split line (minimum 1 split required)

### Edit Behavior

**Visual:**
- Blue border around edit container
- All fields align with column headers
- Looks like ledger view, but fields are editable inputs
- Context preserved (see surrounding transactions)

**Functionality:**
- Simple transactions: Main line + one offset
- Split transactions: Always show all entries in edit mode (even if collapsed in view mode)
- Can convert simple → split via `[+ Split]` button
- Auto-balance calculation for splits
- Debit/Credit mutual exclusion (blur clears other field)
- Auto-select text on focus for quick editing

**Actions:**
- **Save:** Validates, updates transaction, exits edit mode, refreshes ledger
- **Cancel:** Discards changes, exits edit mode, restores view
- **+ Split:** Adds new split entry line
- **Delete:** Shows confirmation, deletes transaction, refreshes ledger
- **Esc key:** Same as Cancel

**Exit:**
- Returns to view mode
- Restores previous display state (collapsed/expanded as it was before editing)

---

## Transaction Editor Component

Behavior defined in `design/specs/web/components/transaction-edit.md`:
- Two modes: Simple (one offset) and Split (multiple offsets)
- Keyboard navigation optimized for rapid entry
- Tab flow through fields
- Auto-balance calculation
- Validation rules
- Debit/Credit mutual exclusion
- Ctrl+Enter toggles split mode

The editor component is mode-agnostic (doesn't know if it's new entry or edit). The ledger screen provides transaction data and handles save/cancel/delete callbacks.

---

## Account Autocomplete

All account input fields use the autocomplete component defined in `design/specs/web/components/account-autocomplete.md`:

**Features:**
- Type to search, filters by relevance
- Colon `:` for progressive path completion
- Tab/Enter to select (Tab also advances focus)
- Arrow keys navigate dropdown
- Escape closes dropdown
- Max 10 results displayed
- Shows full path in dropdown for disambiguation
- Validation: Must have selectedId, not just text

---

## Account Hyperlinks

All account names displayed are clickable:

**Locations:**
- Offset account in transaction rows (collapsed view)
- Account names in expanded entry lines
- Split entry account names (when expanded)

**Behavior:**
- Click: Navigate to `/ledger/{accountId}` (standard navigation)
- Hover: Tooltip shows full account path
- Ctrl/Cmd+Click: Opens in new window (browser default)

**Display:**
- Shows account name only (not full path)
- Uses HTML `title` attribute for hover tooltip with full path
- Example: `<a href="/ledger/123" title="Expenses : Operating : Utilities : Electric">Electric</a>`

---

## Data Fetching

### On Page Load
1. Load account details (entity ID, name, path, code, unit)
2. Load entity details (for header context)
3. Load unit details (symbol, divisor)
4. Load ledger entries for account
5. Load view state from localStorage (expand/collapse, closed date)

### On Transaction Save/Delete
- Refresh ledger entries
- Update account balance in header
- Maintain scroll position
- Restore expand/collapse state

### Running Balance
- Calculated by backend SQL query
- Each entry includes `runningBalance` field
- Displayed in Balance column
- Updates on page reload (not real-time within session)

---

## Keyboard Shortcuts

**Global (page-level):**
- Ctrl+Enter: Toggle split mode (when in transaction editor)

**Within Transaction Editor:**
- Tab: Advance through fields, save from last field
- Enter: Save transaction (from input field), activate button (on button)
- Escape: Cancel edit
- Space: Activate button (on split button or action buttons)
- Arrow keys: Navigate in account autocomplete dropdown
- Colon `:`: Progressive path completion in account autocomplete

---

## Validation & Error Handling

### Transaction Validation
- Date: Required, must be valid date
- Account: Required, must have selectedId (simple mode or each split)
- Amount: One of Debit OR Credit required (not both, not neither)
- Balance: Split transactions must sum to $0.00 (within $0.01 tolerance)

### Visual Feedback
- Invalid fields: Red border or highlight
- Balance indicator (splits): ✓ or ⚠ with amount
- Save button: Disabled until valid
- Inline error messages below invalid fields

### Error States
- Account not found: Show error, prevent save
- Backend save failure: Show error toast, keep editor open with data
- Network error: Show retry option

---

## Dependencies

### Components
- `AccountAutocomplete.svelte`: Account selection with search and path completion
- `TransactionEditor.svelte`: (Future) Extracted inline editor component
- Currently: Inline editor within ledger page component

### Stores
- `entities`: Entity data
- `accounts`: Account data (for autocomplete)
- `viewState`: Per-account UI state (expand/collapse, closed date)

### Services
- `DataService.getLedgerEntries(accountId)`: Fetch transactions for account
- `DataService.createTransaction(transaction)`: Save new transaction
- `DataService.updateTransaction(transactionId, updates)`: Update existing transaction
- `DataService.deleteTransaction(transactionId)`: Delete transaction
- `DataService.searchAccounts(entityId, query)`: For autocomplete

### Libraries
- `sql.js`: SQLite backend (mock mode)
- Svelte 5: Runes mode (`$state`, `$derived`, `$effect`)

---

## Current Implementation Status

**✅ Implemented:**
- Fixed header with back link, context, balance
- Column headers (single row)
- Transaction list with expand/collapse
- Collapsed/expanded view modes
- Locked transaction separator
- New entry row at bottom
- Full inline transaction editor (simple and split modes)
- Click-to-edit for existing transactions
- Blue border in edit mode
- Actions footer (buttons left, totals right for splits)
- Auto-balance calculation
- Debit/Credit mutual exclusion
- Account autocomplete with colon completion
- Account hyperlinks with hover tooltips
- View state persistence (expand/collapse, closed date)
- Delete with confirmation
- Keyboard navigation (Tab, Enter, Escape, Ctrl+Enter)

**⚠️ Known Limitations:**
- Save function updates transaction metadata only (date, ref, memo)
- Does not yet update individual entry amounts/accounts
- Requires additional DataService methods: `updateEntry`, `deleteEntry`, `createEntry`
- Running balance not real-time (requires page refresh)

**🐛 Outstanding Issues:**
- Split entry data not loading correctly into editor (investigation in progress)
- Debug logging added to diagnose data loading

**🔜 Future Enhancements:**
- Extract transaction editor into separate component
- Real-time balance updates
- Undo/redo support
- Transaction search within ledger
- Keyboard shortcuts summary (Help dialog)
- Transaction templates (recurring entries)

---

## Testing Notes

**Manual Test Cases:**
1. Load ledger → Verify header, columns, transactions display
2. Expand transaction → Verify shows all entries correctly
3. Click transaction → Verify edit mode with blue border
4. Edit simple transaction → Save → Verify updates
5. Convert simple → split → Add splits → Save → Verify
6. Edit split transaction → Modify amounts → Verify balance indicator
7. Delete transaction → Confirm → Verify removed
8. Cancel edit → Verify no changes
9. Tab through new entry → Verify rapid entry workflow
10. Lock transaction (set closed date) → Verify separator, dimming, no edit
11. Account autocomplete → Type, colon completion, tab select → Verify
12. Account hyperlinks → Click → Verify navigation
13. Expand all / Collapse all → Verify state persists
14. Reload page → Verify view state restored

**Browser Console:**
- Check for debug logging when entering edit mode
- Verify transaction data structure
- Verify editingData structure
- Check for errors during save/delete

---

## Future Architecture

**Component Extraction:**
```
ledger/[accountId]/+page.svelte
├── LedgerHeader.svelte (entity, account, balance)
├── TransactionList.svelte (view mode)
│   ├── TransactionRow.svelte (collapsed)
│   └── TransactionExpanded.svelte (expanded)
└── TransactionEditor.svelte (new/edit mode)
    ├── AccountAutocomplete.svelte (already extracted)
    └── SplitEntryRow.svelte (repeating split lines)
```

**State Management:**
- Consider Svelte store for ledger data (reactive updates)
- WebSocket or polling for multi-user real-time updates
- Optimistic UI updates with rollback on error

**Performance:**
- Virtual scrolling for large ledgers (1000+ transactions)
- Lazy load transactions (pagination or infinite scroll)
- Debounce autocomplete queries
- Memoize balance calculations

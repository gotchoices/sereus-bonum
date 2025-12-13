# Consolidation: Account Ledger

**Route:** `/ledger/[accountId]`
**Source:** `design/stories/web/03-entries.md`, `design/specs/web/screens/ledger.md`, `design/specs/web/global/transaction-edit.md`, `design/specs/web/global/account-autocomplete.md`
**Generated:** 2024-12-12

## Purpose

Primary transaction entry interface for an account. Displays existing transactions (collapsed or expanded) and provides an always-present blank row for rapid keyboard-centric transaction entry without requiring constant visual attention.

## Technical Requirements

### Components Structure

**Main Page:** `apps/web/src/routes/ledger/[accountId]/+page.svelte`
- Uses `AccountAutocomplete.svelte` component for all account selection
- Implements both simple and split transaction entry modes
- Manages transaction state, validation, and persistence

**Reusable Component:** `apps/web/src/lib/components/AccountAutocomplete.svelte`
- Encapsulates account search, filtering, keyboard navigation
- Implements colon completion logic
- Provides consistent behavior across all account inputs
- Props: `entityId`, `value` (bind), `selectedId` (bind), `placeholder`, `disabled`, `onselect` callback

### Data Flow

**Inputs:**
- Route param: `accountId` (from URL)
- Account details (name, type, unit, parent path)
- Ledger entries for this account
- Entity's full account tree (for autocomplete)
- Running balance

**State Management:**
- Simple mode: `{ date, ref, memo, offsetAccountId, debit, credit }`
- Split mode: adds array of `{ note, accountId, debit, credit }` entries
- Auto-balance calculation on split entry changes
- Real-time validation (balanced = sum of all entries = $0.00 ± $0.01)

**Outputs:**
- Transaction save → Updates ledger entries
- Balance recalculation → Updates header display
- Reactive updates → Notifies linked Accounts View

### Transaction Display & Grouping

**Transaction Grouping:**
- Entries are grouped by `transactionId`
- Each transaction group contains:
  - Header data: date, reference, memo
  - All entries for that transaction
  - Derived state: isLocked, isExpanded

**Display Modes:**
1. **Collapsed (default):** Single line per transaction
   - Shows: date, ref, memo, offset account (or "[Split]"), amounts, balance
   - Expand button (▶) shown if transaction has multiple entries
   - Click anywhere on line → enter edit mode (if not locked)

2. **Expanded:** Transaction header + entry lines
   - Header line: date, ref, memo, "[Split]", balance
   - Entry lines (indented): note, account link, debit/credit amounts
   - Collapse button (▼) on header line
   - Click header → enter edit mode (if not locked)

**Expand/Collapse Controls:**
- Per-transaction expand button (▶/▼)
- Toolbar: "Expand All" and "Collapse All" buttons
- State persisted in localStorage per account (`viewState.expandedTransactions`)
- `viewState.expandAll` overrides individual settings

**Locked Transactions:**
- Transactions before `closedDate` are locked (non-editable)
- Visual separator line with lock icon (🔒) between locked and unlocked
- Locked rows: dimmed opacity (0.7), muted color, no hover effect, no edit on click

### In-Place Editing

**Entering Edit Mode:**
- Click on any transaction line (if not locked)
- Expands transaction into edit container (blue border)
- Loads transaction data into edit form
- Shows: ✏️ icon, full inline editor with entry table and actions footer

**Edit Container:**
- Full-width inline editor at transaction's position in table
- Blue border (2px solid primary-color) indicates active edit mode
- Contains transaction editor matching new entry form
- **Main line:** Date, Ref, Memo, Current Account (disabled), Debit, Credit
- **Split lines:** Note, Account (autocomplete), Debit, Credit, Remove (×) button
- **Actions footer (single line):**
  - **Left side:** [Save] [Cancel] [+ Split] [Delete] buttons
  - **Right side:** Debits total, Credits total, Balance (✓ green or ⚠ red)

**Editing Behavior:**
- Simple transactions: Shows main entry + one offset entry
- Split transactions: Shows main entry + all split entries (always expanded in edit mode)
- Can add/remove splits during editing
- Auto-balance calculation with visual feedback
- Debit/Credit mutual exclusion via blur handlers
- Auto-select text on focus for easy editing

**Exiting Edit Mode:**
- Save → Updates transaction, reloads ledger
- Cancel → Discards changes, returns to view mode
- Delete → Confirmation dialog, removes transaction
- Escape key → Cancel edit mode

**Delete Confirmation:**
- Dialog: "Delete this transaction? This cannot be undone."
- [Cancel] [Delete] buttons
- Only shown for unlocked transactions

**Debug Logging:**
- Extensive logging added to diagnose data loading issues
- Logs transaction structure, split entries, loaded data

### View State Persistence

**Persisted State (localStorage):**
```typescript
interface LedgerViewState {
  expandedTransactions: Record<string, boolean>; // Per-transaction
  expandAll: boolean;                             // Global override
  closedDate?: string;                            // Lock transactions before this date
}
```

**Storage Key:** `viewState:ledger:{accountId}`

**Behavior:**
- Expand/collapse state remembered per transaction
- `expandAll` flag remembered across sessions
- `closedDate` sets locked transaction cutoff

### Account Autocomplete Implementation

**Search & Filter:**
- Case-insensitive match on: account name, code, group name, type name, full path
- Sort priority: exact name match > path starts with query > name starts > type starts > contains anywhere
- Display: full account path in dropdown
- Limit: max 10 results, scrollable

**Keyboard Behaviors:**
- **Tab:** Selects highlighted result, fills full path, advances focus to next field
- **Enter:** Selects highlighted result, fills full path, stays in same field
- **Escape:** Closes dropdown without selection
- **Up/Down arrows:** Move highlight in dropdown
- **Left/Right arrows:** Normal text cursor movement
- **Colon (`:`):** Completes highlighted result through longest matching path element (never completes final account name)
- **Auto-select:** When tabbing into populated field, select all text

**Colon Completion Logic:**
1. Use currently highlighted dropdown result (default = top, or arrow-key selected)
2. Find longest path element in that result containing current search text
3. Complete through that element plus trailing ` : `
4. Never complete the final account name (no colon after it)

Example: Search "land" → highlighted "Assets : Land Holdings : Building A" → press `:` → completes to "Assets : Land Holdings : "

**Validation:**
- Must have valid `selectedId` (not just text) before save
- Tab away without selection → clear input and `selectedId`

### Transaction Entry Modes

**Simple Mode:**
- Fields: Date, Ref, Memo, Account (autocomplete), Debit, Credit
- Split button: right of Account input, enabled only when Account empty
- Debit/Credit: both always enabled (consistent tab flow), on blur clears other field
- Tab from Credit → saves transaction, creates new blank row, cursor to Date

**Split Mode:**
- Triggered by split button click or Ctrl+Enter keyboard shortcut (when Account empty)
- Page-level keyboard handler: `onkeydown={handlePageKeydown}` on ledger-page div
- Main line: Date, Ref, Memo, Current Account (disabled/read-only), Debit, Credit
- Split entries: each has Note, Account (autocomplete), Debit, Credit, Remove (×)
- Initial focus: Debit field of main transaction line
- Auto-balance: new split rows pre-fill appropriate Debit or Credit with balancing amount
- Tab flow: main Debit/Credit → first split Note → Account → Debit → Credit → next split
- Last split Credit: if balanced → Save button, if unbalanced → auto-create new split
- Buttons: [Save] [Cancel] [+ Add Split]

### Validation Rules

**Simple Mode:**
- Date: valid date
- Account: selectedId must be set
- Amount: exactly one of Debit OR Credit (not both, not neither)

**Split Mode:**
- Date: valid date
- Main line: Debit OR Credit
- Each split: selectedId + Debit OR Credit
- Balance: sum of all entries = $0.00 (±$0.01 tolerance)
- Save button disabled until valid

### Layout Structure

```
┌─ Header ────────────────────────────────────────────────────────┐
│ ← Entity Name                                                    │
│ Account Path: Full path with colons                              │
│ Account Code: [code] | Unit: [USD]                               │
│ Balance: $X,XXX.XX                                                │
└──────────────────────────────────────────────────────────────────┘

┌─ Ledger Table ──────────────────────────────────────────────────┐
│ Date | Ref | Memo | Offset | Debit | Credit | Balance |          │
│───────────────────────────────────────────────────────────────────│
│ (existing transactions...)                                        │
│ (new entry row...)                                                │
└──────────────────────────────────────────────────────────────────┘
```

**Split Mode Layout Addition:**
```
┌─ Split Entry ───────────────────────────────────────────────────┐
│ Main: Date | Ref | Memo | [Current Acct] | Debit | Credit       │
│                                                                   │
│ Splits: Note | [Account] | Debit | Credit | [×]                  │
│        Note | [Account] | Debit | Credit | [×]                   │
│        (Balance: $0.00 ✓)                                         │
│        [Save] [Cancel] [+ Add Split]                              │
└──────────────────────────────────────────────────────────────────┘
```

### Event Handlers

**Simple Mode:**
- `onKeyDown` (Debit/Credit): Tab → `saveEntry()` then focus Date of next row
- `onKeyDown` (Debit/Credit): Enter → `saveEntry()`
- `onBlur` (Debit): if value, clear Credit
- `onBlur` (Credit): if value, clear Debit
- `onFocus` (any field with value): select all text
- Split button `onClick`: `initSplitMode()`

**Split Mode:**
- `onKeyDown` (main Debit/Credit): Tab → focus first split Note
- `onKeyDown` (split Credit, last split): Tab → check balance, if balanced focus Save button, else `addSplitEntry()`
- `onKeyDown` (any field): Enter → `saveSplitEntry()` if valid
- `onBlur` (split Debit): if value, clear split Credit
- `onBlur` (split Credit): if value, clear split Debit
- `onFocus` (any field with value): select all text
- Remove button `onClick`: `removeSplitEntry(splitId)`
- Add Split button `onClick`: `addSplitEntry()`
- Save button `onClick`: `saveSplitEntry()`
- Cancel button `onClick`: `cancelSplit()`

### Data Service Calls

```typescript
// Load ledger
const account = await dataService.getAccount(accountId);
const entity = await dataService.getEntity(account.entityId);
const entries = await dataService.getLedgerEntries(accountId);
const balance = await dataService.getAccountBalance(accountId);

// Save transaction (simple)
await dataService.createTransaction({
  date,
  reference,
  memo,
  entries: [
    { accountId: currentAccountId, debit: amount, credit: 0 },
    { accountId: offsetAccountId, debit: 0, credit: amount }
  ]
});

// Save transaction (split)
await dataService.createTransaction({
  date,
  reference,
  memo,
  entries: [
    { accountId: currentAccountId, debit/credit },
    ...splitEntries.map(split => ({
      accountId: split.accountId,
      note: split.note,
      debit: split.debit,
      credit: split.credit
    }))
  ]
});
```

### Navigation

**Entry Points:**
- From Accounts View: click account name → `/ledger/[accountId]`
- From split detail: click split account → `/ledger/[splitAccountId]`

**Exit:**
- Back link → returns to Accounts View for current entity

### Future Features (Not MVP)

**Click-to-Edit:**
- Click existing transaction row → load into entry form
- Simple transaction → simple mode
- Split transaction → split mode with all splits
- Save/Cancel to complete edit

**Delete:**
- Delete button in edit mode with confirmation dialog

## Acceptance Criteria

- [ ] Can enter multiple simple transactions without leaving keyboard
- [ ] Can enter split transactions with auto-balance assistance
- [ ] Offset account autocomplete filters and sorts correctly
- [ ] Colon completion works for partial path entry
- [ ] Tab flow is consistent and completes transactions correctly
- [ ] Balance updates in real-time
- [ ] Transaction validation prevents unbalanced or incomplete entries
- [ ] Linked Accounts View updates when entries are made

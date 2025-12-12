# Consolidation: Account Ledger

**Route:** `/ledger/[accountId]`
**Source:** `design/stories/web/03-entries.md`, `design/specs/web/screens/ledger.md`, `design/specs/web/global/transaction-edit.md`, `design/specs/web/global/account-autocomplete.md`
**Generated:** 2024-12-12

## Purpose

Primary transaction entry interface for an account. Optimized for keyboard-centric rapid data entry without requiring constant visual attention to the screen.

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

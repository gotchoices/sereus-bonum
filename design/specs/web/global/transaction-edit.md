# Spec: Transaction Editor Component

**Purpose:** Reusable component for editing transactions (new or existing). The component is mode-agnostic - it doesn't know or care whether it's editing a new blank transaction or an existing one. The consumer (ledger screen, import review, etc.) provides the transaction data and handles the results.

**See [Ledger Screen](../screens/ledger.md)** for display context:
- How editor appears in ledger (inline, aligned with table columns)
- Column headers (not repeated within editor)
- Visual treatment (colored border, alignment with surrounding transactions)
- New entry vs edit mode workflows

---

## Component Interface

The editor is a pure component that receives transaction data and fires callbacks:

**Props:**
- `transaction` - Transaction data (blank for new, populated for existing)
- `accountId` - Current account (ledger context)
- `entityId` - Current entity
- `onSave(transaction)` - Called when user saves (consumer handles create vs update)
- `onCancel()` - Called when user cancels (consumer handles cleanup)
- `onDelete()` - Optional - if provided, shows delete button

**Display:**
- Delete button visible only if `onDelete` prop exists
- Otherwise identical behavior for new and existing transactions

---

## General Rules

- The user should be able to do multiple transactions in sequence without fingers leaving the keyboard
- This typically means entering data into fields and using the tab key to advance and the Space (or possibly Enter) key to activate selected buttons
- Tab should advance to the next logical/reasonable field where the user might want to enter data
- When tabbing into any field that contains a value, the text is automatically selected (allows quick replace by typing, or edit by using arrow keys)
- There is a "Current Account" which is the account we are currently viewing the ledger for

---

## Two Modes: Simple and Split

The editor operates in one of two modes. User can switch between modes during editing.

### Simple Mode

Edit a transaction with two entries: the current account and one offset account.

**Fields (in tab order):**
1. Date (required): Date picker
2. Ref (optional): Reference/check number
3. Memo (optional): Transaction description
4. Account (required): Offset account - uses **[Account Autocomplete](./account-autocomplete.md)**
5. Split button `[|]`: Converts to split mode (enabled only when Account field is empty)
6. Debit (one required): Amount field
7. Credit (one required): Amount field

**Note:** The consumer (e.g., ledger screen) determines visual layout and alignment. See [Ledger Screen](../screens/ledger.md) for how fields are positioned within the table structure.

**Validation:**
- Date must be valid
- Account must be selected (not just typed text)
- Exactly one of Debit OR Credit must have a value (not both, not neither)
- When one field has a value and user tabs away from it, the other field is cleared

**Tab Flow:**
- Date → Ref → Memo → Account → Debit → Credit
- Tab from Credit (or Debit if Credit empty): Save transaction

### Split Mode

Edit a transaction with multiple entries: the current account and multiple offset accounts.

**Main Transaction Fields:**
1. Date (required): Date picker
2. Ref (optional): Reference/check number
3. Memo (optional): Transaction description
4. Current Account (display only): Disabled/grayed, shows account being viewed
5. Debit (one required): Amount for current account
6. Credit (one required): Amount for current account

**Split Entry Fields (repeating):**
1. Note (optional): Description for this entry
2. Account (required): Offset account with autocomplete
3. Debit (one required): Amount field
4. Credit (one required): Amount field
5. Remove `[×]`: Button to delete this split (mouse-only)

**Entry to Split Mode:**
- Click split button `[|]` (when Account field is empty in simple mode)
- OR: Component receives transaction with 3+ entries

**Note:** See [Ledger Screen](../screens/ledger.md) for how split fields are positioned and aligned within the table structure.

**When Entering Split Mode:**
- Current Account is entered into the account field of the main line (disabled/grayed out)
- Cursor advances to the Debit field of the main line
- Split entry lines appear below

**Auto-Balance:**
- Any split entry line that has neither credit nor debit yet entered will be pre-filled with the amount that would balance the transaction
- Pre-filled amounts are selected, easily overrideable by typing

**Validation:**
- Date must be valid
- Main line: Either Debit OR Credit (not both, not neither)
- Each split: Account selected and either Debit OR Credit (not both, not neither)
- Transaction must balance: Sum of all entries = $0.00 (within $0.01 tolerance)
- When one field (Debit or Credit) has value and user tabs away, the other field is cleared

**Tab Flow:**
- Main line: Date → Ref → Memo → (Current Account disabled) → Debit → Credit
- From main Credit → First split Note
- Split entry: Note → Account → Debit → Credit → Next split Note (or actions if last split)
- If last split balances: Tab → Save action
- If last split doesn't balance: Tab → auto-creates new split entry line (pre-filled with balancing amount)

**Split Actions:**
- `[×]` Remove button: Removes that split row (not in tab order, mouse-only)
- `[+ Add Split]` button: Manually adds new split row (rarely needed, usually auto-created)

---

## Keyboard Navigation

### Tab Key
- Advances through fields in logical order
- From last field (Credit): Saves transaction (calls `onSave`)
- When tabbing into populated field: Auto-selects text

### Enter Key
- In input field: Saves transaction (calls `onSave`)
- On button: Activates button

### Escape Key
- Cancels editing, discards changes (calls `onCancel`)

### Space Key
- On split button: Toggles split mode
- On other buttons: Activates button

### Ctrl+Enter
- Toggles split mode from anywhere in the transaction

---

## Actions

### Save
- Validates transaction
- If valid: Calls `onSave(transaction)` with validated data
- If invalid: Shows inline errors, prevents save

**Consumer handles:**
- Create new transaction or update existing
- Refresh ledger display
- Create new blank entry row (if new transaction)
- Return to view mode (if editing existing)

### Cancel
- Calls `onCancel()` without validation
- Discards all changes

**Consumer handles:**
- Clear blank entry row (if new transaction)
- Restore original transaction display (if editing existing)
- Exit edit mode

### Delete
- Only shown if `onDelete` prop is provided
- Shows confirmation dialog: "Delete this transaction? [Cancel] [Delete]"
- If confirmed: Calls `onDelete()`

**Consumer handles:**
- Delete transaction from database
- Remove from ledger display
- Update account balance

---

## Account Selection

Uses **[Account Autocomplete](./account-autocomplete.md)** component for all account inputs.

**Behavior:**
- Type to search and filter
- Colon (`:`) for progressive path completion
- Tab/Enter to select
- Arrow keys to navigate dropdown
- Escape to close dropdown

**Display in dropdown:**
- Full account path for disambiguation
- Example: "Expenses : Operating : Utilities : Electric"

---

## Validation Rules

### Simple Mode
- Date: Must be valid date
- Account: Must have `selectedId` (not just text)
- Amount: Exactly one of Debit OR Credit (not both, not neither)

### Split Mode
- Date: Must be valid date
- Main line: Either Debit OR Credit (not both, not neither)
- Each split: `selectedId` set AND either Debit OR Credit (not both, not neither)
- Balance: Sum of all entries = $0.00 (within $0.01 tolerance)

### Visual Feedback
- Invalid fields: Red border or highlight
- Balance indicator: ✓ (balanced) or ⚠ $X.XX (imbalance amount)
- Save action disabled until all validation passes

---

## Split Mode Details

### Switching Modes

**Simple → Split:**
- Click split button `[|]` (enabled only when Account field is empty)
- Current account populates main line (disabled)
- One blank split entry line appears
- Cursor moves to main Debit field

**Split → Simple:**
- Remove all but one split entry
- Component automatically collapses to simple mode
- Remaining split account becomes offset account

### Split Entry Management

**Adding Splits:**
- Tab from last split Credit when unbalanced → auto-creates new split
- Click `[+ Add Split]` button → manually adds new split
- New splits pre-filled with balancing amount

**Removing Splits:**
- Click `[×]` button on split row
- Minimum 1 split entry required
- Cannot remove all splits

**Split Order:**
- Splits display in creation order
- No reordering in MVP

---

## Notes

- Component is stateless from consumer perspective (controlled component)
- Consumer manages transaction state and provides to component
- Component handles internal UI state only (field values during edit session)
- All persistence, navigation, and mode transitions handled by consumer


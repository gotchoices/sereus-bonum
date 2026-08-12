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
5. Split button `[|]`: Inline with Account field (NEW entry only, enabled when Account is empty)
6. Debit (one required): Amount field, in the row account's own unit
7. Credit (one required): Amount field, in the row account's own unit

If the offset account holds a different unit than the current account, the row gains Price and Value
fields — see [Multi-Unit Entries](#multi-unit-entries).

**Note:** The consumer (e.g., ledger screen) determines visual layout and alignment. See [Ledger Screen](../screens/ledger.md) for how fields are positioned within the table structure.

**Converting to Split Mode:**
- **During NEW entry:** Split button `[|]` appears inline with Account field (enabled when Account is empty)
- **During EDIT:** `[+ Add Split]` button appears in actions row (always enabled)
- Both convert the transaction from simple to split mode

**Validation:**
- Date must be valid
- Account must be selected (not just typed text)
- Exactly one of Debit OR Credit must have a value (not both, not neither)
- When one field has a value and user tabs away from it, the other field is cleared

**Actions (Edit Mode):**
- `[Save]` button: Commits changes
- `[Cancel]` button: Discards changes
- `[+ Add Split]` button: Converts to split mode
- `[Delete]` button: Deletes transaction (confirmation required)

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
- Transaction must balance **in its reckoning unit**: the sum of every row's Value = zero exactly.
  For an all-one-unit transaction (the common case) Value is just the amount, so this reads as the
  familiar "sum of entries = $0.00".
- A row in a non-reckoning unit with no Value yet is **incomplete**, not zero — it blocks the save and
  says which unit still needs a value.
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

## Multi-Unit Entries

Most transactions are single-unit and none of this appears. It surfaces the moment two accounts in
one transaction hold different units — shares and dollars, euros and dollars, widgets and CHIPs. The
rules are in [domain/units.md](../../domain/units.md).

### The default entry unit is the account's own unit

A row for a stock account asks for **shares**, not dollars. A row for a CHIP account asks for CHIPs.
The unit symbol is shown in or beside the field so it's never ambiguous what the number means.

### Quantity, Price, Value — any two fill the third

When a row's account holds a unit other than the transaction's reckoning unit, that row expands from
a single amount into three fields:

```
  Note        Account            Quantity        Price        Value
  Buy 100     Stock : VPER    12,800.0000  ×  0.013500  =    172.80
```

- The user fills **any two**; the third computes immediately and is shown as derived (not typed).
- Editing a filled field recomputes the field the user did *not* most recently touch, so the pair
  they're actively working with is preserved.
- **Quantity** is in the account's unit. **Value** is in the transaction's reckoning unit. **Price**
  is value ÷ quantity, expressed per one whole unit (dollars per share, not cents per ten-thousandth
  of a share).
- Rows whose account already holds the reckoning unit keep the ordinary single-amount Debit/Credit
  presentation — no price, no value.

### The reckoning unit

The transaction shows which unit its values are reckoned in, and it is editable. Bonum proposes one
per [domain/units.md](../../domain/units.md#choosing-the-reckoning-unit) — the entity's base unit
when the transaction touches it, otherwise the finest-grained leg. The user may choose **any unit the
transaction touches**, including a stock or a CHIP: a stock-for-stock barter with a CHIP fee is
reckoned in one of the stocks and never mentions a currency.

Changing the reckoning unit re-expresses the Value column; it never changes a Quantity, because
quantities are the recorded facts.

### Implied-rate confirmation (required)

Whenever the user supplies a quantity and a value (rather than typing the price directly), the editor
must:

1. Show the **implied rate** prominently, in whole units — "1 VPER = $0.0135".
2. Require an explicit acknowledgment before the transaction can be saved.
3. **Warn** when the implied rate deviates sharply from the most recent reference rate for that pair,
   naming both rates.

This exists to catch a *forgotten row*. Buying €850 for $1,000 while omitting a $30 wire fee still
balances — it just silently implies $1.212/EUR instead of $1.176/EUR, hiding the $30 inside a
distorted rate. An imbalance would be caught; a distorted rate would not. Hence the confirmation.

### Rates are per row

Two rows on the same account, in the same transaction, may carry different prices — a stock order
that fills at three prices is three rows at three rates, and all three are recorded. The editor must
never average them into one rate or collapse the rows.

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
- Balance: sum of every row's Value = zero, exactly, in the reckoning unit

### Multi-Unit
- Every row whose account holds a non-reckoning unit has a Value (any two of quantity/price/value)
- The reckoning unit is one of the units the transaction actually touches
- Any implied rate has been shown and acknowledged

### Visual Feedback
- Invalid fields: Red border or highlight
- Balance indicator: ✓ (balanced) or ⚠ X.XX (imbalance, in the reckoning unit with its symbol)
- Implied rates displayed inline per row; unacknowledged rates block save
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


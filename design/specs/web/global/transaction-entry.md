# Spec: Transaction Entry

## General Rules
- The user should be able to do multiple transactions in a row without fingers leaving the keyboard
- This typically means data entry in fields and using tab key to advance and space key to activate selected buttons
- Tab should advance to the next logical field where the user might want to enter data
- A new blank transaction is created when the user tabs beyond the current entry
- There is a "Current Account" which is the account we are currently viewing the ledger for

## Simple Mode Rules
- The user enters optionally ref and memo
- The user enters an account.  This is the "offset account"
- A tab takes us to the debit field
- An amount may be entered.  Regardless, another tab takes us to the Credit field
- An amount may be entered.  If so, it takes precidence and nulls out the Debit field if any exists.
- A further tab completes the transaction and takes us to the next logical step
  - If we were editing a previous transaction, this means just closing the edit
  - If we were adding a new transaction, this takes us to a new transaction to edit

## Split Mode Rules
- Split mode is invoked by pressing the split button
- The split button is only active if there is nothing in the account window of the primary (transaction) line
- When entering split mode:
  - Enter the Current Account into the account field of the primary line
  - Advance to the Debit field of the primary line
  - Open a new split line with the cursor in the first field of that line
- Any split line that has neither a credit nor a debit yet entered (like the newly entered split line) will be pre-filled with the number that would balance the transaction
- Now a tab out of Credit will advance to the first field of the next entry (split) line
- If the user tabs into a debit or credit column that is already filled, the amount will be selected so that any typing of a number will replace the old value.
- If the last split line balances the transaction, tabbing out of the credit column will close the edit
- If the last split does not balance the transaction, tabbing out will create a new split line which will likewise be pre-filled with a balancing value.
- Closing the edit of a newly added transaction will (like in a simple entry) position the cursor in the first field of a new, empty transaction

## Two Modes

**Simple:** One offset account (two entries total: current account + one offset)
**Split:** Multiple offset accounts (multiple entries: current account + multiple offsets)

**Toggle:** Split button (`|`) or `Ctrl+Enter`

## General Rules

**Keyboard-first workflow:**
- User should complete multiple transactions without leaving keyboard
- Tab advances to next logical field
- Space activates focused button
- Consistent tab flow regardless of data (same number of fields every time)

**Auto-select on Tab:**
- When tabbing into any field that contains a value, select all text
- Allows quick replace (start typing) or edit (arrow keys)
- Applies to: Date, Ref, Memo, Account, Debit, Credit, Note

**Current Account:**
- The account whose ledger is being viewed
- Appears in every transaction on this ledger

## Simple Mode

### Layout
```
Date | Ref | Memo | [Account] [|] | Debit | Credit
```

### Tab Flow
```
Date → Ref → Memo → Account
  If Account empty: → Split button (Space toggles split mode)
  If Account filled: → Debit (skip split button)
Debit → Credit → Tab saves and creates new blank row, cursor to Date
```

### Field Behavior

**Account:**
- Uses AccountAutocomplete component
- Required for transaction

**Split Button:**
- Position: Right of Account input
- Enabled: Only when Account is empty
- Disabled: When Account has value (grayed out)
- Space/Enter: Toggles split mode

**Debit and Credit:**
- Both fields always enabled (consistent tab flow)
- On blur: If field has value, clear the other field
- Result: Only one can have value at a time, but tab count is consistent

**Saving:**
- Tab from Credit field: Saves transaction, creates new blank row, cursor to Date of new row
- Enter in any field: Saves transaction if valid

### Validation

Required:
- Date (valid date)
- Account (selectedId set)
- Debit OR Credit (exactly one must have value, not both, not neither)

## Split Mode

### Entry Sequence

1. User enters Date, Ref, Memo (optional)
2. User clicks Split button (Account field must be empty)
3. System enters split mode:
   - Current Account appears in account field (disabled)
   - New blank split row appears
   - Cursor moves to **Debit field of main transaction line**
4. User enters amount in Debit or Credit
5. Tab advances to first split's Note field

### Layout

```
Main transaction line (shared fields):
Date | Ref | Memo | [Current Account (disabled)] | Debit | Credit

Split rows (one or more):
Note | [Account] | Debit | Credit | [×]

[Save] [Cancel] [+ Add Split]
```

### Tab Flow

```
Date → Ref → Memo → Account (disabled, skipped) → Debit → Credit
  → First split: Note → Account → Debit → Credit
  → Next split: Note → Account → Debit → Credit
  → (etc.)
  → Last split Credit:
      If unbalanced: Auto-creates new split line (cursor to Note)
      If balanced: → Save button → Cancel button → Add Split button
```

**Enter key:**
- In input field: Saves transaction if valid
- On button: Activates that button

### Auto-Balance

**Any new split line gets pre-filled with amount needed to balance:**
- Main account Debit $100 → First split pre-fills Credit $100
- Main account Credit $100 → First split pre-fills Debit $100
- If splits don't sum to balance → New split pre-fills appropriate column

**User can override:**
- Field is auto-selected (Issue 5)
- Type to replace
- Tab to accept and advance

### Debit/Credit Behavior

Same as Simple Mode:
- Both fields always enabled
- On blur: If field has value, clear the other field
- Only one field can have value per split row

### Validation

Required:
- Date (valid date)
- Main account Debit OR Credit
- Each split: Account (selectedId) + Debit OR Credit (exactly one)
- Transaction must balance: Sum of all entries = $0.00 (±$0.01 tolerance)

**Save button disabled if invalid**

## Actions

**Save:**
- Validates transaction
- If valid: Saves, clears form, exits split mode, creates new blank row
- If invalid: Shows inline errors, disables button

**Cancel:**
- Exits split mode
- Discards split rows
- Returns to simple mode
- Does not save

**Add Split:**
- Manually adds new split row
- Pre-fills with balancing amount
- Rarely used (usually auto-created by tabbing)

**Remove (×):**
- Removes that split row
- Not in tab order (mouse-only)

## Editing Existing Transactions

**Not MVP**

**Current:** Click transaction row → Logs entry ID to console

**Future:**
- Click row → Load into entry form
- Simple transaction → Simple mode
- Split transaction → Split mode with all splits
- Edit fields → Save or Cancel

## Deleting Transactions

**Not MVP**

**Future:** Delete button in edit mode with confirmation

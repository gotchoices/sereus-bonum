# Spec: Transaction Entry

## General Rules

- The user should be able to do multiple transactions in sequence without fingers leaving the keyboard
- This typically means entering data into fields and using the tab key to advance and the Space (or possibly Enter) key to activate selected buttons
- Tab should advance to the next logical/reasonable field where the user might want to enter data
- When entering data, a new blank transaction is created when the user tabs beyond the current entry
- Ideally, data entry should not require the user to look at the screen all the time in case they are reading data off a paper or separate screen
- When tabbing into any field that contains a value, the text is automatically selected (allows quick replace by typing, or edit by using arrow keys)
- There is a "Current Account" which is the account we are currently viewing the ledger for

## Simple Mode

The user enters a transaction with two accounts: the current account (the ledger being viewed) and one offset account.

### How It Works

- The user optionally enters ref and memo
- The user enters an account. This is the "offset account"
- A tab takes us to the debit field
- An amount may be entered. Regardless, another tab takes us to the Credit field
- An amount may be entered. If so, it takes precedence and nulls out the Debit field if any exists
- A further tab completes the transaction and takes us to the next logical step:
  - If we were editing a previous transaction, this means just closing the edit
  - If we were adding a new transaction, this takes us to a new transaction to edit

### Layout

```
Date | Ref | Memo | [Account] [|] | Debit | Credit
```

The split button (`|`) appears to the right of the Account input. It's only enabled when the Account field is empty.

### Requirements

- Date must be a valid date
- Account must be selected (not just typed text)
- Either Debit OR Credit must have a value (not both, not neither)
- When one field has a value and the user tabs away from it, the other field is cleared

## Split Mode

The user enters a transaction with multiple accounts: the current account and multiple offset accounts.  There can be any number of debit and credit entries.

### How It Works

- The user invokes split mode via the split button (when Account field is empty)
- The split button is only active if there is nothing in the account field of the primary (transaction) line
- When entering split mode:
  - The Current Account is entered into the account field of the primary line (disabled/grayed out)
  - The cursor advances to the Debit field of the primary line
  - A new split entry line opens below the primary line
- Any split entry line that has neither a credit nor a debit yet entered will be pre-filled with the amount that would balance the transaction
- Tabbing out of the Credit field will advance to the first field of the next split entry line
- If the user tabs into a debit or credit column that is already filled, the amount will be selected so that any typing of a number will replace the old value
- If the last split entry line balances the transaction, tabbing out of the credit column goes to the Save button
- If the last split entry line does not balance the transaction, tabbing out creates a new split entry line which will likewise be pre-filled with a balancing value
- Closing the edit of a newly added transaction will (like in a simple entry) position the cursor in the first field of a new, empty transaction

### Layout

```
Main transaction line (shared fields):
Date | Ref | Memo | [Current Account (disabled)] | Debit | Credit

Split rows (one or more):
Note | [Account] | Debit | Credit | [×]

[Save] [Cancel] [+ Add Split]
```

### Requirements

- Date must be a valid date
- Main account must have either Debit OR Credit (not both, not neither)
- Each split must have an account selected and either Debit OR Credit (not both, not neither)
- Transaction must balance: Sum of all entries = $0.00 (within $0.01 tolerance)
- When one field (Debit or Credit) has a value and the user tabs away from it, the other field is cleared
- Save button is disabled until all requirements are met

## Actions

**Save:**
- Validates the transaction
- If valid: Saves, clears the form, exits split mode if active, creates a new blank row
- If invalid: Shows inline errors, disables the button

**Cancel:**
- Exits split mode
- Discards split rows
- Returns to simple mode
- Does not save

**Add Split:**
- Manually adds a new split row
- Pre-fills with balancing amount
- Rarely used (usually auto-created by tabbing when unbalanced)

**Remove (×):**
- Removes that split row
- Not in tab order (mouse-only)

## Editing Existing Transactions

Editing uses the same component as new entry - same fields, same keyboard navigation, same validation.

**See [Ledger Screen Spec](../screens/ledger.md#editing-existing-transactions)** for:
- Where editing happens (in-place in ledger)
- Visual treatment (colored border)
- Locked transaction handling

**Component behavior when editing:**
- Loads transaction data into editable fields
- Simple transaction → Simple mode (single line, all fields editable)
  - **Split button available:** Can convert simple transaction to split during edit
- Split transaction → **Always shows in split mode** (transaction line + entry lines, all editable)
  - All entries visible for editing, regardless of collapsed/expanded state in view
- Fields mirror display layout but are editable inputs
- **Esc key:** Cancel editing, discard changes, exit edit mode
- **Tab out** (from last field): Validate and save transaction
- **🗑️ icon:** Delete transaction (shows confirmation dialog)
- **On exit:** Returns to view mode, restoring previous display state (collapsed/expanded)
- Save → `updateTransaction()` instead of `createTransaction()`

## Deleting Transactions

**Not MVP**

**Future:** Delete button in edit mode with confirmation

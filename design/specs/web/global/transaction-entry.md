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

**Simple:** One offset account
**Split:** Multiple offset accounts

Toggle: Split button (`|`) or `Ctrl+Enter`

## Simple Mode Layout

```
Date | Ref | Memo | [Account] [|] | Debit | Credit
```

## Simple Mode Tab Flow

```
Date → Ref → Memo → Account
  If Account empty: → Split button
  If Account filled: → Debit (skip split button)
Debit OR Credit → Tab saves entry, focuses next Date
```

## Split Button

- Position: Right of Account input
- Enabled: Only when Account input is empty
- Disabled: When Account has selected value (grayed out)
- Keyboard: Space or Enter toggles split mode

## Simple Mode Validation

Required:
- Date
- Account (selectedId set)
- Debit OR Credit (not both, not neither)

## Split Mode Layout

```
Main transaction (shared fields):
Date | Ref | Memo | [Current Account (disabled)] | Debit | Credit

Split rows (multiple):
Note | [Account] | Debit | Credit | [×]

Balance: $0.00 ✓
[+ Add Split] [Save] [Cancel]
```

## Split Mode Tab Flow

```
Date → Ref → Memo → Account (disabled, skipped) → Debit/Credit
  → First split: Note → Account → Debit → Credit
  → Second split: Note → Account → Debit → Credit
  → (etc.)
  → Last split Credit → Add Split button → Save → Cancel
```

Enter key anywhere: Saves (if valid)

## Auto-Balance

New split defaults:
- If main account is Debit $X, first split defaults to Credit $X
- If main account is Credit $X, first split defaults to Debit $X
- Subsequent splits: Calculate remaining to balance, pre-fill appropriate column

User can override any default.

## Split Mode Validation

Required:
- Date
- Main account Debit OR Credit
- Each split: Account (selectedId) + Debit OR Credit (not both, not neither)
- All entries must sum to $0.00 (±$0.01 tolerance)

## Actions

**Add Split:** Adds new row with auto-balance amount
**Save:** Validates and saves, clears form, exits split mode
**Cancel:** Exits split mode, discards splits, returns to simple mode

## Editing (Not MVP)

Click transaction row: Log entry ID (placeholder)
Future: Load into form for editing

## Deleting (Not MVP)

Future: Delete button in edit mode

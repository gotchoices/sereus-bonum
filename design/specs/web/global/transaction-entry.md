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

Click transaction → expands in-place into editable form with active border.

**Simple transaction:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Date: [2024-12-10▼] Ref: [1234] Memo: [Grocery Store________]  │
│                                                                 │
│ Account: [Groceries ▼] [|]  Debit: [125.50] Credit: [_____]    │
│                                                                 │
│ [Save] [Cancel] [Delete]                                        │
└─────────────────────────────────────────────────────────────────┘
```

**Split transaction:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Date: [2024-12-12▼] Ref: [1236] Memo: [Bill payment________]   │
│                                                                 │
│ Checking Account    Debit: [______] Credit: [450.00]           │
│                                                                 │
│ Note: [Electric] [Utilities ▼] Debit: [150.00] Credit: [] [×]  │
│ Note: [Internet] [Utilities ▼] Debit: [100.00] Credit: [] [×]  │
│ Note: [Phone___] [Utilities ▼] Debit: [200.00] Credit: [] [×]  │
│                                                                 │
│ Balance: $0.00 ✓   [Add Split] [Save] [Cancel] [Delete]        │
└─────────────────────────────────────────────────────────────────┘
```

- Active border shows edit mode
- Same keyboard navigation as new entry
- [Delete] button with confirmation

**Locked Transactions (Closed Periods):**
```
>  | 2024-01-10 | 1001 | Old transaction    | Expenses  | $50.00   | | $1,000.00
>  | 2024-01-15 | 1002 | Another old one    | Utilities | $100.00  | | $900.00
══════════════════════════════════════════════════════════════════════════════
🔒 Transactions above this line are locked (period closed 2024-01-31)
══════════════════════════════════════════════════════════════════════════════
>  | 2024-02-01 | 1003 | Editable entry     | Groceries | $75.00   | | $825.00
>  | 2024-02-05 | 1004 | Recent entry       | Gas       | $45.00   | | $780.00
```

- Separator line with 🔒 icon divides locked/editable transactions
- Locked transactions slightly dimmed
- Click locked transaction → tooltip "Cannot edit - period closed"

## Deleting Transactions

**Not MVP**

**Future:** Delete button in edit mode with confirmation

---

## Transaction Display (Collapsed vs Expanded)

Each transaction can be collapsed (1 line) or expanded (transaction + entry lines).

**Collapsed (default):**
```
>  | Date       | Ref  | Memo           | Account      | Debit    | Credit   | Balance
>  | 2024-12-10 | 1234 | Grocery Store  | Groceries    | $125.50  |          | $5,234.00
>  | 2024-12-11 | 1235 | Salary         | Salary Inc   |          | $2,500.00| $7,734.00
>  | 2024-12-12 | 1236 | Bill payment   | [Multiple]   | $450.00  |          | $7,284.00
```
- `>` icon on left to expand
- Shows net effect on current account
- "[Multiple]" for splits with 3+ entries

**Expanded:**
```
v  | Date       | Ref  | Memo           | Account              | Debit    | Credit   | Balance
v  | 2024-12-10 | 1234 | Grocery Store  |                      |          |          | $5,234.00
   |            |      |                | Checking Account     |          | $125.50  |
   |            |      |                | Groceries            | $125.50  |          |

v  | 2024-12-12 | 1236 | Bill payment   |                      |          |          | $7,284.00
   |            |      |                | Checking Account     |          | $450.00  |
   |            |      |                | Electric             | $150.00  |          |
   |            |      |                | Internet             | $100.00  |          |
   |            |      |                | Phone                | $200.00  |          |
```
- `v` icon on left to collapse
- Transaction line: Date/Ref/Memo filled, Account/Debit/Credit empty, Balance shows
- Entry lines: Date/Ref/Memo empty (shows indentation), Account/Debit/Credit filled
- No balance on entry lines

**Controls:** `[Expand All]` `[Collapse All]` buttons at top

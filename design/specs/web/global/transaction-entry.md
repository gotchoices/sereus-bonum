# Spec: Transaction Entry

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

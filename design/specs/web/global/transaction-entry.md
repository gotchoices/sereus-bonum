# Spec: Transaction Entry

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

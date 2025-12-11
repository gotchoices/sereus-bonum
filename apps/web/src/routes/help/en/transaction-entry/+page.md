# Transaction Entry Help

## Keyboard-First Design

Transaction entry is designed for rapid keyboard data entry. You should be able to enter multiple transactions in a row without ever touching your mouse.

### General Behavior

- **Tab** always moves to the next logical field
- When you tab into a field that already has a value, that value is automatically selected
- You can type to replace it, or press an arrow key to edit it
- **Enter** in any field saves the transaction (if it's valid)
- **Space** activates buttons when they're focused

## Simple Mode (One Offset Account)

This is the default mode for entering a transaction with just two accounts: the current account you're viewing, and one other account.

### The Fields

1. **Date** - Defaults to today
2. **Ref** - Optional reference number (check number, etc.)
3. **Memo** - Optional description
4. **Account** - Search for the offset account (see Account Selection Help)
5. **Split Button** (|) - Only active if Account is empty
6. **Debit** - Enter if money is coming into this account
7. **Credit** - Enter if money is leaving this account

### Tab Flow

```
Date → Ref → Memo → Account
  → Debit → Credit → Saves and starts new transaction
```

### Debit and Credit

Both fields are always there (consistent tab pattern), but only one can have a value:

- Enter an amount in Debit, then tab away - Credit stays empty
- Enter an amount in Credit, then tab away - Debit is cleared
- Whichever field you leave last "wins"

This gives you a consistent two-tab rhythm to finish every transaction.

## Split Mode (Multiple Offset Accounts)

Use split mode when one transaction affects more than two accounts. For example, a grocery run where you bought food, cleaning supplies, and office supplies.

### Entering Split Mode

1. Make sure the Account field is empty
2. Click the split button (|) or press Ctrl+Enter
3. The current account appears in the Account field (grayed out)
4. A blank split line appears below
5. Your cursor moves to the Debit or Credit field

### Entering a Split Transaction

1. Enter the total amount in Debit or Credit on the main line
2. Tab to the first split line
3. The split line is pre-filled with the amount needed to balance
4. Enter a note (optional) and select the account
5. Change the amount if needed, or tab to accept it
6. Tab from Credit goes to the next split line

### Smart Split Creation

- If your last split doesn't balance the transaction, tabbing creates a new split line automatically
- If your last split does balance the transaction, tabbing goes to the Save button
- The pre-filled amounts help you quickly balance multi-way splits

### Example

You withdraw $100 from checking and spend it three ways:

```
Main line: Credit $100 (Checking account)

Split 1: Debit $30 - Groceries
Split 2: Debit $40 - Gas
Split 3: Debit $30 - Office Supplies (auto-filled)
```

Tab through each split, and when the last one balances, tab goes to Save.

### Split Mode Buttons

- **Save** - Saves the transaction (also: press Enter anywhere)
- **Cancel** - Discards the splits and returns to simple mode
- **+ Add Split** - Manually add another split (rarely needed)

### Tips

- You can enter any number of debits or credits in the splits
- Each split can be either a debit or a credit
- The transaction must balance (sum to $0.00) before you can save
- When tabbing into pre-filled amounts, they're automatically selected for easy replacement

## What Happens When You Save

- The transaction is recorded
- The form clears
- A new blank transaction appears
- Your cursor is in the Date field, ready for the next entry

This lets you enter transaction after transaction in rapid succession.

---

*Generated from: design/specs/web/global/transaction-entry.md*


# Account Selection Help

## How It Works

When you need to select an account, you'll see a text input field. Start typing part of the account name, and matching accounts will appear in a list below.

### Basic Selection

- **Type** to search - The list filters as you type
- **Arrow keys** move the highlight up and down
- **Tab** selects the highlighted account and moves to the next field
- **Enter** selects the highlighted account and stays in the same field
- **Escape** closes the list without selecting

### Quick Entry with Colon

For faster entry, you can use the colon (`:`) key to progressively complete account paths:

1. Type the first few letters of an account type (like "exp" for Expenses)
2. Press `:` - it completes to "Expenses : "
3. Type the next part (like "ut" for Utilities)
4. Press `:` again - it completes to "Expenses : Utilities : "
5. Keep going until you reach the account you want
6. Press Tab to finish

**Example:** Type `a:c:c` and you'll quickly get to "Assets : Current Assets : Checking"

### How the List Works

The list shows up to 10 matching accounts. Accounts appear in this order:

1. Exact matches on the account name
2. Accounts whose path starts with what you typed
3. Accounts whose name starts with what you typed
4. Accounts whose type starts with what you typed
5. Anything else that contains what you typed

### Tips

- If you type "land" and see "Assets : Land Holdings : Building A" highlighted, pressing `:` will complete to "Assets : Land Holdings : "
- You can use the arrow keys to highlight a different result, then press `:` to complete that one instead
- The colon always completes through the longest matching part, but never the final account name
- If you tab away without selecting an account, the field will clear

### Arrow Keys

- **Up/Down** move through the list
- **Left/Right** move your cursor in the text normally

---

*Generated from: design/specs/web/global/account-autocomplete.md*


# Spec: Account Autocomplete

## Rules

When the user needs to select an account, they see a text input field. As they start typing, a dropdown list appears below showing matching accounts.

### Basic Selection
- The user types part of an account name
- The list filters to show matching accounts (up to 10 results)
- The top result is highlighted by default
- Arrow keys (up/down) move the highlight through the list
- Tab selects the highlighted account, fills the input with the full path, and moves to the next field
- Enter selects the highlighted account, fills the input with the full path, but stays in the same field
- Escape closes the list without selecting anything
- Clicking outside the dropdown closes it without selecting

### Quick Entry with Colon
The user can use the colon (`:`) key to progressively complete account paths:
- Type the first few letters (like "exp" for Expenses)
- Press `:` and it completes to "Expenses : "
- Type the next part (like "ut" for Utilities)  
- Press `:` again and it completes to "Expenses : Utilities : "
- Continue until reaching the desired account, then press Tab to finish

The colon completion uses whichever result is currently highlighted. If the user types "land" and sees "Assets : Land Holdings : Building A" highlighted, pressing `:` completes to "Assets : Land Holdings : ". If they arrow down to a different result first, the colon will complete that one instead.

The colon always completes through the longest path element that contains what was typed, but never completes the final account name (since there's no colon after it).

### How Results Are Ordered
The list shows accounts in priority order:
1. Exact matches on account name come first
2. Then accounts whose full path starts with what was typed
3. Then accounts whose name starts with what was typed
4. Then accounts whose type starts with what was typed
5. Finally anything that contains what was typed anywhere

The search matches case-insensitively against the account name, code, group name, type name, or full path.

### Field Behavior
- Left/Right arrow keys move the cursor in the text normally
- If the user tabs away without selecting an account, the field clears
- The input must have a valid account selected (not just text) before the transaction can be saved

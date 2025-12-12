# Spec: Account Autocomplete

**Component:** `AccountAutocomplete.svelte`

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

### Field Behavior
- Left/Right arrow keys move the cursor in the text normally
- If the user tabs away without selecting an account, the field clears
- The input must have a valid account selected (not just text) before the transaction can be saved

## Interface

```typescript
<AccountAutocomplete
  entityId={string}           // Required: which entity's accounts
  bind:value={string}          // Current search text / selected path
  bind:selectedId={string}     // Selected account ID (empty if none)
  placeholder={string}         // Input placeholder
  disabled={boolean}           // Disable input
  onselect={(result) => {}}    // Callback when account selected
/>
```

## Dropdown Behavior

- Appears when user types (if results exist)
- Shows max 10 results
- Scrollable if more than 10
- Top result highlighted by default
- Closes on: selection (Tab/Enter), Escape, click outside

## Search

**Match criteria:** Case-insensitive match on account name, code, group name, type name, or full path

**Sort priority:**
1. Exact match on account name
2. Path starts with query
3. Name starts with query  
4. Type (first path element) starts with query
5. Contains query anywhere

## Keyboard

**Up/Down arrows:** Move highlight up/down in dropdown

**Left/Right arrows:** Normal text cursor movement

**Tab:**
- Selects highlighted result
- Fills input with full account path
- Sets `selectedId`
- Closes dropdown
- Advances focus to next field

**Enter:**
- Selects highlighted result
- Fills input with full account path
- Sets `selectedId`
- Closes dropdown
- Keeps focus in same field

**Escape:**
- Closes dropdown
- No selection
- Value unchanged

**Colon (`:`):**
- Uses currently highlighted result (top by default, or arrow-selected)
- Finds longest path element in that result containing current search text
- Completes through that element, including trailing ` : `
- Never completes final account name (no `:` after last element)
- If no match found in path, does nothing

**Colon example:**
```
User types: "land"
Highlighted: "Assets : Land Holdings : Building A"
Longest match: "Land Holdings" (contains "land", not final element)
Press ":" → completes to "Assets : Land Holdings : "
```

## Validation

- `selectedId` must be set for form submission
- If user tabs away without selecting from dropdown, clear input and `selectedId`

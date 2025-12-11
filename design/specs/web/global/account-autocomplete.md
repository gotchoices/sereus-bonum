# Spec: Account Autocomplete

**Component:** `AccountAutocomplete.svelte`

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

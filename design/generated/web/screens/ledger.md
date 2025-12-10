# Consolidation: Account Ledger

**Route:** `/ledger/[accountId]`
**Source:** `design/stories/web/03-entries.md`
**Generated:** 2024-12-09

## Purpose

Primary transaction entry interface for an account. Optimized for keyboard-centric rapid data entry.

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Accounts View                                          │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Checking Account                              Balance: $1,234 │ │
│ │ Bank of America • USD                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Date     │ Ref  │ Memo          │ Offset    │ Debit │ Credit │ │
│ ├──────────┼──────┼───────────────┼───────────┼───────┼────────┤ │
│ │ 12/01    │ 1001 │ Electric bill │ Utilities │       │  85.00 │ │
│ │ 12/02    │ DEP  │ Paycheck      │ Income    │500.00 │        │ │
│ │ 12/03    │ 1002 │ Groceries     │ [Split]   │       │ 123.45 │ │
│ │ ________ │ ____ │ _____________ │ _________ │ _____ │ ______ │ │ ← New entry row
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### Header Section
- **Back link:** Returns to Accounts View for this entity
- **Account name:** Primary identifier
- **Account details:** Parent group, unit (currency)
- **Running balance:** Updates in real-time as entries are made

### Ledger Table

| Column | Description | Input behavior |
|--------|-------------|----------------|
| Date | Transaction date | Date picker, defaults to today |
| Ref | Check number, reference | Free text |
| Memo | Transaction description | Free text |
| Offset | Counter-account | Autocomplete with account search |
| Debit | Increase to account | Number, auto-formats |
| Credit | Decrease from account | Number, auto-formats |

**Note:** For this account's perspective, Debit/Credit columns match the account's normal balance direction. For an Asset account: Debit = money in, Credit = money out.

### Offset Account Autocomplete

**Visual Layout:**
```
[🔀] [Account search input_______________________]
 ↑ Split button (small icon to left of input)
```

**Split Button:**
- Icon: `|` (vertical bar) or `⋮` (three dots) or spreadsheet icon
- Position: Immediately to the left of account input
- Size: Compact (same height as input)
- Action: Toggle split entry mode
- Tooltip: "Add split (Ctrl+Enter)"

**Account Search Behavior:**

Per story step 7:
- Dropdown appears on focus
- Type to filter by any part of account path
- **Tab:** Completes to top result (full path)
- **Colon (`:`):** Completes to end of current path element only
- **Arrow keys:** Navigate results
- Shows full account path in dropdown

**Colon Completion Example:**

User types: `exp` → sees "Expenses : Utilities : Electric"
- User presses `:` → completes to `Expenses : `
- User types `ut` → filters to utilities accounts
- User presses `:` → completes to `Expenses : Utilities : `
- User types `el` → filters to Electric
- User presses Tab → completes to full path `Expenses : Utilities : Electric`

**Autocomplete dropdown example:**
```
Expenses : Utilities : Electric
Expenses : Utilities : Gas
Expenses : Utilities : Water
```

### Split Transaction View (Display)

When a transaction has multiple entries:

```
┌──────────────────────────────────────────────────────────────────┐
│ 12/03 │ 1002 │ Grocery run           │ [Split]  │       │ 123.45 │
│   ├── │      │ Food                  │ Groceries│       │  98.00 │
│   ├── │      │ Cleaning supplies     │ Household│       │  15.45 │
│   └── │      │ Paper goods           │ Office   │       │  10.00 │
└──────────────────────────────────────────────────────────────────┘
```

- Main row shows total and "[Split]" as offset
- Child rows indent, show individual entries
- Each child row has its own note field
- Click to expand/collapse

### Split Transaction Entry (New)

**Triggering Split Mode:**
- Click split button `[|]` to left of account input
- Or press Ctrl+Enter

**Split Entry UI:**

From story 03 (Alt A), when split mode is activated:

```
Transaction Header:
  Date: [12/03]  Ref: [1002]  Memo: [Grocery run__________]

Split Entries:
┌──────────────────────────────────────────────────────────────┐
│ Account              │ Note              │ Debit │ Credit  │
├──────────────────────┼───────────────────┼───────┼─────────┤
│ Checking             │                   │       │ 123.45  │ ← Current account (auto)
│ [Groceries_______]   │ [Food_________]   │ 98.00 │         │ ← First split
│ [Search account__]   │ [Note_________]   │ 25.45 │         │ ← Auto-filled to balance
│                      │                   │       │         │
│                                          [+ Add Split]      │
└──────────────────────────────────────────────────────────────┘
                                            [Save] [Cancel]
```

**Split Entry Behavior:**
1. First row shows current account with total amount (read-only)
2. Each split row has: Account search, Note, Amount
3. **Auto-balance:** As user enters amounts, next empty row pre-fills with "amount needed to balance"
4. User can override auto-filled amount
5. "+ Add Split" button adds another blank row
6. Each row has [X] remove button
7. Save button enabled when transaction balances to zero
8. Warning shown if imbalanced

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Next field; **if in last field (Credit), saves entry like Enter** |
| Shift+Tab | Previous field |
| Enter | Confirm entry, save and start new row |
| Escape | Cancel current edit |
| Ctrl+Enter | Toggle split mode |
| `:` (colon) | In account search: complete to end of current path element |
| Arrow Down | In autocomplete, next option |
| Arrow Up | In autocomplete, previous option |

**Important Tab Behavior:**
- In most fields: Tab moves to next field
- **In Credit field (last field):** Tab triggers save (prevents cursor jumping to browser URL bar)
- This maintains keyboard flow without requiring Enter

## Behavior

1. **Auto-save:** Transaction saved when all required fields complete (date, offset, amount)
2. **Real-time balance:** Header balance updates as entries are committed
3. **Linked window:** If opened from Accounts View, that view updates reactively
4. **Click to edit:** Clicking on any existing transaction row toggles it into edit mode
   - Row fields become editable inputs
   - Save changes on Enter or blur
   - Cancel changes on Escape
5. **Split detection:** Entering split mode when:
   - User explicitly toggles (keyboard/button)
   - User enters a second offset account

## Data Requirements

- Account details (name, group, unit, balance)
- Transaction list for this account
- Full account tree for autocomplete
- Entity's base unit for display

## Acceptance Criteria

- [ ] Can enter simple transaction without mouse
- [ ] Offset account autocomplete filters as user types
- [ ] Split transactions show nested entry rows
- [ ] Balance updates in real-time
- [ ] Linked Accounts View updates when entries made


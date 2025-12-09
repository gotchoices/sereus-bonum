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

Per story step 7:
- Dropdown appears on focus
- Type to filter by any part of account path
- Tab for completion
- Arrow keys to navigate
- Path separator (`:` or `/`) to jump to next path segment
- Shows full account path in dropdown

Example: Typing "util" shows:
```
Expenses : Utilities : Electric
Expenses : Utilities : Gas
Expenses : Utilities : Water
```

### Split Transaction View

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
- Last entry amount pre-fills to balance

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Next field |
| Shift+Tab | Previous field |
| Enter | Confirm entry, move to next row |
| Escape | Cancel current edit |
| Ctrl+S | Force save (though auto-save on complete) |
| Ctrl+Enter | Toggle split mode |
| Arrow Down | In autocomplete, next option |
| Arrow Up | In autocomplete, previous option |

## Behavior

1. **Auto-save:** Transaction saved when all required fields complete (date, offset, amount)
2. **Real-time balance:** Header balance updates as entries are committed
3. **Linked window:** If opened from Accounts View, that view updates reactively
4. **Split detection:** Entering split mode when:
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


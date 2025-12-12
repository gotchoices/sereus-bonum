# Spec: Account Ledger

**Route:** `/ledger/[accountId]`
**Source:** Story 03 (entries), Story 02 (step 9.7)
**Consolidation:** `design/generated/web/screens/ledger.md`

## Purpose

Primary transaction entry interface for an account. Optimized for keyboard-centric rapid data entry with minimal mouse interaction.

**References:**
- **[Transaction Entry](../global/transaction-entry.md):** Detailed specs for simple and split transaction entry
- **[Account Autocomplete](../global/account-autocomplete.md):** Detailed specs for account selection behavior

---

## Header Section

### Entity Context
Display entity name as context for the account:
```
Home Finance > Assets : Current Assets : Checking
```

**Format:**
- **Entity name** (lighter weight, smaller font)
- Separator: `>` or `:`
- **Full account path** (Assets : Current Assets : Checking)

**Why:** User needs to know which entity they're in when multiple windows are open.

### Account Details Line
- Account code (if present): `1010`
- Unit symbol: `USD`, `$`
- Running balance: Updates in real-time

### Back Link
`← Back to Accounts View` returns to `/entities/{entityId}`

---

## Account Display in Splits

### Problem
Split transaction rows show offset account names. Full path can be long:
```
"Expenses : Operating : Utilities : Electric : Commercial Rate"
```

### Solution: Show Name, Reveal Path on Hover

**Display:** Show only the account name in the UI
```
↳ Commercial Rate
```

**On Hover:** Show full path via tooltip (HTML `title` attribute or CSS tooltip)
```
<a href="/ledger/{id}" title="Expenses : Operating : Utilities : Electric : Commercial Rate">
  Commercial Rate
</a>
```

**Rationale:**
- Keeps split rows compact
- Full path available when needed
- Clicking navigates to that account's ledger

---

## Offset Account Autocomplete

From story 03 (step 7):
- Always shows **full account path** in dropdown
- Type to filter by any part of path
- Helps disambiguate accounts with similar names

Example dropdown:
```
Assets : Current : Checking - Wells Fargo
Assets : Current : Checking - Chase
Assets : Savings : High Yield
```

**Why full path here?** Disambiguation is critical during entry. User needs to know exactly which account they're selecting.

---

## Account Hyperlinks

All account names in the ledger should be clickable:

| Location | Link |
|----------|------|
| Split entry offset accounts | `/ledger/{accountId}` |
| (Future) Transaction memo mentions | Parse and link |

**Behavior:**
- Click → Navigate to that account's ledger
- Opens in current window (standard navigation)
- Future: Ctrl/Cmd+Click → New window

---

## Visual Indicators

### Running Balance
- Updates immediately when transaction saved
- Displayed in header with currency formatting
- Color-coded: Green if positive, red if negative (for asset accounts)

### Split Transactions
Split indicator shows in Offset column: `[Split]`

Expand to show child entries:
```
12/03 | 1002 | Grocery run     | [Split]  |       | 123.45
  ├── |      | Food            | Groceries|       |  98.00
  ├── |      | Cleaning        | Household|       |  15.45
  └── |      | Paper goods     | Office   |       |  10.00
```

---

## Transaction Entry

See **[Transaction Entry Spec](../global/transaction-entry.md)** for complete details on:
- Simple mode (single offset account)
- Split mode (multiple offset accounts)
- Tab flow and keyboard navigation
- Auto-balance calculation
- Validation rules

### Quick Summary

**New Entry Row:** Always visible at bottom of ledger
- Enter date, ref, memo, select account, enter amount
- Tab from Debit/Credit field saves transaction
- Click split button (`|`) to enter multi-account transaction

**Account Selection:** Uses **[Account Autocomplete](../global/account-autocomplete.md)**
- Type to search, colon (`:`) for progressive path completion
- Tab/Enter to select from dropdown

---

## Transaction Display Modes

Transactions can be **collapsed** (1 line) or **expanded** (multiple lines showing all entries).

### Collapsed View (Default)

```
>  | Date       | Ref  | Memo           | Account      | Debit    | Credit   | Balance
>  | 2024-12-10 | 1234 | Grocery Store  | Groceries    | $125.50  |          | $5,234.00
>  | 2024-12-11 | 1235 | Salary         | Salary Inc   |          | $2,500.00| $7,734.00
>  | 2024-12-12 | 1236 | Bill payment   | [Multiple]   | $450.00  |          | $7,284.00
```

- `>` icon on left to expand
- Shows net effect on current account
- Account column: offset account name, or "[Multiple]" for splits (3+ entries)

### Expanded View

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
- Entry lines: Date/Ref/Memo empty (indentation visible), Account/Debit/Credit filled
- Entry lines have no balance column

### Controls

**Per-Transaction:**
- Click `>` to expand individual transaction
- Click `v` to collapse individual transaction

**Toolbar Buttons:**
- `[Expand All]` - Expands all transactions in current view
- `[Collapse All]` - Collapses all to single lines

**State Persistence:**
- Expand/collapse state saved per account in localStorage
- Option 1: Remember each transaction's state individually
- Option 2 (simpler): Remember "expand all" vs "collapse all" setting only

---

## Editing Existing Transactions

Click any transaction → expands **in-place** into editable form with colored border.

### Visual Treatment

Edit mode mirrors the ledger display - editable fields inline, looking like the ledger view.

**Simple transaction edit:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│   | [Date▼] | [Ref_] | [Memo___________] | [Account_____▼] [|] | [Debit__] | [Credit_] | Balance |  
│   |                           [Esc=Cancel  Tab=Save  🗑️]                                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Split transaction edit:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│   | [Date▼] | [Ref_] | [Memo___________] | Checking Account    | [_____] | [450.00] | Balance |
│   |         |        | Note: [Electric_] | [Utilities____▼]    | [150.00]| [_____]  |         | [×]
│   |         |        | Note: [Internet_] | [Utilities____▼]    | [100.00]| [_____]  |         | [×]
│   |         |        | Note: [Phone____] | [Utilities____▼]    | [200.00]| [_____]  |         | [×]
│   |                                                                                              │
│   |                     Balance: $0.00 ✓     [+ Split]  [Esc=Cancel  Tab=Save  🗑️]              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Editing behavior:**
- Colored border indicates edit mode
- Transaction expands in-place (stays at its position in ledger)
- Looks like ledger view, but fields are editable inputs
- Context preserved (see surrounding transactions)
- **Split transactions:** Always show multi-line in edit mode (all entries visible), regardless of collapsed/expanded state in view
- **Split button available:** Can convert simple transaction to split during edit
- Same keyboard navigation as new entry
- See **[Transaction Entry Spec](../global/transaction-entry.md)** for complete editor behavior

**Actions:**
- **Esc key:** Cancel editing, discard changes
- **Tab out** (from last field): Save transaction
- **🗑️ icon:** Delete transaction (shows confirmation)
- **On exit:** Returns to view mode, restoring previous display state (collapsed/expanded)

Alternative: Traditional buttons `[Save] [Cancel] [Delete]` below the entry

**Current status:** Click handler exists but only logs to console (not yet implemented)

---

## Locked Transactions

Transactions in closed/reconciled periods cannot be edited.

### Visual Separator

```
>  | 2024-01-10 | 1001 | Old transaction    | Expenses  | $50.00   | | $1,000.00
>  | 2024-01-15 | 1002 | Another old one    | Utilities | $100.00  | | $900.00
═══════════════════════════════════════🔒═══════════════════════════════════════
>  | 2024-02-01 | 1003 | Editable entry     | Groceries | $75.00   | | $825.00
>  | 2024-02-05 | 1004 | Recent entry       | Gas       | $45.00   | | $780.00
```

**Visual treatment:**
- Separator line with 🔒 icon divides locked from editable transactions
- Locked transactions (above line): Subtle tint to indicate read-only
- Editable transactions (below line): Normal appearance

**Behavior:**
- Click locked transaction → Tooltip: "Cannot edit - period closed"
- No edit mode entered
- Can still expand to view transaction details
- Can still navigate to linked accounts

**When periods close:**
- New separator line appears when period is closed/reconciled
- Typically monthly or quarterly, controlled by user in settings

---

## Deleting Transactions

Available in edit mode via [Delete] button with confirmation dialog.

**Not in MVP.** Future implementation.

---

## Future Enhancements

### Account Display Preferences (Settings)
Not in MVP. See STATUS for future implementation:
- Number only: `1010`
- Name only: `Checking`
- Full path: `Assets : Current : Checking`
- Number + Name: `1010 Checking`

Affects: All screens that display accounts

### Date Format Preferences (Settings)
Not in MVP. See STATUS for future implementation.

---

## Acceptance Criteria

- [x] Entity name visible in header
- [x] Full account path shown in header
- [x] Split account names are hyperlinks
- [x] Split accounts show full path on hover
- [ ] Running balance updates in real-time (currently requires page refresh)


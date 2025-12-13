# Spec: Account Ledger

**Route:** `/ledger/[accountId]`
**Source:** Story 03 (entries), Story 02 (step 9.7)
**Consolidation:** `design/generated/web/screens/ledger.md`

## Purpose

Primary transaction entry interface for an account. Optimized for keyboard-centric rapid data entry with minimal mouse interaction.

**References:**
- **[Transaction Editor](../global/transaction-edit.md):** Reusable editor component for new entry and editing
- **[Account Autocomplete](../global/account-autocomplete.md):** Detailed specs for account selection behavior

---

## Header Section
The header is fixed on the page and does not scroll with the transaction list.
The user should be able to see the informatio in the header at all times.

### Back Link (Line 1)
`← Back to Accounts View` returns to `/entities/{entityId}`

### Entity/Account Context (Line 2 left)
Display entity name as context for the account:
```
Home Finance > Assets : Current Assets : Checking 1010
```

**Format:**
- **Entity name** (lighter weight, smaller font)
- **Full account path** (Assets : Current Assets : Checking)
- **Account code** (1010)

### Account Units/Total Context (Line 2 right)
- Unit symbol: `USD`, `$`
- Account balance: Updates in real-time

### Transaction Header
Header contains the column headers for transactions/splits as shown below.
Column headers are not replicated in each transaction or in the transaction editor.

---

## Account Display in Transactions / Splits

### Problem
Entries show offset account names. Full path can be long:
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
## Offset Account Autocomplete
Any entry that accepts an account uses [auto complete](../global/account-autocomplete.md).

## New Transaction Entry

The ledger always maintains a **blank entry row** for entering new transactions.

**Position:** The blank entry row position depends on the transaction sort order (see [Settings](./settings.md#transaction-sort-order)):
- **Oldest first** (default): Blank entry appears at the **bottom** of the ledger
- **Newest first**: Blank entry appears at the **top** of the ledger (after the fixed header)

This ensures the blank entry is always at the natural insertion point for the current sort order.

### Blank Row Behavior

**Initial state:**
- Empty fields: Date (defaults to today), Ref, Memo, Account, Debit, Credit
- Appears as a single line at top or bottom (depending on sort order)
- Not stored in the backend until populated

**User interaction:**
- Focus/click on any field in blank row → Activates transaction editor on blank transaction
- Editor appears in-place (same location, bottom of ledger)
- Same component as editing existing transactions
- See **[Transaction Editor](../global/transaction-edit.md)** for editor behavior

**After save:**
- New transaction created in database
- Ledger refreshes with new transaction added
- New blank entry row appears at bottom
- Cursor moves to Date field of new blank row (ready for next entry)

**After cancel:**
- Blank row fields clear
- Cursor leaves blank row
- Row remains available for future entry

## Account Hyperlinks

All account names in the ledger should be clickable:

| Location | Link |
|----------|------|
| Split entry offset accounts | `/ledger/{accountId}` |
| (Future) Transaction memo mentions | Parse and link |

**Behavior:**
- Click → Navigate to that account's ledger
- Opens in current window (standard navigation)
- Ctrl/Cmd+Click → New window

### Split Transactions
Split indicator shows in Offset column: `[Split]`

Expand to show child entries:
```
12/03 | 1002 | Grocery run     | [Split]  |           |          |  <balance>
             |                 | Checking |           |   123.45 |
             | Food            | Groceries|     98.00 |          |
             | Cleaning        | Household|     15.45 |          |
             | Paper goods     | Office   |     10.00 |          |
```

---

## Transaction Entry

See **[Transaction Editor](../global/transaction-edit.md)** for complete details on:
- Simple mode (single offset account)
- Split mode (multiple accounts, debits, credits)
- Tab flow and keyboard navigation
- Auto-balance calculation
- Validation rules

## Transaction Display Modes

Transactions can be **collapsed** (1 line) or **expanded** (multiple lines showing all entries).
The column headers shown below are part of the fixed header, not the transaction itself.

### Sort Order

Transaction list order is controlled by user preference in **[Settings](./settings.md#transaction-sort-order)**:
- **Oldest first** (default): Chronological order, oldest transaction at top
- **Newest first**: Reverse chronological, most recent transaction at top

The sort order persists across sessions and applies to all account ledgers.

### Collapsed View (Default)

```
>  | Date       | Ref  | Memo           | Account      | Debit    | Credit   | Balance
>  | 2024-12-10 | 1234 | Grocery Store  | Groceries    | $125.50  |          | $5,234.00
>  | 2024-12-11 | 1235 | Salary         | Salary Inc   |          | $2,500.00| $7,734.00
>  | 2024-12-12 | 1236 | Bill payment   | [Split]      | $450.00  |          | $7,284.00
```

- `>` icon on left to expand
- The `>` icon in the header will expand or contract all items in the ledger
- Account column: offset account name, or "[Split]" for splits (3+ entries)

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

**State Persistence:**
- Expand-all/collapse-all state saved per account in localStorage
- Expansion of single transactions not saved

## Editing Existing Transactions

Click any transaction → expands **in-place** into editable form with colored border.

### Visual Treatment

Edit mode mirrors the ledger display - editable fields inline, looking like the ledger view.
Transaction/entry columns are still aligned with other transactions in the ledger.
The editable transaction should appear very much like it was before except the items can be edited.
It is also distinguished by a blue border while in editing mode.

**Simple transaction edit:**
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│   | [Date▼] | [Ref_] | [Memo___________] | [Account_____▼] [|] | [Debit__] | [Credit_] | Balance |  
│   | [Save] [+ Split] [Cancel] [Delete]                                                           |
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Split transaction edit:**
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│   | [Date▼] | [Ref_] | [Memo___________] |                                                       |
│   |         |        |                   | [Checking_____▼]    |           |    450.00 | [×]     |
│   |         |        | Note: [Electric_] | [Utilities____▼]    |    150.00 |           | [×]     |
│   |         |        | Note: [Internet_] | [Business_____▼]    |    100.00 |           | [×]     |
│   |         |        | Note: [Phone____] | [Telecom______▼]    |    200.00 |           | [×]     |
│   ───────────────────────────────────────────────────────────────────────────────────────────────|
│   | [Save] [+ Split] [Cancel] [Delete]            Totals:      |   $450.00 |   $450.00 | $0.00 ✓ |
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Actions Footer:**
- **Left side:** Action buttons in order: [Save] [+ Split] [Cancel] [Delete]
- **Right side:** Running totals and balance indicator
  - Debits total: Sum of all debit amounts
  - Credits total: Sum of all credit amounts
  - Balance: Difference (green ✓ when $0.00, red ⚠ when imbalanced)

**Editing behavior:**
- Colored border indicates edit mode
- Transaction expands in-place (stays at its position in ledger)
- Looks like ledger view, but fields are editable inputs
- Context preserved (see surrounding transactions)
- **Split transactions:** Always show multi-line in edit mode (all entries visible), regardless of collapsed/expanded state in view
- **Split button available:** Can convert simple transaction to split during edit (+ Split button)
- Same keyboard navigation as new entry
- See **[Transaction Editor](../global/transaction-edit.md)** for complete editor behavior

**Actions:**
- **Save:** Validates and saves changes, exits edit mode
- **Cancel:** Discards changes, exits edit mode
- **+ Split:** Adds new split entry line
- **Delete:** Shows confirmation dialog, then deletes transaction
- **Esc key:** Same as Cancel
- **On exit:** Returns to view mode, restoring previous display state (collapsed/expanded)

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

## Acceptance Criteria

- [x] Entity name visible in header
- [x] Full account path shown in header
- [x] Split account names are hyperlinks
- [x] Split accounts show full path on hover
- [ ] Running balance updates in real-time (currently requires page refresh)
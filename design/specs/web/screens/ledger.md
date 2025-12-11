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

## Editing Existing Transactions

**Current behavior (MVP):** Click transaction row logs entry ID (placeholder)

**Future behavior:** See [Transaction Entry Spec - Editing](../global/transaction-entry.md#editing-existing-transactions)
- Click row to load into entry form
- Edit fields, then Save or Cancel
- Simple transactions load in simple mode
- Split transactions load in split mode with all splits visible

---

## Deleting Transactions

**Not in MVP.** See [Transaction Entry Spec - Deleting](../global/transaction-entry.md#deleting-transactions) for future implementation.

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


# Entity Accounts View (Consolidation)

> Generated from stories: 01-firstlook, 03-entries, 04-reporting

Route: `/entities/[id]`

## Derived Requirements

From **story 01** (step 6.5):
- "He now sees a listing of account groups and accounts that looks much like a balance sheet but all the values are zero."

From **story 03**:
- User works with accounts and transactions for an entity
- Keyboard-centric workflow for data entry

From **story 04**:
- Accounts View can toggle between modes: Balance Sheet, Trial Balance, Income Statement, Cash Flow, Custom
- Date range selection affects totals
- Print/PDF export
- Save report configurations

## Inferred Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back    Entity Name                        [Mode ▼] [⋮]  │
├─────────────────────────────────────────────────────────────┤
│ As of: [Date Picker]                                        │
├─────────────────────────────────────────────────────────────┤
│ 💰 Assets                                         $XXX,XXX  │
│   ▶ Current Assets                                $XX,XXX   │
│       1010 Checking Account                       $X,XXX    │
│       1020 Savings Account                        $X,XXX    │
│   ▶ Fixed Assets                                  $XX,XXX   │
│       ...                                                   │
├─────────────────────────────────────────────────────────────┤
│ 📋 Liabilities                                    $XX,XXX   │
│   ...                                                       │
├─────────────────────────────────────────────────────────────┤
│ 📊 Equity                                         $XX,XXX   │
│   ...                                                       │
├─────────────────────────────────────────────────────────────┤
│ Net Worth                                         $XXX,XXX  │
└─────────────────────────────────────────────────────────────┘
```

## Inferred Behavior

1. **Load accounts** for the entity with balances as of selected date
2. **Group by AccountGroup**, organized by AccountType (A/L/E for balance sheet mode)
3. **Expandable groups** — click to show/hide individual accounts
4. **Click account** — navigate to account ledger (future)
5. **Mode selector** — switches between Balance Sheet, Trial Balance, etc. (future)
6. **Date picker** — defaults to today, affects balance calculations

## Data Needs

- Entity details (name, baseUnit)
- Accounts for entity with balances
- Account groups for organization
- Balance calculation per account (sum of entries up to date)

## Open Questions

- Should Income/Expense show in Balance Sheet mode? (No, only in Trial Balance when expanded)
- How to handle accounts with no transactions? (Show with $0 balance)
- Drill-down to ledger view? (Future slice)

## MVP Scope

- Balance Sheet mode only (A/L/E)
- Single date (as of today)
- Expandable groups with account balances
- No mode switching yet (future)


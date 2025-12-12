# Consolidation: Entity Accounts View

**Route:** `/entities/[id]`  
**Source:** Stories 01, 04; Spec `design/specs/web/screens/accounts-view.md`  
**Generated:** 2024-12-12

## Purpose

Display an entity's accounts in multiple reporting formats with hierarchical grouping, expandable sections, date filtering, and navigation to ledgers.

## Report Modes Implementation

### Balance Sheet Mode

**Display:**
- Account types shown: ASSET, LIABILITY, EQUITY
- Retained Earnings: expandable line under EQUITY
  - Collapsed: shows Net Income total
  - Expanded: shows Income and Expense account breakdown
- Date input: single "As of" date
- Default date: today

**Data query:**
- All account types
- Transaction filter: `date <= endDate`
- No startDate parameter

**Calculation:**
- `netIncome = totalIncome - totalExpense`
- `retainedEarnings = netIncome` (accumulated)
- Display Equity total includes Retained Earnings

### Trial Balance Mode

**Display:**
- Account types shown: All 5 (ASSET, LIABILITY, EQUITY, INCOME, EXPENSE)
- Retained Earnings: non-expandable line under EQUITY (I/E already visible separately)
- Date input: single "As of" date
- Verification line: `Assets = Liabilities + Equity + Net Income ✓`

**Data query:**
- All account types
- Transaction filter: `date <= endDate`
- No startDate parameter

**Calculation:**
- Same as Balance Sheet
- Verification: `totalAssets === (totalLiabilities + totalEquity + netIncome)`

### Income Statement Mode

**Display:**
- Account types shown: INCOME, EXPENSE only
- Date inputs: "From" and "To" (both required, vertically stacked)
- Default: Jan 1 of current year to today
- Net Income line at bottom

**Data query:**
- INCOME and EXPENSE accounts only
- Transaction filter: `date >= startDate AND date <= endDate`
- Both startDate and endDate required

**Calculation:**
- `netIncome = totalIncome - totalExpense`

### Cash Flow Mode (Future)

**Display:**
- Pre-selected account groups categorized as Operating/Investing/Financing
- Date inputs: "From" and "To"
- Change in balance (not cumulative)

### Custom Mode (Future)

**Display:**
- User-selected account groups
- Flexible date inputs

## Component Structure

**Main Page:** `apps/web/src/routes/entities/[id]/+page.svelte`

**State Management:**
```typescript
// Report mode
let reportMode = $state<'balance-sheet' | 'trial-balance' | 'income-statement'>('balance-sheet');

// Dates
let endDate = $state(today());
let startDate = $state(jan1OfCurrentYear());

// Expand/collapse
let expandedGroups = $state<Record<string, boolean>>({});

// Persistence
const viewState = createViewStateStore<{
  reportMode: string;
  endDate: string;
  startDate: string;
  expandedGroups: Record<string, boolean>;
}>(`accounts-${entityId}`, defaults);
```

**Data Loading:**
```typescript
async function loadEntityData() {
  const dataService = await getDataService();
  const data = await dataService.getBalanceSheet(
    entityId, 
    endDate,
    reportMode === 'income-statement' ? startDate : undefined
  );
  
  balanceData = data;
  // Contains: totalAssets, totalLiabilities, totalEquity, totalIncome, totalExpense, accounts[]
}
```

**Derived Values:**
```typescript
const netIncome = $derived(
  (balanceData?.totalIncome || 0) - (balanceData?.totalExpense || 0)
);

const isBalanced = $derived(() => {
  const assets = balanceData?.totalAssets || 0;
  const liabilities = balanceData?.totalLiabilities || 0;
  const equity = balanceData?.totalEquity || 0;
  return Math.abs(assets - (liabilities + equity + netIncome)) < 1;
});
```

## UI Layout

**Header:**
- Back link to home
- Entity name
- Report mode dropdown
- Date picker(s) - vertically stacked, right-aligned
- Disabled buttons: "+" (Add Column), "⭐" (Saved Reports)

**Account Display:**
- Hierarchical tree: Type > Group > Account
- Indentation: 0 spaces (Type), 2 spaces (Group), 4 spaces (Account)
- Expand/collapse icons on groups with children
- Account names are hyperlinks to `/ledger/[accountId]`
- Balances right-aligned, tabular numbers

**Special Sections:**
- Retained Earnings: pseudo-account under Equity
  - Balance Sheet: expandable, shows I/E breakdown
  - Trial Balance: non-expandable line item
- Verification line (Trial Balance only): comparison of Assets vs L+E

**Actions:**
- "Expand All" / "Collapse All" buttons
- Click type/group header to toggle expansion
- Click account name to navigate to ledger

## Event Handlers

**Mode change:**
```typescript
function handleModeChange(newMode) {
  reportMode = newMode;
  
  // Auto-set dates based on mode
  if (newMode === 'income-statement') {
    if (!startDate) startDate = jan1OfCurrentYear();
  }
  
  // Save to viewState
  viewState.update(s => ({ ...s, reportMode }));
  
  // Reload data
  loadEntityData();
}
```

**Date change:**
```typescript
function handleDateBlur() {
  // Only reload on blur (not every keystroke)
  if (needsReload) {
    viewState.update(s => ({ ...s, startDate, endDate }));
    loadEntityData();
    needsReload = false;
  }
}

function handleDateInput() {
  needsReload = true;
}
```

**Expand/collapse:**
```typescript
function toggleGroup(groupId: string) {
  expandedGroups[groupId] = !expandedGroups[groupId];
  viewState.update(s => ({ ...s, expandedGroups }));
}

function expandAll() {
  const newState = {};
  allGroupIds.forEach(id => newState[id] = true);
  expandedGroups = newState;
  viewState.update(s => ({ ...s, expandedGroups }));
}

function collapseAll() {
  expandedGroups = {};
  viewState.update(s => ({ ...s, expandedGroups }));
}
```

## Backend Data Requirements

**DataService method:**
```typescript
getBalanceSheet(
  entityId: string, 
  endDate: string,
  startDate?: string
): Promise<BalanceSheetData>
```

**Return type:**
```typescript
interface BalanceSheetData {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;        // Equity accounts only (excludes net income)
  totalIncome: number;         // Separate from equity
  totalExpense: number;        // Separate from equity
  accounts: AccountWithBalance[];
  groups: AccountGroupWithBalance[];
  startDate?: string;          // Echoes input (for period reports)
  endDate: string;             // Echoes input
}
```

**SQL Query Logic:**
- Single query with conditional date filtering using CASE statements
- A/L/E accounts: `WHERE date <= endDate` (cumulative)
- I/E accounts: `WHERE date <= endDate AND (startDate IS NULL OR date >= startDate)` (period if startDate provided)
- Group by account type and group for hierarchical display
- Calculate running totals per account

## Acceptance Criteria

- [ ] Can switch between Balance Sheet, Trial Balance, Income Statement modes
- [ ] Date inputs appear appropriately (single "As of" vs "From/To" range)
- [ ] Accounts filter correctly by date
- [ ] Expand/collapse state persists per entity
- [ ] Account names are clickable links to ledgers
- [ ] Trial Balance shows verification line
- [ ] Retained Earnings appears correctly in each mode
- [ ] Equity total includes Retained Earnings
- [ ] Date changes only reload on blur (performance optimization)

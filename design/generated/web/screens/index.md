# Screen Index (Consolidation)

Derived from stories. This is a generated consolidation — do not hand-edit.

## Screens

| Route | Name | Source | Priority | Status |
|-------|------|--------|----------|--------|
| `/` | Home | 01-firstlook | 1 | pending |
| `/entities/[id]` | AccountsView | 01, 02, 03, 04 | 2 | pending |
| `/entities/[id]/ledger/[accountId]` | Ledger | 02, 03 | 3 | pending |
| `/entities/[id]/reconcile/[accountId]` | Reconciliation | 05 | 4 | pending |
| `/catalog` | AccountCatalog | 01 | 5 | pending |
| `/settings` | Settings | 01 | 6 | pending |
| `/import` | ImportBooks | 01, 02 | 7 | pending |

## Dialogs/Modals

| Component | Name | Source | Status |
|-----------|------|--------|--------|
| EntityEditDialog | Entity Edit | 01 | pending |
| ImportMappingPane | Import Mapping | 02 | pending |
| ReconciliationHistoryDialog | Reconciliation History | 05 | pending |
| SaveReportDialog | Save Report | 04 | pending |

## Shared Components

| Component | Used By | Source |
|-----------|---------|--------|
| VisualBalanceSheet | Home, AccountsView | 01, 02, visual-balance-sheet.md |
| AccountSelector | Ledger | 03 |
| EntityList | Home | 01 |
| AccountTree | AccountsView, AccountCatalog | 01, 02, 04 |
| LedgerGrid | Ledger | 02, 03 |
| DateRangePicker | AccountsView, Reconciliation | 04, 05 |

## Screen Descriptions

### Home (`/`)
- Entity list panel
- Welcome message (dismissible) OR Visual Balance Sheet for selected entity
- Global navigation

### AccountsView (`/entities/[id]`)
- Hierarchical account tree with balances
- Mode selector: Balance Sheet, Trial Balance, Income Statement, Cash Flow, Custom
- Date range controls
- Print/Save report options
- Real-time balance updates

### Ledger (`/entities/[id]/ledger/[accountId]`)
- Transaction register with inline editing
- Columns: Date, Number, Memo, Account (offset), Debit, Credit, Balance
- Split transaction expansion
- Account selector with typeahead
- Keyboard-centric navigation

### Reconciliation (`/entities/[id]/reconcile/[accountId]`)
- Statement date/balance input
- Unreconciled entries list with checkboxes
- Running calculated balance vs statement balance
- Finalize button (enabled when balanced)

### AccountCatalog (`/catalog`)
- Hierarchical account groups (5 types at root)
- CRUD operations on groups
- Drag-to-reorder

### Settings (`/settings`)
- Sereus/cadre management (future)
- Language preference
- Display preferences

### ImportBooks (`/import`)
- File drop zone
- Entity name input
- Format detection (GnuCash, QuickBooks IIF)
- Proceeds to ImportMappingPane

---

*Generated from stories 01-05. Last updated: auto*


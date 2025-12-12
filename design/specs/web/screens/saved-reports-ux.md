# Spec: Saved Reports & Multi-Column Reports

**Status:** Future feature (UI hooks stubbed for now)  
**Story:** [04-reporting.md](../../../stories/web/04-reporting.md) (Alternative Paths F & G)

## Overview

Two related features for the Accounts View:
- **Saved Reports:** Save and recall named report configurations
- **Multi-Column Reports:** Compare multiple periods side-by-side

## 1. Saved Reports

### Purpose

Users frequently view the same reports (e.g., "Year-End Balance Sheet", "Monthly P&L"). Saved Reports let them:
- Save current view configuration (mode, dates, columns, settings) with a name
- Quickly load saved configurations from a dropdown
- Avoid repetitive setup for common reports

### UI Location

Accounts View header, right side:

```
┌────────────────────────────────────────────────────────────┐
│ [Mode ▼]  [Dates]  [Expand All] [Collapse All]   [⭐ Reports ▼] │
└────────────────────────────────────────────────────────────┘
```

### Reports Dropdown

Click "⭐ Reports" button to show menu:

```
┌─────────────────────────────────┐
│ 💾 Save Current View...         │  ← Save action
├─────────────────────────────────┤
│ 📊 Year-End Balance Sheet       │  ← Saved report
│    BS • 2024-12-31              │     (mode + date preview)
│                                 │
│ 📈 Quarterly P&L                │
│    IS • Q1-Q4 2024 (4 cols)     │
│                                 │
│ 📋 Trial Balance (Current)      │
│    TB • Today                   │
├─────────────────────────────────┤
│ 🗂️  Manage Reports...           │  ← Opens management modal
└─────────────────────────────────┘
```

**Actions:**
- **Left-click saved report:** Loads that configuration immediately (view updates)
- **Right-click saved report:** Shows context menu:
  - Rename
  - Update (save current settings over existing report)
  - Duplicate
  - Delete

### Save Current View Dialog

Click "💾 Save Current View..." to open:

```
┌─────────────────────────────────────┐
│ Save Report Configuration           │
├─────────────────────────────────────┤
│ Name:                               │
│ [Year-End Balance Sheet________]   │
│                                     │
│ Current settings:                   │
│ • Mode: Balance Sheet               │
│ • As of: 2024-12-31                 │
│ • Groups: 3 expanded                │
│ • Columns: 1                        │
│                                     │
│         [Cancel]  [Save]            │
└─────────────────────────────────────┘
```

**What Gets Saved:**
- Report name (user-specified)
- Report mode (Balance Sheet, Trial Balance, etc.)
- Date(s) or date range
- Number of columns and column names (if multi-column)
- Variance setting (if enabled)
- Selected account groups (for Custom mode)

**What Does NOT Get Saved:**
- Expanded/collapsed state of groups (too granular, changes frequently)

**Duplicate Names:**
If name already exists:
- Warning: "Report 'XYZ' already exists. Overwrite?"
- Options: [Cancel] [Save As New] [Overwrite]

### Manage Reports Modal

Click "🗂️ Manage Reports..." for detailed management:

```
┌─────────────────────────────────────────────────┐
│ Manage Saved Reports                      [X]   │
├─────────────────────────────────────────────────┤
│                                                 │
│ 📊 Year-End Balance Sheet                       │
│    BS • 2024-12-31 • 1 column                   │
│    Created: 2024-03-15 • Last used: Today       │
│    [Rename] [Duplicate] [Delete]                │
│                                                 │
│ ─────────────────────────────────────────────   │
│                                                 │
│ 📈 Quarterly P&L                                │
│    IS • 2024-01-01 to 2024-12-31 • 4 columns    │
│    Created: 2024-02-10 • Last used: Yesterday   │
│    [Rename] [Duplicate] [Delete]                │
│                                                 │
│ ─────────────────────────────────────────────   │
│                                                 │
│                                    [Close]       │
└─────────────────────────────────────────────────┘
```

**Shows:**
- All saved reports with details
- Creation and last-used dates
- Quick actions per report
- Click report name to load it
- Click action buttons to rename/duplicate/delete

## 2. Multi-Column Reports

### Purpose

Compare multiple time periods side-by-side on the same report. Examples:
- Income Statement: Q1, Q2, Q3, Q4 (4 columns)
- Balance Sheet: This Year, Last Year (2 columns)
- Monthly comparison: Jan through Dec (12 columns)

### UI Location

Date picker area expands to show multiple columns:

```
┌──────────────────────────────────────────────────────┐
│  Mode: Income Statement ▼                            │
│                                                      │
│  ┌─────────┬─────────┬─────────┬─────────┐         │
│  │ From:   │ From:   │ From:   │         │  [+]   │
│  │  To:    │  To:    │  To:    │         │        │
│  ├─────────┼─────────┼─────────┼─────────┤         │
│  │ Column 1│ Column 2│ Column 3│Variance │         │
│  │  [X]    │  [X]    │  [X]    │  [X]    │         │
│  └─────────┴─────────┴─────────┴─────────┘         │
└──────────────────────────────────────────────────────┘
```

### Add Column Button

**Visual:** Small `[+]` icon button (28x28px), positioned to the right of date picker

**Why small?** Keeps layout clean and doesn't push date picker out of alignment with numbers column below.

**On Click:**
- Adds new column to the right
- New column gets default dates (e.g., current year or month)
- Max 12 columns (per Story 04)
- After max reached, button disables with tooltip: "Maximum 12 columns"

### Column Header

Each column shows:

```
┌───────────────┐
│ Column 2  [X] │  ← Name (editable) + remove button
├───────────────┤
│ From:         │
│ [2024-04-01]  │  ← Vertically stacked dates
│ To:           │
│ [2024-06-30]  │
└───────────────┘
```

**Column Name:**
- Default: "Column 1", "Column 2", etc.
- Click to edit: "Q1 2024", "Jan", "Last Year", etc.
- Saved with report configuration

**Remove Button [X]:**
- Removes that column
- First column cannot be removed (button disabled)
- Remaining columns shift left

### Account Data Display

Below the column headers, account balances appear in columns:

```
┌─────────────────┬─────────┬─────────┬─────────┐
│ Account         │   Q1    │   Q2    │   Q3    │
├─────────────────┼─────────┼─────────┼─────────┤
│ 💰 Assets       │ $50,000 │ $55,000 │ $60,000 │
│   Cash & Bank   │  $5,000 │  $7,000 │  $8,000 │
│   Receivables   │ $10,000 │ $12,000 │ $15,000 │
│   ...           │   ...   │   ...   │   ...   │
└─────────────────┴─────────┴─────────┴─────────┘
```

**Layout:**
- Account names on left (sticky when scrolling)
- One data column per period
- Right-aligned amounts
- Tabular number formatting

### Variance Columns (Optional)

Checkbox below column headers:
```
☐ Show variance columns ($ and %)
```

When checked, inserts variance columns between data columns:

```
┌──────────┬─────────┬──────────┬─────────┬─────────┐
│ Account  │ Column 1│ $ Change │ % Change│ Column 2│
├──────────┼─────────┼──────────┼─────────┼─────────┤
│ Revenue  │ $50,000 │  +$5,000 │  +10.0% │ $55,000 │
│ Expenses │ $30,000 │  -$2,000 │   -6.7% │ $28,000 │
└──────────┴─────────┴──────────┴─────────┴─────────┘
```

**Variance Calculation:**
- **$ Change:** Column(n) - Column(n-1)
- **% Change:** [(Column(n) - Column(n-1)) / |Column(n-1)|] × 100
- **Color coding:** Green for positive change, red for negative
- **First column:** No variance (nothing to compare against)

### Responsive Behavior

**Too Many Columns:**
- Horizontal scrollbar appears
- Column headers stick to top when scrolling vertically
- Account names stick to left when scrolling horizontally

**Export:**
- All columns export to separate spreadsheet columns
- Variance columns included if shown
- See [Export Spec](../global/export.md) for details

## 3. Persistence

### Automatic View State (Per Entity)

Saved in browser local storage per entity:
- Current mode
- Current dates (all columns)
- Expanded/collapsed groups
- Column names
- Variance checkbox state

**Key:** `bonum-accounts-view-state-{entityId}`

**Behavior:** When you leave and return to an entity, view looks exactly as you left it.

### Saved Reports (Global)

Saved in browser local storage (shared across all entities):
- Report name
- Mode
- Dates (all columns)
- Column count & names
- Variance setting
- Selected account groups (for Custom mode)

**Key:** `bonum-saved-reports`

**Behavior:** Saved reports are available from any entity.

## 4. Implementation Phases

This feature will be built in phases:

### Phase 1: UI Hooks (Current - Stubbed)
- "⭐ Reports" button present but disabled
- Tooltip: "Coming soon"
- "+ Add Column" button present but disabled
- Tooltip: "Multi-column view coming soon"
- Placeholder functions in code

### Phase 2: Single-Column Save/Load
- Save dialog working
- Load from dropdown working
- Basic rename/delete
- Single column only (no multi-column yet)

### Phase 3: Multi-Column Support
- Enable "+ Add Column" button
- Column management (add/remove/rename)
- Responsive layout with scroll
- Export multi-column to CSV/Excel

### Phase 4: Variance & Advanced Features
- Variance columns ($ and %)
- Manage Reports modal
- Usage tracking (last used, most used)
- Default report templates

## 5. Edge Cases

### Saved Reports
- **Maximum reports:** No hard limit, but UI may get long (consider search/filter)
- **Duplicate names:** Warn and offer options (save as new / overwrite)
- **Export/Import:** Future: export saved reports as JSON file for backup or sharing

### Multi-Column
- **Minimum columns:** 1 (cannot remove all)
- **Maximum columns:** 12 (per story requirement)
- **Date validation:** Start date must be ≤ end date
- **Overlapping dates:** Allowed (useful for comparisons)
- **Performance:** Multiple columns = multiple data queries (may be slow with large datasets)

### Persistence
- **Browser local storage limits:** ~5-10MB depending on browser
- **Clear data:** User can clear browser data, losing all saved reports
- **Future sync:** Saved reports could sync via Sereus across devices

## 6. Future Enhancements

**Report Sharing:**
- Generate shareable link to a report configuration
- Others can view (read-only) or import into their own saved reports

**Scheduled Reports:**
- Auto-generate reports on schedule
- Email or download PDF

**Report Templates:**
- Pre-configured common reports (Year-End Package, Tax Prep, etc.)
- Import standard templates

**Advanced Comparisons:**
- Actual vs Budget
- Actual vs Forecast
- Period-over-period with automatic date calculation

**Drill-Down:**
- Click variance amount to see transaction-level differences
- Shows which transactions changed between periods

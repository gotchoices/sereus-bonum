# Saved Reports & Multi-Column UI/UX

**Status:** Spec for future implementation (UI hooks can be stubbed now)

## Overview

Two related features from Story 04:
- **Saved Reports** (Alt G): Save/recall named report configurations
- **Multi-Column Reports** (Alt F): Compare multiple periods side-by-side

---

## 1. Saved Reports

### UI Location
**Accounts View header, right side:**

```
┌────────────────────────────────────────────────────────────┐
│ [Mode ▼]  [Dates]  [Expand All] [Collapse All]   [⭐ Reports ▼] │
└────────────────────────────────────────────────────────────┘
```

### Dropdown Menu (⭐ Reports)

**When clicked, shows:**

```
┌─────────────────────────────┐
│ 💾 Save Current View...     │  ← Action button
├─────────────────────────────┤
│ 📊 Year-End Balance Sheet   │  ← Saved report
│    BS • 2024-12-31          │     (mode + date preview)
│                             │
│ 📈 Quarterly P&L            │
│    IS • Q1-Q4 2024 (4 cols) │
│                             │
│ 📋 Trial Balance (Current)  │
│    TB • Today               │
├─────────────────────────────┤
│ 🗂️  Manage Reports...       │  ← Opens modal
└─────────────────────────────┘
```

### Dropdown Interactions

**Left-click on saved report:**
- Loads that configuration (mode, dates, columns, expanded groups)
- View immediately updates

**Right-click on saved report:**
```
┌──────────────────┐
│ Rename           │
│ Update (Save)    │
│ Duplicate        │
│ Delete           │
└──────────────────┘
```

### Save Dialog

**When user clicks "💾 Save Current View...":**

```
┌─────────────────────────────────────┐
│ Save Report Configuration           │
├─────────────────────────────────────┤
│ Name:                               │
│ [Year-End Balance Sheet________]   │
│                                     │
│ Current settings:                   │
│ • Mode: Balance Sheet              │
│ • As of: 2024-12-31                │
│ • Groups: 3 expanded               │
│ • Columns: 1                       │
│                                     │
│         [Cancel]  [Save]           │
└─────────────────────────────────────┘
```

**If name already exists:**
- Show warning: "Report 'XYZ' already exists. Overwrite?"
- Options: [Cancel] [Save As New] [Overwrite]

### Manage Reports Modal

**More detailed view for editing:**

```
┌─────────────────────────────────────────────────┐
│ Manage Saved Reports                      [X]   │
├─────────────────────────────────────────────────┤
│                                                 │
│ 📊 Year-End Balance Sheet                      │
│    BS • 2024-12-31 • 1 column                  │
│    Created: 2024-03-15 • Last used: Today      │
│    [Rename] [Duplicate] [Delete]               │
│                                                 │
│ ─────────────────────────────────────────────  │
│                                                 │
│ 📈 Quarterly P&L                               │
│    IS • 2024-01-01 to 2024-12-31 • 4 columns   │
│    Created: 2024-02-10 • Last used: Yesterday  │
│    [Rename] [Duplicate] [Delete]               │
│                                                 │
│ ─────────────────────────────────────────────  │
│                                                 │
│                                    [Close]      │
└─────────────────────────────────────────────────┘
```

---

## 2. Multi-Column Reports

### UI Location
**Next to date picker, when available:**

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

**Visual design:**
```
[+]  ← Compact icon-only button (28x28px), next to date picker
```

**Rationale:** Small size keeps layout clean and doesn't push date picker out of alignment with the numbers column below.

**On click:**
- Adds new column to the right
- New column gets default dates (current year)
- Max 12 columns (story requirement)
- After reaching max, button disables with tooltip: "Maximum 12 columns"

### Column Header

**Each column shows:**
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

**Column name:**
- Default: "Column 1", "Column 2", etc.
- Click to rename: "Q1 2024", "Jan", "Last Year", etc.
- Saved with report configuration

**Remove button (X):**
- Removes that column
- First column cannot be removed (disable button)
- Shifts remaining columns left

### Variance Columns

**Checkbox below columns:**
```
☐ Show variance columns ($ and %)
```

**When checked, inserts variance columns between data columns:**

```
┌─────────┬──────────┬─────────┬──────────┬─────────┐
│ Column 1│ $ Change │ % Change│ Column 2 │...      │
├─────────┼──────────┼─────────┼──────────┼─────────┤
│ $50,000 │  +$5,000 │  +10%   │ $55,000  │         │
│ $30,000 │  -$2,000 │  -6.7%  │ $28,000  │         │
└─────────┴──────────┴─────────┴──────────┴─────────┘
```

**Variance calculation:**
- $ Change = Column(n) - Column(n-1)
- % Change = (Column(n) - Column(n-1)) / |Column(n-1)| × 100
- Positive = green, Negative = red
- First column has no variance (nothing to compare)

### Responsive Behavior

**Too many columns to fit:**
- Horizontal scroll
- Column headers sticky on scroll
- Account names sticky on left

**Export:**
- All columns export to separate spreadsheet columns
- Variance columns included if shown

---

## 3. Persistence & Scope

### View State (Automatic)
Persisted per entity in localStorage:
- Current mode
- Current dates (all columns)
- Expanded groups
- Column names
- Variance checkbox state

**Key:** `bonum-accounts-view-state-{entityId}`

### Saved Reports (Explicit)
Persisted globally (not per-entity) in localStorage:
- Report name
- Mode
- Dates (all columns)
- Column count & names
- Variance setting
- Selected account groups (for Custom mode)
- Does NOT save expanded groups (too granular)

**Key:** `bonum-saved-reports`

**Structure:**
```typescript
interface SavedReport {
  id: string;
  name: string;
  mode: ReportMode;
  columns: Array<{
    name: string;
    startDate?: string;
    endDate: string;
  }>;
  showVariance: boolean;
  selectedGroups?: string[];  // For Custom mode
  createdAt: string;
  lastUsedAt: string;
}
```

---

## 4. Implementation Phases

### Phase 1: UI Hooks (Stub Now)
- ✅ Add "⭐ Reports" button to header (disabled, tooltip: "Coming soon")
- ✅ Add "+ Add Column" button (disabled, tooltip: "Multi-column view coming soon")
- ✅ Add empty SavedReports store
- ✅ Add placeholder functions: `saveReport()`, `loadReport()`, `addColumn()`

### Phase 2: Single Save/Load (Later)
- Implement save dialog
- Implement load from dropdown
- Basic rename/delete
- Single column only (no multi-column yet)

### Phase 3: Multi-Column (Later)
- Enable "+ Add Column" button
- Column management (add/remove/rename)
- Responsive layout (horizontal scroll)
- Export multi-column to CSV/Excel

### Phase 4: Variance & Advanced (Later)
- Variance columns ($ and %)
- Manage Reports modal
- Usage tracking (last used, most used)
- Report templates (default set)

---

## 5. UI Component Structure

**New files to create (when implementing):**

```
src/lib/components/
  SavedReportsDropdown.svelte    - Main dropdown UI
  SaveReportDialog.svelte         - Save/rename dialog
  ManageReportsModal.svelte       - Full management interface
  ColumnPicker.svelte             - Multi-column date inputs
  VarianceColumn.svelte           - Variance display logic

src/lib/stores/
  savedReports.ts                 - Global saved reports store
```

**Integration points:**
- `entities/[id]/+page.svelte` header section
- Date picker area (for multi-column)

---

## 6. Edge Cases & Validation

### Saved Reports
- Duplicate names: warn and offer "Save As New"
- Max 50 saved reports (or unlimited?)
- Export/import saved reports (JSON file)
- Sync across devices (future: via Sereus)

### Multi-Column
- Minimum 1 column (cannot remove all)
- Maximum 12 columns (story requirement)
- Date validation: startDate ≤ endDate
- Overlapping date ranges: allowed (for comparison)
- Column width: fixed 150px or dynamic?

### Performance
- Large datasets + 12 columns = 12 SQL queries
- Consider: single query with UNION for all date ranges
- Loading indicator per column vs global

---

## 7. Accessibility

- Keyboard navigation through columns (Tab, Arrow keys)
- Screen reader announces: "Column 1 of 4", "Variance between Q1 and Q2"
- High contrast for variance colors
- Focus management in modals

---

## 8. Future Enhancements

- **Report sharing:** Generate shareable link
- **Scheduled reports:** Auto-generate on schedule (email PDF)
- **Report templates:** Pre-configured common reports
- **Comparison types:** Period-over-period, actual vs budget, actual vs forecast
- **Drill-down from variance:** Click variance to see transaction differences

---

## Notes

- This spec covers UI/UX only
- Backend changes documented in `accounts-view.md` (SQL for date ranges)
- Export format documented in `global/export.md` (multi-column CSV/Excel)
- See Story 04 for user requirements


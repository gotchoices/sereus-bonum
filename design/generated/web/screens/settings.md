# Settings Screen - Consolidation

**Status:** Consolidation (derived from Story 01 Alt D)  
**Generated:** 2025-12-10

---

## Purpose

Global application settings and user preferences.

---

## Derived From

- **Story 01 (Alt D):** Sam explores settings, sees Sereus node config and language selection
- **User requirements:** Date formats, account display, theme control, sign conventions
- **Ledger Story 03:** Keyboard-centric workflow implies display preferences

---

## Layout

### Page Structure

```
┌──────────────────────────────────────────────────┐
│ ← Back to Home                                   │
│                                                  │
│ Settings                                         │
│                                                  │
│ ┌────────────────────────────────────────────┐  │
│ │ Display Preferences                        │  │
│ ├────────────────────────────────────────────┤  │
│ │ Theme:               [Dark ▼]              │  │
│ ├────────────────────────────────────────────┤  │
│ │ Language:            [English ▼]           │  │
│ ├────────────────────────────────────────────┤  │
│ │ Date Format:         [US ▼]  12/10/2025   │  │
│ ├────────────────────────────────────────────┤  │
│ │ Account Display:     [Name only ▼]         │  │
│ ├────────────────────────────────────────────┤  │
│ │ Transaction Sort:    [Oldest first ▼]      │  │
│ └────────────────────────────────────────────┘  │
│                                                  │
│ ┌────────────────────────────────────────────┐  │
│ │ Accounting Preferences                     │  │
│ ├────────────────────────────────────────────┤  │
│ │ ☐ Hide negative signs on Equity & Income  │  │
│ │    (Shows true accounting by default)      │  │
│ └────────────────────────────────────────────┘  │
│                                                  │
│ ┌────────────────────────────────────────────┐  │
│ │ Network (Future)                           │  │
│ ├────────────────────────────────────────────┤  │
│ │ Sereus Nodes:               [+ Add Node]   │  │
│ ├────────────────────────────────────────────┤  │
│ │ ┌──────────────────────────────────────┐   │  │
│ │ │  No nodes configured yet             │   │  │
│ │ └──────────────────────────────────────┘   │  │
│ └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘

(Auto-saves on change, no Save button needed)
```

---

## Settings Groups

### 1. Display Preferences

**Theme**
- Radio buttons: Light | Dark | System (follows OS)
- Default: System
- Changes apply immediately (no page reload)
- Stored in: `localStorage: bonum-theme`

**Language**
- Dropdown: English (MVP only)
- Future: Spanish, French, German, etc.
- Requires page reload to apply
- Stored in: `localStorage: bonum-language`

**Date Format**
- Radio buttons:
  - US: MM/DD/YYYY (e.g., 12/10/2025)
  - European: DD/MM/YYYY (e.g., 10/12/2025)
  - ISO: YYYY-MM-DD (e.g., 2025-12-10)
- Default: System locale detection
- Applies to: All date displays, exports
- Stored in: `localStorage: bonum-date-format`

**Account Display**
- Radio buttons:
  - Code only: `1000`
  - Name only: `Checking Account`
  - Full path: `Assets : Cash & Bank : Checking Account`
  - Code: Name: `1000: Checking Account`
- Default: Name only
- Applies to: Ledger, autocomplete, search results
- Does NOT apply to: Accounts View (always shows hierarchy)
- Stored in: `localStorage: bonum-account-display`

**Transaction Sort Order**
- Radio buttons:
  - Oldest first: Chronological order (oldest transaction at top)
  - Newest first: Reverse chronological (most recent transaction at top)
- Default: Oldest first
- Applies to: All account ledgers
- Stored in: `localStorage: bonum-transaction-sort`
- Changes apply immediately when viewing ledgers

### 2. Accounting Preferences

**Sign Convention** (Simplified)

Single toggle:
- ☐ Hide negative signs on Equity and Income

**Context:**
- Database stores signed amounts: debit = +, credit = -
- Equity and Income are credit-normal (naturally negative in DB)
- Binary choice: show true accounting signs OR hide negatives
- This is display-only; database unchanged

**When checked:**
- Equity shows as positive
- Income shows as positive
- Liabilities remain unchanged (stay negative)

**Applies to:**
- Account balances in Accounts View
- Ledger displays
- Reports (Balance Sheet, Income Statement)
- Exports (CSV, Excel)

**Default:** Unchecked (show accounting convention signs)

**Stored in:** `localStorage: bonum-sign-reversal` (sets both equity and income flags)

### 3. Network (Future)

**Sereus Nodes List**
- Shows list of configured nodes (empty for MVP)
- "+ Add Node" button (disabled, future implementation)
- Each node card shows:
  - Node URL (wss://...)
  - Connection status
  - Remove button
- For MVP: Shows "No nodes configured yet"
- Future: Add/remove nodes, connection management, sync status

---

## Behavior

### On Page Load
1. Load all settings from `localStorage`
2. Apply theme immediately (before render)
3. Display current values in form

### On Change (Per Setting)

**Theme:**
- Apply immediately (no save button needed)
- Update `data-theme` attribute on `<html>`
- Store in localStorage

**Date Format:**
- Apply immediately
- Update all displayed dates
- Store in localStorage

**Account Display:**
- Apply immediately
- Affects next view of ledger/search
- Store in localStorage

**Sign Reversal:**
- Apply immediately
- Re-render any visible balance displays
- Store in localStorage

**Language:**
- Requires page reload
- Show confirmation: "Page will reload to apply language change"

### Save Button

**Purpose:** Explicit confirmation (optional pattern)

**Alternative:** Auto-save on change (recommended)
- Each change saves immediately
- No "Save" button needed
- Toast notification: "Setting saved"

### Cancel Button

**Purpose:** Discard changes and return to previous page

**Alternative:** Just "Back" link (if auto-save)

---

## Validation

- No validation needed (all are selections, not text input)
- Theme change: Immediate visual feedback
- Date format: Preview shown next to selection?
  - "Today: MM/DD/YYYY" → updates as user selects

---

## Accessibility

- Keyboard navigation: Tab through all controls
- Radio buttons: Arrow keys to select
- Checkboxes: Space to toggle
- Screen reader: Announce setting name + current value
- High contrast support for theme toggle

---

## Future Enhancements

- **Import/Export Settings:** Backup/restore preferences
- **Fiscal Year Start:** For year-end calculations
- **Decimal Precision:** How many decimal places (default: 2)
- **Keyboard Shortcuts:** Configure custom hotkeys
- **Report Defaults:** Default mode, date range for Accounts View
- **Auto-Backup:** Enable local export on schedule

---

## Implementation Notes

### localStorage Keys

```typescript
'bonum-theme'           // 'light' | 'dark' | 'system'
'bonum-language'        // 'en' | 'es' | 'fr' | ...
'bonum-date-format'     // 'US' | 'EU' | 'ISO'
'bonum-account-display' // 'code' | 'name' | 'path' | 'code-name'
'bonum-sign-reversal'   // { equity: boolean, income: boolean, liability: boolean }
```

### Theme Application

```typescript
function applyTheme(theme: 'light' | 'dark' | 'system') {
  if (theme === 'system') {
    // Detect OS preference
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
```

### Date Formatting

Use existing utility or create new:

```typescript
function formatDate(date: Date, format: 'US' | 'EU' | 'ISO'): string {
  switch (format) {
    case 'US': return `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()}`;
    case 'EU': return `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
    case 'ISO': return date.toISOString().split('T')[0];
  }
}
```

### Sign Reversal

Apply in display logic:

```typescript
function displayAmount(amount: number, accountType: AccountType, reversal: SignReversal): number {
  if (accountType === 'EQUITY' && reversal.equity) return -amount;
  if (accountType === 'INCOME' && reversal.income) return -amount;
  if (accountType === 'LIABILITY' && reversal.liability) return -amount;
  return amount;
}
```

---

## MVP Scope

**Include:**
- ✅ Theme toggle (Light/Dark/System)
- ✅ Date format (US/EU/ISO)
- ✅ Account display (4 options)
- ✅ Sign reversal (3 checkboxes)
- ✅ Language dropdown (English only, disabled for MVP)

**Defer:**
- ⬜ Sereus node configuration (show placeholder only)
- ⬜ Fiscal year settings
- ⬜ Keyboard shortcuts
- ⬜ Report defaults

---

## Related Files

- **Story:** `design/stories/web/01-firstlook.md` (Alt D)
- **i18n:** Update `src/lib/i18n/locales/en.ts` with settings strings
- **Styles:** `src/app.css` (theme application)
- **Utils:** Create `src/lib/utils/settings.ts` for get/set functions


# Spec: Settings

**Route:** `/settings`
**Source:** Story 01 (Alt D)
**Consolidation:** `design/generated/web/screens/settings.md`

## Purpose

Global application settings and user preferences.

---

## Display Preferences

### Theme
- Options: `System`, `Light`, `Dark`
- Default: `System` (follows OS preference)

### Language
- Options: `English` (MVP)
- Future: Multi-language support

### Date Format
- Options: `US` (MM/DD/YYYY), `European` (DD/MM/YYYY), `ISO` (YYYY-MM-DD)
- Shows live preview of current date in selected format

### Account Display
- Options: `Number only`, `Name only`, `Full path`, `Number: Name`
- Controls how accounts appear throughout the app

### Transaction Sort Order
- Options: `Newest first`, `Oldest first`
- Default: `Oldest first` (chronological order, oldest at top)
- Controls the display order in account ledgers

---

## Accounting Preferences

### Sign Display for Equity & Income
- Checkbox: "Hide negative signs on Equity & Income"
- Default: Unchecked (shows natural accounting signs)
- When checked: UI hides minus signs for these account types

---

## Network Preferences (Future)

### Sereus Nodes
- List of configured Sereus network nodes
- Add/remove node functionality
- Empty state: "No nodes configured yet"

---

## Persistence

All settings are:
- Auto-saved on change (no explicit Save button)
- Stored in `localStorage` per device
- Applied immediately across the app


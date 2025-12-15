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

## AI Assistant

### Enable AI Assistant
- Checkbox: "Enable AI Assistant"
- Default: Unchecked (disabled)
- When enabled, shows additional configuration options

### AI Provider
- Dropdown: `OpenAI`, `Anthropic`, `Google Gemini`
- Required when AI assistant is enabled
- Default: None (user must select)

### API Key
- Password input field (with show/hide toggle)
- Monospace font for better readability
- Required when provider is selected
- Validated on blur

### Test Connection
- Button: "Test Connection"
- Disabled when no API key provided
- Shows loading state while testing
- Displays success/error message with visual feedback

### Privacy Note
- Prominent message explaining:
  - API key stored locally in browser
  - Never sent to Sereus servers
  - Requests go directly from browser to chosen provider

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


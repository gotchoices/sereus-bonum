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


## Units & Reference Rates

Bonum treats every currency, security, commodity, and inventory item as a **unit**
(see [domain/units.md](../../domain/units.md)). Two things are managed here.

**Units.** List, create, and edit units: `code` (bare for currencies — `USD`; namespaced otherwise —
`NYSE:VPER`, `INV:widget`), `name`, `symbol`, type, and `displayDivisor`. The divisor is fixed once the
unit has entries — changing it would reinterpret every stored amount, so it must be locked, not warned
about.

**Reference rates.** Observed quotes between two units, used only to value holdings at report time.
Transaction rates are *not* here — they live on the entries themselves.

- List rates by pair, most recent first, showing value, date, and source (MARKET / MANUAL).
- **Add a manual rate**: pair, date, rate, and a note explaining where it came from. This is how a user
  values an idle holding — hold CHIPs with no recent activity, log a CHIP/USD quote, and the balance
  sheet can render in dollars.
- Imported price histories (GnuCash keeps one) land here as MARKET rates and are visible alongside
  manual ones.
- Rates are stored as exact rationals; the UI must round only for display, never for storage.

**Surfacing gaps:** when a report can't reach the display unit from some held unit, it flags that unit
(see [accounts-view.md](./accounts-view.md#display-unit)) and offers a direct path to add the missing
rate here.

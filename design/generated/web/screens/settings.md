---
dependsOn:
  - design/specs/web/screens/settings.md
  - design/stories/web/01-firstlook.md
depHashes:
  design/specs/web/screens/settings.md: 277578e5f469cb38b1256e9f7aac0d4b8d153222b99fd584ee0813ef6353be4c
  design/stories/web/01-firstlook.md: a383e823aa5e362529d07d75688744556ef21848e59b20fa76986ba214169f06
provides:
  - screen:Settings
needs:
  - store:settings
  - service:ai
  - util:formatDate
generated: 2026-07-18
lastUpdated: 2026-07-18
component: apps/web/src/routes/settings/+page.svelte
---

# Consolidation: Settings Screen

**Route:** `/settings`
**Component:** `apps/web/src/routes/settings/+page.svelte`
**Generated:** 2026-07-18

---

## Purpose

Global, device-local application preferences. The page is a thin form over the `settings` store
(`$lib/stores/settings.ts`): local `$state` mirrors the store via `$effect`, each control's `onchange`
calls a `settings.set*` mutator that persists to `localStorage` and applies immediately (no Save button).
Groups: Display, Accounting (sign convention), AI Assistant, and a placeholder Network section.

## Architecture

- **Screen** (`+page.svelte`): renders sections; holds no persistence logic. `onMount` → `settings.load()`;
  `$effect` syncs store → local fields; handlers (`handleThemeChange`, `handleDateFormatChange`,
  `handleAccountDisplayChange`, `handleTransactionSortOrderChange`, `handleSignReversalChange`,
  `handleAISettingsChange`) push changes back.
- **Store** (`$lib/stores/settings.ts`): `load` / `setTheme` / `setDateFormat` / `setAccountDisplay` /
  `setTransactionSortOrder` / `setSignReversal` / `setAISettings`; per-key `localStorage` (`bonum-*`);
  `applyTheme` sets `data-theme` on `<html>`.
- **Helpers**: `getDateFormatPreview` (`$lib/utils/formatDate`) for the live date sample;
  `testAIConnection` (`$lib/services/ai`) for the connection test.

---

## Source Requirements Verification

### Display Preferences
| Requirement | Status | Implementation |
|---|---|---|
| Theme: System / Light / Dark, default System | ✅ | `theme` `<select>` → `handleThemeChange` → `setTheme`; `applyTheme` sets `data-theme` |
| Language: English (MVP) | ✅ | Language `<select>` rendered `disabled` (English only) |
| Date Format: US / EU / ISO with live preview | ✅ | `dateFormat` `<select>`; `datePreview = getDateFormatPreview(dateFormat)` shown alongside |
| Account Display: Number / Name / Full path / Number:Name | ✅ | `accountDisplay` `<select>` (`code`/`name`/`path`/`code-name`) → `setAccountDisplay` |
| Transaction Sort: Newest / Oldest, default Oldest | ✅ | `transactionSortOrder` `<select>` → `setTransactionSortOrder`; store default `oldest` |

### Accounting Preferences
| Requirement | Status | Implementation |
|---|---|---|
| Single "Hide negative signs on Equity & Income" toggle, default off | ✅ | `hideNegativeSigns` checkbox → `handleSignReversalChange` → `setSignReversal({equity, income, liability:false})` |
| Display-only, DB unchanged | ✅ | Store flags only; consumed by balance/ledger render (outside this screen) |

### AI Assistant
| Requirement | Status | Implementation |
|---|---|---|
| Enable toggle, default off; reveals config when on | ✅ | `aiEnabled` checkbox; `{#if aiEnabled}` gates provider/key/test |
| Provider dropdown: OpenAI / Anthropic / Google Gemini | ✅ | `aiProvider` `<select>` (`openai`/`anthropic`/`google`) → `handleAISettingsChange` |
| API Key password field with show/hide, monospace | ✅ | `type={showApiKey?'text':'password'}`; `btn-toggle-key`; `.api-key-input` mono font |
| API Key validated on blur | ⚠️ Partial | `onblur` saves via `handleAISettingsChange`; no validation performed |
| Test Connection button, disabled without key, loading + result | ✅ | `btn-test` `disabled={testingConnection || !aiApiKey}`; `handleTestConnection` → `testAIConnection`; `testResult` success/error block |
| Privacy note: key local, never to Sereus, direct to provider | ✅ | `.security-note` block, names selected provider |

### Network Preferences (Future)
| Requirement | Status | Implementation |
|---|---|---|
| Sereus Nodes list, add/remove | ⛔ Deferred | Section rendered; "+ Add Node" `disabled`; node-card markup commented out |
| Empty state "No nodes configured yet" | ✅ | `.node-list-empty` |

### Persistence
| Requirement | Status | Implementation |
|---|---|---|
| Auto-save on change, no Save button | ✅ | Every handler calls a `settings.set*` mutator immediately |
| Stored in localStorage per device | ✅ | `bonum-theme`, `bonum-date-format`, `bonum-account-display`, `bonum-transaction-sort`, `bonum-sign-reversal`, `bonum-ai-settings` |
| Applied immediately across app | ✅ | Theme via `applyTheme`; others read live from store by consumers |

### stories/web/01-firstlook.md
| Requirement | Status | Notes |
|---|---|---|
| Settings entry in global menu | ✅ | Route `/settings`, "Back to Home" link |
| Adjust operating preferences (Alt D) | ✅ | Display + Accounting groups |
| Sereus node config visible | ✅ | Network section present (placeholder) |

---

## Deferred / Notes
- **Sereus node configuration** — UI stub only; add/remove and connection management not built.
- **API key validation** — spec asks for on-blur validation; component only persists on blur. Live
  correctness is surfaced separately via Test Connection.
- **Language switching** — only English; selector disabled, no reload flow (spec's future scope).
- Sign convention is a single simplified toggle (equity+income); the underlying store still carries a
  separate `liability` flag, held `false` here.

---
dependsOn:
  - design/specs/domain/units.md
  - design/specs/web/screens/settings.md
  - design/stories/web/01-firstlook.md
depHashes:
  design/specs/web/screens/settings.md: 277578e5f469cb38b1256e9f7aac0d4b8d153222b99fd584ee0813ef6353be4c
  design/stories/web/01-firstlook.md: 11e9c354253b25afbcbaee117a3cc645ba53348eaf9c46a831127520807a3222
provides:
  - screen:Settings
needs:
  - store:settings
  - service:ai
  - service:i18n
  - util:formatDate
generated: 2026-07-22
lastUpdated: 2026-07-22
component: apps/web/src/routes/settings/+page.svelte
status: partial
---

# Consolidation: Settings

**Route:** `/settings`
**Component:** `apps/web/src/routes/settings/+page.svelte`
**Generated:** 2026-07-22 · reconciled to the implementation (the built screen is the source of truth for
this consolidation).

---

## Purpose

Global application settings and user preferences, grouped into Display Preferences, Accounting
Preferences, an AI Assistant integration, and a stubbed (Future) Network section. All preferences
auto-save to `localStorage` and apply immediately — no explicit Save button. See
[settings.md](../../../specs/web/screens/settings.md) and story
[01-firstlook.md](../../../stories/web/01-firstlook.md) (Alt Path D).

## Architecture

- **Screen** (`+page.svelte`): local `$state` mirrors (`theme`, `dateFormat`, `accountDisplay`,
  `transactionSortOrder`, `hideNegativeSigns`, `ai*`) kept in sync with the store by a `$effect`
  reading `$settings`. Each control's `onchange`/`onblur` calls the matching `settings.setX(...)`
  mutator (auto-save). `onMount` → `settings.load()`.
- **Store** (`$lib/stores/settings`): `AppSettings` writable + per-key `localStorage` persistence
  (`bonum-theme`, `bonum-language`, `bonum-date-format`, `bonum-account-display`,
  `bonum-transaction-sort`, `bonum-sign-reversal`, `bonum-ai-settings`); `applyTheme` sets
  `data-theme` on `<html>` (resolves `system` via `prefers-color-scheme`); `effectiveTheme` derived.
  Type unions: `Theme`, `DateFormat`, `AccountDisplay`, `TransactionSortOrder`, `AIProvider`.
- **AI service** (`$lib/services/ai`): `testAIConnection()` (a minimal `generateAIResponse` round-trip);
  provider clients built via `@ai-sdk/openai` / `@ai-sdk/anthropic` / `@ai-sdk/google` from the stored
  key, direct browser access (Anthropic sends `anthropic-dangerous-direct-browser-access`). Default
  models per provider (`gpt-4o`, `claude-sonnet-4-0`, `gemini-1.5-pro`).
- **Date preview** (`$lib/utils/formatDate` `getDateFormatPreview`): `datePreview` `$derived` from the
  selected `dateFormat`.
- **i18n** (`$lib/i18n` `t`): Display/Accounting/Network copy via `settings.*` keys; the AI Assistant
  section uses hard-coded English strings.

---

## Source Requirements Verification

### specs/web/screens/settings.md — Display Preferences

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Theme: System / Light / Dark, default System | ✅ | `theme` select → `settings.setTheme`; `applyTheme` applies live; default `system` |
| Language: English (MVP) | ⚠️ Partial | Only `English` option; `<select>` is `disabled` with no `onchange`; `settings.setLanguage` exists but is unwired |
| Date Format: US / EU / ISO with live preview | ✅ | `dateFormat` select → `setDateFormat`; `datePreview` via `getDateFormatPreview` |
| Account Display: Number / Name / Full path / Number: Name | ✅ | `accountDisplay` select (`code`/`name`/`path`/`code-name`) → `setAccountDisplay` |
| Transaction Sort Order: Newest / Oldest, default Oldest | ✅ | `transactionSortOrder` select → `setTransactionSortOrder`; default `oldest` |

### specs/web/screens/settings.md — Accounting Preferences

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Checkbox "Hide negative signs on Equity & Income", default unchecked | ✅ | `hideNegativeSigns` → `setSignReversal({equity, income, liability:false})`; single toggle drives both |

### specs/web/screens/settings.md — AI Assistant

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Enable checkbox, default unchecked; reveals config when on | ✅ | `aiEnabled` → `handleAISettingsChange`; provider/key blocks `{#if aiEnabled}` |
| Provider dropdown OpenAI / Anthropic / Google, required, default None | ✅ | `aiProvider` select (`null` default) → `handleAISettingsChange` |
| API Key: password input, show/hide toggle, monospace | ✅ | `type={showApiKey ? 'text':'password'}`; `btn-toggle-key`; `.api-key-input` `font-mono` |
| API Key required when provider selected | ✅ | Key row rendered only `{#if aiProvider}`; Test button `disabled` without a key |
| API Key validated on blur | ⚠️ Partial | `onblur` only persists (`handleAISettingsChange`); no key validation until "Test Connection" |
| Test Connection: disabled w/o key, loading state, success/error feedback | ✅ | `handleTestConnection` → `testAIConnection`; `testingConnection`; `.test-result.success/.error` |
| Privacy Note (local key, never to Sereus, direct to provider) | ✅ | `.security-note` with per-provider destination |

### specs/web/screens/settings.md — Network (Future) + story 01 Alt D (Sereus nodes)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Sereus Nodes list with add/remove | ⛔ Deferred | Section marked "Future"; "+ Add Node" button `disabled`; node cards commented-out |
| Empty state "No nodes configured yet" | ✅ | `.node-list-empty` (`settings.no_nodes_configured`) |

### specs/web/screens/settings.md — Persistence

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Auto-save on change (no Save button) | ✅ | every control's handler calls a `settings.setX` mutator |
| Stored in localStorage per device | ✅ | per-key `localStorage` writes in the store |
| Applied immediately across the app | ✅ | store is reactive; theme applied synchronously via `applyTheme` |

### stories/web/01-firstlook.md (Alt Path D)

| # | Requirement | Status | Implementation |
|---|-------------|--------|----------------|
| 6.1 | Sereus: managing cadre & partner nodes | ⛔ Deferred | Network section stubbed (disabled add, empty state) |
| 6.1 | Selecting preferred language | ⚠️ Partial | Language select present but `disabled`; only English |

---

## Deferred / Notes (demanded by stories/specs, not yet built)

- **Language selection** (spec Display, story Alt D). Only English exists and the `<select>` is
  `disabled` with no change handler; `settings.setLanguage` / `bonum-language` persistence is wired in
  the store but not surfaced. Multi-language is Future.
- **Sereus network nodes** (spec Network Future, story Alt D). Entirely stubbed — the "+ Add Node"
  control is disabled, node cards are commented out, and only the empty state renders. No add/remove or
  connection logic.
- **API-key validation on blur** (spec AI Assistant). Blur only persists the key; there is no
  validation short of an explicit "Test Connection" round-trip.
- **Sign reversal granularity** — the store models per-type reversal (`equity`/`income`/`liability`),
  but the UI collapses it to one "Equity & Income" toggle (liability always `false`), matching the spec.

## Units & Reference Rates (spec'd 2026-08-11, UI pending)

Spec: [settings.md](../../../specs/web/screens/settings.md#units--reference-rates)

Data layer is in place — `DataService.getExchangeRates({unitA,unitB,asOf})` and `createExchangeRate`
on both backends, `exchange` table holding MARKET/MANUAL quotes as exact rationals. The management UI
(unit list/editor, rate list, "add a manual rate") is **not built yet**; the reports screen already
deep-links here from its unvalued-units banner.

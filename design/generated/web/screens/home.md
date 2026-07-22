---
dependsOn:
  - design/stories/web/01-firstlook.md
  - design/specs/web/navigation.md
  - design/specs/web/screens/index.md
depHashes:
  design/stories/web/01-firstlook.md: 11e9c354253b25afbcbaee117a3cc645ba53348eaf9c46a831127520807a3222
  design/specs/web/navigation.md: bae0519ddf8e0b88b1d2243da4aeb92482af8e61ff830470399d1f2ab90cb03b
  design/specs/web/screens/index.md: 3ec165d57ce4dcd3e62df4951435e545404349b2caf05329ac65c84c307fc608
provides:
  - screen:Home
needs:
  - service:DataService
  - store:entities
  - component:EntityList
  - component:WelcomePanel
  - component:VisualBalanceSheet
generated: 2026-07-22
lastUpdated: 2026-07-22
component: apps/web/src/routes/+page.svelte
status: partial
---

# Consolidation: Home

**Route:** `/`
**Component:** `apps/web/src/routes/+page.svelte`
**Generated:** 2026-07-22 · reconciled to the implementation (the built screen is the source of truth for
this consolidation).

> Home has **no dedicated screen spec** (`screens/index.md` lists its Spec as "—"). Requirements are traced
> from the primary story [stories/web/01-firstlook.md](../../../stories/web/01-firstlook.md) plus
> [navigation.md](../../../specs/web/navigation.md) and [screens/index.md](../../../specs/web/screens/index.md).

---

## Purpose

The landing screen: a two-pane dashboard. The left pane lists all entities (select + context menu, add
control); the right pane shows a dismissible **Welcome** panel for new users, swapping to a
**Visual Balance Sheet** for the selected entity. This is the hub from which the user reaches an entity's
reports (**Accounts View**, `/entities/[id]`), its **Manage Accounts** screen (`/entities/[id]/accounts`),
and — per the story — entity create/edit/import/boilerplate flows.

## Architecture

- **Screen** (`+page.svelte`): a `.home-layout` grid — an `.entities-panel` (header with title + `➕` add
  button, then `<EntityList>`) and a `.dashboard-panel`. `selectedEntity` is derived from the `entities`
  store + `selectedEntityId`. `showWelcomePanel` = `!welcomeDismissed && !selectedEntity`; dismissal read
  from `localStorage['bonum-welcome-dismissed']` in a `browser` `$effect`. When an entity is selected the
  pane shows its name (linking to `/entities/[id]`), optional description, and `<VisualBalanceSheet>`;
  otherwise a "select an entity" empty state.
- **EntityList** (`$lib/components/EntityList.svelte`): loading / error / empty / list states from the
  `entities` store. Each row: entity name as an anchor to `/entities/[id]` (**Accounts View**, reports),
  description, base unit; row click → `selectEntity`; right-click → context menu. Context menu items:
  **Edit** (📝, TODO stub), **Accounts** (📊, anchor → `/entities/[id]/accounts`, **Manage Accounts**),
  **Import** (📥, TODO stub), **Boilerplate** (📋, TODO stub), **Delete** (🗑️, `confirm()` →
  `deleteEntity`). Closes on window click.
- **WelcomePanel** (`$lib/components/WelcomePanel.svelte`): intro + getting-started / nav tips lists and a
  "don't show again" checkbox whose `$effect` writes `bonum-welcome-dismissed=true` to `localStorage`.
- **VisualBalanceSheet** (`$lib/components/VisualBalanceSheet.svelte`): radial SVG (net-worth center, A/L/E
  ring, account-group ring) via `getDataService().getBalanceSheet(entityId, asOf)`; own loading / error /
  empty states. Reloads on `entityId` change.
- **Store** (`$lib/stores/entities`): `entities`, `entitiesLoading`, `entitiesError`, `selectedEntityId`,
  derived `selectedEntity`; `initializeEntities`, `selectEntity`, `addEntity`, `updateEntity`,
  `deleteEntity` — all backed by `DataService`. (Store init happens in the root layout.)

---

## Source Requirements Verification

### Home dashboard (01-firstlook §1–4; navigation.md; screens/index.md)

| # | Requirement | Status | Implementation |
|---|-------------|--------|----------------|
| 1 | Welcome pane with basic-usage advice + "don't show again" | ✅ | `WelcomePanel`; `welcome.*` copy; checkbox → `bonum-welcome-dismissed` |
| 1 | Selecting an entity replaces the welcome message with its Visual Balance Sheet | ✅ | `showWelcomePanel` gate; `{:else if selectedEntity}` → `VisualBalanceSheet` |
| 1 | Welcome dismissible permanently | ✅ | `$effect` persists `true`; read back into `welcomeDismissed` |
| 2 | Entities pane pre-seeded with Home Finance / Small Business templates | ✅ | Rendered from `entities` store (seed provides the two templates) |
| 3 | Clear "add new entity" control | ⚠️ Partial | `➕` button rendered (`entities.add` title) but has **no click handler** — see Deferred |
| 4 | Entity name is a hyperlink → Accounts View | ✅ | `EntityList` `<a href="/entities/{id}">`; also entity-title link in dashboard |
| 4 | Row click highlights/selects; VBS updates to that entity | ✅ | `handleSelect` → `selectEntity`; `.selected` class; derived `selectedEntity` |
| 4 | Context menu: Edit / Accounts / Import / Boilerplate / Delete | ⚠️ Partial | All five present in order; Accounts + Delete wired, Edit/Import/Boilerplate are TODO stubs |
| 5 | Global menu (Home / Catalog / Import Books / Settings …) | ✅ (elsewhere) | Provided by the root layout nav, not this screen (see navigation.md) |

### Entity context-menu actions (01-firstlook §4; navigation.md § Entity Context Menu)

| Action | Status | Implementation |
|--------|--------|----------------|
| **Edit** — add/update basic entity info | ⛔ Deferred | Menu item present; handler is `/* TODO: edit modal */`. `updateEntity` exists in the store, unused by UI |
| **Accounts** — open Manage Accounts (add/edit/retire) | ✅ | Anchor → `/entities/[id]/accounts` (Alt Path E screen) |
| **Import** — load transactions from a file | ⛔ Deferred | Menu item present; handler is `/* TODO: import transactions */` |
| **Boilerplate** — clone structure into a new entity | ⛔ Deferred | Menu item present; handler is `/* TODO: boilerplate */` |
| **Delete** — remove entity, with confirmation | ✅ | `confirm(entities.delete_confirm)` → `deleteEntity`; clears selection if deleted |

### Create-entity flow (01-firstlook Alt Path A §6.1–6.5)

| # | Requirement | Status | Implementation |
|---|-------------|--------|----------------|
| 6.1 | Click add → start a new entity | ⛔ Deferred | `➕` button has no `onclick`; no create trigger wired |
| 6.2 | Editing pane captures name, tax id, accounting method, unit of account | ⛔ Deferred | No create/edit form component exists on this screen |
| 6.3 | New entity appears in the list | ⚠️ | `addEntity` appends to `entities` store, but nothing calls it from the UI |
| 6.4–6.5 | Select new entity, Delete with warning | ✅ (delete) | Delete + confirm works; the create half is unbuilt |

### Boilerplate / clone flow (01-firstlook Alt Path B §6.1–6.5)

| # | Requirement | Status | Implementation |
|---|-------------|--------|----------------|
| 6.1 | Context-menu Boilerplate on an entity | ⛔ Deferred | Menu item present but stubbed |
| 6.2 | Editing pane for the new (cloned) entity's details | ⛔ Deferred | Not built |
| 6.4–6.5 | Open the clone → zeroed balance-sheet-like listing | ✅ (target exists) | `/entities/[id]` renders zeroed reports for an empty entity; only the clone step is missing |

### Variants (01-firstlook § Variants)

| Variant | Status | Implementation |
|---------|--------|----------------|
| **happy** — entities present, VBS renders on select | ✅ | `EntityList` + `VisualBalanceSheet` |
| **empty** — no entities; welcome stands in | ✅ | `EntityList` `.empty-state` (`no_entities` / `create_prompt`); welcome shown until an entity is selected |
| **error** — blank/duplicate name rejected inline | ⛔ Deferred | No create form → no name validation |
| **error** — delete asks for confirmation | ✅ | `confirm()` gate before `deleteEntity` |

---

## Deferred / Notes (demanded by the story, not yet built)

- **Create-entity flow** (Alt Path A). The `➕` button in `+page.svelte` (the `.panel-header` `btn-icon`,
  lines ~35–37) is a **dead control** — no `onclick`, no form. Needs an entity-editor modal capturing name +
  tax id + accounting method + unit, plus blank/duplicate-name validation (the **error** variant), then a
  call to `addEntity` (which already exists and appends to the store).
- **Edit entity** (context menu). `EntityList.svelte` handler is a TODO stub; the same editor modal would
  cover it via the existing `updateEntity` store function.
- **Import transactions** (context menu). Stubbed; the `/import` route exists but the per-entity menu action
  does not wire to it.
- **Boilerplate / clone** (Alt Path B). Stubbed; no "clone this entity's account structure into a new one"
  flow. The destination (a zeroed Accounts View for an empty entity) already renders.
- **Delete-confirm copy** is a generic `entities.delete_confirm` string — no entity name in the prompt
  (polish; the story only asks for "a warning").
- **Global menu** items (Home / Catalog / Import Books / Settings / Search / Assistant) are owned by the root
  layout nav, not this screen; traced in navigation.md.

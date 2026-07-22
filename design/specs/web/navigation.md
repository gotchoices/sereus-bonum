# Navigation (Web)

App-wide navigation for the web target. A desktop-oriented, multi-window paradigm.

## Sitemap

| Route | Screen | Notes |
|-------|--------|-------|
| `/` | Home | Entity list + Visual Balance Sheet (or welcome) |
| `/catalog` | Account Catalog | Shared account groups |
| `/entities/[id]` | Entity Accounts | Balance-sheet/report views for one entity |
| `/entities/[id]/accounts` | Manage Accounts | Add / edit an entity's accounts (see account-edit.md) |
| `/ledger/[accountId]` | Ledger | Transaction entry for one account |
| `/search` | Transaction Search | Cross-entity search |
| `/import` | Import | Books (new entity) or transactions |
| `/settings` | Settings | Preferences, Sereus, language |

## Global Menu

A persistent tray on the left. Opens on launch; can be toggled hidden (its state persists) with an
animated slide; when hidden the rest of the page expands to fill the space. The top shows the
"Sereus Bonum" logo. Entries:

- **Home** — entity list + balance sheet
- **Account Catalog** — review/edit account groups
- **Search** — cross-entity transaction search
- **Import Books** — create an entity from another program's file
- **Settings** — preferences
- **Assistant** — AI help (see [components/ai-assistant.md](./components/ai-assistant.md))

## Entity Context Menu

From a selected entity on Home: **Edit**, **Accounts** (opens Manage Accounts — add/edit the entity's
accounts; see [screens/account-edit.md](./screens/account-edit.md)), **Import**, **Boilerplate** (clone its
structure into a new entity), **Delete** (with confirmation). The entity *name* link opens the Accounts View
(reports).

## Window Model

Multiple panes/windows can be open at once.

| Action | Result |
|--------|--------|
| Click a link | Navigate in the current pane |
| Ctrl/Cmd + click | Open in a new window |

Some windows are **linked** so changes propagate live: Entity Accounts → Ledger, Ledger → offset
Ledger, Reconciliation → Ledger (new entries appear in the reconciliation list).

## Deep Links

Scheme: `bonum://` — e.g. `bonum://screen/Ledger?accountId=…`.

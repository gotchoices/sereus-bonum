# Screens Plan

List of screens for this target with routes and status.

## Instructions

- List each screen with a clear, stable name
- Add the route name (PascalCase, used for navigation and deep links)
- Spec file uses kebab-case (`item-list.md` for route `ItemList`)
- Note variants to support (happy, empty, error)

## Screens

| Screen Name | Route | Spec File | Variants | Status |
|-------------|-------|-----------|----------|--------|
| Home | / | (home) | - | implemented |
| Catalog | /catalog | catalog.md | - | implemented |
| Entity Accounts | /entities/[id] | (entity-accounts) | - | implemented |
| Ledger | /ledger/[accountId] | ledger.md | - | implemented |
| Search | /search | search.md | - | implemented |
| Import | /import | import.md | - | draft |
| Settings | /settings | settings.md | - | implemented |

## Notes

- Add/remove rows as needed
- Screen-specific requirements go in spec files
- Agent proposes screens from stories if this is empty

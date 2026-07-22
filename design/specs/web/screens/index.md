# Screens (Web)

Route names are PascalCase (used by tooling); Path is the actual SvelteKit route.

| Screen | Route | Path | Spec | Status |
|--------|-------|------|------|--------|
| Home | Home | `/` | — | implemented |
| Account Catalog | Catalog | `/catalog` | catalog.md | implemented |
| Entity Accounts | EntityAccounts | `/entities/[id]` | accounts-view.md | implemented |
| Manage Accounts | ManageAccounts | `/entities/[id]/accounts` | account-edit.md | implemented |
| Ledger | Ledger | `/ledger/[accountId]` | ledger.md | implemented |
| Transaction Search | Search | `/search` | search.md | implemented |
| Import | Import | `/import` | import.md | implemented |
| Settings | Settings | `/settings` | settings.md | implemented |
| Saved Reports | SavedReports | (within EntityAccounts) | saved-reports-ux.md | future |

Navigation and the global menu: [../navigation.md](../navigation.md).

# Components Plan

List reusable UI components for this target.

## Instructions

- Components are shared building blocks used by multiple screens/routes
- Keep component specs **user-observable** (behavior, states, constraints)
- Implementation mapping belongs in consolidations (`design/generated/...`)

## Components

| Component Name | Spec File | Used By | Status |
|----------------|----------|---------|--------|
| AccountAutocomplete | account-autocomplete.md | Ledger, Search, Import | complete |
| TransactionEditor | transaction-edit.md | Ledger, Import Review | complete |
| TransactionResultsTable | transaction-results-table.md | Search | draft |
| AIAssistant | ai-assistant.md | All screens (sidebar) | draft |

## Notes

- Add/remove rows as needed
- Component spec filenames use kebab-case



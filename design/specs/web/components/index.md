# Components (Web)

Reusable UI building blocks. Component specs stay user-observable (behavior, states, constraints);
implementation mapping lives in consolidations.

| Component | Spec | Used By | Status |
|-----------|------|---------|--------|
| AccountAutocomplete | account-autocomplete.md | Ledger, Search, Import | complete |
| AccountGroupTreeSelector | account-group-tree-selector.md | Import, Account management | draft |
| TransactionEditor | transaction-edit.md | Ledger, Import review | complete |
| AIAssistant | ai-assistant.md | All screens (overlay) | draft |
| VisualBalanceSheet | visual-balance-sheet.md | Home, Reports | draft |

The transaction results table used by Search is specified within [screens/search.md](../screens/search.md)
(no separate component spec).

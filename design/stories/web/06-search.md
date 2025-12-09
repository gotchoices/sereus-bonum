# User Story: Transaction Search

## Story Overview
As a user of Sereus Bonum, I want to search through all my recorded transactions across entities using flexible criteria so I can find specific entries, verify patterns, or generate ad-hoc reports.

Context: Tom has been using Bonum for several months across two entities (home and business). He needs to find all transactions related to a specific vendor and wants to save the search for future use.

## Sequence
1. Tom opens the global navigation menu and sees a "Search" option. He clicks it.
2. He arrives at the Transaction Search screen. It shows a list of previously saved searches (currently empty for him) and a button to create a new search.
3. He clicks "Add New Search" and sees a search builder interface.
4. The builder presents a set of criteria fields he can add:
   - Entity (dropdown: any, specific entity, or multiple)
   - Account (autocomplete with full path)
   - Memo (text with operators: equals, contains, wildcard, regexp)
   - Reference (text with operators)
   - Date (range: from/to, or operators: <, >, =)
   - Amount (numeric with operators: <, >, =, !=, range)
   - Debit (same as amount)
   - Credit (same as amount)
   - Tag (when tags are implemented)
   - Partner (when partners are implemented)
5. He adds his first criterion: "Memo contains 'Office Depot'"
6. He clicks "Add Criterion" and adds another: "Amount > 100"
7. By default, criteria are combined with AND logic. He sees the search preview: `Memo contains 'Office Depot' AND Amount > 100`
8. He wants to broaden the search to include another vendor. He clicks "Add Criterion" and selects "Memo contains 'Staples'"
9. He notices that this new criterion is indented beneath the previous memo criterion, creating a subgroup. The preview now shows: `(Memo contains 'Office Depot' OR Memo contains 'Staples') AND Amount > 100`
10. He sees a toggle next to the grouped criteria to switch between AND/OR. He changes the inner group to OR.
11. He enters a name for this search: "Office Supplies > $100"
12. He clicks "Run Search" and the results appear below (or in a new section).
13. The results screen shows a list of matching transactions. Each transaction displays:
    - Date
    - Entity name (since search is cross-entity)
    - Reference
    - Memo
    - Account (which account from this entity was affected)
    - Debit amount (if positive)
    - Credit amount (if negative)
14. Each transaction can be expanded to show split entries if it has multiple entries.
15. At the bottom, he sees totals:
    - Total Debits: $X,XXX
    - Total Credits: $X,XXX
    - Balance: $0.00 ✓ (or warning if imbalanced)
16. He clicks "Save Search" and the search is added to his saved searches list with the name "Office Supplies > $100"

Alternative Path A: Editing a Saved Search
6.1. Tom returns to the Search screen later and sees his saved searches.
6.2. He clicks "Office Supplies > $100" from the list.
6.3. The search criteria are loaded into the builder. He can modify them, re-run the search, and save again (overwrite or save as new).

Alternative Path B: Complex Boolean Logic
6.1. Tom wants to find all transactions that are either:
    - Personal expenses over $500, OR
    - Business expenses in December
6.2. He builds the search with grouping:
```
Group 1 (OR):
  ├─ Entity = "Home Finance" AND Amount > 500
  └─ Entity = "Small Business" AND Date range "Dec 1 - Dec 31"
```
6.3. He uses indentation to create the groups and toggles AND/OR at each level.
6.4. The search builder validates the logic and shows a preview of the query.

Alternative Path C: Exporting Results
6.1. After running a search, Tom sees an "Export" button.
6.2. He clicks it and can export the results to CSV for further analysis in a spreadsheet.
6.3. The export includes all visible columns plus split details.

Alternative Path D: Deleting Saved Search
6.1. Tom right-clicks on a saved search in the list.
6.2. He sees options: Run, Edit, Duplicate, Delete.
6.3. He deletes an old search he no longer needs.

## Acceptance Criteria
- [ ] Search builder supports all listed field types (entity, account, memo, date, amount, etc.)
- [ ] Boolean logic supports AND/OR with grouping (indentation)
- [ ] Results display shows all matching transactions across entities
- [ ] Transactions are expandable to show splits
- [ ] Results show debit/credit totals with balance verification
- [ ] Saved searches persist across sessions
- [ ] Search can be run, edited, duplicated, and deleted
- [ ] Results can be exported to CSV
- [ ] Search preview shows human-readable query before running
- [ ] At least 100 transaction results can be displayed efficiently (pagination or virtual scroll)


# User Story: Reconciling Bank Statements

## Story Overview
As a user of Sereus Bonum, I want to reconcile my bank accounts against statements to verify that my records match reality and to catch any discrepancies or missing transactions.

Context: Lisa has been entering transactions for a few months.  She just received her monthly bank statement and wants to reconcile her checking account.

## Sequence
1. Lisa opens the Accounts View and navigates to her checking account.
2. She sees a "Reconcile" option associated with the account.  She selects it.
3. A dialog appears asking for the statement ending date and ending balance.  She enters December 31 and $4,523.67 from her bank statement.
4. A reconciliation view opens showing all entries for this account that are not yet reconciled, dated on or before December 31.
5. At the bottom she sees a summary:
   - Statement Ending Balance: $4,523.67
   - Calculated Balance: $4,523.67
   - Difference: $0.00
6. The balances match.  She sees a "Finalize" button which is now enabled.
7. She clicks Finalize.  The system links all the displayed entries to this statement record and marks them as reconciled.
8. She's returned to the ledger view.  She notices the reconciled entries now show a small indicator (such as a checkmark or "R") in the reconciliation column.

Alternative Path A: Balances Don't Match
5.1. After entering the statement details, she sees:
   - Statement Ending Balance: $4,523.67
   - Calculated Balance: $4,612.45
   - Difference: -$88.78
5.2. The Finalize button is disabled because the balances don't match.
5.3. She compares the list on screen to her bank statement.  Each entry has a checkbox.
5.4. She begins checking off entries that appear on both her screen and her bank statement.
5.5. As she checks entries, the Calculated Balance updates to reflect only checked items.  The Difference updates accordingly.
5.6. She finds a transaction in the system that's not on the statement — a check that hasn't cleared yet.  She leaves it unchecked.  That $88.78 check accounts for the difference.
5.7. Now the Calculated Balance (of checked items only) matches the Statement Ending Balance.  The Finalize button enables.
5.8. She clicks Finalize.  Only the checked entries are marked as reconciled.  The unchecked check remains unreconciled and will appear in next month's reconciliation.

Alternative Path B: Missing Transaction
6.1. While reconciling, Lisa notices the bank statement shows a $12.00 monthly service fee that's not in her records.
6.2. She uses the option to open the checking account ledger in a new window (as established in prior stories).
6.3. In the ledger window, she enters the missing fee as a new transaction: debit to Bank Fees expense, credit to Checking.
6.4. Back in the reconciliation window, she sees the new entry appear in the list automatically — the view updated asynchronously.
6.5. She checks the new entry and continues reconciling.

Alternative Path C: Unreconciling Entries
9.1. A week later, Lisa realizes she reconciled the wrong transaction — she marked a $50 entry but it was actually a different $50 entry on the statement.
9.2. She opens the ledger for checking and finds the incorrectly reconciled entry.
9.3. She selects it and chooses "Unreconcile" from the context menu.
9.4. The entry is now unreconciled and will appear in the next reconciliation.
9.5. She can also unreconcile an entire statement if needed.  She opens the Reconciliation History, selects the December statement, and chooses "Unreconcile Statement."  All entries linked to that statement become unreconciled.

Alternative Path D: Reconciliation History
10.1. Lisa wants to see her past reconciliations.
10.2. From the checking account, she selects "Reconciliation History."
10.3. She sees a list of past statements:
   - December 2024 — Ending Balance: $4,523.67 — Reconciled: Jan 3, 2025
   - November 2024 — Ending Balance: $3,891.22 — Reconciled: Dec 2, 2024
   - (etc.)
10.4. She can click on any statement to see the list of entries that were reconciled to it.
10.5. She can also attach her bank statement PDF to the reconciliation record for future reference.

Alternative Path E: First-Time Reconciliation
11.1. Tom just imported his books and has never reconciled this account in Bonum.
11.2. He starts a reconciliation with his current statement.
11.3. All unreconciled entries up to the statement date appear — this includes historical transactions from the import.
11.4. The calculated balance may be way off if there are very old entries that cleared long ago.
11.5. He checks all entries that should have cleared by now (comparing to his statement or online banking).
11.6. Once balanced, he finalizes.  This brings the account current.  Future reconciliations will only show new entries.

## Acceptance Criteria
- [ ] Reconciliation requires only ending date and ending balance (no starting balance)
- [ ] All unreconciled entries ≤ ending date are shown
- [ ] Calculated balance updates in real-time as entries are checked/unchecked
- [ ] Finalize is only enabled when calculated balance matches statement balance
- [ ] Reconciled entries are linked to the statement record
- [ ] Entries added in other windows appear asynchronously in reconciliation view
- [ ] Individual entries can be unreconciled
- [ ] Entire statements can be unreconciled
- [ ] Reconciliation history shows past statements with dates and balances
- [ ] PDF statements can be attached to reconciliation records


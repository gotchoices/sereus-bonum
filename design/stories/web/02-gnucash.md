# User Story: Existing Gnucash User

## Story Overview
As a user of Gnucash, I'd like a more up-to-date accounting program that offers multi-user access and leverages the strengths of Sereus Fabric.

Context: Ken has discovered Sereus Bonum and has been through the sequences described in [First Look](./01-firstlook.md).

## Sequence
1. Ken selects the global option to import books
2. He is presented with a dialog that includes a new entity name and an option to choose a file or drag a file.  He fills in the name with Home Books and then drags his current book file from gnucash into the import target.
3. He is put into a pane that looks like a hierarchical trial balance sheet.  He can see his familiar accounts from gnucash on one side and on the other, the way the accounts will be created in Bonum.
4. He is able to modify account names and account group names, which he does for several cases.  He then approves the pane and now sees only the newly created trial balance sheet.
5. There are sections for Assets, Liabilities and Equity
6. There are also sections for Income and Expense.  However, he notices a way to collapse this.
7. When expanded, all 5 categories are shown.  When collapsed, the income and expense are not shown and it looks just like a balance sheet.
8. He notices how the means to expand to a full trial balance sheet is associated with the Equity account Retained Earnings.  He appreciates this association noting that retained earnings for a period are the sum of Income - Expenses.

Alternative Path A: Verify New Entity
6.1. He selects the home option
6.2. He sees that a third entity has been created with the name he specified
6.3. He now sees a visual balance sheet appear in the pane where the welcome message first appeared
6.4. He recognizes this from a prior experience with [MyCHIPs](https://mychips.org).

Alternative Path B: Investigate Ledgers
9.1. He follows the hyperlink associated with his checking account.  He is now in a pane that looks familiar from gnucash and other accounting programs he has used.
9.2. Each line is a transaction that has things like:
  - Date
  - Number
  - Memo
  - Account
  - Debit
  - Credit
  - Balance
9.3. Some of the lines show a single account which is the other half of the transaction.
9.4. Others show that the transaction is a split and contains multiple offset accounts.
9.5. It is possible to expand the transaction to show all the contained splits.
9.6. It is also possible to configure the entire ledger to show splits for all transactions.
9.7. He sees that each offset account is a hyperlink which he can follow to jump to similar ledgers for those accounts.
9.8. Remembering the welcome instructions, he uses the option to open the offset account in a new window.  Now he has two ledger windows open, the one he jumped from and the one he jumped to.

## Acceptance Criteria
- [ ] <specific, testable criterion>
- [ ] <another criterion>
- [ ] <performance requirement>
- [ ] <error handling requirement>
- [ ] <usability requirement>

---

Note: Agents will derive screens/specs from stories. Human specs in `design/specs/*` override consolidations.



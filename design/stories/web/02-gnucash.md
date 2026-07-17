# User Story: Existing Gnucash User

## Story Overview
As a user of Gnucash, I'd like a more up-to-date accounting program that offers multi-user access and leverages the strengths of Sereus Fabric.

Context: Ken has discovered Sereus Bonum and has been through the sequences described in [First Look](./01-firstlook.md).

## Sequence
1. Ken selects the global option to import books
2. He is presented with a dialog that includes a new entity name and an option to choose a file or drag a file.  He fills in the name with Home Books and then drags his current book file from gnucash into the import target.
3. He is put into a pane that shows a hierarchical account mapping.  He can see his familiar accounts from gnucash on one side and on the other, the way the accounts will be created in Bonum.
4. He is able to modify account names and account group names, which he does for several cases.  He then approves the pane and now sees the Accounts View for his newly created entity.
5. There are sections for Assets, Liabilities and Equity
6. There are also sections for Income and Expense.  However, he notices a way to collapse this.
7. When expanded, all 5 categories are shown.  When collapsed, the income and expense are not shown and it looks just like a balance sheet.
8. He notices how the toggle to show Income and Expense is associated with the Equity line for Retained Earnings.  He appreciates this association remembering that retained earnings for a period are the sum of Income - Expenses.

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
9.3. Some of the lines show a single account which is the other half of the transaction — the "offset account" (in double-entry, every transaction has at least two sides that balance to zero).
9.4. Others show that the transaction is a split and contains multiple offset accounts.
9.5. It is possible to expand the transaction to show all the contained splits.
9.6. It is also possible to configure the entire ledger to show splits for all transactions.
9.7. He sees that each offset account is a hyperlink which he can follow to jump to similar ledgers for those accounts.
9.8. Remembering the welcome instructions, he uses the option to open the offset account in a new window.  Now he has two ledger windows open, the one he jumped from and the one he jumped to.

## Acceptance Criteria
- [ ] "Import Books" accepts a GnuCash file by browse or drag-and-drop and requires a new entity name.
- [ ] The account-mapping view shows source accounts beside their proposed Bonum accounts/groups, and names can be edited before approval.
- [ ] Approving creates the entity, which then appears on Home with a Visual Balance Sheet.
- [ ] Accounts View shows Assets, Liabilities, and Equity, with Income and Expense collapsible under Retained Earnings (collapsed looks like a balance sheet).
- [ ] The ledger shows Date, Number, Memo, Account, Debit, Credit, and Balance; split transactions expand to show all offset accounts.
- [ ] Offset accounts are hyperlinks; opening one in a new window leaves the original ledger open.

## Variants
- **happy:** A valid GnuCash file imports cleanly and lands the user in the new entity's Accounts View.
- **empty:** A file with no transactions still creates the entity, with its account structure zeroed.
- **error:** An unreadable, corrupt, or unsupported file is reported clearly and no entity is created. If any step fails mid-import, the whole import rolls back and the user's mapping is preserved so they can fix it and retry.


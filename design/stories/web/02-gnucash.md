# User Story: Existing Gnucash User

## Story Overview
As a user of Gnucash, I'd like a more up-to-date accounting program that offers multi-user access and leverages the strengths of Sereus Fabric.

Context: Ken has discovered Sereus Bonum and has been through the sequences described in [First Look](./01-firstlook.md).

## Sequence
1. Ken selects the global option to import books
2. He is presented with a dialog that includes a new entity name and an option to choose a file or drag a file.  He fills in the name with Home Books and then drags his current book file from gnucash into the import target.
3. He is put into a pane that shows a hierarchical account mapping.  He can see his familiar accounts from gnucash on one side and on the other, the way the accounts will be created in Bonum.
4. He is able to modify account names and account group names, which he does for several cases.  He then approves the mapping.
5. Before anything is written, Ken sees a transaction preview listing every transaction from the file.  Because this is a first import, they are all marked *new*.  A few are flagged *incomplete* — the file didn't fully determine an offset account — so he assigns the right account until each balances.  Satisfied, he proceeds; the entity and its transactions are created, and he lands on the Accounts View.
6. There are sections for Assets, Liabilities and Equity
7. There are also sections for Income and Expense.  However, he notices a way to collapse this.
8. When expanded, all 5 categories are shown.  When collapsed, the income and expense are not shown and it looks just like a balance sheet.
9. He notices how the toggle to show Income and Expense is associated with the Equity line for Retained Earnings.  He appreciates this association remembering that retained earnings for a period are the sum of Income - Expenses.

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

Alternative Path C: Re-Import & Merge (keeping both programs in sync)
10.1. Months later Ken has kept his GnuCash books alongside Bonum and wants to bring Bonum current.  He chooses Import Books again, but this time selects his existing "Home Books" entity as the target rather than a new one.
10.2. He drops the updated GnuCash file.  Because he imported this file before, every source account already maps to a Bonum account, so the account-mapping step is skipped entirely and he goes straight to the transaction preview.
10.3. Most transactions are marked *already imported* — they match his prior import and will not be duplicated.  A handful are *new* since last time.  One is *incomplete* (a split whose category didn't map), which he completes.
10.4. He proceeds.  Only the new and completed transactions are merged into Home Books; the ones already present are left untouched.  Bonum now matches GnuCash.
10.5. Out of caution he runs the very same import once more.  This time everything shows as *already imported* and nothing is written — a safe no-op.

## Acceptance Criteria
- [ ] "Import Books" accepts a GnuCash file by browse or drag-and-drop, targeting a new entity or an existing one (for re-import/merge).
- [ ] The account-mapping step shows source accounts beside their proposed Bonum accounts/groups and lets names be edited — and is skipped entirely when every source account already resolves (repeat import).
- [ ] Before writing, a transaction preview classifies each transaction as already-imported, new, or incomplete, grouped with counts.
- [ ] Incomplete transactions can be completed in the preview (assign missing account, set amount/date) until they balance; new ones can be excluded.
- [ ] Proceeding merges only new/completed transactions into the target; already-imported ones are skipped — re-running an unchanged import writes nothing (idempotent).
- [ ] A first import lands the user on the new entity's Accounts View (Assets/Liabilities/Equity, with Income/Expense collapsible under Retained Earnings).
- [ ] The ledger shows Date, Number, Memo, Account, Debit, Credit, and Balance; split transactions expand to show all offset accounts, each a hyperlink (openable in a new window).

## Variants
- **happy:** A valid GnuCash file imports cleanly; first import creates the entity, a later re-import merges only the new activity.
- **empty:** A file with no transactions still creates/updates the entity with no transactions written; a re-import with no changes writes nothing.
- **error:** An unreadable, corrupt, or unsupported file is reported clearly and nothing is written. Import can't proceed while any transaction is still *incomplete* (each must be completed or excluded). If a step fails mid-merge, the whole merge rolls back and the preview is preserved for retry.


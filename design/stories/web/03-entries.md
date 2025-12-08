# User Story: Making Manual Entries

## Story Overview
As a user of Sereus Bonum, I will be entering many transactions by hand.  I'd like a very efficient data entry model.  I'd prefer that once I get set up on a certain account, I'm able to just type on the keyboard and not have to go back and forth from the mouse.

Context: Susan has imported her books using a process similar to [Gnucash import](./02-gnucash.md).  Now she is ready to make her first entries.

## Sequence
1. Susan is at the home screen.  She selects the new entity she just created with the import.
2. Now she is looking at the Accounts View.  The only account groups she can see are those that actually have accounts under them.  Those not used by this entity are not shown.
3. The ones used are shown as a single line with a way to expand them.  She expands Assets -> Current Assets.
4. Now she sees several bank accounts.  She hyperlinks into the one for her checking account, using the method that opens a new window.  This leaves the Accounts View showing in the old window.  She is paying some bills right now and so will enter the transactions concurrently.
5. She sees a ledger of all the existing entries.  There is a blank line which she begins putting data into.
6. This is a simple transaction with a single offset account.  She can't remember the account exactly, but when she moves into the input to enter it, a selection widget appears with all defined accounts in it.  
7. She begins typing what she remembers about the full account path.  As she does, the list is pared down and she can see several choices.  This helps her remember which account she wanted.  She can tab for completion and use arrows to select the choice she wants.  She can also use the full account path separator character to take her to the next part of the path where she can begin typing account name, number, etc.  She can quickly get the account she needs even though she didn't remember everything about it.
8. By completing the required fields for the transaction, it is possible to have it entered to the database without needing to move to the mouse and click an OK/Save type button.
9. Since this transaction has only a single offset account, it was fairly simple and feels like a single entry system.  But internally it is stored as two entries in a single transaction.  She verifies this by selecting a split view for the transaction where she can see both entries.
10. She makes several more entries in a row, fingers never leaving the keyboard.
11. She notices that as she makes her entries, the balance in the Accounts View is getting updated.

Alternative Path A: Split Entry
6.1. She needs to put in a split that credits cash for the whole amount but will debit several expense accounts.
6.2. She fills in the parts of the entry common for the whole transaction.  She gets to the offset account but realizes there are several.  She picks one of the debit accounts and fills in the credit column with the total credit.  She is able to select a split option from the keyboard (or the mouse if she prefers).
6.3. This changes the view of the transaction.  Instead of a single line as before, now she sees one line for the transaction and two lines below for the entries.  The top line is the entry to the checking account and shows the proper credit.
6.4. The next line is the debit of the offset account she entered.  The amount for this line is highlighted and the cursor is ready for her to put in a different number for that part of the split, she enters it.
6.5. Now another split line is populated.  Each of the entries has a note field where she can explain what the split is about.  As she tabs into the amount input, it is pre-filled with the amount necessary to balance the account.  Because it is not right (more entries to come), she overrides it with the correct amount.
6.6. She repeats this until all splits are in.  On the last one, the default amount to balance is correct so she accepts it and the transaction is complete.

## Acceptance Criteria
- [ ] <specific, testable criterion>
- [ ] <another criterion>
- [ ] <performance requirement>
- [ ] <error handling requirement>
- [ ] <usability requirement>

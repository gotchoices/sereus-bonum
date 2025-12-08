# User Story: Reports and Views

## Story Overview
As a user of Sereus Bonum, I want to generate standard accounting reports and customize the Accounts View to see exactly the information I need for different purposes.

Context: Mike has been using Bonum for several months.  He has a good set of transactions and wants to generate reports for his accountant and for his own analysis.

## Sequence
1. Mike opens the Accounts View for his primary entity.  He notices a mode selector that lets him switch between different views.
2. The current mode is "Balance Sheet" which shows Assets, Liabilities, and Equity with their balances as of today's date.
3. He notices a date selector showing the current date.  He changes it to December 31 of last year to see his year-end position.  The balances update immediately.
4. He sees a print icon.  Clicking it renders the current view to PDF and opens it in a new browser tab.  From there he can print or save the document.
5. He discovers a "Save Report" option.  He names this configuration "Year-End Balance Sheet" and saves it.  Later he can recall it from a list of saved reports.

Alternative Path A: Trial Balance Mode
6.1. Mike switches the mode to "Trial Balance."
6.2. This shows the same Assets, Liabilities, and Equity, but now there's a toggle associated with the Retained Earnings line.
6.3. He expands Retained Earnings and now sees Income and Expense accounts broken out, showing how they roll up into the retained earnings figure.
6.4. In this mode, he also sees a date range selector.  The ending date defaults to today.  A starting date is also shown because Income and Expense are period-based (they accumulate over time, not as of a point in time).
6.5. He sets the range to the current fiscal year.  The Income and Expense totals now reflect just that period.

Alternative Path B: Income Statement Mode
7.1. Mike switches the mode to "Income Statement."
7.2. Now only Income and Expense account groups are shown.  Assets, Liabilities, and Equity are hidden.
7.3. A date range is required.  He sets it to the last quarter.
7.4. He sees the familiar Profit & Loss layout: Income at the top, Expenses below, with a Net Income line at the bottom.
7.5. He saves this as "Quarterly P&L."

Alternative Path C: Cash Flow Mode
8.1. Mike switches the mode to "Cash Flow."
8.2. This shows a pre-configured selection of account groups relevant to cash flow analysis:
  - Operating Activities: Changes in current assets and liabilities, net income adjustments
  - Investing Activities: Capital assets, investments
  - Financing Activities: Debt, equity transactions
8.3. The report shows the change in each category over a date range, with a net change in cash at the bottom.
8.4. He notices this requires comparison between two dates to show the change.  He sets it to compare year-end to year-end.

Alternative Path D: Custom View
9.1. Mike wants to see just his Fixed Assets and their depreciation.
9.2. He switches the mode to "Custom" and sees checkboxes for each account group.
9.3. He selects only the groups he wants: Capital Assets, Accumulated Depreciation.
9.4. The view now shows just those groups with their balances.
9.5. He saves this as "Fixed Asset Schedule."

Alternative Path E: Multi-Column Report
10.1. Mike wants to compare multiple periods side by side.
10.2. He's in Income Statement mode.  He sees an "Add Column" option.
10.3. He clicks it and a new column appears.  Each column has its own date range.
10.4. He sets up three columns: Q1, Q2, Q3 of the current year.
10.5. Now he can see his revenue and expenses trending across quarters.
10.6. He could also add variance columns ($ change, % change) between periods.
10.7. He saves this as "Quarterly Comparison."

Alternative Path F: Recalling Saved Reports
11.1. Later, Mike wants to run his year-end reports.
11.2. He opens a "Saved Reports" list and sees all his configurations.
11.3. He selects "Year-End Balance Sheet."  The view switches to Balance Sheet mode with the date pre-set to December 31 of last year.
11.4. He updates the date to the current year-end and saves it again (overwriting or as a new report).

## Acceptance Criteria
- [ ] Accounts View supports at least 4 modes: Balance Sheet, Trial Balance, Income Statement, Cash Flow
- [ ] Custom mode allows selection of any combination of account groups
- [ ] Date range is required for Income/Expense; single date for Balance Sheet accounts
- [ ] Multi-column reports allow at least 12 columns (monthly for a year)
- [ ] Print/PDF renders a clean, printable document
- [ ] Saved reports persist across sessions
- [ ] Reports update in real-time as underlying data changes

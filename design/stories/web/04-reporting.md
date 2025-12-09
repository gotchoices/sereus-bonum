# User Story: Reports and Views

## Story Overview
As a user of Sereus Bonum, I want to generate standard accounting reports and customize the Accounts View to see exactly the information I need for different purposes.

Context: Mike has been using Bonum for several months.  He has a good set of transactions and wants to generate reports for his accountant and for his own analysis.

## Sequence
1. Mike opens the Accounts View for his primary entity.  He notices a mode selector that lets him switch between different views.
2. The current mode is "Balance Sheet" which shows Assets, Liabilities, and Equity with their balances as of today's date. Income and Expense accounts are rolled into Retained Earnings under Equity.
3. He notices a date selector showing the current date.  He changes it to December 31 of last year to see his year-end position.  The balances update immediately.
4. At the bottom, he sees a verification line: "Assets $150,000 = Liabilities + Equity $150,000 ✓" which confirms his books are balanced.
5. He sees a print icon.  Clicking it renders the current view to PDF and opens it in a new browser tab.  From there he can print or save the document.
6. He discovers a "Save Report" option.  He names this configuration "Year-End Balance Sheet" and saves it.  Later he can recall it from a list of saved reports.

Alternative Path A: Expanding Retained Earnings
7.1. In Balance Sheet mode, Mike notices the Retained Earnings line under Equity has an expand icon.
7.2. He clicks it and the line expands to show Income and Expense as subcategories, revealing how they contribute to the retained earnings figure.
7.3. He can see the calculation: Total Income - Total Expenses = Net Income (which flows into Retained Earnings).
7.4. This helps him understand where his equity came from without switching to a different report mode.

Alternative Path B: Trial Balance Mode
6.1. Mike switches the mode to "Trial Balance."
6.2. Now all five account types are visible as separate top-level sections: Assets, Liabilities, Equity, Income, and Expense.
6.3. Each section shows its groups and totals. Unlike Balance Sheet mode, Income and Expense are not hidden under Equity—they're visible as their own sections.
6.4. At the bottom, he sees the same verification line: "Assets $150,000 = Liabilities + Equity $150,000 ✓"
6.5. He notices a date range selector. The ending date defaults to today, and a starting date is also shown because Income and Expense are period-based (they accumulate over time, not as of a point in time).
6.6. He sets the range to the current fiscal year. The Income and Expense totals now reflect just that period, while A/L/E show cumulative balances as of the end date.
6.7. This view helps him verify his books are balanced and see all account activity in one place.

Alternative Path C: Income Statement Mode
8.1. Mike switches the mode to "Income Statement."
8.2. Now only Income and Expense account groups are shown. Assets, Liabilities, and Equity are hidden.
8.3. A date range is required. He sets it to the last quarter.
8.4. He sees the familiar Profit & Loss layout: Income at the top, Expenses below, with a Net Income line at the bottom showing the difference.
8.5. The Net Income line shows: Total Income $60,000 - Total Expenses $45,000 = Net Income $15,000
8.6. He saves this as "Quarterly P&L."

Alternative Path D: Cash Flow Mode
9.1. Mike switches the mode to "Cash Flow."
9.2. This shows a pre-configured selection of account groups relevant to cash flow analysis:
  - Operating Activities: Changes in current assets and liabilities, net income adjustments
  - Investing Activities: Capital assets, investments
  - Financing Activities: Debt, equity transactions
9.3. The report shows the change in each category over a date range, with a net change in cash at the bottom.
9.4. He notices this requires comparison between two dates to show the change. He sets it to compare year-end to year-end.

Alternative Path E: Custom View
10.1. Mike wants to see just his Fixed Assets and their depreciation.
10.2. He switches the mode to "Custom" and sees checkboxes for each account group.
10.3. He selects only the groups he wants: Capital Assets, Accumulated Depreciation.
10.4. The view now shows just those groups with their balances.
10.5. He saves this as "Fixed Asset Schedule."

Alternative Path F: Multi-Column Report
10.1. Mike wants to compare multiple periods side by side.
10.2. He's in Income Statement mode.  He sees an "Add Column" option.
10.3. He clicks it and a new column appears.  Each column has its own date range.
10.4. He sets up three columns: Q1, Q2, Q3 of the current year.
10.5. Now he can see his revenue and expenses trending across quarters.
10.6. He could also add variance columns ($ change, % change) between periods.
10.7. He saves this as "Quarterly Comparison."

Alternative Path G: Recalling Saved Reports
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

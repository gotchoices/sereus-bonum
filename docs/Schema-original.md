# Bonum Data Model Design

## General Design
Bonum should be roughly comparable to Quickbooks or Gnucash in many respects.
However, it will be built on [Sereus Fabric](sereus.org).
This gives the user several abilities:
- Safer Storage: Joining additional cadre nodes gives better security to data.  If a device is lost or damaged, the data will persist with the rest of the cadre.
- Sharing Data: Sereus facilitates access to the data (both read and write) for multiple people at once
- Limited Access: Data can also be shared with professionals such as accountants, auditors, etc.

Many previous personal finance programs have focused on checkbook management.
While this helps people to live within their means, it may not help them to build wealth.
Checkbook managers reinforce spending less-than-or-equal to what is earned.
In contrast, a balance sheet approach teaches people to manage and increase their wealth.

For example, in balance sheet accounting, a disbursement on a valuable asset may not decrease wealth at all even though it decreases a person's cash.

## Basic Requirements
The primary goal is to maintain a ledger of transactions from which any standard accounting report might be generated.
This includes:
- Income statement
- Balance sheet
- Cash flow statement
Secondary goals include:
- Vendor database
- Accounts payable tracking
- Customer database
- Accounts receivable tracking

The user should be able to define any number of separate business units.

Each transaction belongs to a particular account.  The taxonomy of accounts is as follows:

There are five standard account types:
- Assets
- Liabilities
- Equity
- Income
- Expense
+ Imbalance (a pseudo-type for unclassified transactions)

Any number of account groups may be defined across the database such as:
- Current Assets
- Capital Assets
- Jobs in Process
- Inventory
- Current Liabilities
- Amortized Debt
- Member Capital
- Sales
- Cost of Goods Sold
- Overhead
- Tax
- Interest
These are shared common across all business units.  Each group is assigned to one of the basic 5 account types.
Transactions cannot be logged directly to an account group.

Any number of accounts may then be defined.
Each account belongs to a business unit and an account group.
The assigned account group defines the basic account type.
Account numbers are considered unique only within the context of the specified business unit.
Account number may follow the traditional numbering convention:
- Assets: 1xxx
- Liabilities: 2xxx
- Equity: 3xxx
- Income: 4xxx
- Expense: 5xxx
This convention will be encouraged but not forced.
In fact account numbers are optional.
Accounts may also be identified by an alpha code if the user likes that better.
Accounts must have a title and description.

Accounts have a notion of a closed date.
This is a date before which no further activity may be logged.
The closed date ideally moves only forward in time but with the right authority it may be moved back.

Accounts also are associated with a particular currency.

Accounts also track the notion of reconciliation.
An associated reconciliation record would allow one to input periodic statements received from an outside party.
As an example, one could record a statement for "Feb 28th, 2024."
With each such statement is also recorded an "ending balance".
Each transaction can be linked to a particular reconciliation statement.
In this way, the system can verify that the running internal balance matches that of the outside entity.

A financial period for a business entity will be considered as 'closed' when all its accounts have a closed date >= to the last day of that period.

Accounts may be linked to a client or vendor (or perhaps just a generalized partner entity).
In this way, accounts receivable and accounts payable may be associated with these outside parties.

In addition to an account, each transaction may be assigned a category.
Examples include:
- Travel
- Gas
- Lodging
- Food
- Utilities
- Phone
Historically, accounting software often used 'expense accounts' to define these categories.
We will make an orthongal classification because, in addition to clarifying expenses, these categories can also be helpful in understanding disbursements made into other types of accounts including:
- Jobs in Process
- Capital Equipment
- Cost of Sales
- Cost of Goods Sold

## Possible Advanced Features
- Capital Asset Tracking
- Inventory Tracking
- Percent Completion Accruals

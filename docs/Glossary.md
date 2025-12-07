# Bonum Glossary

## Accounting Terms

### Account
A ledger record that tracks a specific type of value — such as a bank account, a loan, revenue from sales, or office expenses. Each account belongs to one of five fundamental types.

### Account Type
One of the five fundamental classifications in double-entry bookkeeping:
- **Asset:** Resources owned (cash, equipment, receivables)
- **Liability:** Obligations owed (loans, payables, accrued expenses)
- **Equity:** Owner's stake in the entity (capital, retained earnings)
- **Income:** Revenue earned (sales, interest income, fees)
- **Expense:** Costs incurred (rent, wages, supplies)

### Account Group
A classification category that organizes accounts for reporting purposes. Examples: "Current Assets", "Long-term Liabilities", "Cost of Goods Sold". Each group belongs to one of the five account types.

### Balance Sheet
A financial statement showing an entity's assets, liabilities, and equity at a specific point in time. Fundamental equation: Assets = Liabilities + Equity.

### Double-Entry Bookkeeping
An accounting method where every transaction affects at least two accounts, with total debits equaling total credits. This self-balancing property helps catch errors and provides a complete picture of financial activity.

### Entry
A single line within a transaction, recording a debit or credit to a specific account.

### Income Statement
A financial statement showing revenue, expenses, and net income over a period of time. Also called a Profit & Loss (P&L) statement.

### Normal Balance
The side of an account (debit or credit) that represents an increase:
- Assets and Expenses: Debit (positive)
- Liabilities, Equity, and Income: Credit (negative)

### Reconciliation
The process of verifying that the balance of an account matches an external statement (e.g., a bank statement). Individual entries are marked as reconciled once verified.

### Transaction
A complete accounting event consisting of one or more balanced entries. The total debits must equal total credits.

---

## Bonum-Specific Terms

### Entity
A distinct financial entity for which separate books are maintained. This could be:
- A business or company
- A personal household
- A nonprofit organization
- A subdivision within a larger organization

The term "entity" is standard in accounting ("reporting entity") and applies equally to business and personal finances.

### Tag
An orthogonal classification for entries, independent of account structure. Examples: "Travel", "Utilities", "Fuel", "Materials". Tags help analyze spending patterns across different accounts and are assigned at the entry level to support split transactions with mixed purposes.

### Partner
A vendor, customer, or other external party with whom financial transactions occur. Partners can be linked to accounts for receivables and payables tracking.

### Unit
A unit of measure for account balances. Generalizes the concept of "currency" to include:
- Fiat currencies (USD, EUR)
- Cryptocurrencies (BTC, ETH)
- Alternative currencies (CHIP from MyChips)
- Inventory items (widgets, parts)
- Securities (shares of stock)

All amounts are stored as integers in the smallest indivisible unit (e.g., cents for USD). The `displayDivisor` field tells the UI how to format (divide by this value for display). This supports non-base-10 units like time (divisor 60) or dozens (divisor 12).

This generalization allows a balance sheet to be an "inventory of units, valued at render time."

### Exchange
A record of the rate between two units. Can be:
- **Transaction-linked:** The cost basis for a specific transaction (e.g., "I paid $50 per widget")
- **Reference rate:** A standalone market or manual rate for rendering reports in a different unit

Exchange rates are stored as numerator/denominator for precision.

---

## Sereus Terms

### Sereus Fabric
The underlying peer-to-peer network on which Bonum is built. Provides distributed storage, synchronization, and access control.

### Cadre
A group of nodes in the Sereus network that collectively maintain and replicate data. Adding nodes to a cadre increases redundancy and resilience.

### Node
A single device or instance participating in the Sereus network.

---

## See Also

- [Vision](Vision.md) — Project philosophy and goals
- [Requirements](Requirements.md) — Functional requirements
- [Schema](Schema.md) — Data model specification


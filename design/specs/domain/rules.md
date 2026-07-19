# Rules & Invariants

Cross-cutting rules every target and backend must uphold. These are the guarantees that keep the
books trustworthy. Where a rule has its own detailed home, this file states the invariant and links
there rather than repeating it.

## Double-Entry Integrity

- **Every transaction balances.** Its entries sum to zero (debits positive, credits negative). For
  transactions spanning multiple units, "balances" is defined via attached exchange rates — see
  [units.md](./units.md#transaction-balancing).
- **Single-sided entry is never possible.** Even a "simple" transaction with one visible offset
  account is stored as (at least) two entries. The UI may present it as a single line, but the data
  is always balanced.
- **Transactions post to Accounts, never to Account Groups.** Groups classify; only accounts hold
  entries. See [account-groups.md](./account-groups.md).

## Account Structure

- An Account's `accountType` is **derived** from its Account Group — it is never set directly.
- A parent account must belong to the **same Entity and the same Account Group** as its children.
- Account Groups are shared across all entities; per-entity structure is expressed through parent
  accounts. See [account-groups.md](./account-groups.md) for group rules (including that a group
  can't be deleted while any entity has accounts in it).

## The Imbalance Account

- Each Entity has a system **Imbalance** account that absorbs unclassified or partial amounts so no
  value is ever silently lost.

## Closing

Two distinct operations share the word "close":

- **Close out a period** (per account): an account is marked **closed through** a date
  (`closedThrough`) — entries dated on or before it are final and read-only. This is routine period
  finalization; **non-zero balances are normal.** Reopening (moving `closedThrough` earlier) makes
  those entries editable again.
  - The **Imbalance account closes out like any other account**, but may only be closed through a date
    once its balance there is zero (all value allocated).
  - A **period is closed for the entity** exactly when **every** account — Imbalance included — is
    closed through a date ≥ the period's last day. (Hence a period can't fully close while Imbalance
    carries a balance.)
- **Close an account** (retire it): `isActive = false` disables the account for further activity and
  hides it from active views. **Allowed only when the account's balance is zero.**

Bonum posts **no closing entries**: income and expense accounts accumulate perpetually (income
statements are period-scoped at query time), and retained earnings is **derived** as accumulated net
income, never posted.

## Reconciliation

- Reconciliation verifies internal records against an external statement. Only unreconciled entries
  dated on or before the statement date are eligible.
- **Finalize is allowed only when the reconciled (checked) balance equals the statement's ending
  balance.** On finalize, those entries link to the statement record and are marked reconciled.
- Reconciliation is reversible: individual entries can be unreconciled, and an entire statement can
  be unreconciled (releasing all its entries).

## Audit Trail

- Transaction history is preserved: edits are timestamped and attributable, not silently overwritten.
- Invariants above must survive a peer-to-peer sync/merge; conflicting edits are reconciled without
  ever leaving the books unbalanced. See [interfaces.md](./interfaces.md).

# Spec: Import Strategy

## Two Entry Points, One Engine

### Import Books (Global Menu)
- **Purpose:** Create new entity from external books
- **Behavior:** Always creates new entity
- **Sources:** GnuCash, QuickBooks IIF

### Import Transactions (Entity Context Menu)
- **Purpose:** Add data to existing entity
- **Behavior:** Merge into current entity (idempotent)
- **Sources:** GnuCash, CSV, QIF, QFX, OFX

## Idempotence

**GnuCash:**
- Match by GUID (stored in optional fields)
- Skip exact duplicates

**Transaction Files:**
- Fuzzy match: date + amount + account (within $0.01)
- Show suspected duplicates for review

## Account Handling

**New Entity:** Create all accounts as-is

**Existing Entity:**
- Match by name or GUID
- Create missing accounts
- Show mapping UI if ambiguous

## User Feedback

Always show summary:
- Accounts: X new, Y matched, Z skipped
- Transactions: X new, Y duplicates


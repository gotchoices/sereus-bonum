# User Story: Sharing & Multi-User Books

## Story Overview
As a user who keeps important financial records in Bonum, I want my books replicated across my own
devices and — when I choose — shared with other people, so my data survives a lost device and more
than one person can work on the books.

Context: Bonum is built on the Sereus fabric. A user's own devices form a **cadre**; a shared data
space between parties is a **strand**; the data lives in a Quereus database replicated across the
participating nodes. Ada has been keeping her business books on her laptop and wants them safer,
reachable from more places, and eventually shared with her bookkeeper. Storage and sharing model:
[domain/interfaces.md](../../specs/domain/interfaces.md).

## Sequence
1. Ada wants a safety net against losing her laptop. From Settings → Sereus she adds another node to
   her cadre (a home server or a cloud droplet). Her books replicate to it automatically; if the
   laptop dies, the data persists on the rest of the cadre.
2. She installs Bonum on her phone and joins it to her cadre. The phone opens the **same** books as
   her laptop — same entities, accounts, and transactions — kept in sync, not a separate copy.
3. For an ad-hoc analysis, Ada opens **Quoomb** (the Quereus SQL command line) against her strand and
   queries her ledger directly — the same data the app uses, reachable as plain SQL.
4. At tax time she invites her bookkeeper's cadre to her business strand, granting the permissions she
   chooses (e.g. read/write on the business entity). The bookkeeper's own devices can now reach those
   books.
5. Now two people work the books at once: Ada records receipts on her phone while the bookkeeper
   reconciles on their laptop, each seeing the other's changes as they sync. Permissions govern who
   can do what.

Alternative Path A: Read-Only Advisor
6.1. Ada invites her accountant with read-only permission. They can view, export, and run their own
    SQL queries, but cannot alter entries.

Alternative Path B: Revoking Access
7.1. When the engagement ends, Ada revokes the bookkeeper's access from Settings → Sereus. Their
    nodes stop receiving updates; Ada's cadre keeps the full books.

## Acceptance Criteria
- [ ] A user can add nodes to their cadre from Settings; books replicate across the cadre for redundancy.
- [ ] The same books are reachable from multiple devices (browser and phone) as one synced database, not separate copies.
- [ ] The books are reachable as plain SQL via the Quereus command line (Quoomb) against the strand.
- [ ] A user can invite another party's cadre to a strand and grant scoped permissions (read or read/write).
- [ ] Multiple authorized users can work concurrently; changes propagate between them, governed by permissions.
- [ ] Access can be revoked; a revoked party stops receiving updates while the owner keeps the full books.

## Variants
- **happy:** A second cadre node and a second device both sync cleanly; an invited collaborator edits within their permissions.
- **empty:** A brand-new user with one device works entirely locally — no cadre setup needed until they want redundancy or sharing.
- **error:** Two people edit the same transaction at once — the sync layer reconciles without leaving the books unbalanced (see [domain/rules.md](../../specs/domain/rules.md)). A party without sufficient permission is prevented from editing, with a clear message.

## Notes
- Requires the production (Sereus/Quereus) backend; not exercised by the mock backend.
- Sereus terms: **cadre** (your own devices), **strand** (shared data space), **Quoomb** (Quereus SQL CLI; `quoomb-web` is a browser query interface).
- Invariants that must survive sync/merge: [domain/rules.md](../../specs/domain/rules.md).

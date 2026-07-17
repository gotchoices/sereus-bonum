# User Story: Tagging Entries

## Story Overview
As a user, I want to tag entries with labels that cut across my accounts — a trip, a project, a
vehicle, a client — so I can group and total related activity no matter which accounts it touched.

Context: Tags are an orthogonal classification on individual entries, independent of the account
structure (see [domain/schema.md](../../specs/domain/schema.md#tag)). Ben runs a consulting business
and wants to see everything tied to one client engagement, whose costs and income are scattered
across many accounts.

## Sequence
1. While entering a transaction, Ben tags an expense entry "Acme Project". The tag field offers his
   existing tags with type-ahead; typing a new name creates a tag on the fly.
2. Over the following weeks he tags more entries across different accounts — travel, subcontractor
   costs, and the income when he invoices — all with "Acme Project".
3. In Transaction Search he filters by Tag = "Acme Project" and gets every tagged entry regardless of
   account, with debit/credit totals — a running picture of the engagement.
4. He wants finer structure, so he nests tags: "Acme Project" gains children "Phase 1" and "Phase 2".
   Filtering by the parent includes its children; filtering by a child narrows to that phase.

Alternative Path A: Tagging a Split
5.1. In a split transaction, each entry can carry its own tag — so one payment can allocate different
    lines to different projects.

Alternative Path B: Managing Tags
6.1. Ben renames a tag, merges two duplicates into one, or deletes a tag he no longer needs. Deleting
    a tag removes the label from entries; it never deletes the entries themselves.

## Acceptance Criteria
- [ ] An entry can be tagged during entry, with type-ahead over existing tags and on-the-fly creation of new ones.
- [ ] The same tag can apply to entries in any account or account type (tags are independent of accounts).
- [ ] Each entry in a split can carry its own tag.
- [ ] Tags can be hierarchical; filtering by a parent tag includes its children.
- [ ] Transaction Search can filter by tag and total the matching entries.
- [ ] Tags can be renamed, merged, and deleted; deleting a tag removes the label but keeps the entries.

## Variants
- **happy:** Entries across several accounts share a tag and total correctly when filtered.
- **empty:** No tags defined yet — the tag field is optional and entry proceeds normally without one.
- **error:** A duplicate tag name under the same parent is prevented (or offered as a merge); deleting a tag in use asks for confirmation and shows how many entries it affects.

## Notes
- Schema: [domain/schema.md](../../specs/domain/schema.md#tag) — `Tag` is orthogonal to accounts, with an optional parent for hierarchy.
- Search integration: [06-search.md](./06-search.md) already lists tag as a search criterion.

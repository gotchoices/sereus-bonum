---
dependsOn:
  - design/stories/web/02-gnucash.md
  - design/specs/web/screens/import.md
  - design/specs/domain/import.md
depHashes:
  design/stories/web/02-gnucash.md: aface7ea6ecc5c8030d0e7165cc5cba488f5bd1d74da3eb706d56d5dc1599ba2
  design/specs/web/screens/import.md: 708496debbf12e61eb5b52d66ec0caca1610f2c037f7a7120cebf958e63d0a07
  design/specs/domain/import.md: e641a5e16a794ec67fe9210cc0ab927c7d8c37a6e484243da211d1d1c39d9bb5
provides:
  - screen:Import
needs:
  - service:ImportService
  - service:native-books
  - store:entities
generated: 2026-07-17
lastUpdated: 2026-07-17
component: apps/web/src/routes/import/+page.svelte
---

# Consolidation: Import Screen

**Route:** `/import`
**Component:** `apps/web/src/routes/import/+page.svelte`
**Generated:** 2026-07-17

---

## Purpose

Plan-driven **merge** import. Parses an external file (GnuCash, native `.json`), builds a merge plan with
**no writes**, shows the user the exact preview (accounts to create + per-transaction dispositions), and
only then executes. What the user reviews is what gets written — the preview is derived from the same
`ImportService.buildMergePlan` result that `executeMerge` consumes. See
[domain/import.md](../../../specs/domain/import.md) (Merge Model, Hierarchy Mapping, Native Books).

## Architecture

- **Screen** (`+page.svelte`): steps `upload → planning → preview → importing`. Holds no mapping logic
  of its own; renders the plan and collects exclude/include choices.
- **Engine** (`$lib/import/import-service.ts`): `parseFile`, `buildMergePlan(parsed, entityId|null)`
  (null = plan a new entity without creating it), `createOrGetEntity`, `executeMerge` (atomic
  `bulkImport`). Account resolution is hierarchy-aware (`resolveAccounts`).
- **Native** (`$lib/import/native.ts`): `.json` → `importNativeBooks` (non-interactive restore).

---

## Source Requirements Verification

### specs/web/screens/import.md

#### Step 1 — File selection & target
| Requirement | Status | Implementation |
|---|---|---|
| New-entity name **or** existing-entity picker | ✅ | `targetMode` segmented control; name input / entity `<select>` |
| File drop zone + browse, supported types | ✅ | `.drop-zone`, `selectFile` (`.gnucash`, `.iif`, `.json`) |
| Next disabled until target + file provided | ✅ | `next` button `disabled` guard |

#### Step 2 — Account mapping review
| Requirement | Status | Implementation |
|---|---|---|
| Show accounts to create, hierarchical (indented), correct target group | ✅ | "accounts will be created" section; `accountDepth` indent; `targetGroupPath` |
| General source levels → shared catalog group (no account) | ✅ | `resolveAccounts` (group nodes → `skip`) |
| Specific levels → entity accounts nested via `parentId` | ✅ | `resolveAccounts` `parentSourceGuid`; `executeMerge` `topoSortByParent` |
| Root / empty accounts excluded | ✅ | `resolveAccounts` only creates used + ancestor-of-used non-group nodes |
| Inline edit of group / account path (autocomplete, tree, settle, rescan) | ⛔ Deferred | Auto-resolution only; editable mapping is a follow-up (was the disconnected old table) |

#### Step 3 — Transaction preview & merge review
| Requirement | Status | Implementation |
|---|---|---|
| Disposition per txn (exists / new / incomplete) | ✅ | `classifyTransactions`; grouped `incompleteTxns` / `newTxns` / `existsTxns` |
| Grouped by disposition with counts | ✅ | Sections + `.summary-stats` |
| Already-imported hidden by default, toggle to show | ✅ | `showAlreadyImported` (collapsed section) |
| Rows expandable to entries (split view) | ✅ | `expanded` + `txnRow` snippet entries |
| Incomplete flagged with reason | ✅ | `tx.reason` shown on incomplete rows |
| Exclude a New txn / force-include an Already-imported one | ✅ | `excluded` / `forceInclude` sets |
| Import enabled only when no unresolved Incomplete remains | ✅ | `canImport` (each incomplete must be excluded) |
| Complete an incomplete txn inline (assign account, amount/date) | ⛔ Deferred | Must exclude incompletes for now |

#### Step 4 — Execution (merge)
| Requirement | Status | Implementation |
|---|---|---|
| Only New + user-completed written; exists/excluded skipped | ✅ | `doImport` `toWrite`; `executeMerge` skips `exists`/`excluded` |
| Needed accounts created first | ✅ | `executeMerge` creates resolved accounts before txns |
| Atomic (single db transaction, rollback on failure) | ✅ | `bulkImport` `BEGIN…COMMIT/ROLLBACK` |
| Idempotent re-import writes nothing | ✅ | Identity match by stored `source_id` → `exists` |
| Identity persistence (txn GUID + account GUID stored) | ✅ | `source_id` on `txn` + `account` (schema v2) |

#### Post-completion
| Requirement | Status | Implementation |
|---|---|---|
| Toast + navigate to entity (Trial Balance) | ✅ | `showToast`; `initializeEntities` then `goto(/entities/{id}?view=trial-balance)` |

### stories/web/02-gnucash.md
| # | Requirement | Status | Notes |
|---|---|---|---|
| Global "Import Books" entry | ✅ | Route `/import` |
| Dialog: target + file | ✅ | Step 1 |
| Review before commit | ✅ | Step 3 preview drives the write |
| Re-import / periodic merge | ✅ | Existing-entity target + dispositions |
| Navigate to entity after import | ✅ | Post-completion |

---

## Deferred (tracked)
- **Editable account mapping** (Step 2 autocomplete/tree/settle/rescan). Auto-resolution is correct
  (hierarchy-aware); manual override UI not yet rebuilt.
- **Inline completion of Incomplete transactions.** Currently they must be excluded to proceed.
- **Import Transactions mode** (CSV/QIF/OFX) — only Books (GnuCash) + native restore implemented.

## Verification
- `apps/web/scripts/test-hierarchy.mjs` — end-to-end via the preview flow: `Assets:Fixed Assets:Jeppson:AOF Loan`
  → group Fixed Assets, account Jeppson with child AOF Loan (9 assertions pass).
- Real `Kyle.gnucash` (161 accounts / 17,756 txns) imports cleanly on quereus-local.

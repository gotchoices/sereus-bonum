---
dependsOn:
  - design/specs/web/screens/import.md
  - design/specs/domain/import.md
  - design/stories/web/02-gnucash.md
  - design/stories/web/09-ai-capture-import.md
depHashes:
  design/specs/web/screens/import.md: 708496debbf12e61eb5b52d66ec0caca1610f2c037f7a7120cebf958e63d0a07
  design/specs/domain/import.md: 4991609989846c5c8e00bacb9eb99cbcc5181d0fe49e6cf22fa2746376bdc6a7
  design/stories/web/02-gnucash.md: aface7ea6ecc5c8030d0e7165cc5cba488f5bd1d74da3eb706d56d5dc1599ba2
  design/stories/web/09-ai-capture-import.md: ef9db1ace50ab26bb9f0701b1905c0242e27669baa7d3e7b6e7deb46d6971d88
provides:
  - screen:Import
needs:
  - service:ImportService
  - service:native-books
  - store:entities
  - store:notifications
generated: 2026-07-22
lastUpdated: 2026-07-22
component: apps/web/src/routes/import/+page.svelte
status: partial
---

# Consolidation: Import Screen

**Route:** `/import`
**Component:** `apps/web/src/routes/import/+page.svelte`
**Generated:** 2026-07-22 · reconciled to the implementation (the built screen is the source of truth for
this consolidation).

---

## Purpose

Plan-driven **merge** import. Parses an external file (GnuCash `.gnucash`, or a native `.json` restore),
builds a merge plan with **no writes**, shows the user the exact preview (accounts to create + per-transaction
dispositions), and only then executes. What the user reviews is what gets written — the preview is derived
from the same `ImportService.buildMergePlan` result that `executeMerge` consumes. See
[domain/import.md](../../../specs/domain/import.md) (Merge Model, Hierarchy Mapping, Native Books) and
[screens/import.md](../../../specs/web/screens/import.md).

## Architecture

- **Screen** (`+page.svelte`): steps `upload → planning → preview → importing`. Holds no mapping logic of
  its own; renders the plan and collects exclude/include/expand choices. Errors surface via `notifyError`
  toasts (an inline `error-message` block also shows Step-1 validation). On import failure into a freshly
  created entity, `discardNewEntity` removes the empty entity.
- **Engine** (`$lib/import/import-service.ts`): `parseFile`, `buildMergePlan(parsed, entityId|null)` (null
  = plan a new entity without creating it), `createOrGetEntity`, `executeMerge`. Account resolution is
  hierarchy-aware (`resolveAccounts`); creation is topo-sorted by parent and normalized into each parent's
  group (`topoSortByParent` / `normalizeAccountGroupsToParent`, single-path invariant).
- **Native** (`$lib/import/native.ts`): `.json` → `importNativeBooks` (non-interactive restore; new ids,
  no merge/preview).

---

## Source Requirements Verification

### specs/web/screens/import.md

#### Step 1 — File selection & target
| Requirement | Status | Implementation |
|---|---|---|
| New-entity name **or** existing-entity picker | ✅ | `targetMode` segmented control; name input / entity `<select>` ("Merge into existing" disabled when no entities) |
| File drop zone + browse, supported types shown | ✅ | `.drop-zone` drag/drop + `selectFile`; accept `.gnucash,.iif,.json`; `.help-text` lists formats |
| Next disabled until target + file provided | ✅ | `next` button `disabled` guard; native `.json` flips the button to "Restore" |
| Entity-context "Import Transactions" entry (pre-filled entity) | ⛔ Deferred | Only the global `/import` route exists; no entity-scoped pre-fill entry |

#### Step 2 — Account mapping review
| Requirement | Status | Implementation |
|---|---|---|
| Show accounts to create, hierarchical (indented), correct target group | ✅ | Collapsible "N accounts will be created"; `accountPathSegments` joins the account chain; `targetGroupPath` |
| General source levels → shared catalog group (no account) | ✅ | `resolveAccounts` (group-matching nodes without own postings → `skip`) |
| Specific levels → entity accounts nested via `parentId` | ✅ | `resolveAccounts` `parentSourceGuid`; `executeMerge` `topoSortByParent` + group normalization |
| Catalog-named node with its own balance → single account (not group + sibling) | ✅ | Domain rule handled in `resolveAccounts`; verified by hierarchy test |
| Root / empty accounts excluded | ✅ | `resolveAccounts` keeps only used + ancestor-of-used non-group nodes |
| Skip Step 2 entirely on a fully-resolved repeat import | ⚠️ Partial | Preview always renders the accounts section (collapsed, 0 rows when none); no separate skippable step |
| Transaction-count column, resolution-status indicator, hover path+GUID | ⚠️ Partial | Rows show group+account path with `title="source: …"`; no txn-count column, no status indicator per row |
| Inline edit of group / account path (autocomplete, tree, settle, rescan) | ⛔ Deferred | Auto-resolution only; editable mapping / settle / rescan not built |

#### Step 3 — Transaction preview & merge review
| Requirement | Status | Implementation |
|---|---|---|
| Disposition per txn (exists / new / incomplete) | ✅ | `classifyTransactions`; derived `incompleteTxns` / `newTxns` / `existsTxns` |
| Grouped by disposition (Incomplete → New → Already imported) with counts | ✅ | Ordered sections + `.summary-stats` counts |
| Already-imported hidden by default, toggle to show | ✅ | `showAlreadyImported` (collapsed section) |
| Rows expandable to entries (split view) | ✅ | `expanded` set + `txnRow` snippet entries (acct / debit / credit) |
| Incomplete flagged with reason | ✅ | `tx.reason` shown (`⚠`) on incomplete rows |
| Exclude a New txn / force-include an Already-imported one | ✅ | `excluded` / `forceInclude` sets; `toggleExclude` / `toggleInclude` |
| Import enabled only when no unresolved Incomplete remains | ✅ | `canImport` = `blockingIncomplete === 0` (each incomplete must be excluded) |
| Complete an incomplete txn inline (assign account, amount/date) | ⛔ Deferred | Must exclude incompletes; no inline completion/autocomplete |

#### Step 4 — Execution (merge)
| Requirement | Status | Implementation |
|---|---|---|
| Only New + user-completed written; exists/excluded skipped | ✅ | `doImport` `toWrite`; `executeMerge` skips `exists`/`excluded` (force-included promoted to `new`) |
| Needed accounts created first | ✅ | `executeMerge` creates resolved accounts (topo-sorted) before txns |
| Atomic (single db transaction, rollback on failure) | ✅ | Single `ds.bulkImport({accounts, transactions, entries})` in try/catch (stale JSDoc still says "sequential") |
| Failure preserves preview for retry; no empty entity left behind | ✅ | On error returns to `preview`; `discardNewEntity` deletes a just-created entity |
| Idempotent re-import writes nothing | ✅ | Identity match by stored `source_id` → `exists` |
| Identity persistence (txn GUID + account GUID stored) | ✅ | `sourceId` on `txn` + `account` |

#### Post-completion
| Requirement | Status | Implementation |
|---|---|---|
| Toast + navigate to entity (Trial Balance) | ✅ | `notifySuccess`; `initializeEntities` then `goto(/entities/{id}?view=trial-balance)` |

### specs/domain/import.md
| Requirement | Status | Notes |
|---|---|---|
| Merge model + disposition classification | ✅ | `buildMergePlan` / `classifyTransactions` |
| Hierarchy mapping (general→group, specific→account, own-balance rule) | ✅ | `resolveAccounts` + normalization |
| Type mapping (BANK/ASSET/CASH/STOCK/MUTUAL→Asset, etc.) | ✅ | `mapGnuCashType` (ROOT/unknown skipped) |
| GnuCash XML / SQLite | ⚠️ Partial | XML (incl. gzip via `pako`) parsed; SQLite `.gnucash` not handled |
| QuickBooks IIF (books) | ⛔ Deferred | `parseFile` throws "IIF import not yet implemented" |
| Import Transactions: CSV / QIF / OFX / QFX | ⛔ Deferred | `parseFile` supports only `.gnucash` + native `.json`; no CSV/QIF/OFX |
| Multi-commodity: STOCK/MUTUAL share units | ⛔ Deferred (bug) | See below — all accounts forced to entity `baseUnit` |
| Native books dump / restore | ✅ | `importNativeBooks` (non-interactive, new ids) |

### stories/web/02-gnucash.md
| # | Requirement | Status | Notes |
|---|---|---|---|
| Global "Import Books" entry | ✅ | Route `/import` |
| Dialog: target + file (name new / drag file) | ✅ | Step 1 |
| Account-mapping pane, editable names/groups, approve | ⚠️ Partial | Mapping shown (read-only); editing names/groups not built |
| Mapping skipped on fully-resolved re-import | ⚠️ Partial | No distinct skippable step; accounts section just shows 0 to create |
| Transaction preview before write; incomplete completion | ⚠️ Partial | Preview drives the write; incompletes must be excluded, not completed inline |
| Re-import / periodic merge; idempotent no-op | ✅ | Existing-entity target + dispositions; identity-based dedup |
| Navigate to entity after import | ✅ | Post-completion |

### stories/web/09-ai-capture-import.md
| Requirement | Status | Notes |
|---|---|---|
| AI receipt/image → proposed transaction; arbitrary-file mapping with preview | ⛔ Deferred | Draft/exploratory story; no AI ingestion on the import screen |
| AI-assisted imports reuse the atomic execution path | ⛔ Deferred | N/A until AI capture exists (`executeMerge` is the intended shared path) |

---

## Deferred / Notes (demanded by stories/specs, not yet built)

- **Editable account mapping** (Step 2 autocomplete / tree selector / settle / rescan). Auto-resolution is
  correct and hierarchy-aware, but there is no manual-override UI, no per-row txn-count / status column, and
  no separately skippable mapping step. Bigger gap.
- **Inline completion of Incomplete transactions.** They must be excluded to proceed; no inline
  account-assignment / amount-date editing. Bigger gap.
- **Stock / multi-unit base-unit bug.** `pickBaseUnit` picks the first 3-letter currency (else USD) and
  `executeMerge` forces **every** created account to `entity.baseUnit` (line ~277). STOCK/MUTUAL accounts
  therefore get the currency unit, not their share unit, and entries carry only a cents `amount` (no
  quantity/price). Multi-commodity books collapse to a single base unit. Bigger gap / data-fidelity bug.
- **CSV / QIF / OFX / QFX transaction import.** `parseFile` supports only `.gnucash` + native `.json`;
  the "Import Transactions" mode (bank/statement files) is unbuilt. `.iif` is accepted at the picker but
  throws on parse. GnuCash **SQLite** `.gnucash` is also unhandled (XML only). Bigger gap.
- **Entity-scoped "Import Transactions..." entry** (pre-filled target) — only the global route exists.
- **AI-assisted capture/import** (story 09) — exploratory; no implementation.

## Verification
- `apps/web/scripts/test-hierarchy.mjs` — end-to-end via the preview flow: `Assets:Fixed Assets:Jeppson:AOF Loan`
  → group Fixed Assets, account Jeppson with child AOF Loan (assertions pass).
- Real `Kyle.gnucash` (161 accounts / 17,756 txns) imports cleanly on quereus-local.

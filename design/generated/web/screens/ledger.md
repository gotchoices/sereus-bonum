---
dependsOn:
  - design/specs/web/screens/ledger.md
  - design/stories/web/03-entries.md
  - design/stories/web/02-gnucash.md
  - design/specs/web/components/transaction-edit.md
  - design/specs/web/components/account-autocomplete.md
depHashes:
  design/specs/web/screens/ledger.md: 5b512945de7bc19a22ddb23d4784d14b07a23147d1ed49db804140c605fd3889
  design/stories/web/03-entries.md: bfaff41f79d2542c5d1ec3d5c4fad72ef79d6f1d3e6660174527ba9cb9368830
  design/stories/web/02-gnucash.md: aface7ea6ecc5c8030d0e7165cc5cba488f5bd1d74da3eb706d56d5dc1599ba2
  design/specs/web/components/transaction-edit.md: 2ae5d29a44168cc9d75a80157e78ec8b0371dc331f378594e41b2a5ab53467df
  design/specs/web/components/account-autocomplete.md: cb46a848d70142a9a5d8def94782e17590369a33a3caa39a57844aef5634b6d8
provides:
  - screen:Ledger
needs:
  - service:DataService
  - store:settings
  - store:viewState
  - component:TransactionEditor
  - component:AccountAutocomplete
generated: 2026-07-18
lastUpdated: 2026-07-18
component: apps/web/src/routes/ledger/[accountId]/+page.svelte
---

# Consolidation: Account Ledger Screen

**Route:** `/ledger/[accountId]`
**Component:** `apps/web/src/routes/ledger/[accountId]/+page.svelte`
**Generated:** 2026-07-18

---

## Purpose

Primary transaction entry and viewing surface for a single account. Fixed header (entity/account
context + balance), a fixed column-header row, and a scrolling CSS-Grid ledger of collapsible
transactions with a running balance. New/edit entry is inline via the shared `TransactionEditor`,
keyboard-centric for rapid entry. See [screens/ledger.md](../../../specs/web/screens/ledger.md) and the
[transaction-edit](../../../specs/web/components/transaction-edit.md) /
[account-autocomplete](../../../specs/web/components/account-autocomplete.md) component specs.

## Architecture

- **Screen** (`+page.svelte`): loads data (`loadData`), groups flat entries into transactions
  (`transactions` derived), owns edit state (`editingData`), and holds all save/cancel/delete/split
  callbacks that it hands to the editor.
- **Editor** (`$lib/components/TransactionEditor.svelte`): mode-agnostic inline editor, simple vs.
  split by `editingData.splits.length`; nested 8-column grid aligned to the ledger, blue border.
- **Data** (`DataService.getLedgerEntries` and CRUD): entries carry `runningBalance`, `offsetAccount*`,
  and `splitEntries` computed in the data layer.
- **Persistence**: per-account UI state via `loadViewState`/`saveViewState` (key `ledger:{accountId}`);
  sort order via the global `settings` store.

---

## Source Requirements Verification

### specs/web/screens/ledger.md

#### Header
| Requirement | Status | Implementation |
|---|---|---|
| Fixed header + fixed column-header row (do not scroll) | ✅ | `.ledger-header` (sticky) and `.column-headers` sit outside `.ledger-container` (the scroll area) |
| Back link → `/entities/{entityId}` | ✅ | `.back-link` anchor |
| Entity name + full account path + code | ✅ | `.account-context`; `getAccountPath` walks `accountGroups` parents |
| Unit symbol + account balance | ✅ | `.balance-display` from last entry's `runningBalance` |
| Balance updates in real time | ⚠️ | Recomputed on `loadData` after save/delete, not live during an in-progress edit |
| Column headers not replicated per row | ✅ | Single `.column-headers` grid row |

#### Transaction display
| Requirement | Status | Implementation |
|---|---|---|
| Grid layout (not tables), variable-height rows, aligned columns | ✅ | `.ledger-grid` CSS Grid; rows use `display: contents` |
| Large-list performance | ⚠️ | `content-visibility: auto` native virtualization only; no JS virtual scroller (TanStack) yet |
| Collapsed (1 line) vs. expanded (entry lines) | ✅ | `txn.isExpanded` branch; header line + per-entry/split lines |
| `[Split]` indicator for split txns | ✅ | `.split-indicator` when `entries[0].isSplit` |
| Per-txn expand/collapse + header toggles all | ✅ | `toggleExpand`; `toggleExpandAll` (clears per-txn overrides) |
| Offset account shows name, full path on hover | ✅ | Anchor `title` = `offsetAccountPath`/`accountPath` |
| Account names are hyperlinks → `/ledger/{id}`; Ctrl/Cmd+Click new window | ✅ | Plain anchors (browser handles modified click) |
| Sort order (oldest/newest) drives list + blank-row position; global, persists | ✅ | `$settings.transactionSortOrder`; blank row rendered top or bottom accordingly |
| Expand-all state persisted per account; single expansions NOT persisted | ⚠️ | `expandAll` persisted, but `expandedTransactions` (individual) is also saved — contradicts spec |

#### New transaction entry
| Requirement | Status | Implementation |
|---|---|---|
| Always-present blank row, real inputs, Date defaults today, subtle until focus | ✅ | `.blank-entry-row` + `.blank-input`; date value = today |
| Tab/click into blank row activates editor | ✅ | `onfocus={activateNewEntry}` |
| Save creates txn, reloads, new blank row, scrolls to saved, focus new Date | ✅ | `saveEdit` → `createTransaction` → `loadData` → `scrollToTransaction` + focus `.blank-entry-row` date |
| Cancel clears row, row remains | ✅ | `cancelEdit` resets edit state |

#### Editing existing transactions
| Requirement | Status | Implementation |
|---|---|---|
| Click unlocked txn → inline edit, blue border | ✅ | `enterEditMode`; `.editor-container` accent border |
| Splits always shown multi-line in edit | ✅ | `editingData.splits` populated from `splitEntries` |
| Convert simple → split (+ Split) | ✅ | `addSplitEntry` / split-toggle button |
| Auto-balance new split amount | ✅ | `addSplitEntry` seeds amount from `getEditBalance` |
| Debit/Credit mutual exclusion | ✅ | `handleCurrent*Blur` / `handleSplit*Blur` clear the other |
| Auto-select text on focus | ✅ | `handleFocus` |
| Totals + balance indicator (green ✓ / red ⚠) | ✅ | `getEditTotals`; editor `.balanced`/`.imbalanced` |
| Save persists edited amounts/accounts | ⛔ | `updateTransaction` writes date/reference/memo only — edited entry amounts & accounts are NOT saved (new entries do write full entries) |
| Delete with confirmation | ✅ | `deleteTransaction` (`confirm`) |
| Save validates balance | ✅ | `saveEdit` rejects `|balance| > 1` |
| Esc = Cancel | ⛔ | No keydown handler anywhere |

#### Locked transactions
| Requirement | Status | Implementation |
|---|---|---|
| Txns before closed date are read-only, dimmed | ✅ | `isLocked = date < closedDate`; `.locked` opacity |
| 🔒 separator between locked/editable | ✅ | `.locked-separator` at `firstUnlockedIndex` |
| Locked still expandable + links navigable | ✅ | Expand button and anchors unaffected |
| Click locked → "period closed" tooltip | ⚠️ | Edit is blocked, but no tooltip/message is shown |
| UI to set/close the period (closed date) | ⛔ | `closedDate` is read from view state; no in-screen control to set it |

#### Viewport management
| Requirement | Status | Implementation |
|---|---|---|
| First visit → blank row; return → last position; fallback blank | ✅ | `restoreScrollPosition` (uses `lastVisibleTransactionId`, else `.blank-entry-row`) |
| After save, ensure saved txn visible (minimal scroll) | ✅ | `scrollToTransaction` (`block: 'nearest'`) |
| Track topmost visible txn, debounced, persist | ✅ | `handleScroll` (300 ms debounce) → `lastVisibleTransactionId` in view state |

#### Referenced component specs
| Requirement | Status | Implementation |
|---|---|---|
| Offset fields use account autocomplete | ✅ | `AccountAutocomplete` in simple + split rows |
| Editor keyboard nav: Tab-flow save, Enter save, Ctrl+Enter split toggle | ⛔ | No keyboard handlers; editor is mouse/Tab-focus + button driven |

### stories/web/03-entries.md · 02-gnucash.md (step 9.7)
| Requirement | Status | Notes |
|---|---|---|
| Keyboard-centric rapid entry ledger | ⚠️ | Blank-row Tab activation works; editor lacks Enter/Esc/Ctrl+Enter shortcuts |
| Simple + split transactions | ✅ | Both modes in editor |
| Running balance column | ✅ | From data-layer `runningBalance` |
| Viewable after GnuCash import | ✅ | Renders imported entries; see Updates note (scale) |

---

## Deferred / Notes
- **Editing amounts/accounts of an existing transaction does not persist** — `updateTransaction` saves
  only date/reference/memo. This is the most significant gap; the edit UI shows editable amounts and
  offset accounts but discards those changes on save. New-transaction creation writes full entries.
- **Keyboard shortcuts** (Esc cancel, Enter save, Ctrl+Enter split toggle) from the editor spec are
  unimplemented — no keydown handlers exist. Blank-row Tab-to-activate works.
- **Real-time running balance** — updates only on reload after save/delete (spec acceptance item left
  unchecked).
- **Locked "period closed" tooltip** and any in-screen control to set the closed date are absent.
- **JS virtual scrolling** — only `content-visibility` native virtualization; no TanStack integration.
- **Individual expansion persistence** — code persists per-txn expansion, which the spec says it should not.
- Dev-only bulk test-data generator (`generateTestData`, gated by `ENABLE_TEST_DATA`) exists for
  performance testing; not a spec requirement.

## Updates — 2026-07 (perf)
- `getLedgerEntries` was rewritten for scale (data-layer only, screen behavior unchanged): single-table
  indexed reads with offset/split siblings resolved in JS, replacing a per-row N+1 SQL join that hung at
  scale. Offset accounts, `[Split]` detection, and running balance are unchanged. See docs/STATUS.md.

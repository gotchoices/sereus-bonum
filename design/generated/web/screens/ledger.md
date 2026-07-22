---
dependsOn:
  - design/specs/web/screens/ledger.md
  - design/stories/web/03-entries.md
  - design/stories/web/02-gnucash.md
  - design/specs/web/components/transaction-edit.md
  - design/specs/web/components/account-autocomplete.md
  - design/specs/domain/rules.md
  - design/specs/domain/schema.md
depHashes:
  design/specs/web/screens/ledger.md: 6102fde4889a385391e9673faa36c079ccae46388cbffd7aebdb62ecea1870f6
  design/stories/web/03-entries.md: bfaff41f79d2542c5d1ec3d5c4fad72ef79d6f1d3e6660174527ba9cb9368830
  design/stories/web/02-gnucash.md: aface7ea6ecc5c8030d0e7165cc5cba488f5bd1d74da3eb706d56d5dc1599ba2
  design/specs/web/components/transaction-edit.md: 2ae5d29a44168cc9d75a80157e78ec8b0371dc331f378594e41b2a5ab53467df
  design/specs/web/components/account-autocomplete.md: cb46a848d70142a9a5d8def94782e17590369a33a3caa39a57844aef5634b6d8
  design/specs/domain/rules.md: fb5f4acfe557b963423b354d66c89b5fcf5f37364de3b03ef2096f03d5b09244
  design/specs/domain/schema.md: 44ec79253286e31c446d1238de03d3282379e50a04969629998d59753f6a4d80
provides:
  - screen:Ledger
needs:
  - service:DataService
  - store:entities
  - store:accounts
  - store:settings
  - store:viewState
  - component:TransactionEditor
  - component:AccountAutocomplete
generated: 2026-07-22
lastUpdated: 2026-07-22
component: apps/web/src/routes/ledger/[accountId]/+page.svelte
status: partial
---

# Consolidation: Account Ledger Screen

**Route:** `/ledger/[accountId]`
**Component:** `apps/web/src/routes/ledger/[accountId]/+page.svelte`
**Generated:** 2026-07-22 · reconciled to the implementation (the built screen is the source of truth for
this consolidation).

---

## Purpose

Primary transaction entry and viewing surface for a single account. A fixed header (entity ›
account-path › code, plus unit symbol + running balance), a fixed column-header row, and a scrolling
CSS-Grid ledger of collapsible transactions with a running-balance column. New and existing
transactions are edited inline through the shared `TransactionEditor` (simple ↔ split), with offset
accounts chosen via `AccountAutocomplete` (path search + colon completion). The screen aims at
keyboard-centric rapid entry — the blank-row and autocomplete keyboard paths are built; editor-level
save/cancel shortcuts are not yet (see gaps). See
[screens/ledger.md](../../../specs/web/screens/ledger.md) and the
[transaction-edit](../../../specs/web/components/transaction-edit.md) /
[account-autocomplete](../../../specs/web/components/account-autocomplete.md) component specs.

## Architecture

- **Screen** (`+page.svelte`): loads via `loadData` (`getAccount` / `getEntity` / `getUnits` /
  `getAccountGroup` / `getLedgerEntries` with `sortOrder` from settings), groups the flat
  `LedgerEntry[]` into transactions (`transactions` derived, keyed by `transactionId`), owns edit state
  (`editingData`, `editingTransactionId`, `isNewEntry`) and all save/cancel/delete/split callbacks
  handed to the editor. Builds the balanced entry set (this account + splits) in `saveEdit`, shared by
  create and edit.
- **Editor** (`$lib/components/TransactionEditor.svelte`): mode-agnostic controlled component; simple
  vs. split chosen by `editingData.splits.length === 1`. Nested 8-column grid aligned to the ledger,
  accent (blue) border. Simple row carries an inline split-toggle `[|]` (disabled once an account is
  chosen); split/edit rows carry `+ Add Split` and per-split `[×]`. Split footer shows debit/credit
  totals + balance indicator (`✓` / `⚠`).
- **Autocomplete** (`$lib/components/AccountAutocomplete.svelte`): `searchAccounts` (≤10 results),
  keyboard-driven — ↑/↓ move highlight, Tab selects+advances, Enter selects+stays, `:` progressively
  completes the longest matching path element of the highlighted result, Esc closes; clears on blur
  when no `selectedId`.
- **Data** (`DataService`): `getLedgerEntries` returns entries carrying `runningBalance`,
  `offsetAccount*`, `isSplit`, and `splitEntries` (computed data-layer, single-table indexed reads
  joined in JS — see Updates). `createTransaction` writes full entries; `updateTransaction(id, header,
  entries)` replaces header **and** rewrites entries wholesale in one DB transaction with a balance
  check; `deleteTransaction` cascades entries then txn.
- **Persistence**: per-account UI state via `loadViewState`/`saveViewState` (key `ledger:{accountId}`:
  `expandedTransactions`, `expandAll`, `closedDate`, `lastVisibleTransactionId`); sort order from the
  global `settings` store (`transactionSortOrder`).

---

## Source Requirements Verification

### specs/web/screens/ledger.md

#### Header
| Requirement | Status | Implementation |
|---|---|---|
| Fixed header + fixed column-header row (do not scroll) | ✅ | `.ledger-header` (sticky) and `.column-headers` sit outside `.ledger-container` (the scroll area) |
| Back link → `/entities/{entityId}` | ✅ | `.back-link` anchor to `/entities/{entity.id}` |
| Entity name + full account path + code | ✅ | `.account-context`; `getAccountPath` walks `$accountGroups` parents, appends account name |
| Unit symbol + account balance | ✅ | `.balance-display` = `unit.symbol` + last entry's `runningBalance` |
| Balance updates in real time | ⚠️ Partial | Recomputed on `loadData` after save/delete, not live during an in-progress edit |
| Column headers not replicated per row | ✅ | Single `.column-headers` grid row |

#### Transaction display
| Requirement | Status | Implementation |
|---|---|---|
| Grid layout (not tables), variable-height rows, aligned columns | ✅ | `.ledger-grid` CSS Grid; rows use `display: contents` |
| Large-list performance (10K+) | ⚠️ Partial | `content-visibility: auto` + `contain-intrinsic-size` native virtualization only; no JS virtual scroller |
| Collapsed (1 line) vs. expanded (entry lines) | ✅ | `txn.isExpanded` branch; header line + per-entry / offset / split lines |
| `[Split]` indicator for split txns | ✅ | `.split-indicator` when `txn.entries[0].isSplit` |
| Per-txn expand/collapse + header toggles all | ✅ | `toggleExpand`; `toggleExpandAll` (clears per-txn overrides) |
| Offset account shows name, full path on hover | ✅ | anchor `title` = `offsetAccountPath` / `accountPath` / `split.accountPath` |
| Account names are hyperlinks → `/ledger/{id}`; Ctrl/Cmd+Click new window | ✅ | plain anchors (browser handles modified click) |
| Sort order (oldest/newest) drives list + blank-row position; global, persists | ✅ | `$settings.transactionSortOrder`; blank row rendered top (newest) or bottom (oldest) |
| Initial scroll lands on latest activity (bottom oldest / top newest) | ✅ | `scrollToLatest` drives `scrollTop`, re-asserted across rAF/timeouts for content-visibility rows |
| Expand-all state persisted per account; single expansions NOT persisted | ⚠️ Partial | `expandAll` persisted, but `expandedTransactions` (individual) is also saved — contradicts spec |

#### New transaction entry
| Requirement | Status | Implementation |
|---|---|---|
| Always-present blank row, real inputs, Date defaults today, subtle until focus | ✅ | `.blank-entry-row` + `.blank-input` (muted/italic until `:focus`); date value = today |
| Tab/click into blank row activates editor | ✅ | `onfocus={activateNewEntry}` on each blank input |
| Save creates txn, reloads, new blank row, scrolls to saved, focus new Date | ✅ | `saveEdit` → `createTransaction` → `loadData` → `scrollToTransaction` + focus `.blank-entry-row` date |
| Cancel clears row, row remains | ✅ | `cancelEdit` resets edit state; blank row re-renders |
| Single offset stored as two balanced entries; revealable in split view | ✅ | simple save writes `[{account,+amt},{offset,-amt}]`; expand shows both entry lines |

#### Editing existing transactions
| Requirement | Status | Implementation |
|---|---|---|
| Click unlocked txn → inline edit, accent border | ✅ | `enterEditMode`; `.editor-container` accent border |
| Splits always shown multi-line in edit | ✅ | `editingData.splits` populated from `splitEntries` |
| Convert simple → split (`+ Add Split` / `[|]`) | ✅ | `addSplitEntry`; simple-row `[|]` toggle, edit/split-row `+ Add Split` |
| Auto-balance new split amount, pre-selected | ✅ | `addSplitEntry` seeds amount from `getEditBalance`; `handleFocus` selects text |
| Debit/Credit mutual exclusion | ✅ | `handleCurrent*Blur` / `handleSplit*Blur` clear the other |
| Auto-select text on focus | ✅ | `handleFocus` (`target.select()`) |
| Totals + balance indicator (green ✓ / red ⚠) | ✅ | `getEditTotals`; editor `.balanced` / `.imbalanced` |
| Save persists edited amounts / accounts | ✅ | `saveEdit` passes rebuilt `entries` to `updateTransaction`; production service replaces entries wholesale in a txn (balanced or throws) |
| Delete with confirmation | ✅ | `deleteTransaction` (`confirm`) |
| Save validates balance | ✅ | `saveEdit` rejects `|balance| > 1`; service re-checks `|Σ| > 0.001` |
| Account must be a real selection (not just typed text) | ⚠️ Partial | autocomplete clears on blur without `selectedId`, and splits lacking `accountId` are dropped; no inline "invalid account" error, uses `alert` on imbalance |
| Esc = Cancel | ⛔ Missing | no keydown handler; Cancel is button-only |

#### Locked transactions
| Requirement | Status | Implementation |
|---|---|---|
| Txns before closed date are read-only, dimmed | ✅ | `isLocked = date < closedDate`; `.locked` opacity 0.6 |
| 🔒 separator between locked/editable | ✅ | `.locked-separator` at `firstUnlockedIndex` |
| Locked still expandable + links navigable | ✅ | expand button and anchors unaffected |
| Click locked → "period closed" tooltip | ⛔ Missing | edit is blocked (`enterEditMode` early-returns), but no tooltip/message shown |
| UI to set/close the period; wired to `closedThrough` | ⛔ Missing | `closedDate` read from view state only; no in-screen control; not sourced from account `closedThrough` (schema/rules) |

#### Viewport management
| Requirement | Status | Implementation |
|---|---|---|
| First visit → latest activity/blank row; return → last position; fallback latest | ✅ | `restoreScrollPosition` (uses `lastVisibleTransactionId`, else `scrollToLatest`) |
| After save, ensure saved txn visible (minimal scroll) | ✅ | `scrollToTransaction` (`block: 'nearest'`, smooth) |
| Track topmost visible txn, debounced 300 ms, persist | ✅ | `handleScroll` → `lastVisibleTransactionId` in view state |

### specs/web/components/transaction-edit.md · account-autocomplete.md
| Requirement | Status | Implementation |
|---|---|---|
| Offset fields use account autocomplete | ✅ | `AccountAutocomplete` in simple + each split row |
| Autocomplete: ↑/↓ navigate, Tab select+advance, Enter select+stay, Esc close, colon path completion | ✅ | `handleKeydown` in `AccountAutocomplete` (`:` completes longest matching element of highlighted result) |
| Autocomplete: ≤10 results, clears if tabbed away unselected | ✅ | `results.slice(0,10)`; `handleBlur` clears when no `selectedId` |
| Result ordering priority (exact name → path-prefix → name-prefix → type → contains) | ⚠️ Partial | ordering is delegated to `DataService.searchAccounts`; component renders as returned (priority ranking not verified here) |
| Editor keyboard nav: Enter saves, Esc cancels, Ctrl+Enter toggles split, Tab-from-Credit saves | ⛔ Missing | `TransactionEditor` has no keydown handlers; save/cancel/split are button/`onblur` driven |
| Split Tab-flow: Tab from last unbalanced split auto-creates next split | ⛔ Missing | new splits only via `+ Add Split` / `[|]`; no Tab auto-create |
| Split → Simple auto-collapse when reduced to one split | ⚠️ Partial | `removeSplitEntry` re-seeds a split when emptied; mode follows `splits.length === 1`, but there is no explicit "collapse to simple" beyond that |

### stories/web/03-entries.md (acceptance criteria)
| Requirement | Status | Implementation |
|---|---|---|
| Blank entry line always available to start a new transaction | ✅ | `.blank-entry-row` at natural insertion point |
| Account field: autocomplete searchable by full path, tab-completion + path separator between segments | ✅ | `AccountAutocomplete` (Tab complete, `:` segment completion) |
| A complete transaction can be entered and **saved using the keyboard alone** | ⛔ Missing | no Enter-to-save / Tab-from-last-field-saves; user must click **Save** |
| Single-offset stored as two balanced entries, revealable in split view | ✅ | see New-entry rows above |
| In a split, each new line pre-fills balancing amount, overrideable | ✅ | `addSplitEntry` pre-fill + `handleFocus` select |
| Account balances in Accounts View update as entries are saved | ⚠️ Partial | balances recompute on that screen's load/navigation, not live cross-screen while editing here |

### stories/web/02-gnucash.md (step 9.x) · domain rules.md / schema.md
| Requirement | Status | Implementation |
|---|---|---|
| Ledger shows Date, Ref/Number, Memo, Account, Debit, Credit, Balance | ✅ | `.column-headers` + row cells |
| Split expands to show all offset accounts, each a hyperlink | ✅ | expanded entry/split lines with `/ledger/{id}` anchors |
| Every transaction balances; single-sided never possible (rules.md) | ✅ | simple save writes offsetting pair; `updateTransaction`/`createTransaction` reject non-zero sums |
| Entries post to accounts, amounts as signed integers in smallest unit (schema.md) | ✅ | amounts × `displayDivisor`; debit positive / credit negative |
| Imbalance-account routing of remainder (rules.md; story error variant) | ⛔ Deferred | imbalance is rejected via `alert`; no auto-route of the remainder to the Imbalance account |

---

## Deferred / Notes (demanded by stories/specs, not yet built)

- **Editor keyboard workflow** — the headline story-03 requirement "enter and save a transaction with
  the keyboard alone" is unmet: `TransactionEditor` has no keydown handlers, so Enter-to-save,
  Esc-to-cancel, Ctrl+Enter split toggle, and Tab-from-Credit-saves (transaction-edit.md § Keyboard
  Navigation) are all missing. The **autocomplete** keyboard path (Tab/Enter/`:`/arrows/Esc) *is*
  fully implemented; the gap is at the surrounding form. This is why `status: partial`.
- **Split Tab auto-create** — tabbing off the last unbalanced split does not spawn the next split
  (spec says it should); splits are added via `+ Add Split` / `[|]` only.
- **Locked period** — no "Cannot edit – period closed" tooltip, and no in-screen control to set the
  closed date. `closedDate` comes from local view state, not from the account's `closedThrough`
  (schema/rules), so real period-close is not surfaced here.
- **Real-time balance** — header balance and the Accounts-View balances refresh on reload/navigation
  after save/delete, not live during an in-progress edit (spec acceptance item unchecked).
- **Imbalance routing** — an unbalanced transaction is rejected with an `alert`; the rules.md/story
  option to route the remainder to the Imbalance account is not offered.
- **Individual expansion persistence** — code persists per-txn `expandedTransactions`, which the spec
  says should NOT be saved (only expand-all).
- **JS virtual scrolling** — only `content-visibility` native virtualization; no windowing library for
  10K+ lists.
- **Inline field validation** — imbalance/invalid-account feedback is an `alert`, not the spec's
  red-border per-field treatment; account "must be selected" is enforced only by drop-on-save + blur
  clearing.
- Dev-only bulk test-data generator (`generateTestData`, gated by `ENABLE_TEST_DATA`) exists for
  performance testing; not a spec requirement.

## Updates — 2026-07
- **Edit now persists entries.** `saveEdit` rebuilds the balanced entry set and calls
  `updateTransaction(id, header, entries)`; the production service rewrites entries wholesale
  (DELETE + INSERT) inside a DB transaction with a balance guard. (Previously only date/reference/memo
  were saved — that gap is resolved.)
- **`getLedgerEntries` perf** — data-layer rewritten for scale: single-table indexed reads with
  offset/split siblings and running balance resolved in JS, replacing an N+1 SQL join. Screen behavior
  unchanged. See docs/STATUS.md and the Quereus store-join-perf memo.
</content>
</invoke>

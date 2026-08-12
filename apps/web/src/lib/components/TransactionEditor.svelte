<script lang="ts">
  import { t } from '$lib/i18n';
  import AccountAutocomplete from './AccountAutocomplete.svelte';
  import { completeRow, impliedRate, rateDeviates, rateAckKey, type EntryField } from '$lib/report/entry-math';
  import { formatRate } from '$lib/report/format';
  
  interface EditingData {
    date: string;
    reference: string;
    memo: string;
    currentAccountDebit: string;
    currentAccountCredit: string;
    currentAccountValue?: string;
    currentAccountPrice?: string;
    splits: Array<{
      id: string;
      accountId: string;
      accountSearch: string;
      /** Quantity in THIS row's account unit. */
      debit: string;
      credit: string;
      /** The row restated in the reckoning unit; empty when the units already match. */
      value?: string;
      /** Price per whole unit. Any two of quantity/price/value fill the third. */
      price?: string;
      note: string;
    }>;
  }
  
  interface Props {
    editingData: EditingData;
    isNewEntry: boolean;
    entityId: string;
    accountId: string;
    accountName: string;
    accountPath: string;
    unit: { symbol?: string; displayDivisor: number } | null;
    /** Reckoning unit code — what every row's VALUE is expressed in and what must sum to zero. */
    reckoningUnit?: string;
    /** Row-level unit lookup, so a split knows whether it needs a value. */
    unitForAccount?: (accountId: string) => { code: string; symbol?: string; displayDivisor: number } | undefined;
    /** The reckoning unit as a full Unit, for rate formatting. */
    reckoningUnitObj?: { code: string; symbol?: string; displayDivisor: number };
    /** Reference rate for a unit pair, for the implied-rate deviation warning. Null when unknown. */
    referenceRate?: (fromUnit: string) => number | null;
    /** Acknowledged implied rates, keyed by row id — save is blocked until each is confirmed. */
    acknowledgedRates?: Record<string, string>;
    onAcknowledgeRate?: (rowId: string, key: string) => void;
    onSave: () => void;
    onCancel: () => void;
    onDelete?: (txnId: string) => void;
    onAddSplit: () => void;
    onRemoveSplit: (splitId: string) => void;
    onCurrentDebitBlur: () => void;
    onCurrentCreditBlur: () => void;
    onSplitDebitBlur: (splitId: string) => void;
    onSplitCreditBlur: (splitId: string) => void;
    onFocus: (e: FocusEvent) => void;
    getEditTotals: () => { debits: number; credits: number; balance: number };
    transactionId?: string;
  }
  
  let {
    editingData = $bindable(),
    isNewEntry,
    entityId,
    accountId,
    accountName,
    accountPath,
    unit,
    reckoningUnit = '',
    reckoningUnitObj = undefined,
    unitForAccount = () => undefined,
    referenceRate = () => null,
    acknowledgedRates = {},
    onAcknowledgeRate = () => {},
    onSave,
    onCancel,
    onDelete,
    onAddSplit,
    onRemoveSplit,
    onCurrentDebitBlur,
    onCurrentCreditBlur,
    onSplitDebitBlur,
    onSplitCreditBlur,
    onFocus,
    getEditTotals,
    transactionId,
  }: Props = $props();
  
  let isSimpleMode = $derived(editingData.splits.length === 1);

  // --- Multi-unit rows -----------------------------------------------------------------------
  // None of this renders for an ordinary single-unit transaction. A row needs quantity/price/value
  // only when its account holds a unit other than the one the transaction is reckoned in.
  const rowUnitCode = (accountId: string) => unitForAccount(accountId)?.code ?? '';
  const rowNeedsValue = (accountId: string) =>
    !!reckoningUnit && !!accountId && !!rowUnitCode(accountId) && rowUnitCode(accountId) !== reckoningUnit;

  const num = (v: string | undefined): number | undefined => {
    if (v === undefined || v === '') return undefined;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const qtyOf = (debit: string, credit: string) => num(debit) ?? (num(credit) !== undefined ? -num(credit)! : undefined);
  const fmt = (n: number | undefined, places: number) => (n === undefined ? '' : String(Number(n.toFixed(places))));

  /** Recompute the third field after the user edits one of quantity / price / value. */
  function recompute(row: { debit: string; credit: string; value?: string; price?: string; accountId: string },
                     edited: EntryField) {
    const quantity = qtyOf(row.debit, row.credit);
    const filled = completeRow(
      { quantity, price: num(row.price), value: num(row.value) === undefined ? undefined : Math.abs(num(row.value)!) },
      edited);
    if (edited !== 'price' && filled.price !== undefined) row.price = fmt(filled.price, 6);
    if (edited !== 'value' && filled.value !== undefined) row.value = fmt(Math.abs(filled.value), 2);
    if (edited !== 'quantity' && filled.quantity !== undefined) {
      // Preserve which column the user was using (debit vs credit).
      const target = row.credit && !row.debit ? 'credit' : 'debit';
      row[target] = fmt(Math.abs(filled.quantity), 4);
    }
  }

  /** The implied rate for a row, plus whether it deviates from a known reference rate. */
  function rateInfoFor(row: { id: string; debit: string; credit: string; value?: string; accountId: string }) {
    const quantity = qtyOf(row.debit, row.credit);
    const value = num(row.value);
    const implied = impliedRate(quantity, value === undefined ? undefined : Math.abs(value));
    if (implied === null) return null;
    const reference = referenceRate(row.id === 'current' ? currentUnitCode() : rowUnitCode(row.accountId));
    return {
      implied,
      key: rateAckKey(quantity, value === undefined ? undefined : Math.abs(value)),
      deviates: reference !== null && rateDeviates(implied, reference),
      reference,
    };
  }

  /** Rows whose implied rate the user has not yet confirmed — these block the save. */
  /** The ledger account's own unit code (this ledger's rows are quantities of it). */
  const currentUnitCode = () => (unit as { code?: string } | null)?.code ?? '';
  /**
   * The ledger's own account carries the quantity on the main row, so it needs a value whenever its
   * unit isn't the reckoning unit — in simple mode (a stock ledger with a cash offset) and in split
   * mode alike.
   */
  let currentNeedsValue = $derived(
    !!reckoningUnit && !!currentUnitCode() && currentUnitCode() !== reckoningUnit
    && !!editingData.splits[0]?.accountId);
  /** True when any row is in a unit other than the reckoning unit. */
  let isMultiUnitEditor = $derived(
    currentNeedsValue || editingData.splits.some((sp) => rowNeedsValue(sp.accountId)));
  /**
   * Label for the totals row. Totals are values in the RECKONING unit, which for a single-unit
   * transaction is just this ledger's unit (so nothing visibly changes for ordinary entry).
   */
  let totalsLabel = $derived(
    !isMultiUnitEditor ? (unit?.symbol ?? '') : `${reckoningUnit} `);

  /** Recompute the third field for the simple-mode current-account row. */
  function recomputeCurrent(edited: EntryField) {
    const row = {
      debit: editingData.currentAccountDebit, credit: editingData.currentAccountCredit,
      value: editingData.currentAccountValue, price: editingData.currentAccountPrice, accountId: '',
    };
    recompute(row, edited);
    editingData.currentAccountDebit = row.debit;
    editingData.currentAccountCredit = row.credit;
    editingData.currentAccountValue = row.value;
    editingData.currentAccountPrice = row.price;
  }

  /** Implied rate for the simple-mode current-account row. */
  let currentRateInfo = $derived.by(() => {
    if (!currentNeedsValue) return null;
    return rateInfoFor({
      id: 'current', debit: editingData.currentAccountDebit, credit: editingData.currentAccountCredit,
      value: editingData.currentAccountValue, accountId: '',
    });
  });

  let unconfirmedRates = $derived.by(() => {
    const out: string[] = [];
    if (currentNeedsValue && currentRateInfo && acknowledgedRates['current'] !== currentRateInfo.key) {
      out.push('current');
    }
    for (const split of editingData.splits) {
      if (!rowNeedsValue(split.accountId)) continue;
      const info = rateInfoFor(split);
      if (info && acknowledgedRates[split.id] !== info.key) out.push(split.id);
    }
    return out;
  });
  
  function formatAmount(amount: number): string {
    const divisor = unit?.displayDivisor ?? 100;
    return (amount / divisor).toFixed(2);
  }
</script>

<style>
  /* Editor container - spans all columns, creates nested grid */
  .editor-container {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 
      40px      /* Expand */
      135px     /* Date */
      100px     /* Ref */
      1fr       /* Memo */
      200px     /* Offset */
      160px     /* Debit */
      160px     /* Credit */
      160px;    /* Balance */
    gap: 0;
    border: 2px solid var(--accent-color, #0066cc);
    background: var(--bg-hover, #f9f9f9);
    margin: 0.25rem 0;
  }
  
  /* Editor rows use display: contents so cells align with grid */
  .editor-row {
    display: contents;
  }
  
  /* All editor cells */
  .editor-row > div {
    padding: 0.5rem 1rem;
    background: var(--bg-hover, #f9f9f9);
  }
  
  /* Current account row gets different background */
  .edit-current-account > div {
    background: var(--bg-secondary);
  }
  
  /* Multi-unit sub-row: price/value/implied-rate for a row whose account is in another unit. */
  .unit-row > div {
    background: var(--bg-secondary, #f3f4f6);
    padding-top: 0.25rem;
    padding-bottom: 0.5rem;
  }
  .unit-hint {
    font-size: 0.75rem;
    color: var(--text-muted, #6b7280);
    font-style: italic;
  }
  .unit-field {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.7rem;
    color: var(--text-muted, #6b7280);
  }
  .unit-rate {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.75rem;
    justify-content: center;
  }
  .implied-rate { font-variant-numeric: tabular-nums; }
  .implied-rate.deviates { color: var(--danger, #b45309); font-weight: 600; }
  .btn-confirm-rate {
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    border: 1px solid var(--accent-color, #0066cc);
    background: transparent;
    color: var(--accent-color, #0066cc);
    border-radius: 3px;
    cursor: pointer;
  }
  .rate-ok { color: var(--success, #16a34a); }
  .rate-warning { color: var(--danger, #b45309); font-size: 0.7rem; cursor: help; }

  /* Actions row spans full width */
  .editor-actions {
    grid-column: 1 / -1;
    padding: 0;
    border-top: 1px solid var(--border-color);
  }
  
  /* Simple account field with split toggle button */
  .simple-account-field {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }
  
  .split-toggle-btn {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 0.375rem 0.5rem;
    cursor: pointer;
    font-size: 1rem;
    font-weight: bold;
    min-width: 28px;
    height: 34px;
    color: var(--text-primary);
  }
  
  .split-toggle-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    border-color: var(--accent-color);
  }
  
  .split-toggle-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Column alignment (widths defined by parent grid) */
  :global(.col-debit),
  :global(.col-credit),
  :global(.col-balance) {
    text-align: right;
  }
  
  /* Edit inputs */
  :global(.edit-input) {
    width: 100%;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--border-light);
    border-radius: 4px;
    background: var(--bg-card);
    color: var(--text-primary);
    font-size: 0.875rem;
    box-sizing: border-box;
  }
  
  :global(.edit-input:focus) {
    outline: none;
    border-color: var(--accent-color);
  }
  
  :global(.edit-input.edit-amount) {
    text-align: right;
    font-family: 'Courier New', monospace;
    max-width: 145px; /* Fit within 160px column with padding */
  }
  
  /* Date and ref inputs should fit their columns */
  :global(.col-date .edit-input) {
    max-width: 120px;
  }
  
  :global(.col-ref .edit-input) {
    max-width: 85px;
  }
  
  /* Memo/note is the flexible field */
  :global(.col-memo .edit-input) {
    min-width: 185px;
  }
  
  /* Hide spinners on number inputs */
  :global(input[type="number"]::-webkit-inner-spin-button),
  :global(input[type="number"]::-webkit-outer-spin-button) {
    -webkit-appearance: none;
    margin: 0;
  }
  
  :global(input[type="number"]) {
    -moz-appearance: textfield;
  }
  
  /* Current account link */
  .current-account-link {
    color: var(--text-muted);
    text-decoration: none;
    pointer-events: all;
    cursor: pointer;
  }
  
  .current-account-link:hover {
    color: var(--accent-color);
    text-decoration: underline;
  }
  
  /* Remove split button */
  .btn-remove-split {
    background: transparent;
    border: none;
    color: var(--danger);
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }
  
  .btn-remove-split:hover {
    color: var(--danger-hover);
  }
  
  /* Actions footer */
  .edit-actions-container {
    display: flex !important;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    gap: 2rem;
    min-height: 50px;
  }
  
  .edit-actions-left {
    display: flex !important;
    gap: 0.5rem;
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  
  .edit-totals-right {
    display: flex;
    gap: 1rem;
    align-items: center;
    font-size: 0.875rem;
    font-family: 'Courier New', monospace;
    white-space: nowrap;
  }
  
  .total-amount {
    font-weight: 600;
    margin-right: 0.5rem;
  }
  
  .balanced {
    color: var(--success);
    font-weight: 600;
  }
  
  .imbalanced {
    color: var(--danger);
    font-weight: 600;
  }
  
  /* Buttons */
  .btn-primary,
  .btn-secondary,
  .btn-danger {
    display: inline-block !important;
    visibility: visible !important;
    opacity: 1 !important;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
    border: none;
    font-weight: 500;
    transition: background-color 0.15s;
  }
  
  .btn-primary {
    background: var(--accent-color, #0066cc);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--accent-hover, #0052a3);
  }

  .btn-primary:disabled,
  .btn-primary[disabled] {
    background: var(--bg-secondary, #d1d5db);
    color: var(--text-muted, #6b7280);
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: var(--bg-secondary, #f5f5f5);
    color: var(--text-primary, #000);
    border: 1px solid var(--border-color, #ccc);
  }
  
  .btn-secondary:hover {
    background: var(--bg-hover, #e8e8e8);
  }
  
  .btn-danger {
    background: var(--danger, #dc3545);
    color: white;
  }
  
  .btn-danger:hover {
    background: var(--danger-hover, #bd2130);
  }
</style>

<div class="editor-container">
{#if isSimpleMode}
  <!-- SIMPLE MODE: Single row entry -->
  <div class="editor-row" role="row">
    <div class="col-expand" role="gridcell"></div>
    <div class="col-date" role="gridcell">
      <input 
        type="date" 
        bind:value={editingData.date}
        onfocus={onFocus}
        class="edit-input"
      />
    </div>
    <div class="col-ref" role="gridcell">
      <input 
        type="text" 
        bind:value={editingData.reference}
        placeholder={$t('ledger.ref')}
        onfocus={onFocus}
        class="edit-input"
      />
    </div>
    <div class="col-memo" role="gridcell">
      <input 
        type="text" 
        bind:value={editingData.memo}
        placeholder={$t('ledger.memo')}
        onfocus={onFocus}
        class="edit-input"
      />
    </div>
    <div class="col-offset" role="gridcell">
      <div class="simple-account-field">
        <AccountAutocomplete
          {entityId}
          bind:value={editingData.splits[0].accountSearch}
          bind:selectedId={editingData.splits[0].accountId}
          disabled={false}
          onfocus={onFocus}
        />
        <button 
          class="split-toggle-btn"
          onclick={onAddSplit}
          title="Convert to split transaction"
          disabled={!!editingData.splits[0].accountId}
        >
          |
        </button>
      </div>
    </div>
    <div class="col-debit" role="gridcell">
      <input 
        type="number" 
        step="0.01" 
        bind:value={editingData.currentAccountDebit}
        placeholder=""
        onblur={onCurrentDebitBlur}
        onfocus={onFocus}
        class="edit-input edit-amount"
      />
    </div>
    <div class="col-credit" role="gridcell">
      <input 
        type="number" 
        step="0.01" 
        bind:value={editingData.currentAccountCredit}
        placeholder=""
        onblur={onCurrentCreditBlur}
        onfocus={onFocus}
        class="edit-input edit-amount"
      />
    </div>
    <div class="col-balance" role="gridcell"></div>
  </div>
  {#if currentNeedsValue}
    <!-- The two legs are in different units, so the quantity above can't balance the offset on its own.
         Price and Value complete it — the user fills any two. Simple mode keeps ONE amount pair, so it
         is the current account (the ledger's own unit) that carries the value. -->
    <div class="editor-row unit-row" role="row">
      <div class="col-expand" role="gridcell"></div>
      <div class="col-date" role="gridcell"></div>
      <div class="col-ref" role="gridcell"></div>
      <div class="col-memo" role="gridcell">
        <span class="unit-hint">{$t('ledger.quantity_in', { unit: unit?.symbol || currentUnitCode() })}</span>
      </div>
      <div class="col-offset" role="gridcell">
        <label class="unit-field">
          <span>{$t('ledger.price')}</span>
          <input
            type="number" step="any"
            value={editingData.currentAccountPrice ?? ''}
            oninput={(e) => { editingData.currentAccountPrice = e.currentTarget.value; recomputeCurrent('price'); }}
            onfocus={onFocus} class="edit-input edit-amount"
          />
        </label>
      </div>
      <div class="col-debit" role="gridcell">
        <label class="unit-field">
          <span>{$t('ledger.value')} ({reckoningUnit})</span>
          <input
            type="number" step="0.01"
            value={editingData.currentAccountValue ?? ''}
            oninput={(e) => { editingData.currentAccountValue = e.currentTarget.value; recomputeCurrent('value'); }}
            onfocus={onFocus} class="edit-input edit-amount"
          />
        </label>
      </div>
      <div class="col-credit unit-rate" role="gridcell">
        {#if currentRateInfo}
          <span class="implied-rate" class:deviates={currentRateInfo.deviates}>
            {formatRate(currentRateInfo.implied, unit as never, reckoningUnitObj as never)}
          </span>
          {#if acknowledgedRates['current'] !== currentRateInfo.key}
            <!-- A forgotten leg still BALANCES — it only distorts this rate, so it must be confirmed. -->
            <button class="btn-confirm-rate" onclick={() => onAcknowledgeRate('current', currentRateInfo.key)}>
              {$t('ledger.confirm_rate')}
            </button>
          {:else}
            <span class="rate-ok">✓</span>
          {/if}
          {#if currentRateInfo.deviates && currentRateInfo.reference !== null}
            <span class="rate-warning" title={$t('ledger.rate_deviates_hint')}>
              ⚠ {$t('ledger.rate_deviates', { reference: currentRateInfo.reference.toPrecision(6) })}
            </span>
          {/if}
        {/if}
      </div>
      <div class="col-balance" role="gridcell"></div>
    </div>
  {/if}
  
  <!-- Simple mode actions -->
  <div class="editor-actions" role="row">
    <div class="edit-actions-container">
      <div class="edit-actions-left">
        <button class="btn-primary" onclick={onSave} disabled={unconfirmedRates.length > 0}
                title={unconfirmedRates.length > 0 ? $t('ledger.confirm_rate_first') : ''}>
          {$t('common.save')}
        </button>
        <button class="btn-secondary" onclick={onCancel}>{$t('common.cancel')}</button>
        {#if !isNewEntry}
          <button class="btn-secondary" onclick={onAddSplit}>+ {$t('ledger.add_split')}</button>
          {#if onDelete && transactionId}
            <button class="btn-danger" onclick={() => onDelete?.(transactionId!)}>{$t('common.delete')}</button>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{:else}
  <!-- SPLIT MODE: Multiple rows -->
  <!-- Transaction metadata row -->
  <div class="editor-row" role="row">
    <div class="col-expand" role="gridcell"></div>
    <div class="col-date" role="gridcell">
      <input 
        type="date" 
        bind:value={editingData.date}
        onfocus={onFocus}
        class="edit-input"
      />
    </div>
    <div class="col-ref" role="gridcell">
      <input 
        type="text" 
        bind:value={editingData.reference}
        placeholder={$t('ledger.ref')}
        onfocus={onFocus}
        class="edit-input"
      />
    </div>
    <div class="col-memo" role="gridcell">
      <input 
        type="text" 
        bind:value={editingData.memo}
        placeholder={$t('ledger.memo')}
        onfocus={onFocus}
        class="edit-input"
      />
    </div>
    <div class="col-offset" role="gridcell"></div>
    <div class="col-debit" role="gridcell"></div>
    <div class="col-credit" role="gridcell"></div>
    <div class="col-balance" role="gridcell"></div>
  </div>
  
  <!-- Current account entry row -->
  <div class="editor-row edit-current-account" role="row">
    <div class="col-expand" role="gridcell"></div>
    <div class="col-date" role="gridcell"></div>
    <div class="col-ref" role="gridcell"></div>
    <div class="col-memo" role="gridcell"></div>
    <div class="col-offset" role="gridcell">
      <a href="/ledger/{accountId}" class="current-account-link" title={accountPath}>
        {accountName}
      </a>
    </div>
    <div class="col-debit" role="gridcell">
      <input 
        type="number" 
        step="0.01" 
        bind:value={editingData.currentAccountDebit}
        placeholder=""
        onblur={onCurrentDebitBlur}
        onfocus={onFocus}
        class="edit-input edit-amount"
      />
    </div>
    <div class="col-credit" role="gridcell">
      <input 
        type="number" 
        step="0.01" 
        bind:value={editingData.currentAccountCredit}
        placeholder=""
        onblur={onCurrentCreditBlur}
        onfocus={onFocus}
        class="edit-input edit-amount"
      />
    </div>
    <div class="col-balance" role="gridcell"></div>
  </div>
  {#if currentNeedsValue}
    <!-- The two legs are in different units, so the quantity above can't balance the offset on its own.
         Price and Value complete it — the user fills any two. Simple mode keeps ONE amount pair, so it
         is the current account (the ledger's own unit) that carries the value. -->
    <div class="editor-row unit-row" role="row">
      <div class="col-expand" role="gridcell"></div>
      <div class="col-date" role="gridcell"></div>
      <div class="col-ref" role="gridcell"></div>
      <div class="col-memo" role="gridcell">
        <span class="unit-hint">{$t('ledger.quantity_in', { unit: unit?.symbol || currentUnitCode() })}</span>
      </div>
      <div class="col-offset" role="gridcell">
        <label class="unit-field">
          <span>{$t('ledger.price')}</span>
          <input
            type="number" step="any"
            value={editingData.currentAccountPrice ?? ''}
            oninput={(e) => { editingData.currentAccountPrice = e.currentTarget.value; recomputeCurrent('price'); }}
            onfocus={onFocus} class="edit-input edit-amount"
          />
        </label>
      </div>
      <div class="col-debit" role="gridcell">
        <label class="unit-field">
          <span>{$t('ledger.value')} ({reckoningUnit})</span>
          <input
            type="number" step="0.01"
            value={editingData.currentAccountValue ?? ''}
            oninput={(e) => { editingData.currentAccountValue = e.currentTarget.value; recomputeCurrent('value'); }}
            onfocus={onFocus} class="edit-input edit-amount"
          />
        </label>
      </div>
      <div class="col-credit unit-rate" role="gridcell">
        {#if currentRateInfo}
          <span class="implied-rate" class:deviates={currentRateInfo.deviates}>
            {formatRate(currentRateInfo.implied, unit as never, reckoningUnitObj as never)}
          </span>
          {#if acknowledgedRates['current'] !== currentRateInfo.key}
            <!-- A forgotten leg still BALANCES — it only distorts this rate, so it must be confirmed. -->
            <button class="btn-confirm-rate" onclick={() => onAcknowledgeRate('current', currentRateInfo.key)}>
              {$t('ledger.confirm_rate')}
            </button>
          {:else}
            <span class="rate-ok">✓</span>
          {/if}
          {#if currentRateInfo.deviates && currentRateInfo.reference !== null}
            <span class="rate-warning" title={$t('ledger.rate_deviates_hint')}>
              ⚠ {$t('ledger.rate_deviates', { reference: currentRateInfo.reference.toPrecision(6) })}
            </span>
          {/if}
        {/if}
      </div>
      <div class="col-balance" role="gridcell"></div>
    </div>
  {/if}
  
  <!-- Split entry rows -->
  {#each editingData.splits as split (split.id)}
    <div class="editor-row" role="row">
      <div class="col-expand" role="gridcell"></div>
      <div class="col-date" role="gridcell"></div>
      <div class="col-ref" role="gridcell"></div>
      <div class="col-memo" role="gridcell">
        <input 
          type="text" 
          bind:value={split.note}
          placeholder={$t('ledger.note')}
          onfocus={onFocus}
          class="edit-input"
        />
      </div>
      <div class="col-offset" role="gridcell">
        <AccountAutocomplete
          {entityId}
          bind:value={split.accountSearch}
          bind:selectedId={split.accountId}
          disabled={false}
          onfocus={onFocus}
        />
      </div>
      <div class="col-debit" role="gridcell">
        <input 
          type="number" 
          step="0.01" 
          bind:value={split.debit}
          placeholder=""
          onblur={() => onSplitDebitBlur(split.id)}
          onfocus={onFocus}
          class="edit-input edit-amount"
        />
      </div>
      <div class="col-credit" role="gridcell">
        <input 
          type="number" 
          step="0.01" 
          bind:value={split.credit}
          placeholder=""
          onblur={() => onSplitCreditBlur(split.id)}
          onfocus={onFocus}
          class="edit-input edit-amount"
        />
      </div>
      <div class="col-balance" role="gridcell">
        {#if editingData.splits.length > 1}
          <button 
            class="btn-remove-split" 
            onclick={() => onRemoveSplit(split.id)}
            title={$t('ledger.remove_split')}
          >
            ×
          </button>
        {/if}
      </div>
    </div>
    {#if rowNeedsValue(split.accountId)}
      <!-- This row's account holds a different unit than the transaction reckons in, so the quantity
           above can't balance on its own. Price and Value complete it — the user fills any two.
           See design/specs/web/components/transaction-edit.md § Multi-Unit Entries. -->
      {@const info = rateInfoFor(split)}
      {@const rowUnit = unitForAccount(split.accountId)}
      <div class="editor-row unit-row" role="row">
        <div class="col-expand" role="gridcell"></div>
        <div class="col-date" role="gridcell"></div>
        <div class="col-ref" role="gridcell"></div>
        <div class="col-memo" role="gridcell">
          <span class="unit-hint">
            {$t('ledger.quantity_in', { unit: rowUnit?.symbol || rowUnit?.code || '' })}
          </span>
        </div>
        <div class="col-offset" role="gridcell">
          <label class="unit-field">
            <span>{$t('ledger.price')}</span>
            <input
              type="number" step="any" bind:value={split.price}
              oninput={() => recompute(split, 'price')}
              onfocus={onFocus} class="edit-input edit-amount"
            />
          </label>
        </div>
        <div class="col-debit" role="gridcell">
          <label class="unit-field">
            <span>{$t('ledger.value')} ({reckoningUnit})</span>
            <input
              type="number" step="0.01" bind:value={split.value}
              oninput={() => recompute(split, 'value')}
              onfocus={onFocus} class="edit-input edit-amount"
            />
          </label>
        </div>
        <div class="col-credit unit-rate" role="gridcell">
          {#if info}
            <span class="implied-rate" class:deviates={info.deviates}>
              {formatRate(info.implied, rowUnit as never, reckoningUnitObj as never)}
            </span>
            {#if acknowledgedRates[split.id] !== info.key}
              <!-- A forgotten leg still BALANCES — it just distorts this rate. The balance check can't
                   catch it, so the rate must be confirmed explicitly. -->
              <button class="btn-confirm-rate" onclick={() => onAcknowledgeRate(split.id, info.key)}>
                {$t('ledger.confirm_rate')}
              </button>
            {:else}
              <span class="rate-ok">✓</span>
            {/if}
            {#if info.deviates && info.reference !== null}
              <span class="rate-warning" title={$t('ledger.rate_deviates_hint')}>
                ⚠ {$t('ledger.rate_deviates', { reference: info.reference.toPrecision(6) })}
              </span>
            {/if}
          {/if}
        </div>
        <div class="col-balance" role="gridcell"></div>
      </div>
    {/if}
  {/each}
  
  <!-- Split mode actions -->
  <div class="editor-actions" role="row">
    {#if true}
      {@const totals = getEditTotals()}
      <div class="edit-actions-container">
        <div class="edit-actions-left">
          <button class="btn-primary" onclick={onSave} disabled={unconfirmedRates.length > 0}
                  title={unconfirmedRates.length > 0 ? $t('ledger.confirm_rate_first') : ''}>
            {$t('common.save')}
          </button>
          {#if !isNewEntry && onDelete && transactionId}
            <button class="btn-danger" onclick={() => onDelete?.(transactionId!)}>{$t('common.delete')}</button>
          {/if}
          <button class="btn-secondary" onclick={onCancel}>{$t('common.cancel')}</button>
          <button class="btn-secondary" onclick={onAddSplit}>+ {$t('ledger.add_split')}</button>
        </div>
        <div class="edit-totals-right">
          <!-- Totals are VALUES in the reckoning unit — quantities in different units can't be summed. -->
          <span class="total-amount">{totalsLabel}{totals.debits.toFixed(2)}</span>
          <span class="total-amount">{totalsLabel}{totals.credits.toFixed(2)}</span>
          {#if Number.isNaN(totals.balance)}
            <span class="imbalanced">{$t('ledger.needs_value')} ⚠</span>
          {:else if Math.abs(totals.balance) <= 1}
            <span class="balanced">{totalsLabel}0.00 ✓</span>
          {:else}
            <span class="imbalanced">{totalsLabel}{formatAmount(totals.balance)} ⚠</span>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}
</div>


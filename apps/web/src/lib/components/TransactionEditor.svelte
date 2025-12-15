<script lang="ts">
  import { t } from '$lib/i18n';
  import AccountAutocomplete from './AccountAutocomplete.svelte';
  
  interface EditingData {
    date: string;
    reference: string;
    memo: string;
    currentAccountDebit: string;
    currentAccountCredit: string;
    splits: Array<{
      id: string;
      accountId: string;
      accountSearch: string;
      debit: string;
      credit: string;
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
    unit: { symbol: string; displayDivisor: number } | null;
    onSave: () => void;
    onCancel: () => void;
    onDelete?: (txnId: string) => void;
    onAddSplit: () => void;
    onRemoveSplit: (splitId: string) => void;
    onCurrentDebitBlur: () => void;
    onCurrentCreditBlur: () => void;
    onSplitDebitBlur: (splitId: string) => void;
    onSplitCreditBlur: (splitId: string) => void;
    onFocus: () => void;
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
    border: 2px solid var(--primary-color, #0066cc);
    background: var(--surface-hover, #f9f9f9);
    margin: 0.25rem 0;
  }
  
  /* Editor rows use display: contents so cells align with grid */
  .editor-row {
    display: contents;
  }
  
  /* All editor cells */
  .editor-row > div {
    padding: 0.5rem 1rem;
    background: var(--surface-hover, #f9f9f9);
  }
  
  /* Current account row gets different background */
  .edit-current-account > div {
    background: var(--surface-secondary);
  }
  
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
    background: var(--surface-secondary);
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
    background: var(--surface-hover);
    border-color: var(--primary-color);
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
    background: var(--surface-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
    box-sizing: border-box;
  }
  
  :global(.edit-input:focus) {
    outline: none;
    border-color: var(--primary-color);
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
    color: var(--primary-color);
    text-decoration: underline;
  }
  
  /* Remove split button */
  .btn-remove-split {
    background: transparent;
    border: none;
    color: var(--danger-color);
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }
  
  .btn-remove-split:hover {
    color: var(--danger-color-hover);
  }
  
  /* Actions footer */
  .edit-actions-container {
    display: flex !important;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--surface-secondary);
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
    color: var(--success-color);
    font-weight: 600;
  }
  
  .imbalanced {
    color: var(--danger-color);
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
    background: var(--primary-color, #0066cc);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--primary-color-hover, #0052a3);
  }
  
  .btn-secondary {
    background: var(--surface-secondary, #f5f5f5);
    color: var(--text-primary, #000);
    border: 1px solid var(--border-color, #ccc);
  }
  
  .btn-secondary:hover {
    background: var(--surface-hover, #e8e8e8);
  }
  
  .btn-danger {
    background: var(--danger-color, #dc3545);
    color: white;
  }
  
  .btn-danger:hover {
    background: var(--danger-color-hover, #bd2130);
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
  
  <!-- Simple mode actions -->
  <div class="editor-actions" role="row">
    <div class="edit-actions-container">
      <div class="edit-actions-left">
        <button class="btn-primary" onclick={onSave}>{$t('common.save')}</button>
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
  {/each}
  
  <!-- Split mode actions -->
  <div class="editor-actions" role="row">
    {#if true}
      {@const totals = getEditTotals()}
      <div class="edit-actions-container">
        <div class="edit-actions-left">
          <button class="btn-primary" onclick={onSave}>{$t('common.save')}</button>
          {#if !isNewEntry && onDelete && transactionId}
            <button class="btn-danger" onclick={() => onDelete?.(transactionId!)}>{$t('common.delete')}</button>
          {/if}
          <button class="btn-secondary" onclick={onCancel}>{$t('common.cancel')}</button>
          <button class="btn-secondary" onclick={onAddSplit}>+ {$t('ledger.add_split')}</button>
        </div>
        <div class="edit-totals-right">
          <span class="total-amount">{unit?.symbol ?? ''}{totals.debits.toFixed(2)}</span>
          <span class="total-amount">{unit?.symbol ?? ''}{totals.credits.toFixed(2)}</span>
          {#if Math.abs(totals.balance) <= 1}
            <span class="balanced">{unit?.symbol ?? ''}0.00 ✓</span>
          {:else}
            <span class="imbalanced">{unit?.symbol ?? ''}{formatAmount(totals.balance)} ⚠</span>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}
</div>


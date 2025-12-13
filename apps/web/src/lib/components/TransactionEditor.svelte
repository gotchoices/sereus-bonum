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
  /* Editor row styling */
  :global(.edit-simple-row),
  :global(.edit-metadata-row),
  :global(.edit-entry-row),
  :global(.edit-actions-row) {
    background: var(--surface-hover, #f9f9f9) !important;
    position: relative;
  }
  
  /* First row in edit group gets top border */
  :global(.edit-simple-row),
  :global(.edit-metadata-row) {
    border: 2px solid var(--primary-color, #0066cc);
    border-bottom: none;
  }
  
  /* Middle rows get left/right borders only */
  :global(.edit-entry-row) {
    border-left: 2px solid var(--primary-color, #0066cc);
    border-right: 2px solid var(--primary-color, #0066cc);
    border-bottom: none;
  }
  
  /* Last row (actions) gets bottom border */
  :global(.edit-actions-row) {
    border: 2px solid var(--primary-color, #0066cc);
    border-top: none;
  }
  
  :global(.edit-actions-row td) {
    padding: 0 !important;
    background: var(--surface-hover, #f9f9f9) !important;
  }
  
  :global(.edit-current-account) {
    background: var(--surface-secondary);
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
  
  /* Column-specific widths to match ledger table */
  :global(.col-date) {
    width: 135px;
  }
  
  :global(.col-ref) {
    width: 100px;
  }
  
  :global(.col-memo) {
    min-width: 200px;
  }
  
  :global(.col-offset) {
    min-width: 150px;
  }
  
  :global(.col-debit),
  :global(.col-credit) {
    width: 160px;
    text-align: right;
  }
  
  :global(.col-balance) {
    width: 160px;
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

{#if isSimpleMode}
  <!-- SIMPLE MODE: Single row entry -->
  <tr class="edit-simple-row" class:new-entry-row={isNewEntry}>
    <td class="col-expand"></td>
    <td class="col-date">
      <input 
        type="date" 
        bind:value={editingData.date}
        onfocus={onFocus}
        class="edit-input"
      />
    </td>
    <td class="col-ref">
      <input 
        type="text" 
        bind:value={editingData.reference}
        placeholder={$t('ledger.ref')}
        onfocus={onFocus}
        class="edit-input"
      />
    </td>
    <td class="col-memo">
      <input 
        type="text" 
        bind:value={editingData.memo}
        placeholder={$t('ledger.memo')}
        onfocus={onFocus}
        class="edit-input"
      />
    </td>
    <td class="col-offset">
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
    </td>
    <td class="col-debit">
      <input 
        type="number" 
        step="0.01" 
        bind:value={editingData.currentAccountDebit}
        placeholder=""
        onblur={onCurrentDebitBlur}
        onfocus={onFocus}
        class="edit-input edit-amount"
      />
    </td>
    <td class="col-credit">
      <input 
        type="number" 
        step="0.01" 
        bind:value={editingData.currentAccountCredit}
        placeholder=""
        onblur={onCurrentCreditBlur}
        onfocus={onFocus}
        class="edit-input edit-amount"
      />
    </td>
    <td class="col-balance"></td>
  </tr>
  
  <!-- Simple mode actions -->
  <tr class="edit-actions-row" class:new-entry-row={isNewEntry}>
    <td colspan="8">
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
    </td>
  </tr>
{:else}
  <!-- SPLIT MODE: Multiple rows -->
  <!-- Transaction metadata row -->
  <tr class="edit-metadata-row" class:new-entry-row={isNewEntry}>
    <td class="col-expand"></td>
    <td class="col-date">
      <input 
        type="date" 
        bind:value={editingData.date}
        onfocus={onFocus}
        class="edit-input"
      />
    </td>
    <td class="col-ref">
      <input 
        type="text" 
        bind:value={editingData.reference}
        placeholder={$t('ledger.ref')}
        onfocus={onFocus}
        class="edit-input"
      />
    </td>
    <td class="col-memo">
      <input 
        type="text" 
        bind:value={editingData.memo}
        placeholder={$t('ledger.memo')}
        onfocus={onFocus}
        class="edit-input"
      />
    </td>
    <td class="col-offset"></td>
    <td class="col-debit"></td>
    <td class="col-credit"></td>
    <td class="col-balance"></td>
  </tr>
  
  <!-- Current account entry row -->
  <tr class="edit-entry-row edit-current-account" class:new-entry-row={isNewEntry}>
    <td class="col-expand"></td>
    <td class="col-date"></td>
    <td class="col-ref"></td>
    <td class="col-memo"></td>
    <td class="col-offset">
      <a href="/ledger/{accountId}" class="current-account-link" title={accountPath}>
        {accountName}
      </a>
    </td>
    <td class="col-debit">
      <input 
        type="number" 
        step="0.01" 
        bind:value={editingData.currentAccountDebit}
        placeholder=""
        onblur={onCurrentDebitBlur}
        onfocus={onFocus}
        class="edit-input edit-amount"
      />
    </td>
    <td class="col-credit">
      <input 
        type="number" 
        step="0.01" 
        bind:value={editingData.currentAccountCredit}
        placeholder=""
        onblur={onCurrentCreditBlur}
        onfocus={onFocus}
        class="edit-input edit-amount"
      />
    </td>
    <td class="col-balance"></td>
  </tr>
  
  <!-- Split entry rows -->
  {#each editingData.splits as split (split.id)}
    <tr class="edit-entry-row edit-split-entry" class:new-entry-row={isNewEntry}>
      <td class="col-expand"></td>
      <td class="col-date"></td>
      <td class="col-ref"></td>
      <td class="col-memo">
        <input 
          type="text" 
          bind:value={split.note}
          placeholder={$t('ledger.note')}
          onfocus={onFocus}
          class="edit-input"
        />
      </td>
      <td class="col-offset">
        <AccountAutocomplete
          {entityId}
          bind:value={split.accountSearch}
          bind:selectedId={split.accountId}
          disabled={false}
          onfocus={onFocus}
        />
      </td>
      <td class="col-debit">
        <input 
          type="number" 
          step="0.01" 
          bind:value={split.debit}
          placeholder=""
          onblur={() => onSplitDebitBlur(split.id)}
          onfocus={onFocus}
          class="edit-input edit-amount"
        />
      </td>
      <td class="col-credit">
        <input 
          type="number" 
          step="0.01" 
          bind:value={split.credit}
          placeholder=""
          onblur={() => onSplitCreditBlur(split.id)}
          onfocus={onFocus}
          class="edit-input edit-amount"
        />
      </td>
      <td class="col-balance">
        {#if editingData.splits.length > 1}
          <button 
            class="btn-remove-split" 
            onclick={() => onRemoveSplit(split.id)}
            title={$t('ledger.remove_split')}
          >
            ×
          </button>
        {/if}
      </td>
    </tr>
  {/each}
  
  <!-- Split mode actions -->
  <tr class="edit-actions-row" class:new-entry-row={isNewEntry}>
    <td colspan="8">
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
    </td>
  </tr>
{/if}


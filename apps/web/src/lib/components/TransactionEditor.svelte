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
  /* Inherit most styles from parent, only component-specific overrides here */
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


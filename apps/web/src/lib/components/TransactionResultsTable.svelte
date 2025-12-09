<script lang="ts">
  import type { LedgerEntry } from '$lib/data/types';
  import { t } from '$lib/i18n';
  import { formatCurrency } from '$lib/utils/format';
  
  interface Props {
    entries: LedgerEntry[];
    showEntity?: boolean;
    showAccount?: boolean;
    allowExpand?: boolean;
    showTotals?: boolean;
    emptyMessage?: string;
  }
  
  let {
    entries,
    showEntity = true,
    showAccount = true,
    allowExpand = true,
    showTotals = true,
    emptyMessage = $t('search.empty'),
  }: Props = $props();
  
  // Track expanded transactions
  let expandedTxns = $state(new Set<string>());
  
  // Expand/collapse functions
  function toggleExpand(txnId: string) {
    const newSet = new Set(expandedTxns);
    if (newSet.has(txnId)) {
      newSet.delete(txnId);
    } else {
      newSet.add(txnId);
    }
    expandedTxns = newSet;
  }
  
  function expandAll() {
    const allTxns = new Set(entries.map(e => e.transactionId));
    expandedTxns = allTxns;
  }
  
  function collapseAll() {
    expandedTxns = new Set();
  }
  
  // Calculate totals
  const totals = $derived(() => {
    let totalDebits = 0;
    let totalCredits = 0;
    
    for (const entry of entries) {
      if (entry.amount > 0) {
        totalDebits += entry.amount;
      } else {
        totalCredits += Math.abs(entry.amount);
      }
    }
    
    const imbalance = Math.abs(totalDebits - totalCredits);
    const isBalanced = imbalance < 0.01; // Allow for floating point errors
    
    return {
      totalDebits,
      totalCredits,
      imbalance,
      isBalanced,
    };
  });
</script>

<div class="transaction-results-table">
  {#if entries.length === 0}
    <div class="empty-state">
      <p>{emptyMessage}</p>
    </div>
  {:else}
    <div class="table-controls">
      {#if allowExpand}
        <button on:click={expandAll}>{$t('search.expand_all')}</button>
        <button on:click={collapseAll}>{$t('search.collapse_all')}</button>
      {/if}
    </div>
    
    <div class="table-container">
      <table>
        <thead>
          <tr>
            {#if allowExpand}
              <th class="expand-col"></th>
            {/if}
            <th>{$t('search.date_col')}</th>
            {#if showEntity}
              <th>{$t('search.entity_col')}</th>
            {/if}
            {#if showAccount}
              <th>{$t('search.account_col')}</th>
            {/if}
            <th>{$t('search.ref_col')}</th>
            <th>{$t('search.memo_col')}</th>
            <th class="amount-col">{$t('search.debit_col')}</th>
            <th class="amount-col">{$t('search.credit_col')}</th>
          </tr>
        </thead>
        <tbody>
          {#each entries as entry (entry.entryId)}
            <tr class="entry-row">
              {#if allowExpand}
                <td class="expand-col">
                  {#if entry.isSplit}
                    <button
                      class="expand-btn"
                      on:click={() => toggleExpand(entry.transactionId)}
                      aria-label={expandedTxns.has(entry.transactionId) ? 'Collapse' : 'Expand'}
                    >
                      {expandedTxns.has(entry.transactionId) ? '▼' : '▶'}
                    </button>
                  {/if}
                </td>
              {/if}
              <td>{entry.date}</td>
              {#if showEntity}
                <td>
                  <a href="/entities/{(entry as any).entityId}">
                    {(entry as any).entityName || '—'}
                  </a>
                </td>
              {/if}
              {#if showAccount}
                <td>
                  <a 
                    href="/ledger/{entry.accountId}" 
                    title={(entry as any).accountPath || (entry as any).accountName}
                  >
                    {(entry as any).accountName || '—'}
                  </a>
                </td>
              {/if}
              <td>{entry.reference || '—'}</td>
              <td>{entry.memo || '—'}</td>
              <td class="amount-col">
                {entry.amount > 0 ? formatCurrency(entry.amount) : ''}
              </td>
              <td class="amount-col">
                {entry.amount < 0 ? formatCurrency(Math.abs(entry.amount)) : ''}
              </td>
            </tr>
            
            {#if allowExpand && entry.isSplit && expandedTxns.has(entry.transactionId)}
              {#if entry.splitEntries}
                {#each entry.splitEntries as split (split.entryId)}
                  <tr class="split-row">
                    <td></td>
                    <td colspan="2"></td>
                    {#if showEntity}
                      <td></td>
                    {/if}
                    <td>
                      <a 
                        href="/ledger/{split.accountId}" 
                        title={split.accountPath}
                        class="split-account"
                      >
                        ↳ {split.accountName}
                      </a>
                    </td>
                    <td colspan="2">{split.note || '—'}</td>
                    <td class="amount-col">
                      {split.amount > 0 ? formatCurrency(split.amount) : ''}
                    </td>
                    <td class="amount-col">
                      {split.amount < 0 ? formatCurrency(Math.abs(split.amount)) : ''}
                    </td>
                  </tr>
                {/each}
              {/if}
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
    
    {#if showTotals}
      <div class="totals-footer">
        <div class="totals-left">
          {$t('search.total_entries').replace('{count}', entries.length.toString())}
        </div>
        <div class="totals-right">
          <div class="total-row">
            <span class="total-label">{$t('search.total_debits')}:</span>
            <span class="total-value">{formatCurrency(totals().totalDebits)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">{$t('search.total_credits')}:</span>
            <span class="total-value">{formatCurrency(totals().totalCredits)}</span>
          </div>
          <div class="total-row verification {totals().isBalanced ? 'balanced' : 'imbalanced'}">
            {#if totals().isBalanced}
              <span class="status-icon">✓</span>
              <span>{$t('search.balanced')}</span>
            {:else}
              <span class="status-icon">⚠</span>
              <span>{$t('search.imbalance')}: {formatCurrency(totals().imbalance)}</span>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .transaction-results-table {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }
  
  .empty-state {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--text-muted);
  }
  
  .table-controls {
    display: flex;
    gap: var(--spacing-sm);
  }
  
  .table-controls button {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--button-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  .table-controls button:hover {
    background: var(--button-hover-bg);
  }
  
  .table-container {
    overflow-x: auto;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  
  thead {
    background: var(--card-bg);
    border-bottom: 2px solid var(--border-color);
  }
  
  th {
    padding: var(--spacing-sm);
    text-align: left;
    font-weight: 600;
    white-space: nowrap;
  }
  
  th.amount-col {
    text-align: right;
  }
  
  th.expand-col {
    width: 2rem;
  }
  
  td {
    padding: var(--spacing-sm);
    border-bottom: 1px solid var(--border-color);
  }
  
  td.amount-col {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  
  .entry-row {
    background: var(--bg-primary);
  }
  
  .entry-row:hover {
    background: var(--hover-bg);
  }
  
  .split-row {
    background: var(--bg-secondary);
    font-size: 0.8125rem;
  }
  
  .split-row:hover {
    background: var(--hover-bg);
  }
  
  .split-account {
    padding-left: var(--spacing-md);
    font-style: italic;
  }
  
  .expand-col {
    width: 2rem;
    text-align: center;
  }
  
  .expand-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  
  .expand-btn:hover {
    color: var(--text-primary);
  }
  
  a {
    color: var(--link-color);
    text-decoration: none;
  }
  
  a:hover {
    text-decoration: underline;
  }
  
  .totals-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding: var(--spacing-md);
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: 0.875rem;
  }
  
  .totals-left {
    color: var(--text-muted);
  }
  
  .totals-right {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    align-items: flex-end;
  }
  
  .total-row {
    display: flex;
    gap: var(--spacing-md);
  }
  
  .total-label {
    font-weight: 500;
  }
  
  .total-value {
    font-variant-numeric: tabular-nums;
    min-width: 8rem;
    text-align: right;
  }
  
  .verification {
    margin-top: var(--spacing-xs);
    padding-top: var(--spacing-xs);
    border-top: 1px solid var(--border-color);
    font-weight: 600;
  }
  
  .verification.balanced {
    color: var(--success-color);
  }
  
  .verification.imbalanced {
    color: var(--error-color);
  }
  
  .status-icon {
    margin-right: var(--spacing-xs);
  }
</style>


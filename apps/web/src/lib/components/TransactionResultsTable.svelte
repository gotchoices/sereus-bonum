<script lang="ts">
  import type { LedgerEntry } from '$lib/data/types';
  import { t } from '$lib/i18n';
  import { formatCurrency } from '$lib/utils/format';
  
  interface Props {
    entries: LedgerEntry[];
    showEntity?: boolean;
    showTotals?: boolean;
    emptyMessage?: string;
  }
  
  let {
    entries,
    showEntity = true,
    showTotals = true,
    emptyMessage = $t('search.empty'),
  }: Props = $props();
  
  // Group entries by transaction
  interface TransactionGroup {
    transactionId: string;
    date: string;
    entityId: string;
    entityName: string;
    memo?: string;
    reference?: string;
    entries: Array<{
      entryId: string;
      accountId: string;
      accountName: string;
      accountPath: string;
      amount: number;
      note?: string;
    }>;
  }
  
  const transactionGroups = $derived(() => {
    const groups = new Map<string, TransactionGroup>();
    
    for (const entry of entries) {
      const txnId = entry.transactionId;
      
      if (!groups.has(txnId)) {
        groups.set(txnId, {
          transactionId: txnId,
          date: entry.date,
          entityId: (entry as any).entityId || '',
          entityName: (entry as any).entityName || '',
          memo: entry.memo,
          reference: entry.reference,
          entries: [],
        });
      }
      
      const group = groups.get(txnId)!;
      group.entries.push({
        entryId: entry.entryId,
        accountId: entry.accountId,
        accountName: (entry as any).accountName || '',
        accountPath: (entry as any).accountPath || '',
        amount: entry.amount,
        note: entry.note,
      });
    }
    
    return Array.from(groups.values());
  });
  
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
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>{$t('search.date_col')}</th>
            {#if showEntity}
              <th>{$t('search.entity_col')}</th>
            {/if}
            <th>{$t('search.memo_col')}</th>
            <th>{$t('search.ref_col')}</th>
            <th>{$t('search.account_col')}</th>
            <th class="amount-col">{$t('search.debit_col')}</th>
            <th class="amount-col">{$t('search.credit_col')}</th>
          </tr>
        </thead>
        <tbody>
          {#each transactionGroups() as txnGroup (txnGroup.transactionId)}
            <!-- Transaction Header Row -->
            <tr class="txn-header-row">
              <td>{txnGroup.date}</td>
              {#if showEntity}
                <td>
                  <a href="/entities/{txnGroup.entityId}">
                    {txnGroup.entityName}
                  </a>
                </td>
              {/if}
              <td>{txnGroup.memo || '—'}</td>
              <td>{txnGroup.reference || '—'}</td>
              <td colspan="3"></td>
            </tr>
            
            <!-- Split Rows -->
            {#each txnGroup.entries as entry (entry.entryId)}
              <tr class="split-row">
                <td colspan="2"></td>
                {#if showEntity}
                  <td></td>
                {/if}
                <td colspan="2">
                  <a 
                    href="/ledger/{entry.accountId}" 
                    title={entry.accountPath}
                    class="split-account"
                  >
                    ↳ {entry.accountName}
                  </a>
                  {#if entry.note}
                    <span class="split-note">— {entry.note}</span>
                  {/if}
                </td>
                <td class="amount-col">
                  {entry.amount > 0 ? formatCurrency(entry.amount) : ''}
                </td>
                <td class="amount-col">
                  {entry.amount < 0 ? formatCurrency(Math.abs(entry.amount)) : ''}
                </td>
              </tr>
            {/each}
          {/each}
          
          {#if showTotals}
            <!-- Totals Row -->
            <tr class="totals-row">
              <td colspan="{showEntity ? 5 : 4}">
                <strong>Totals:</strong>
              </td>
              <td class="amount-col">
                <strong>{formatCurrency(totals().totalDebits)}</strong>
              </td>
              <td class="amount-col">
                <strong>{formatCurrency(totals().totalCredits)}</strong>
              </td>
            </tr>
            
            <!-- Verification Row -->
            <tr class="verification-row {totals().isBalanced ? 'balanced' : 'imbalanced'}">
              <td colspan="{showEntity ? 5 : 4}">
                {#if totals().isBalanced}
                  <span class="status-icon">✓</span>
                  <span>{$t('search.balanced')}</span>
                {:else}
                  <span class="status-icon">⚠</span>
                  <span>{$t('search.imbalance')}: {formatCurrency(totals().imbalance)}</span>
                {/if}
              </td>
              <td colspan="2"></td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
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
  
  td {
    padding: var(--spacing-sm);
    border-bottom: 1px solid var(--border-color);
  }
  
  td.amount-col {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  
  .txn-header-row {
    background: var(--card-bg);
    font-weight: 500;
  }
  
  .txn-header-row:hover {
    background: var(--hover-bg);
  }
  
  .split-row {
    background: var(--bg-primary);
    font-size: 0.8125rem;
  }
  
  .split-row:hover {
    background: var(--hover-bg);
  }
  
  .split-account {
    padding-left: var(--spacing-md);
    font-style: italic;
  }
  
  .split-note {
    color: var(--text-muted);
    font-size: 0.75rem;
    margin-left: var(--spacing-xs);
  }
  
  a {
    color: var(--link-color);
    text-decoration: none;
  }
  
  a:hover {
    text-decoration: underline;
  }
  
  .totals-row {
    background: var(--card-bg);
    border-top: 2px solid var(--border-color);
    font-weight: 600;
  }
  
  .totals-row td {
    padding: var(--spacing-sm) var(--spacing-sm);
  }
  
  .verification-row {
    background: var(--card-bg);
    font-weight: 600;
    border-bottom: none;
  }
  
  .verification-row td {
    padding: var(--spacing-xs) var(--spacing-sm);
    border-bottom: none;
  }
  
  .verification-row.balanced {
    color: var(--success-color);
  }
  
  .verification-row.imbalanced {
    color: var(--error-color);
  }
  
  .status-icon {
    margin-right: var(--spacing-xs);
  }
</style>

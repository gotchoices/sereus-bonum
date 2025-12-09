<script lang="ts">
  import { onMount } from 'svelte';
  import { getDataService } from '$lib/data';
  import TransactionResultsTable from '$lib/components/TransactionResultsTable.svelte';
  import type { LedgerEntry } from '$lib/data/types';
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  
  let entries = $state<LedgerEntry[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  
  async function loadAllTransactions() {
    loading = true;
    error = null;
    log.ui.info('Loading all transactions');
    
    try {
      const dataService = await getDataService();
      entries = await dataService.getAllTransactions();
      log.ui.info(`Loaded ${entries.length} transactions`);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load transactions';
      log.ui.error(`Error loading transactions: ${error}`);
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>{$t('search.title')} - {$t('app.name')}</title>
</svelte:head>

<div class="search-page">
  <header class="page-header">
    <h1>{$t('search.title')}</h1>
    <button 
      class="btn-primary" 
      on:click={loadAllTransactions}
      disabled={loading}
    >
      {loading ? 'Loading...' : $t('search.show_all')}
    </button>
  </header>
  
  {#if error}
    <div class="error-message">
      <p>⚠ {error}</p>
    </div>
  {/if}
  
  <TransactionResultsTable 
    {entries}
    showEntity={true}
    showAccount={true}
    allowExpand={true}
    showTotals={true}
    emptyMessage={$t('search.empty')}
  />
</div>

<style>
  .search-page {
    padding: var(--spacing-lg);
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
  }
  
  .page-header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }
  
  .btn-primary {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--border-radius);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--primary-hover-color);
  }
  
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .error-message {
    padding: var(--spacing-md);
    background: var(--error-bg);
    border: 1px solid var(--error-color);
    border-radius: var(--border-radius);
    color: var(--error-color);
    margin-bottom: var(--spacing-md);
  }
  
  .error-message p {
    margin: 0;
  }
</style>


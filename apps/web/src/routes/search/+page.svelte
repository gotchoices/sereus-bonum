<script lang="ts">
  import { onMount } from 'svelte';
  import { getDataService } from '$lib/data';
  import TransactionResultsTable from '$lib/components/TransactionResultsTable.svelte';
  import type { LedgerEntry } from '$lib/data/types';
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  import { exportToCSV, exportToExcel } from '$lib/utils/export';
  
  let entries = $state<LedgerEntry[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let showExportMenu = $state(false);
  
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
  
  function handleExportCSV() {
    if (entries.length === 0) return;
    
    const filename = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    exportToCSV(entries, filename);
    showExportMenu = false;
    log.ui.info('Exported to CSV');
  }
  
  function handleExportExcel() {
    if (entries.length === 0) return;
    
    const filename = `transactions-${new Date().toISOString().slice(0, 10)}.xlsx`;
    try {
      exportToExcel(entries, filename);
      showExportMenu = false;
      log.ui.info('Exported to Excel');
    } catch (err) {
      log.ui.warn('Excel export failed, falling back to CSV');
      handleExportCSV();
    }
  }
  
  // Close export menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.export-dropdown')) {
      showExportMenu = false;
    }
  }
  
  $effect(() => {
    if (showExportMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  });
</script>

<svelte:head>
  <title>{$t('search.title')} - {$t('app.name')}</title>
</svelte:head>

<div class="search-page">
  <header class="page-header">
    <h1>{$t('search.title')}</h1>
    <div class="header-actions">
      <button 
        class="btn-primary" 
        on:click={loadAllTransactions}
        disabled={loading}
      >
        {loading ? 'Loading...' : $t('search.show_all')}
      </button>
      
      {#if entries.length > 0}
        <div class="export-dropdown">
          <button 
            class="btn-secondary export-btn" 
            on:click={() => showExportMenu = !showExportMenu}
            title="Export"
          >
            📥 Export
          </button>
          
          {#if showExportMenu}
            <div class="export-menu">
              <button on:click={handleExportCSV}>
                📄 Export to CSV
              </button>
              <button on:click={handleExportExcel}>
                📊 Export to Excel
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </header>
  
  {#if error}
    <div class="error-message">
      <p>⚠ {error}</p>
    </div>
  {/if}
  
  <TransactionResultsTable 
    {entries}
    showEntity={true}
    showTotals={true}
    emptyMessage={$t('search.empty')}
  />
</div>

<style>
  .search-page {
    padding: var(--space-lg);
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-lg);
  }
  
  .page-header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }
  
  .header-actions {
    display: flex;
    gap: var(--space-sm);
    align-items: center;
  }
  
  .btn-primary {
    padding: var(--space-sm) var(--space-md);
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover);
  }
  
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    padding: var(--space-sm) var(--space-md);
    background: var(--accent-color);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .btn-secondary:hover {
    background: var(--accent-hover);
  }
  
  .export-dropdown {
    position: relative;
  }
  
  .export-btn {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }
  
  .export-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 100;
    min-width: 180px;
  }
  
  .export-menu button {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background 0.2s;
  }
  
  .export-menu button:hover {
    background: var(--bg-hover);
  }
  
  .export-menu button:first-child {
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }
  
  .export-menu button:last-child {
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }
  
  .error-message {
    padding: var(--space-md);
    background: var(--danger-bg);
    border: 1px solid var(--danger);
    border-radius: var(--radius-md);
    color: var(--danger);
    margin-bottom: var(--space-md);
  }
  
  .error-message p {
    margin: 0;
  }
</style>


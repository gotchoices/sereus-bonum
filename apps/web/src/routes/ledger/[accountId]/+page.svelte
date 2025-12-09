<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  import { entities } from '$lib/stores/entities';
  import { accounts } from '$lib/stores/accounts';
  import { getDataService, type LedgerEntry, type Account, type Unit } from '$lib/data';
  
  // Route param
  let accountId = $derived($page.params.accountId);
  
  // Account info
  let account: Account | null = $state(null);
  let unit: Unit | null = $state(null);
  
  // Ledger data
  let entries: LedgerEntry[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);
  
  // New entry form state
  let newEntry = $state({
    date: new Date().toISOString().split('T')[0],
    reference: '',
    memo: '',
    offsetAccountId: '',
    offsetSearch: '',
    debit: '',
    credit: '',
  });
  
  // Account search results for autocomplete
  let searchResults: Array<{ id: string; name: string; path: string; code?: string }> = $state([]);
  let showAutocomplete = $state(false);
  let selectedSearchIndex = $state(0);
  
  // Load data when account changes
  $effect(() => {
    if (browser && accountId) {
      loadData();
    }
  });
  
  async function loadData() {
    log.ui.debug('[Ledger] Loading data for account:', accountId);
    loading = true;
    error = null;
    
    try {
      const ds = await getDataService();
      
      // Get account info
      account = await ds.getAccount(accountId);
      if (!account) {
        error = 'Account not found';
        return;
      }
      
      // Get unit info
      unit = await ds.getUnit(account.unit);
      
      // Get ledger entries
      entries = await ds.getLedgerEntries(accountId);
      
      log.ui.debug('[Ledger] Loaded', entries.length, 'entries');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load ledger';
      log.ui.error('[Ledger] Load error:', e);
    } finally {
      loading = false;
    }
  }
  
  // Format amount for display
  function formatAmount(amount: number): string {
    const divisor = unit?.displayDivisor ?? 100;
    const value = amount / divisor;
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  
  // Handle offset account search
  async function handleOffsetSearch() {
    if (!account || newEntry.offsetSearch.length < 1) {
      searchResults = [];
      showAutocomplete = false;
      return;
    }
    
    try {
      const ds = await getDataService();
      searchResults = await ds.searchAccounts(account.entityId, newEntry.offsetSearch);
      showAutocomplete = searchResults.length > 0;
      selectedSearchIndex = 0;
    } catch (e) {
      log.ui.error('[Ledger] Search error:', e);
    }
  }
  
  // Select an account from autocomplete
  function selectAccount(result: { id: string; name: string; path: string }) {
    newEntry.offsetAccountId = result.id;
    newEntry.offsetSearch = result.path;
    showAutocomplete = false;
  }
  
  // Handle keyboard in autocomplete
  function handleSearchKeydown(e: KeyboardEvent) {
    if (!showAutocomplete) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedSearchIndex = Math.min(selectedSearchIndex + 1, searchResults.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedSearchIndex = Math.max(selectedSearchIndex - 1, 0);
        break;
      case 'Tab':
      case 'Enter':
        if (searchResults[selectedSearchIndex]) {
          e.preventDefault();
          selectAccount(searchResults[selectedSearchIndex]);
        }
        break;
      case 'Escape':
        showAutocomplete = false;
        break;
    }
  }
  
  // Save new entry
  async function saveEntry() {
    if (!account) return;
    
    const amount = newEntry.debit 
      ? parseFloat(newEntry.debit) * (unit?.displayDivisor ?? 100)
      : newEntry.credit
        ? -parseFloat(newEntry.credit) * (unit?.displayDivisor ?? 100)
        : 0;
    
    if (!amount || !newEntry.offsetAccountId || !newEntry.date) {
      log.ui.warn('[Ledger] Invalid entry data');
      return;
    }
    
    try {
      const ds = await getDataService();
      await ds.createTransaction(
        {
          entityId: account.entityId,
          date: newEntry.date,
          memo: newEntry.memo || undefined,
          reference: newEntry.reference || undefined,
        },
        [
          { transactionId: '', accountId: accountId, amount },
          { transactionId: '', accountId: newEntry.offsetAccountId, amount: -amount },
        ]
      );
      
      // Reset form and reload
      newEntry = {
        date: new Date().toISOString().split('T')[0],
        reference: '',
        memo: '',
        offsetAccountId: '',
        offsetSearch: '',
        debit: '',
        credit: '',
      };
      
      await loadData();
      log.ui.info('[Ledger] Entry saved');
    } catch (e) {
      log.ui.error('[Ledger] Save error:', e);
    }
  }
  
  // Handle Enter key on last field to save
  function handleAmountKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (newEntry.debit || newEntry.credit)) {
      e.preventDefault();
      saveEntry();
    }
  }
  
  // Get entity for back link
  let entity = $derived($entities.find(e => e.id === account?.entityId));
</script>

<div class="ledger-page">
  <!-- Header -->
  <header class="ledger-header">
    {#if entity}
      <a href="/entities/{entity.id}" class="back-link">
        ← {$t('ledger.back_to_accounts')}
      </a>
    {/if}
    
    {#if account}
      <div class="account-info">
        <h1>{account.name}</h1>
        <span class="account-meta">
          {account.code ? `${account.code} • ` : ''}{unit?.symbol ?? account.unit}
        </span>
      </div>
      
      <div class="balance-display">
        <span class="balance-label">{$t('ledger.running_balance')}</span>
        <span class="balance-value">
          {#if entries.length > 0}
            {unit?.symbol ?? ''}{formatAmount(entries[entries.length - 1].runningBalance)}
          {:else}
            {unit?.symbol ?? ''}0.00
          {/if}
        </span>
      </div>
    {/if}
  </header>
  
  <!-- Ledger Table -->
  <div class="ledger-container">
    {#if loading}
      <div class="loading-state">
        <span class="spinner"></span>
        <span>{$t('common.loading')}</span>
      </div>
    {:else if error}
      <div class="error-state">
        <p>{$t('common.error')}: {error}</p>
      </div>
    {:else}
      <table class="ledger-table">
        <thead>
          <tr>
            <th class="col-date">{$t('ledger.date')}</th>
            <th class="col-ref">{$t('ledger.ref')}</th>
            <th class="col-memo">{$t('ledger.memo')}</th>
            <th class="col-offset">{$t('ledger.offset')}</th>
            <th class="col-debit">{$t('ledger.debit')}</th>
            <th class="col-credit">{$t('ledger.credit')}</th>
            <th class="col-balance">{$t('ledger.running_balance')}</th>
          </tr>
        </thead>
        <tbody>
          {#if entries.length === 0}
            <tr class="empty-row">
              <td colspan="7">
                <div class="empty-message">
                  <p>{$t('ledger.no_transactions')}</p>
                  <p class="text-muted">{$t('ledger.enter_first')}</p>
                </div>
              </td>
            </tr>
          {/if}
          
          {#each entries as entry (entry.entryId)}
            <tr class:split-parent={entry.isSplit}>
              <td class="col-date">{entry.date}</td>
              <td class="col-ref">{entry.reference ?? ''}</td>
              <td class="col-memo">{entry.memo ?? ''}</td>
              <td class="col-offset">
                {#if entry.isSplit}
                  <span class="split-indicator">[{$t('ledger.split')}]</span>
                {:else}
                  {entry.offsetAccountName ?? ''}
                {/if}
              </td>
              <td class="col-debit amount">
                {entry.amount > 0 ? formatAmount(entry.amount) : ''}
              </td>
              <td class="col-credit amount">
                {entry.amount < 0 ? formatAmount(Math.abs(entry.amount)) : ''}
              </td>
              <td class="col-balance amount">
                {formatAmount(entry.runningBalance)}
              </td>
            </tr>
            
            {#if entry.isSplit && entry.splitEntries}
              {#each entry.splitEntries as split (split.entryId)}
                <tr class="split-child">
                  <td></td>
                  <td></td>
                  <td class="split-note">{split.note ?? ''}</td>
                  <td class="split-account">↳ {split.accountName}</td>
                  <td class="col-debit amount">
                    {split.amount > 0 ? formatAmount(split.amount) : ''}
                  </td>
                  <td class="col-credit amount">
                    {split.amount < 0 ? formatAmount(Math.abs(split.amount)) : ''}
                  </td>
                  <td></td>
                </tr>
              {/each}
            {/if}
          {/each}
          
          <!-- New entry row -->
          <tr class="new-entry-row">
            <td class="col-date">
              <input 
                type="date" 
                bind:value={newEntry.date}
                class="input-date"
              />
            </td>
            <td class="col-ref">
              <input 
                type="text" 
                bind:value={newEntry.reference}
                placeholder=""
                class="input-ref"
              />
            </td>
            <td class="col-memo">
              <input 
                type="text" 
                bind:value={newEntry.memo}
                placeholder=""
                class="input-memo"
              />
            </td>
            <td class="col-offset autocomplete-container">
              <input 
                type="text" 
                bind:value={newEntry.offsetSearch}
                oninput={handleOffsetSearch}
                onkeydown={handleSearchKeydown}
                onfocus={() => handleOffsetSearch()}
                onblur={() => setTimeout(() => showAutocomplete = false, 200)}
                placeholder={$t('ledger.search_accounts')}
                class="input-offset"
              />
              {#if showAutocomplete}
                <div class="autocomplete-dropdown">
                  {#each searchResults as result, i (result.id)}
                    <button 
                      class="autocomplete-option"
                      class:selected={i === selectedSearchIndex}
                      onmousedown={() => selectAccount(result)}
                    >
                      {result.path}
                    </button>
                  {/each}
                </div>
              {/if}
            </td>
            <td class="col-debit">
              <input 
                type="text" 
                bind:value={newEntry.debit}
                onkeydown={handleAmountKeydown}
                placeholder=""
                class="input-amount"
                disabled={!!newEntry.credit}
              />
            </td>
            <td class="col-credit">
              <input 
                type="text" 
                bind:value={newEntry.credit}
                onkeydown={handleAmountKeydown}
                placeholder=""
                class="input-amount"
                disabled={!!newEntry.debit}
              />
            </td>
            <td class="col-balance"></td>
          </tr>
        </tbody>
      </table>
    {/if}
  </div>
</div>

<style>
  .ledger-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: var(--space-md);
  }
  
  .ledger-header {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    padding: var(--space-md) var(--space-lg);
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
  }
  
  .back-link {
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.875rem;
  }
  
  .back-link:hover {
    color: var(--accent-color);
  }
  
  .account-info {
    flex: 1;
  }
  
  .account-info h1 {
    margin: 0;
    font-size: 1.25rem;
  }
  
  .account-meta {
    font-size: 0.875rem;
    color: var(--text-muted);
  }
  
  .balance-display {
    text-align: right;
  }
  
  .balance-label {
    display: block;
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .balance-value {
    font-size: 1.5rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  
  .ledger-container {
    flex: 1;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    overflow: auto;
  }
  
  .ledger-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  
  .ledger-table th {
    position: sticky;
    top: 0;
    background: var(--bg-secondary);
    padding: var(--space-sm) var(--space-md);
    text-align: left;
    font-weight: 600;
    border-bottom: 1px solid var(--border-color);
    white-space: nowrap;
  }
  
  .ledger-table td {
    padding: var(--space-xs) var(--space-md);
    border-bottom: 1px solid var(--border-color);
    vertical-align: middle;
  }
  
  .col-date { width: 100px; }
  .col-ref { width: 80px; }
  .col-memo { min-width: 200px; }
  .col-offset { min-width: 180px; }
  .col-debit, .col-credit { width: 100px; text-align: right; }
  .col-balance { width: 120px; text-align: right; }
  
  .amount {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  
  .split-indicator {
    color: var(--text-muted);
    font-style: italic;
  }
  
  .split-child td {
    background: var(--bg-secondary);
    font-size: 0.8125rem;
  }
  
  .split-account {
    color: var(--text-secondary);
    padding-left: var(--space-lg) !important;
  }
  
  .split-note {
    color: var(--text-muted);
    font-style: italic;
  }
  
  .empty-row td {
    padding: var(--space-xl);
  }
  
  .empty-message {
    text-align: center;
  }
  
  .new-entry-row {
    background: var(--bg-secondary);
  }
  
  .new-entry-row input {
    width: 100%;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-primary);
    font-size: inherit;
    font-family: inherit;
  }
  
  .new-entry-row input:focus {
    outline: none;
    border-color: var(--accent-color);
  }
  
  .new-entry-row input:disabled {
    opacity: 0.5;
  }
  
  .input-amount {
    text-align: right;
  }
  
  .autocomplete-container {
    position: relative;
  }
  
  .autocomplete-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-lg);
    max-height: 200px;
    overflow-y: auto;
    z-index: 100;
  }
  
  .autocomplete-option {
    display: block;
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.8125rem;
  }
  
  .autocomplete-option:hover,
  .autocomplete-option.selected {
    background: var(--bg-secondary);
  }
  
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-xl);
    gap: var(--space-md);
  }
  
  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>


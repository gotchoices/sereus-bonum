<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  import { entities } from '$lib/stores/entities';
  import { accounts, accountGroups } from '$lib/stores/accounts';
  import { getDataService, type LedgerEntry, type Account, type Unit, type AccountGroup, type Entity } from '$lib/data';
  import AccountAutocomplete from '$lib/components/AccountAutocomplete.svelte';
  
  // Route param
  let accountId = $derived($page.params.accountId);
  
  // Account info
  let account: Account | null = $state(null);
  let unit: Unit | null = $state(null);
  let entity: Entity | null = $state(null);
  let accountGroup: AccountGroup | null = $state(null);
  
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
  
  // Split entry state
  let isSplitMode = $state(false);
  let splitEntries = $state<Array<{
    id: string;
    accountId: string;
    accountSearch: string;
    amount: string;
    note: string;
  }>>([]);
  
  // Initialize split entries with first empty row
  function initSplitMode() {
    isSplitMode = true;
    splitEntries = [
      {
        id: crypto.randomUUID(),
        accountId: newEntry.offsetAccountId || '',
        accountSearch: newEntry.offsetSearch || '',
        amount: newEntry.debit || newEntry.credit || '',
        note: '',
      }
    ];
  }
  
  // Add a new split entry
  function addSplitEntry() {
    // Calculate amount needed to balance
    const currentAccountAmount = newEntry.debit 
      ? parseFloat(newEntry.debit) * (unit?.displayDivisor ?? 100)
      : newEntry.credit
        ? -parseFloat(newEntry.credit) * (unit?.displayDivisor ?? 100)
        : 0;
    
    const splitTotal = splitEntries.reduce((sum, split) => {
      const amt = parseFloat(split.amount) || 0;
      return sum + (amt * (unit?.displayDivisor ?? 100));
    }, 0);
    
    const amountToBalance = -(currentAccountAmount + splitTotal);
    const displayAmount = Math.abs(amountToBalance / (unit?.displayDivisor ?? 100)).toFixed(2);
    
    splitEntries = [...splitEntries, {
      id: crypto.randomUUID(),
      accountId: '',
      accountSearch: '',
      amount: displayAmount,
      note: '',
    }];
  }
  
  // Remove a split entry
  function removeSplitEntry(id: string) {
    splitEntries = splitEntries.filter(e => e.id !== id);
    if (splitEntries.length === 0) {
      isSplitMode = false;
    }
  }
  
  // Calculate split balance
  function getSplitBalance(): number {
    const currentAccountAmount = newEntry.debit 
      ? parseFloat(newEntry.debit) * (unit?.displayDivisor ?? 100)
      : newEntry.credit
        ? -parseFloat(newEntry.credit) * (unit?.displayDivisor ?? 100)
        : 0;
    
    const splitTotal = splitEntries.reduce((sum, split) => {
      const amt = parseFloat(split.amount) || 0;
      return sum + (amt * (unit?.displayDivisor ?? 100));
    }, 0);
    
    return currentAccountAmount + splitTotal;
  }
  
  // Edit mode state
  let editingEntryId = $state<string | null>(null);
  
  // Account search results for autocomplete
  let searchResults: Array<{ id: string; name: string; path: string; code?: string }> = $state([]);
  let showAutocomplete = $state(false);
  let selectedSearchIndex = $state(0);
  
  // Split account autocomplete (per split row)
  let splitSearchResults = $state<Record<string, Array<{ id: string; name: string; path: string }>>>({});
  let showSplitAutocomplete = $state<Record<string, boolean>>({});
  
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
      
      // Get entity info
      entity = await ds.getEntity(account.entityId);
      
      // Get account group info
      accountGroup = await ds.getAccountGroup(account.accountGroupId);
      
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
  
  // Build full account path
  function getAccountPath(): string {
    if (!accountGroup) return account?.name ?? '';
    
    // Get account type name
    const typeName = accountGroup.accountType;
    const typeLabel = {
      'ASSET': 'Assets',
      'LIABILITY': 'Liabilities',
      'EQUITY': 'Equity',
      'INCOME': 'Income',
      'EXPENSE': 'Expenses',
    }[typeName] || typeName;
    
    // Build path: Type : Group : Account
    return `${typeLabel} : ${accountGroup.name} : ${account?.name ?? ''}`;
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
  
  // Handle split account search
  async function handleSplitAccountSearch(splitId: string, query: string) {
    if (!account || query.length < 1) {
      splitSearchResults[splitId] = [];
      showSplitAutocomplete[splitId] = false;
      return;
    }
    
    try {
      const ds = await getDataService();
      const results = await ds.searchAccounts(account.entityId, query);
      splitSearchResults = { ...splitSearchResults, [splitId]: results };
      showSplitAutocomplete = { ...showSplitAutocomplete, [splitId]: results.length > 0 };
    } catch (e) {
      log.ui.error('[Ledger] Split search error:', e);
    }
  }
  
  // Select split account from autocomplete
  function selectSplitAccount(splitId: string, result: { id: string; name: string; path: string }) {
    const split = splitEntries.find(s => s.id === splitId);
    if (split) {
      split.accountId = result.id;
      split.accountSearch = result.path;
      splitEntries = [...splitEntries];
    }
    showSplitAutocomplete = { ...showSplitAutocomplete, [splitId]: false };
  }
  
  // Handle keyboard in offset account input
  function handleSearchKeydown(e: KeyboardEvent) {
    // Ctrl+Enter toggles split mode
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      if (!isSplitMode) {
        initSplitMode();
      } else {
        cancelSplit();
      }
      return;
    }
    
    if (!showAutocomplete && e.key !== ':') return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedSearchIndex = Math.min(selectedSearchIndex + 1, searchResults.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedSearchIndex = Math.max(selectedSearchIndex - 1, 0);
        break;
      case ':':
        // Complete to end of current path element using TOP result (index 0)
        if (searchResults.length > 0) {
          e.preventDefault();
          const result = searchResults[0]; // Always use top filtered result
          const path = result.path;
          const currentInput = newEntry.offsetSearch;
          
          // Find how many colons we've already typed
          const colonsTyped = (currentInput.match(/:/g) || []).length;
          const pathParts = path.split(' : ');
          
          // Complete to the next colon position
          if (colonsTyped < pathParts.length - 1) {
            newEntry.offsetSearch = pathParts.slice(0, colonsTyped + 1).join(' : ') + ' : ';
            handleOffsetSearch();
          }
        }
        break;
      case 'Tab':
        // Complete to top result
        if (searchResults[selectedSearchIndex]) {
          e.preventDefault();
          selectAccount(searchResults[selectedSearchIndex]);
        }
        break;
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
  
  // Save new entry (simple mode)
  async function saveEntry() {
    if (!account || isSplitMode) return;
    
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
      resetForm();
      await loadData();
      log.ui.info('[Ledger] Entry saved');
    } catch (e) {
      log.ui.error('[Ledger] Save error:', e);
    }
  }
  
  // Save split entry (multi-line mode)
  async function saveSplitEntry() {
    if (!account) return;
    
    // Validate all splits have accounts
    const invalidSplits = splitEntries.filter(s => !s.accountId && !s.accountSearch);
    if (invalidSplits.length > 0) {
      log.ui.warn('[Ledger] All splits must have an account selected');
      return;
    }
    
    // Check if balanced
    if (Math.abs(getSplitBalance()) >= 1) {
      log.ui.warn('[Ledger] Split transaction must balance to zero');
      return;
    }
    
    const currentAccountAmount = newEntry.debit 
      ? parseFloat(newEntry.debit) * (unit?.displayDivisor ?? 100)
      : newEntry.credit
        ? -parseFloat(newEntry.credit) * (unit?.displayDivisor ?? 100)
        : 0;
    
    try {
      const ds = await getDataService();
      
      // Build entries array: current account + all splits
      const entries = [
        { transactionId: '', accountId: accountId, amount: currentAccountAmount, note: undefined }
      ];
      
      for (const split of splitEntries) {
        const splitAmount = parseFloat(split.amount) * (unit?.displayDivisor ?? 100);
        entries.push({
          transactionId: '',
          accountId: split.accountId,
          amount: -splitAmount, // Opposite sign from current account
          note: split.note || undefined,
        });
      }
      
      await ds.createTransaction(
        {
          entityId: account.entityId,
          date: newEntry.date,
          memo: newEntry.memo || undefined,
          reference: newEntry.reference || undefined,
        },
        entries
      );
      
      // Reset form and reload
      resetForm();
      await loadData();
      log.ui.info('[Ledger] Split entry saved');
    } catch (e) {
      log.ui.error('[Ledger] Split save error:', e);
    }
  }
  
  // Cancel split mode
  function cancelSplit() {
    isSplitMode = false;
    splitEntries = [];
  }
  
  // Reset entry form
  function resetForm() {
    newEntry = {
      date: new Date().toISOString().split('T')[0],
      reference: '',
      memo: '',
      offsetAccountId: '',
      offsetSearch: '',
      debit: '',
      credit: '',
    };
    isSplitMode = false;
    splitEntries = [];
  }
  
  // Handle Enter/Tab key on amount fields
  function handleAmountKeydown(e: KeyboardEvent) {
    // Simple mode: Enter or Tab saves and moves to next transaction
    if (!isSplitMode) {
      if (e.key === 'Enter' && (newEntry.debit || newEntry.credit)) {
        e.preventDefault();
        saveEntry();
        return;
      }
      
      // Tab in either Debit or Credit field saves and focuses date input
      if (e.key === 'Tab' && !e.shiftKey && (newEntry.debit || newEntry.credit)) {
        e.preventDefault();
        saveEntry().then(() => {
          // Focus date input for next entry
          setTimeout(() => {
            const dateInput = document.querySelector('.new-entry-row .input-date') as HTMLInputElement;
            if (dateInput) dateInput.focus();
          }, 50);
        });
      }
      return;
    }
    
    // Split mode: Tab from amount goes to first split's Note field
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      setTimeout(() => {
        const firstSplitNote = document.querySelector('.split-entry-row .input-split-note') as HTMLInputElement;
        if (firstSplitNote) {
          firstSplitNote.focus();
        }
      }, 50);
    }
    
    // Enter saves the split transaction
    if (e.key === 'Enter') {
      e.preventDefault();
      saveSplitEntry();
    }
  }
  
  // Handle keyboard on split button
  function handleSplitButtonKeydown(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!isSplitMode) {
        initSplitMode();
      } else {
        cancelSplit();
      }
    }
  }
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
        {#if entity}
          <div class="entity-breadcrumb">
            {entity.name} › {getAccountPath()}
          </div>
        {/if}
        <div class="account-details">
          <span class="account-code">{account.code || ''}</span>
          <span class="account-unit">{unit?.symbol ?? account.unit}</span>
        </div>
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
            <tr 
              class:split-parent={entry.isSplit}
              class:clickable={true}
              onclick={() => {
                // TODO: Implement full edit mode
                log.ui.info('[Ledger] Click to edit:', entry.entryId);
                editingEntryId = entry.entryId;
              }}
              title="Click to edit (coming soon)"
            >
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
                  <td class="split-account">
                    ↳ <a 
                      href="/ledger/{split.accountId}" 
                      class="split-account-link"
                      title={split.accountPath}
                    >
                      {split.accountName}
                    </a>
                  </td>
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
              <div class="offset-input-wrapper">
                {#if isSplitMode}
                  <input 
                    type="text"
                    value={account?.name || ''}
                    disabled
                    placeholder=""
                    class="input-offset"
                  />
                {:else}
                  <AccountAutocomplete
                    entityId={account?.entityId || ''}
                    bind:value={newEntry.offsetSearch}
                    bind:selectedId={newEntry.offsetAccountId}
                    placeholder={$t('ledger.search_accounts')}
                    disabled={false}
                    onselect={(result) => {
                      log.ui.debug('[Ledger] Account selected:', result.path);
                    }}
                  />
                {/if}
                <button 
                  class="split-button"
                  onclick={() => {
                    if (!isSplitMode) {
                      initSplitMode();
                    } else {
                      isSplitMode = false;
                      splitEntries = [];
                    }
                  }}
                  onkeydown={handleSplitButtonKeydown}
                  class:active={isSplitMode}
                  disabled={!!newEntry.offsetAccountId}
                  title={newEntry.offsetAccountId ? "Clear account first" : "Add split (Ctrl+Enter / Space)"}
                  type="button"
                  tabindex={newEntry.offsetAccountId ? -1 : 0}
                >
                  |
                </button>
              </div>
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
          
          <!-- Split entry rows (when in split mode) -->
          {#if isSplitMode}
            <tr class="split-mode-header">
              <td colspan="7">
                <div class="split-mode-indicator">
                  Split Transaction Entry - Balance: {formatAmount(getSplitBalance())}
                  {#if Math.abs(getSplitBalance()) < 1}
                    <span class="balanced">✓</span>
                  {:else}
                    <span class="imbalanced">⚠ Imbalanced</span>
                  {/if}
                </div>
              </td>
            </tr>
            
            <!-- Current account row (read-only) -->
            <tr class="split-current-account">
              <td></td>
              <td></td>
              <td class="col-note"></td>
              <td class="col-offset current-account-name">{account?.name || ''}</td>
              <td class="col-debit" colspan="2">
                <span class="current-account-amount">
                  {#if newEntry.debit}
                    {newEntry.debit} DR
                  {:else if newEntry.credit}
                    {newEntry.credit} CR
                  {/if}
                </span>
              </td>
              <td></td>
            </tr>
            
            {#each splitEntries as split, i (split.id)}
              <tr class="split-entry-row">
                <td></td>
                <td></td>
                <td class="col-note">
                  <input 
                    type="text" 
                    bind:value={split.note}
                    placeholder={$t('ledger.note')}
                    class="input-split-note"
                  />
                </td>
                <td class="col-offset">
                  <AccountAutocomplete
                    entityId={account?.entityId || ''}
                    bind:value={split.accountSearch}
                    bind:selectedId={split.accountId}
                    placeholder={$t('ledger.search_accounts')}
                    disabled={false}
                    onselect={(result) => {
                      log.ui.debug('[Ledger] Split account selected:', result.path);
                      // Force reactivity update
                      splitEntries = [...splitEntries];
                    }}
                  />
                </td>
                <td class="col-debit" colspan="2">
                  <input 
                    type="text" 
                    bind:value={split.amount}
                    onkeydown={(e) => {
                      // If this is the last split and user presses Tab, go to date of next entry
                      if (e.key === 'Tab' && !e.shiftKey && i === splitEntries.length - 1) {
                        e.preventDefault();
                        setTimeout(() => {
                          const dateInput = document.querySelector('.new-entry-row .input-date') as HTMLInputElement;
                          if (dateInput) dateInput.focus();
                        }, 50);
                      }
                      // Enter saves split transaction
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveSplitEntry();
                      }
                    }}
                    placeholder={$t('ledger.amount_to_balance')}
                    class="input-amount"
                  />
                </td>
                <td class="col-actions">
                  <button 
                    class="btn-remove-split"
                    onclick={() => removeSplitEntry(split.id)}
                    title={$t('ledger.remove_split')}
                    type="button"
                  >
                    ×
                  </button>
                </td>
              </tr>
            {/each}
            
            <tr class="split-actions-row">
              <td colspan="7">
                <div class="split-actions">
                  <button class="btn-add-split" onclick={addSplitEntry} type="button">
                    + {$t('ledger.add_split')}
                  </button>
                  <button class="btn-save-split" onclick={saveSplitEntry} type="button">
                    {$t('ledger.save')}
                  </button>
                  <button class="btn-cancel-split" onclick={cancelSplit} type="button">
                    {$t('ledger.cancel')}
                  </button>
                </div>
              </td>
            </tr>
          {/if}
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
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }
  
  .entity-breadcrumb {
    font-size: 0.95rem;
    color: var(--text-primary);
    line-height: 1.4;
  }
  
  .account-details {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 0.8125rem;
    color: var(--text-muted);
  }
  
  .account-code {
    font-family: var(--font-mono);
  }
  
  .account-unit {
    font-weight: 500;
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
  
  .ledger-table tr.clickable {
    cursor: pointer;
    transition: background-color 0.15s;
  }
  
  .ledger-table tr.clickable:hover {
    background: var(--bg-hover);
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
  
  .split-account-link {
    color: var(--text-secondary);
    text-decoration: none;
  }
  
  .split-account-link:hover {
    color: var(--accent-color);
    text-decoration: underline;
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
  
  .offset-input-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .split-button {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    color: var(--text-muted);
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  
  .split-button:hover {
    background: var(--bg-hover);
    border-color: var(--accent-color);
    color: var(--accent-color);
  }
  
  .split-button:active {
    transform: scale(0.95);
  }
  
  .split-button.active {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
  }
  
  .split-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  
  .split-button:disabled:hover {
    background: var(--bg-secondary);
    border-color: var(--border-color);
    color: var(--text-muted);
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
  
  /* Split mode styles */
  .split-mode-header td {
    background: var(--bg-secondary);
    padding: var(--space-sm) var(--space-md);
    border-top: 2px solid var(--accent-color);
  }
  
  .split-mode-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .split-mode-indicator .balanced {
    color: var(--success);
  }
  
  .split-mode-indicator .imbalanced {
    color: var(--warning);
  }
  
  .split-current-account {
    background: var(--bg-secondary);
    font-weight: 500;
  }
  
  .split-current-account td {
    background: var(--bg-secondary);
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--border-light);
  }
  
  .current-account-name {
    color: var(--text-primary);
    font-style: italic;
  }
  
  .current-account-amount {
    display: block;
    text-align: right;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }
  
  .split-entry-row {
    background: var(--bg-secondary);
  }
  
  .split-entry-row td {
    background: var(--bg-secondary);
  }
  
  .split-entry-row input {
    width: 100%;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-primary);
    font-size: inherit;
  }
  
  .split-entry-row input:focus {
    outline: none;
    border-color: var(--accent-color);
  }
  
  .btn-remove-split {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--danger);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--danger);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
  }
  
  .btn-remove-split:hover {
    background: var(--danger);
    color: white;
  }
  
  .split-actions-row td {
    background: var(--bg-secondary);
    border-bottom: 2px solid var(--accent-color);
  }
  
  .split-actions {
    display: flex;
    gap: var(--space-sm);
    padding: var(--space-sm) 0;
  }
  
  .btn-add-split,
  .btn-save-split,
  .btn-cancel-split {
    padding: var(--space-xs) var(--space-md);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    cursor: pointer;
  }
  
  .btn-add-split {
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  
  .btn-add-split:hover {
    background: var(--bg-hover);
    border-color: var(--accent-color);
  }
  
  .btn-save-split {
    background: var(--accent-color);
    color: white;
    border-color: var(--accent-color);
  }
  
  .btn-save-split:hover {
    opacity: 0.9;
  }
  
  .btn-cancel-split {
    background: transparent;
    color: var(--text-secondary);
  }
  
  .btn-cancel-split:hover {
    background: var(--bg-hover);
  }
  
  .clickable {
    cursor: pointer;
  }
</style>


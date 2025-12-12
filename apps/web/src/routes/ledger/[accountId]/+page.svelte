<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  import { entities } from '$lib/stores/entities';
  import { accounts, accountGroups } from '$lib/stores/accounts';
  import { createViewStateStore } from '$lib/stores/viewState';
  import { getDataService, type LedgerEntry, type Account, type Unit, type AccountGroup, type Entity, type Transaction, type Entry } from '$lib/data';
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
  
  // View state persistence (expand/collapse, closed period)
  interface LedgerViewState {
    expandedTransactions: Record<string, boolean>;
    expandAll: boolean;
    closedDate?: string; // Transactions before this date are locked
  }
  
  const viewState = createViewStateStore<LedgerViewState>('ledger', {
    expandedTransactions: {},
    expandAll: false,
  });
  
  let closedDate = $derived($viewState.closedDate);
  
  // Transaction grouping (derived from entries)
  interface TransactionGroup {
    transactionId: string;
    date: string;
    reference?: string;
    memo?: string;
    entries: LedgerEntry[];
    isLocked: boolean;
    isExpanded: boolean;
  }
  
  let transactions = $derived.by(() => {
    const txnMap = new Map<string, TransactionGroup>();
    
    for (const entry of entries) {
      if (!txnMap.has(entry.transactionId)) {
        const isLocked = closedDate ? entry.date < closedDate : false;
        const isExpanded = $viewState.expandAll || $viewState.expandedTransactions[entry.transactionId] || false;
        
        txnMap.set(entry.transactionId, {
          transactionId: entry.transactionId,
          date: entry.date,
          reference: entry.reference,
          memo: entry.memo,
          entries: [entry],
          isLocked,
          isExpanded,
        });
      } else {
        txnMap.get(entry.transactionId)!.entries.push(entry);
      }
    }
    
    return Array.from(txnMap.values());
  });
  
  // Check if we have any locked transactions
  let hasLockedTransactions = $derived(transactions.some(t => t.isLocked));
  let firstUnlockedIndex = $derived(transactions.findIndex(t => !t.isLocked));
  
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
    debit: string;
    credit: string;
    note: string;
  }>>([]);
  
  // Edit mode state
  let editingTransactionId = $state<string | null>(null);
  let editingData = $state<{
    date: string;
    reference: string;
    memo: string;
    entries: Array<{
      id: string;
      accountId: string;
      accountSearch: string;
      debit: string;
      credit: string;
      note: string;
    }>;
  } | null>(null);
  
  // Initialize split entries with first empty row
  function initSplitMode() {
    isSplitMode = true;
    
    // Pre-fill main transaction line with current account (read-only)
    newEntry.offsetAccountId = accountId;
    newEntry.offsetSearch = account?.name ?? '';
    
    // Initialize with one empty split entry (will be auto-balanced)
    splitEntries = [
      {
        id: crypto.randomUUID(),
        accountId: '',
        accountSearch: '',
        debit: '',
        credit: '',
        note: '',
      }
    ];
    
    log.ui.debug('[Ledger] Initialized split mode');
  }
  
  // Add a new split entry
  function addSplitEntry() {
    splitEntries = [
      ...splitEntries,
      {
        id: crypto.randomUUID(),
        accountId: '',
        accountSearch: '',
        debit: '',
        credit: '',
        note: '',
      }
    ];
    log.ui.debug('[Ledger] Added split entry, total:', splitEntries.length);
  }
  
  // Remove a split entry
  function removeSplitEntry(id: string) {
    splitEntries = splitEntries.filter(s => s.id !== id);
    if (splitEntries.length === 0) {
      addSplitEntry(); // Always keep at least one
    }
    log.ui.debug('[Ledger] Removed split entry, remaining:', splitEntries.length);
  }
  
  // Calculate split balance
  function getSplitBalance(): number {
    const divisor = unit?.displayDivisor ?? 100;
    
    // Main entry amount
    const mainDebit = newEntry.debit ? parseFloat(newEntry.debit) : 0;
    const mainCredit = newEntry.credit ? parseFloat(newEntry.credit) : 0;
    const mainAmount = mainDebit || -mainCredit;
    
    // Split entries sum
    const splitsSum = splitEntries.reduce((sum, split) => {
      const debit = split.debit ? parseFloat(split.debit) : 0;
      const credit = split.credit ? parseFloat(split.credit) : 0;
      return sum + (debit || -credit);
    }, 0);
    
    return (mainAmount + splitsSum) * divisor;
  }
  
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
  
  // Toggle transaction expand/collapse
  function toggleExpand(transactionId: string) {
    const current = $viewState.expandedTransactions[transactionId] || false;
    viewState.update(state => ({
      ...state,
      expandedTransactions: {
        ...state.expandedTransactions,
        [transactionId]: !current,
      },
    }));
  }
  
  // Expand/Collapse All
  function expandAll() {
    viewState.update(state => ({ ...state, expandAll: true }));
  }
  
  function collapseAll() {
    viewState.update(state => ({ ...state, expandAll: false, expandedTransactions: {} }));
  }
  
  // Enter edit mode for existing transaction
  function enterEditMode(txn: TransactionGroup) {
    if (txn.isLocked) {
      log.ui.warn('[Ledger] Cannot edit locked transaction:', txn.transactionId);
      return;
    }
    
    log.ui.info('[Ledger] Entering edit mode for transaction:', txn.transactionId);
    editingTransactionId = txn.transactionId;
    
    // Load transaction data into edit form
    const mainEntry = txn.entries.find(e => e.accountId === accountId);
    const otherEntries = txn.entries.filter(e => e.accountId !== accountId);
    
    if (!mainEntry) {
      log.ui.error('[Ledger] No entry found for current account in transaction');
      return;
    }
    
    editingData = {
      date: txn.date,
      reference: txn.reference || '',
      memo: txn.memo || '',
      entries: otherEntries.map(e => ({
        id: e.entryId,
        accountId: e.offsetAccountId || e.accountId,
        accountSearch: e.offsetAccountName || '',
        debit: e.amount > 0 ? formatAmount(e.amount) : '',
        credit: e.amount < 0 ? formatAmount(Math.abs(e.amount)) : '',
        note: e.note || '',
      })),
    };
    
    // If it's a split (3+ entries), show as split mode in editor
    if (txn.entries.length > 2) {
      // Initialize split data (handled by editingData.entries)
    }
  }
  
  // Exit edit mode
  function cancelEdit() {
    log.ui.info('[Ledger] Canceling edit mode');
    editingTransactionId = null;
    editingData = null;
  }
  
  // Save edited transaction
  async function saveEdit() {
    if (!editingTransactionId || !editingData) return;
    
    log.ui.info('[Ledger] Saving edited transaction:', editingTransactionId);
    
    // TODO: Implement update transaction via DataService
    // For now, just log and exit edit mode
    log.ui.warn('[Ledger] Update transaction not yet implemented');
    
    cancelEdit();
    await loadData(); // Reload
  }
  
  // Delete transaction (with confirmation)
  async function deleteTransaction(txn: TransactionGroup) {
    if (txn.isLocked) {
      log.ui.warn('[Ledger] Cannot delete locked transaction:', txn.transactionId);
      return;
    }
    
    const confirmed = confirm($t('ledger.confirm_delete'));
    if (!confirmed) return;
    
    log.ui.info('[Ledger] Deleting transaction:', txn.transactionId);
    
    try {
      const ds = await getDataService();
      await ds.deleteTransaction(txn.transactionId);
      await loadData(); // Reload ledger
      log.ui.info('[Ledger] Transaction deleted successfully');
    } catch (e) {
      log.ui.error('[Ledger] Delete failed:', e);
      alert($t('common.error') + ': ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  }
  
  // Global keyboard handler for Ctrl+Enter
  function handlePageKeydown(e: KeyboardEvent) {
    // Escape key cancels edit or split mode
    if (e.key === 'Escape') {
      if (editingTransactionId) {
        e.preventDefault();
        cancelEdit();
      } else if (isSplitMode) {
        e.preventDefault();
        cancelSplit();
      }
      return;
    }
    
    // Ctrl+Enter toggles split mode (only in new entry, not edit mode)
    if (e.key === 'Enter' && e.ctrlKey && !editingTransactionId) {
      e.preventDefault();
      if (!isSplitMode && !newEntry.offsetAccountId) {
        initSplitMode();
      } else if (isSplitMode) {
        cancelSplit();
      }
    }
  }
  
  // Save new entry (simple mode)
  async function saveNewEntry() {
    log.ui.debug('[Ledger] Saving new simple entry');
    
    const divisor = unit?.displayDivisor ?? 100;
    const debitValue = newEntry.debit ? parseFloat(newEntry.debit) * divisor : 0;
    const creditValue = newEntry.credit ? parseFloat(newEntry.credit) * divisor : 0;
    
    if (!newEntry.date || !newEntry.offsetAccountId || (!debitValue && !creditValue)) {
      log.ui.warn('[Ledger] Validation failed', { date: newEntry.date, offsetAccountId: newEntry.offsetAccountId, debit: debitValue, credit: creditValue });
      return;
    }
    
    try {
      const ds = await getDataService();
      
      // Create transaction with two entries
      const txnData = {
        entityId: account!.entityId,
        date: newEntry.date,
        reference: newEntry.reference || undefined,
        memo: newEntry.memo || undefined,
      };
      
      const entriesData = [
        {
          accountId: accountId,
          amount: debitValue || -creditValue,
          note: undefined,
        },
        {
          accountId: newEntry.offsetAccountId,
          amount: -debitValue || creditValue,
          note: undefined,
        },
      ];
      
      await ds.createTransaction(txnData, entriesData);
      log.ui.info('[Ledger] Transaction created');
      
      // Reset form and reload
      resetForm();
      await loadData();
      
      // Focus on date field for next entry
      setTimeout(() => {
        document.querySelector<HTMLInputElement>('.new-entry-row input[type="date"]')?.focus();
      }, 100);
    } catch (e) {
      log.ui.error('[Ledger] Save failed:', e);
      alert($t('common.error') + ': ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  }
  
  // Save split entry (multi-line mode)
  async function saveSplitEntry() {
    log.ui.debug('[Ledger] Saving split entry');
    
    const divisor = unit?.displayDivisor ?? 100;
    const mainDebit = newEntry.debit ? parseFloat(newEntry.debit) * divisor : 0;
    const mainCredit = newEntry.credit ? parseFloat(newEntry.credit) * divisor : 0;
    const mainAmount = mainDebit || -mainCredit;
    
    // Validate main entry
    if (!newEntry.date || !mainAmount) {
      log.ui.warn('[Ledger] Split validation failed: main entry incomplete');
      return;
    }
    
    // Validate splits
    const validSplits = splitEntries.filter(s => {
      const hasAccount = !!s.accountId;
      const hasAmount = !!(s.debit || s.credit);
      return hasAccount && hasAmount;
    });
    
    if (validSplits.length === 0) {
      log.ui.warn('[Ledger] Split validation failed: no valid splits');
      return;
    }
    
    // Check balance
    const balance = getSplitBalance();
    if (Math.abs(balance) > 1) { // Allow $0.01 tolerance
      log.ui.warn('[Ledger] Split validation failed: imbalanced by', balance / divisor);
      alert($t('ledger.transaction_must_balance'));
      return;
    }
    
    try {
      const ds = await getDataService();
      
      // Create transaction
      const txnData = {
        entityId: account!.entityId,
        date: newEntry.date,
        reference: newEntry.reference || undefined,
        memo: newEntry.memo || undefined,
      };
      
      // Build entries array
      const entriesData = [
        // Main entry (current account)
        {
          accountId: accountId,
          amount: mainAmount,
          note: undefined,
        },
        // Split entries
        ...validSplits.map(split => {
          const debit = split.debit ? parseFloat(split.debit) * divisor : 0;
          const credit = split.credit ? parseFloat(split.credit) * divisor : 0;
          return {
            accountId: split.accountId,
            amount: debit || -credit,
            note: split.note || undefined,
          };
        }),
      ];
      
      await ds.createTransaction(txnData, entriesData);
      log.ui.info('[Ledger] Split transaction created');
      
      // Reset and reload
      cancelSplit();
      await loadData();
      
      // Focus on date field
      setTimeout(() => {
        document.querySelector<HTMLInputElement>('.new-entry-row input[type="date"]')?.focus();
      }, 100);
    } catch (e) {
      log.ui.error('[Ledger] Split save failed:', e);
      alert($t('common.error') + ': ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  }
  
  // Cancel split mode
  function cancelSplit() {
    isSplitMode = false;
    splitEntries = [];
    resetForm();
    log.ui.debug('[Ledger] Canceled split mode');
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
    log.ui.debug('[Ledger] Form reset');
  }
  
  // Handle Enter/Tab key on amount fields
  function handleAmountKeydown(e: KeyboardEvent) {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      saveNewEntry();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      saveNewEntry();
    }
  }
  
  // Handle keyboard on split button
  function handleSplitButtonKeydown(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      initSplitMode();
    }
  }
  
  // Auto-select text on focus (per spec: all fields)
  function handleFocus(e: FocusEvent) {
    const target = e.target as HTMLInputElement;
    if (target && target.select) {
      setTimeout(() => target.select(), 0);
    }
  }
  
  // Handle blur on Debit/Credit: clear the other field if this one has value
  function handleDebitBlur() {
    if (newEntry.debit) {
      newEntry.credit = '';
    }
  }
  
  function handleCreditBlur() {
    if (newEntry.credit) {
      newEntry.debit = '';
    }
  }
  
  // Handle blur on split Debit/Credit
  function handleSplitDebitBlur(splitId: string) {
    const split = splitEntries.find(s => s.id === splitId);
    if (split && split.debit) {
      split.credit = '';
    }
  }
  
  function handleSplitCreditBlur(splitId: string) {
    const split = splitEntries.find(s => s.id === splitId);
    if (split && split.credit) {
      split.debit = '';
    }
  }
</script>

<div class="ledger-page" onkeydown={handlePageKeydown}>
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
  
  <!-- Toolbar: Expand/Collapse -->
  {#if transactions.length > 0}
    <div class="ledger-toolbar">
      <div class="toolbar-left">
        <button class="btn-icon" onclick={expandAll} title={$t('ledger.expand_all')}>
          ▼ {$t('ledger.expand_all')}
        </button>
        <button class="btn-icon" onclick={collapseAll} title={$t('ledger.collapse_all')}>
          ▶ {$t('ledger.collapse_all')}
        </button>
      </div>
    </div>
  {/if}
  
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
            <th class="col-expand"></th>
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
          {#if transactions.length === 0}
            <tr class="empty-row">
              <td colspan="8">
                <div class="empty-message">
                  <p>{$t('ledger.no_transactions')}</p>
                  <p class="text-muted">{$t('ledger.enter_first')}</p>
                </div>
              </td>
            </tr>
          {/if}
          
          {#each transactions as txn, idx (txn.transactionId)}
            <!-- Locked transaction separator -->
            {#if hasLockedTransactions && idx === firstUnlockedIndex}
              <tr class="locked-separator">
                <td colspan="8">
                  <div class="separator-line">
                    <span class="lock-icon">🔒</span>
                  </div>
                </td>
              </tr>
            {/if}
            
            <!-- Transaction in edit mode -->
            {#if editingTransactionId === txn.transactionId && editingData}
              <tr class="transaction-edit-mode">
                <td colspan="8">
                  <div class="edit-container">
                    <div class="edit-header">
                      <span class="edit-label">✏️ {$t('ledger.editing_transaction')}</span>
                    </div>
                    
                    <!-- TODO: Render full transaction editor here -->
                    <div class="edit-placeholder">
                      <p>Edit mode UI coming soon</p>
                      <div class="edit-actions">
                        <button class="btn-primary" onclick={saveEdit}>{$t('common.save')}</button>
                        <button class="btn-secondary" onclick={cancelEdit}>{$t('common.cancel')}</button>
                        <button class="btn-danger" onclick={() => deleteTransaction(txn)}>{$t('common.delete')}</button>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            {:else}
              <!-- Transaction header (collapsed or expanded) -->
              {#if txn.isExpanded && txn.entries.length > 1}
                <!-- Expanded: Show transaction header + all entries -->
                <tr 
                  class="transaction-header"
                  class:locked={txn.isLocked}
                  class:clickable={!txn.isLocked}
                  onclick={() => !txn.isLocked && enterEditMode(txn)}
                >
                  <td class="col-expand">
                    <button 
                      class="expand-btn" 
                      onclick={(e) => { e.stopPropagation(); toggleExpand(txn.transactionId); }}
                      aria-label={$t('ledger.collapse')}
                    >
                      ▼
                    </button>
                  </td>
                  <td class="col-date">{txn.date}</td>
                  <td class="col-ref">{txn.reference ?? ''}</td>
                  <td class="col-memo">{txn.memo ?? ''}</td>
                  <td class="col-offset">
                    <span class="split-indicator">[{$t('ledger.split')}]</span>
                  </td>
                  <td class="col-debit amount"></td>
                  <td class="col-credit amount"></td>
                  <td class="col-balance amount">
                    {#if txn.entries[0]}
                      {formatAmount(txn.entries[0].runningBalance)}
                    {/if}
                  </td>
                </tr>
                
                <!-- Entry lines -->
                {#each txn.entries as entry (entry.entryId)}
                  <tr class="entry-line" class:locked={txn.isLocked}>
                    <td class="col-expand"></td>
                    <td class="col-date"></td>
                    <td class="col-ref"></td>
                    <td class="col-memo">{entry.note ?? ''}</td>
                    <td class="col-offset">
                      {#if entry.offsetAccountName}
                        <a href="/ledger/{entry.offsetAccountId}" title={entry.offsetAccountName}>
                          {entry.offsetAccountName}
                        </a>
                      {/if}
                    </td>
                    <td class="col-debit amount">
                      {entry.amount > 0 ? formatAmount(entry.amount) : ''}
                    </td>
                    <td class="col-credit amount">
                      {entry.amount < 0 ? formatAmount(Math.abs(entry.amount)) : ''}
                    </td>
                    <td class="col-balance amount"></td>
                  </tr>
                {/each}
              {:else}
                <!-- Collapsed: Single line for entire transaction -->
                <tr 
                  class="transaction-line"
                  class:locked={txn.isLocked}
                  class:clickable={!txn.isLocked}
                  onclick={() => !txn.isLocked && enterEditMode(txn)}
                >
                  <td class="col-expand">
                    {#if txn.entries.length > 1}
                      <button 
                        class="expand-btn" 
                        onclick={(e) => { e.stopPropagation(); toggleExpand(txn.transactionId); }}
                        aria-label={$t('ledger.expand')}
                      >
                        ▶
                      </button>
                    {/if}
                  </td>
                  <td class="col-date">{txn.date}</td>
                  <td class="col-ref">{txn.reference ?? ''}</td>
                  <td class="col-memo">{txn.memo ?? ''}</td>
                  <td class="col-offset">
                    {#if txn.entries.length > 2}
                      <span class="split-indicator">[{$t('ledger.split')}]</span>
                    {:else if txn.entries[0]?.offsetAccountName}
                      <a href="/ledger/{txn.entries[0].offsetAccountId}" title={txn.entries[0].offsetAccountName}>
                        {txn.entries[0].offsetAccountName}
                      </a>
                    {/if}
                  </td>
                  <td class="col-debit amount">
                    {#if txn.entries[0]}
                      {txn.entries[0].amount > 0 ? formatAmount(txn.entries[0].amount) : ''}
                    {/if}
                  </td>
                  <td class="col-credit amount">
                    {#if txn.entries[0]}
                      {txn.entries[0].amount < 0 ? formatAmount(Math.abs(txn.entries[0].amount)) : ''}
                    {/if}
                  </td>
                  <td class="col-balance amount">
                    {#if txn.entries[0]}
                      {formatAmount(txn.entries[0].runningBalance)}
                    {/if}
                  </td>
                </tr>
              {/if}
            {/if}
          {/each}
          
          <!-- New Entry Row (Simple Mode) -->
          {#if !isSplitMode}
            <tr class="new-entry-row">
              <td class="col-expand"></td>
              <td class="col-date">
                <input 
                  type="date" 
                  bind:value={newEntry.date}
                  onfocus={handleFocus}
                />
              </td>
              <td class="col-ref">
                <input 
                  type="text" 
                  bind:value={newEntry.reference}
                  placeholder={$t('ledger.ref')}
                  onfocus={handleFocus}
                />
              </td>
              <td class="col-memo">
                <input 
                  type="text" 
                  bind:value={newEntry.memo}
                  placeholder={$t('ledger.memo')}
                  onfocus={handleFocus}
                />
              </td>
              <td class="col-offset">
                <div class="offset-input-wrapper">
                  <AccountAutocomplete
                    entityId={account?.entityId ?? ''}
                    bind:search={newEntry.offsetSearch}
                    bind:selectedId={newEntry.offsetAccountId}
                    disabled={false}
                    onfocus={handleFocus}
                  />
                  <button 
                    class="split-btn" 
                    onclick={initSplitMode}
                    onkeydown={handleSplitButtonKeydown}
                    disabled={!!newEntry.offsetAccountId}
                    title={$t('ledger.split_transaction')}
                    aria-label={$t('ledger.split_transaction')}
                  >
                    |
                  </button>
                </div>
              </td>
              <td class="col-debit">
                <input 
                  type="number" 
                  step="0.01" 
                  bind:value={newEntry.debit}
                  placeholder="0.00"
                  onblur={handleDebitBlur}
                  onkeydown={handleAmountKeydown}
                  onfocus={handleFocus}
                />
              </td>
              <td class="col-credit">
                <input 
                  type="number" 
                  step="0.01" 
                  bind:value={newEntry.credit}
                  placeholder="0.00"
                  onblur={handleCreditBlur}
                  onkeydown={handleAmountKeydown}
                  onfocus={handleFocus}
                />
              </td>
              <td class="col-balance"></td>
            </tr>
          {/if}
          
          <!-- New Entry (Split Mode) -->
          {#if isSplitMode}
            <!-- Main transaction line -->
            <tr class="new-entry-row split-main">
              <td class="col-expand"></td>
              <td class="col-date">
                <input 
                  type="date" 
                  bind:value={newEntry.date}
                  onfocus={handleFocus}
                />
              </td>
              <td class="col-ref">
                <input 
                  type="text" 
                  bind:value={newEntry.reference}
                  placeholder={$t('ledger.ref')}
                  onfocus={handleFocus}
                />
              </td>
              <td class="col-memo">
                <input 
                  type="text" 
                  bind:value={newEntry.memo}
                  placeholder={$t('ledger.memo')}
                  onfocus={handleFocus}
                />
              </td>
              <td class="col-offset">
                <input 
                  type="text" 
                  value={account?.name ?? ''}
                  disabled
                  class="current-account-disabled"
                />
              </td>
              <td class="col-debit">
                <input 
                  type="number" 
                  step="0.01" 
                  bind:value={newEntry.debit}
                  placeholder="0.00"
                  onblur={handleDebitBlur}
                  onfocus={handleFocus}
                />
              </td>
              <td class="col-credit">
                <input 
                  type="number" 
                  step="0.01" 
                  bind:value={newEntry.credit}
                  placeholder="0.00"
                  onblur={handleCreditBlur}
                  onfocus={handleFocus}
                />
              </td>
              <td class="col-balance"></td>
            </tr>
            
            <!-- Split entry lines -->
            {#each splitEntries as split, idx (split.id)}
              {@const balance = getSplitBalance()}
              {@const divisor = unit?.displayDivisor ?? 100}
              {@const autoFillAmount = idx === splitEntries.length - 1 && !split.debit && !split.credit ? formatAmount(-balance) : ''}
              {@const isDebit = balance < 0}
              
              <tr class="new-entry-row split-entry">
                <td class="col-expand"></td>
                <td class="col-date"></td>
                <td class="col-ref"></td>
                <td class="col-memo">
                  <input 
                    type="text" 
                    bind:value={split.note}
                    placeholder={$t('ledger.note')}
                    onfocus={handleFocus}
                  />
                </td>
                <td class="col-offset">
                  <AccountAutocomplete
                    entityId={account?.entityId ?? ''}
                    bind:search={split.accountSearch}
                    bind:selectedId={split.accountId}
                    disabled={false}
                    onfocus={handleFocus}
                  />
                </td>
                <td class="col-debit">
                  <input 
                    type="number" 
                    step="0.01" 
                    bind:value={split.debit}
                    placeholder={isDebit ? autoFillAmount : '0.00'}
                    onblur={() => handleSplitDebitBlur(split.id)}
                    onfocus={handleFocus}
                  />
                </td>
                <td class="col-credit">
                  <input 
                    type="number" 
                    step="0.01" 
                    bind:value={split.credit}
                    placeholder={!isDebit ? autoFillAmount : '0.00'}
                    onblur={() => handleSplitCreditBlur(split.id)}
                    onfocus={handleFocus}
                  />
                </td>
                <td class="col-balance">
                  {#if splitEntries.length > 1}
                    <button 
                      class="btn-remove-split" 
                      onclick={() => removeSplitEntry(split.id)}
                      title={$t('ledger.remove_split')}
                      aria-label={$t('ledger.remove_split')}
                    >
                      ×
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
            
            <!-- Split actions row -->
            <tr class="split-actions-row">
              <td colspan="8">
                <div class="split-balance-indicator">
                  {#if Math.abs(getSplitBalance()) <= 1}
                    <span class="balanced">✓ {$t('ledger.balanced')}</span>
                  {:else}
                    <span class="imbalanced">
                      ⚠ {$t('ledger.imbalance')}: {unit?.symbol ?? ''}{formatAmount(getSplitBalance())}
                    </span>
                  {/if}
                </div>
                <div class="split-actions">
                  <button class="btn-save-split" onclick={saveSplitEntry} type="button">
                    {$t('common.save')}
                  </button>
                  <button class="btn-cancel-split" onclick={cancelSplit} type="button">
                    {$t('common.cancel')}
                  </button>
                  <button class="btn-add-split" onclick={addSplitEntry} type="button">
                    + {$t('ledger.add_split')}
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
    padding: 1rem;
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .ledger-header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .back-link {
    color: var(--primary-color);
    text-decoration: none;
    font-size: 0.875rem;
  }
  
  .back-link:hover {
    text-decoration: underline;
  }
  
  .account-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .entity-breadcrumb {
    font-size: 0.875rem;
    color: var(--text-muted);
  }
  
  .account-details {
    display: flex;
    gap: 1rem;
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .balance-display {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--surface-secondary);
    border-radius: 4px;
  }
  
  .balance-label {
    color: var(--text-muted);
  }
  
  .balance-value {
    font-weight: 600;
    font-family: 'Courier New', monospace;
  }
  
  .ledger-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    background: var(--surface-secondary);
    border-radius: 4px;
  }
  
  .toolbar-left {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn-icon {
    background: transparent;
    border: 1px solid var(--border-color);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  .btn-icon:hover {
    background: var(--surface-hover);
  }
  
  .ledger-container {
    overflow-x: auto;
  }
  
  .loading-state, .error-state {
    text-align: center;
    padding: 3rem;
  }
  
  .spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .ledger-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  
  .ledger-table thead th {
    text-align: left;
    padding: 0.5rem;
    background: var(--surface-secondary);
    border-bottom: 2px solid var(--border-color);
    font-weight: 600;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  
  .ledger-table th.col-expand {
    width: 30px;
  }
  
  .ledger-table th.col-date {
    width: 100px;
  }
  
  .ledger-table th.col-ref {
    width: 80px;
  }
  
  .ledger-table th.col-debit,
  .ledger-table th.col-credit,
  .ledger-table th.col-balance {
    width: 120px;
    text-align: right;
  }
  
  .ledger-table tbody td {
    padding: 0.5rem;
    border-bottom: 1px solid var(--border-light);
  }
  
  .ledger-table .empty-row td {
    text-align: center;
    padding: 2rem;
  }
  
  .empty-message p {
    margin: 0.5rem 0;
  }
  
  .expand-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  
  .expand-btn:hover {
    color: var(--text-primary);
  }
  
  .clickable {
    cursor: pointer;
  }
  
  .clickable:hover {
    background: var(--surface-hover);
  }
  
  .locked {
    color: var(--text-muted);
    opacity: 0.7;
  }
  
  .locked-separator td {
    padding: 1rem 0;
  }
  
  .separator-line {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-muted);
  }
  
  .separator-line::before,
  .separator-line::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-color);
  }
  
  .lock-icon {
    font-size: 1rem;
  }
  
  .transaction-header,
  .transaction-line {
    font-weight: 500;
  }
  
  .entry-line {
    font-size: 0.8125rem;
    background: var(--surface-secondary);
  }
  
  .transaction-edit-mode td {
    padding: 0;
  }
  
  .edit-container {
    padding: 1rem;
    background: var(--surface-hover);
    border: 2px solid var(--primary-color);
    border-radius: 4px;
  }
  
  .edit-header {
    margin-bottom: 1rem;
    font-weight: 600;
  }
  
  .edit-placeholder {
    padding: 2rem;
    text-align: center;
  }
  
  .edit-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    margin-top: 1rem;
  }
  
  .split-indicator {
    font-style: italic;
    color: var(--text-muted);
  }
  
  .amount {
    text-align: right;
    font-family: 'Courier New', monospace;
  }
  
  .new-entry-row {
    background: var(--surface-primary);
  }
  
  .new-entry-row input {
    width: 100%;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border-light);
    border-radius: 4px;
    background: var(--surface-primary);
    color: var(--text-primary);
    font-size: inherit;
  }
  
  .new-entry-row input:focus {
    outline: none;
    border-color: var(--primary-color);
  }
  
  .new-entry-row input:disabled {
    background: var(--surface-secondary);
    color: var(--text-muted);
    cursor: not-allowed;
  }
  
  .new-entry-row input[type="number"] {
    text-align: right;
    font-family: 'Courier New', monospace;
  }
  
  .offset-input-wrapper {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }
  
  .split-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--surface-primary);
    cursor: pointer;
    font-size: 1rem;
    font-weight: bold;
    flex-shrink: 0;
  }
  
  .split-btn:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--primary-color);
  }
  
  .split-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .split-entry {
    background: var(--surface-secondary);
  }
  
  .split-balance-indicator {
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }
  
  .balanced {
    color: var(--success-color);
  }
  
  .imbalanced {
    color: var(--error-color);
  }
  
  .split-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
  
  .btn-save-split,
  .btn-cancel-split,
  .btn-add-split,
  .btn-remove-split {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  .btn-save-split {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
  }
  
  .btn-cancel-split {
    background: var(--surface-secondary);
  }
  
  .btn-add-split {
    background: var(--surface-primary);
  }
  
  .btn-remove-split {
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    color: var(--error-color);
    font-size: 1.25rem;
    font-weight: bold;
  }
  
  .btn-remove-split:hover {
    background: var(--error-color);
    color: white;
  }
  
  .btn-primary {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .btn-secondary {
    background: var(--surface-secondary);
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .btn-danger {
    background: var(--error-color);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
  
  a {
    color: var(--primary-color);
    text-decoration: none;
  }
  
  a:hover {
    text-decoration: underline;
  }
</style>

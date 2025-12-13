<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  import { entities } from '$lib/stores/entities';
  import { accounts, accountGroups } from '$lib/stores/accounts';
  import { loadViewState, saveViewState } from '$lib/stores/viewState';
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
  
  // View state - individual reactive variables
  let expandedTransactions = $state<Record<string, boolean>>({});
  let expandAll = $state(false);
  let closedDate = $state<string | undefined>(undefined);
  
  // Load view state when accountId changes
  $effect(() => {
    if (browser && accountId) {
      const loaded = loadViewState<{
        expandedTransactions: Record<string, boolean>;
        expandAll: boolean;
        closedDate?: string;
      }>(`ledger:${accountId}`, {
        expandedTransactions: {},
        expandAll: false,
      });
      expandedTransactions = loaded.expandedTransactions;
      expandAll = loaded.expandAll;
      closedDate = loaded.closedDate;
    }
  });
  
  // Save view state whenever it changes
  $effect(() => {
    if (browser && accountId) {
      saveViewState(`ledger:${accountId}`, {
        expandedTransactions,
        expandAll,
        closedDate,
      });
    }
  });
  
  // Transaction grouping
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
        const isExpanded = expandAll || expandedTransactions[entry.transactionId] || false;
        
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
  
  // Check for locked transactions
  let hasLockedTransactions = $derived(transactions.some(t => t.isLocked));
  let firstUnlockedIndex = $derived(transactions.findIndex(t => !t.isLocked));
  
  // Edit mode state
  let editingTransactionId: string | null = $state(null);
  let isNewEntry = $state(false);
  
  interface EditingSplitEntry {
    id: string;
    accountId: string;
    accountSearch: string;
    debit: string;
    credit: string;
    note: string;
  }
  
  interface EditingData {
    date: string;
    reference: string;
    memo: string;
    currentAccountDebit: string;
    currentAccountCredit: string;
    splits: EditingSplitEntry[];
  }
  
  let editingData: EditingData | null = $state(null);
  
  // Load data
  async function loadData() {
    try {
      loading = true;
      error = null;
      
      const dataService = await getDataService();
      
      // Load account
      account = $accounts.find(a => a.id === accountId) || null;
      if (!account) {
        error = 'Account not found';
        return;
      }
      
      // Load entity
      entity = $entities.find(e => e.id === account!.entityId) || null;
      
      // Load unit
      const units = await dataService.getUnits();
      unit = units.find(u => u.code === account!.unit) || null;
      
      // Load account group (for path)
      if (account.groupId) {
        accountGroup = $accountGroups.find(g => g.id === account!.groupId) || null;
      }
      
      // Load ledger entries
      entries = await dataService.getLedgerEntries(accountId);
      
      log.data.info('[Ledger] Loaded', entries.length, 'entries for account', accountId);
    } catch (e) {
      log.data.error('[Ledger] Load failed:', e);
      error = e instanceof Error ? e.message : 'Failed to load ledger';
    } finally {
      loading = false;
    }
  }
  
  // Reload when accountId changes
  $effect(() => {
    if (accountId) {
      loadData();
    }
  });
  
  // Get full account path
  function getAccountPath(): string {
    if (!account || !accountGroup) return account?.name || '';
    
    const parts: string[] = [];
    let current: AccountGroup | null = accountGroup;
    
    while (current) {
      parts.unshift(current.name);
      current = current.parentId ? $accountGroups.find(g => g.id === current!.parentId) || null : null;
    }
    
    parts.push(account.name);
    return parts.join(' : ');
  }
  
  // Format amount
  function formatAmount(amount: number): string {
    const divisor = unit?.displayDivisor ?? 100;
    return (amount / divisor).toFixed(2);
  }
  
  // Toggle expand/collapse
  function toggleExpand(transactionId: string) {
    expandedTransactions = {
      ...expandedTransactions,
      [transactionId]: !expandedTransactions[transactionId]
    };
  }
  
  // Toggle expand all (via header icon)
  function toggleExpandAll() {
    expandAll = !expandAll;
    // Clear individual overrides
    expandedTransactions = {};
  }
  
  // Enter edit mode
  function enterEditMode(txn: TransactionGroup) {
    if (txn.isLocked) {
      log.ui.warn('[Ledger] Cannot edit locked transaction');
      return;
    }
    
    log.ui.info('[Ledger] Entering edit mode for', txn.transactionId);
    log.ui.debug('[Ledger] Transaction:', txn);
    
    editingTransactionId = txn.transactionId;
    
    const mainEntry = txn.entries[0]; // Current account entry
    log.ui.debug('[Ledger] Main entry:', mainEntry);
    
    // Check if split (3+ entries total, or has splitEntries)
    const isSplit = mainEntry.isSplit || (mainEntry.splitEntries && mainEntry.splitEntries.length > 0);
    log.ui.debug('[Ledger] isSplit:', isSplit, 'splitEntries:', mainEntry.splitEntries);
    
    if (isSplit && mainEntry.splitEntries) {
      // Split transaction
      log.ui.info('[Ledger] Loading split with', mainEntry.splitEntries.length, 'splits');
      editingData = {
        date: txn.date,
        reference: txn.reference || '',
        memo: txn.memo || '',
        currentAccountDebit: mainEntry.amount > 0 ? formatAmount(mainEntry.amount) : '',
        currentAccountCredit: mainEntry.amount < 0 ? formatAmount(Math.abs(mainEntry.amount)) : '',
        splits: mainEntry.splitEntries.map(split => {
          log.ui.debug('[Ledger] Loading split:', split);
          return {
            id: split.entryId,
            accountId: split.accountId,
            accountSearch: split.accountName,
            debit: split.amount > 0 ? formatAmount(split.amount) : '',
            credit: split.amount < 0 ? formatAmount(Math.abs(split.amount)) : '',
            note: split.note || '',
          };
        }),
      };
    } else {
      // Simple transaction
      log.ui.info('[Ledger] Loading simple transaction, offset:', mainEntry.offsetAccountName);
      editingData = {
        date: txn.date,
        reference: txn.reference || '',
        memo: txn.memo || '',
        currentAccountDebit: mainEntry.amount > 0 ? formatAmount(mainEntry.amount) : '',
        currentAccountCredit: mainEntry.amount < 0 ? formatAmount(Math.abs(mainEntry.amount)) : '',
        splits: [{
          id: crypto.randomUUID(),
          accountId: mainEntry.offsetAccountId || '',
          accountSearch: mainEntry.offsetAccountName || '',
          debit: mainEntry.amount < 0 ? formatAmount(Math.abs(mainEntry.amount)) : '',
          credit: mainEntry.amount > 0 ? formatAmount(mainEntry.amount) : '',
          note: '',
        }],
      };
    }
    
    log.ui.debug('[Ledger] EditingData:', editingData);
  }
  
  // Calculate edit balance
  function getEditBalance(): number {
    if (!editingData) return 0;
    
    const divisor = unit?.displayDivisor ?? 100;
    
    const currentDebit = editingData.currentAccountDebit ? parseFloat(editingData.currentAccountDebit) : 0;
    const currentCredit = editingData.currentAccountCredit ? parseFloat(editingData.currentAccountCredit) : 0;
    const currentAmount = currentDebit || -currentCredit;
    
    const splitsSum = editingData.splits.reduce((sum, split) => {
      const debit = split.debit ? parseFloat(split.debit) : 0;
      const credit = split.credit ? parseFloat(split.credit) : 0;
      return sum + (debit || -credit);
    }, 0);
    
    return (currentAmount + splitsSum) * divisor;
  }
  
  // Get edit totals
  function getEditTotals(): { debits: number; credits: number; balance: number } {
    if (!editingData) return { debits: 0, credits: 0, balance: 0 };
    
    const currentDebit = editingData.currentAccountDebit ? parseFloat(editingData.currentAccountDebit) : 0;
    const currentCredit = editingData.currentAccountCredit ? parseFloat(editingData.currentAccountCredit) : 0;
    
    const debitsTotal = currentDebit + editingData.splits.reduce((sum, s) => 
      sum + (s.debit ? parseFloat(s.debit) : 0), 0);
    
    const creditsTotal = currentCredit + editingData.splits.reduce((sum, s) => 
      sum + (s.credit ? parseFloat(s.credit) : 0), 0);
    
    return {
      debits: debitsTotal,
      credits: creditsTotal,
      balance: getEditBalance()
    };
  }
  
  // Add split entry
  function addSplitEntry() {
    if (!editingData) return;
    
    const balance = getEditBalance();
    const divisor = unit?.displayDivisor ?? 100;
    const autoAmount = formatAmount(-balance);
    
    editingData.splits = [
      ...editingData.splits,
      {
        id: crypto.randomUUID(),
        accountId: '',
        accountSearch: '',
        debit: balance < 0 ? autoAmount : '',
        credit: balance > 0 ? autoAmount : '',
        note: '',
      }
    ];
  }
  
  // Remove split entry
  function removeSplitEntry(id: string) {
    if (!editingData) return;
    editingData.splits = editingData.splits.filter(s => s.id !== id);
    if (editingData.splits.length === 0) {
      addSplitEntry();
    }
  }
  
  // Activate new entry mode
  function activateNewEntry() {
    if (editingTransactionId) return; // Already editing
    
    log.ui.info('[Ledger] Activating new entry mode');
    isNewEntry = true;
    editingTransactionId = 'new';
    editingData = {
      date: new Date().toISOString().split('T')[0],
      reference: '',
      memo: '',
      currentAccountDebit: '',
      currentAccountCredit: '',
      splits: [{
        id: crypto.randomUUID(),
        accountId: '',
        accountSearch: '',
        debit: '',
        credit: '',
        note: '',
      }],
    };
  }
  
  // Save edit or create new
  async function saveEdit() {
    if (!editingData) return;
    
    // Validate
    const balance = getEditBalance();
    if (Math.abs(balance) > 1) {
      alert($t('ledger.transaction_must_balance'));
      return;
    }
    
    try {
      const dataService = await getDataService();
      const divisor = unit?.displayDivisor ?? 100;
      
      if (isNewEntry) {
        // Create new transaction
        const currentDebit = editingData.currentAccountDebit ? parseFloat(editingData.currentAccountDebit) : 0;
        const currentCredit = editingData.currentAccountCredit ? parseFloat(editingData.currentAccountCredit) : 0;
        const currentAmount = (currentDebit || -currentCredit) * divisor;
        
        // For simple transaction (1 split)
        if (editingData.splits.length === 1 && editingData.splits[0].accountId) {
          const split = editingData.splits[0];
          await dataService.createTransaction({
            date: editingData.date,
            reference: editingData.reference || undefined,
            memo: editingData.memo || undefined,
            entries: [
              {
                accountId: accountId,
                amount: currentAmount,
              },
              {
                accountId: split.accountId,
                amount: -currentAmount,
              },
            ],
          });
        } else {
          // Split transaction
          const entries = [
            {
              accountId: accountId,
              amount: currentAmount,
            },
            ...editingData.splits.filter(s => s.accountId).map(s => {
              const debit = s.debit ? parseFloat(s.debit) : 0;
              const credit = s.credit ? parseFloat(s.credit) : 0;
              return {
                accountId: s.accountId,
                amount: (debit || -credit) * divisor,
              };
            }),
          ];
          
          await dataService.createTransaction({
            date: editingData.date,
            reference: editingData.reference || undefined,
            memo: editingData.memo || undefined,
            entries,
          });
        }
        
        log.ui.info('[Ledger] New transaction created');
      } else if (editingTransactionId) {
        // Update existing transaction
        await dataService.updateTransaction(editingTransactionId, {
          date: editingData.date,
          reference: editingData.reference || undefined,
          memo: editingData.memo || undefined,
        });
        
        log.ui.info('[Ledger] Transaction updated');
      }
      
      // Exit edit mode and reload
      isNewEntry = false;
      editingTransactionId = null;
      editingData = null;
      await loadData();
      
      // Focus on new entry date field if just created
      if (isNewEntry) {
        setTimeout(() => {
          document.querySelector<HTMLInputElement>('.new-entry-row input[type="date"]')?.focus();
        }, 100);
      }
    } catch (e) {
      log.ui.error('[Ledger] Save failed:', e);
      alert($t('common.error') + ': ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  }
  
  // Cancel edit
  function cancelEdit() {
    isNewEntry = false;
    editingTransactionId = null;
    editingData = null;
    log.ui.info('[Ledger] Edit cancelled');
  }
  
  // Delete transaction
  async function deleteTransaction(transactionId: string) {
    if (!confirm($t('ledger.confirm_delete'))) return;
    
    try {
      const dataService = await getDataService();
      await dataService.deleteTransaction(transactionId);
      
      log.ui.info('[Ledger] Transaction deleted');
      
      editingTransactionId = null;
      editingData = null;
      await loadData();
    } catch (e) {
      log.ui.error('[Ledger] Delete failed:', e);
      alert($t('common.error') + ': ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  }
  
  // Handle blur on Debit/Credit (mutual exclusion)
  function handleCurrentDebitBlur() {
    if (editingData && editingData.currentAccountDebit) {
      editingData.currentAccountCredit = '';
    }
  }
  
  function handleCurrentCreditBlur() {
    if (editingData && editingData.currentAccountCredit) {
      editingData.currentAccountDebit = '';
    }
  }
  
  function handleSplitDebitBlur(splitId: string) {
    if (!editingData) return;
    const split = editingData.splits.find(s => s.id === splitId);
    if (split && split.debit) {
      split.credit = '';
    }
  }
  
  function handleSplitCreditBlur(splitId: string) {
    if (!editingData) return;
    const split = editingData.splits.find(s => s.id === splitId);
    if (split && split.credit) {
      split.debit = '';
    }
  }
  
  // Auto-select text on focus
  function handleFocus(e: FocusEvent) {
    const target = e.target as HTMLInputElement;
    if (target && target.select) {
      setTimeout(() => target.select(), 0);
    }
  }
</script>

<div class="ledger-page">
  <!-- Fixed Header -->
  <header class="ledger-header">
    {#if entity && account}
      <div class="header-top">
        <a href="/entities/{entity.id}" class="back-link">
          ← {$t('ledger.back_to_accounts')}
        </a>
      </div>
      
      <div class="header-main">
        <div class="account-context">
          <span class="entity-name">{entity.name}</span>
          <span class="separator">›</span>
          <span class="account-path">{getAccountPath()}</span>
          {#if account.code}
            <span class="account-code">{account.code}</span>
          {/if}
        </div>
        
        <div class="balance-display">
          <span class="balance-value">
            {unit?.symbol ?? ''}{#if entries.length > 0}{formatAmount(entries[entries.length - 1].runningBalance)}{:else}0.00{/if}
          </span>
        </div>
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
            <th class="col-expand">
              <button 
                class="expand-all-btn" 
                onclick={toggleExpandAll}
                title={expandAll ? $t('ledger.collapse_all') : $t('ledger.expand_all')}
              >
                {expandAll ? '▼' : '▶'}
              </button>
            </th>
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
            <!-- Locked separator -->
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
              <!-- Edit mode: Transaction metadata row -->
              <tr class="edit-metadata-row">
                <td class="col-expand"></td>
                <td class="col-date">
                  <input 
                    type="date" 
                    bind:value={editingData.date}
                    onfocus={handleFocus}
                    class="edit-input"
                  />
                </td>
                <td class="col-ref">
                  <input 
                    type="text" 
                    bind:value={editingData.reference}
                    placeholder={$t('ledger.ref')}
                    onfocus={handleFocus}
                    class="edit-input"
                  />
                </td>
                <td class="col-memo" colspan="5">
                  <input 
                    type="text" 
                    bind:value={editingData.memo}
                    placeholder={$t('ledger.memo')}
                    onfocus={handleFocus}
                    class="edit-input edit-input-wide"
                  />
                </td>
              </tr>
              
              <!-- Edit mode: Current account entry row -->
              <tr class="edit-entry-row edit-current-account">
                <td class="col-expand"></td>
                <td class="col-date"></td>
                <td class="col-ref"></td>
                <td class="col-memo"></td>
                <td class="col-offset">
                  <input 
                    type="text" 
                    value={account?.name ?? ''}
                    disabled
                    class="edit-input edit-disabled"
                  />
                </td>
                <td class="col-debit">
                  <input 
                    type="number" 
                    step="0.01" 
                    bind:value={editingData.currentAccountDebit}
                    placeholder="0.00"
                    onblur={handleCurrentDebitBlur}
                    onfocus={handleFocus}
                    class="edit-input edit-amount"
                  />
                </td>
                <td class="col-credit">
                  <input 
                    type="number" 
                    step="0.01" 
                    bind:value={editingData.currentAccountCredit}
                    placeholder="0.00"
                    onblur={handleCurrentCreditBlur}
                    onfocus={handleFocus}
                    class="edit-input edit-amount"
                  />
                </td>
                <td class="col-balance"></td>
              </tr>
              
              <!-- Edit mode: Split entry rows -->
              {#each editingData.splits as split (split.id)}
                <tr class="edit-entry-row edit-split-entry">
                  <td class="col-expand"></td>
                  <td class="col-date"></td>
                  <td class="col-ref"></td>
                  <td class="col-memo">
                    <input 
                      type="text" 
                      bind:value={split.note}
                      placeholder={$t('ledger.note')}
                      onfocus={handleFocus}
                      class="edit-input"
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
                      placeholder="0.00"
                      onblur={() => handleSplitDebitBlur(split.id)}
                      onfocus={handleFocus}
                      class="edit-input edit-amount"
                    />
                  </td>
                  <td class="col-credit">
                    <input 
                      type="number" 
                      step="0.01" 
                      bind:value={split.credit}
                      placeholder="0.00"
                      onblur={() => handleSplitCreditBlur(split.id)}
                      onfocus={handleFocus}
                      class="edit-input edit-amount"
                    />
                  </td>
                  <td class="col-balance">
                    {#if editingData.splits.length > 1}
                      <button 
                        class="btn-remove-split" 
                        onclick={() => removeSplitEntry(split.id)}
                        title={$t('ledger.remove_split')}
                      >
                        ×
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
              
              <!-- Edit mode: Actions footer row -->
              <tr class="edit-actions-row">
                <td colspan="8">
                  <div class="edit-actions-container">
                    <div class="edit-actions-left">
                      <button class="btn-primary" onclick={saveEdit}>{$t('common.save')}</button>
                      <button class="btn-secondary" onclick={cancelEdit}>{$t('common.cancel')}</button>
                      <button class="btn-secondary" onclick={addSplitEntry}>+ {$t('ledger.add_split')}</button>
                      <button class="btn-danger" onclick={() => deleteTransaction(txn.transactionId)}>{$t('common.delete')}</button>
                    </div>
                    {#if editingData.splits.length > 1}
                      {@const totals = getEditTotals()}
                      <div class="edit-totals-right">
                        <span class="total-label">{$t('ledger.debits_total')}:</span>
                        <span class="total-amount">{unit?.symbol ?? ''}{totals.debits.toFixed(2)}</span>
                        <span class="total-label">{$t('ledger.credits_total')}:</span>
                        <span class="total-amount">{unit?.symbol ?? ''}{totals.credits.toFixed(2)}</span>
                        <span class="total-label">{$t('ledger.balance')}:</span>
                        {#if Math.abs(totals.balance) <= 1}
                          <span class="balanced">{unit?.symbol ?? ''}0.00 ✓</span>
                        {:else}
                          <span class="imbalanced">{unit?.symbol ?? ''}{formatAmount(totals.balance)} ⚠</span>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </td>
              </tr>
            {:else}
              <!-- View mode: Collapsed or Expanded -->
              {#if txn.isExpanded}
                <!-- Expanded: Transaction header -->
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
                    >
                      ▼
                    </button>
                  </td>
                  <td class="col-date">{txn.date}</td>
                  <td class="col-ref">{txn.reference ?? ''}</td>
                  <td class="col-memo">{txn.memo ?? ''}</td>
                  <td class="col-offset"></td>
                  <td class="col-debit"></td>
                  <td class="col-credit"></td>
                  <td class="col-balance amount">
                    {#if txn.entries[0]}
                      {formatAmount(txn.entries[0].runningBalance)}
                    {/if}
                  </td>
                </tr>
                
                <!-- Expanded: Entry lines -->
                {#each txn.entries as entry (entry.entryId)}
                  <!-- Current account entry -->
                  <tr class="entry-line" class:locked={txn.isLocked}>
                    <td class="col-expand"></td>
                    <td class="col-date"></td>
                    <td class="col-ref"></td>
                    <td class="col-memo">{entry.note ?? ''}</td>
                    <td class="col-offset">
                      {account?.name}
                    </td>
                    <td class="col-debit amount">
                      {entry.amount > 0 ? formatAmount(entry.amount) : ''}
                    </td>
                    <td class="col-credit amount">
                      {entry.amount < 0 ? formatAmount(Math.abs(entry.amount)) : ''}
                    </td>
                    <td class="col-balance"></td>
                  </tr>
                  
                  <!-- Offset account entry (simple) -->
                  {#if entry.offsetAccountName}
                    <tr class="entry-line" class:locked={txn.isLocked}>
                      <td class="col-expand"></td>
                      <td class="col-date"></td>
                      <td class="col-ref"></td>
                      <td class="col-memo"></td>
                      <td class="col-offset">
                        <a href="/ledger/{entry.offsetAccountId}" title={entry.offsetAccountPath || entry.offsetAccountName}>
                          {entry.offsetAccountName}
                        </a>
                      </td>
                      <td class="col-debit amount">
                        {entry.amount < 0 ? formatAmount(Math.abs(entry.amount)) : ''}
                      </td>
                      <td class="col-credit amount">
                        {entry.amount > 0 ? formatAmount(entry.amount) : ''}
                      </td>
                      <td class="col-balance"></td>
                    </tr>
                  {/if}
                  
                  <!-- Split entries -->
                  {#if entry.splitEntries}
                    {#each entry.splitEntries as split (split.entryId)}
                      <tr class="entry-line" class:locked={txn.isLocked}>
                        <td class="col-expand"></td>
                        <td class="col-date"></td>
                        <td class="col-ref"></td>
                        <td class="col-memo">{split.note ?? ''}</td>
                        <td class="col-offset">
                          <a href="/ledger/{split.accountId}" title={split.accountPath}>
                            {split.accountName}
                          </a>
                        </td>
                        <td class="col-debit amount">
                          {split.amount > 0 ? formatAmount(split.amount) : ''}
                        </td>
                        <td class="col-credit amount">
                          {split.amount < 0 ? formatAmount(Math.abs(split.amount)) : ''}
                        </td>
                        <td class="col-balance"></td>
                      </tr>
                    {/each}
                  {/if}
                {/each}
              {:else}
                <!-- Collapsed: Single line -->
                <tr 
                  class="transaction-line"
                  class:locked={txn.isLocked}
                  class:clickable={!txn.isLocked}
                  onclick={() => !txn.isLocked && enterEditMode(txn)}
                >
                  <td class="col-expand">
                    <button 
                      class="expand-btn" 
                      onclick={(e) => { e.stopPropagation(); toggleExpand(txn.transactionId); }}
                    >
                      ▶
                    </button>
                  </td>
                  <td class="col-date">{txn.date}</td>
                  <td class="col-ref">{txn.reference ?? ''}</td>
                  <td class="col-memo">{txn.memo ?? ''}</td>
                  <td class="col-offset">
                    {#if txn.entries[0]?.isSplit}
                      <span class="split-indicator">[{$t('ledger.split')}]</span>
                    {:else if txn.entries[0]?.offsetAccountName}
                      <a href="/ledger/{txn.entries[0].offsetAccountId}" title={txn.entries[0].offsetAccountPath || txn.entries[0].offsetAccountName}>
                        {txn.entries[0].offsetAccountName}
                      </a>
                    {/if}
                  </td>
                  <td class="col-debit amount">
                    {#if txn.entries[0] && txn.entries[0].amount > 0}
                      {formatAmount(txn.entries[0].amount)}
                    {/if}
                  </td>
                  <td class="col-credit amount">
                    {#if txn.entries[0] && txn.entries[0].amount < 0}
                      {formatAmount(Math.abs(txn.entries[0].amount))}
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
          
          <!-- New Entry Row -->
          {#if isNewEntry && editingTransactionId === 'new' && editingData}
            <!-- New entry in edit mode -->
            <tr class="edit-metadata-row new-entry-row">
              <td class="col-expand"></td>
              <td class="col-date">
                <input 
                  type="date" 
                  bind:value={editingData.date}
                  onfocus={handleFocus}
                  class="edit-input"
                />
              </td>
              <td class="col-ref">
                <input 
                  type="text" 
                  bind:value={editingData.reference}
                  placeholder={$t('ledger.ref')}
                  onfocus={handleFocus}
                  class="edit-input"
                />
              </td>
              <td class="col-memo" colspan="5">
                <input 
                  type="text" 
                  bind:value={editingData.memo}
                  placeholder={$t('ledger.memo')}
                  onfocus={handleFocus}
                  class="edit-input edit-input-wide"
                />
              </td>
            </tr>
            
            <tr class="edit-entry-row edit-current-account new-entry-row">
              <td class="col-expand"></td>
              <td class="col-date"></td>
              <td class="col-ref"></td>
              <td class="col-memo"></td>
              <td class="col-offset">
                <input 
                  type="text" 
                  value={account?.name ?? ''}
                  disabled
                  class="edit-input edit-disabled"
                />
              </td>
              <td class="col-debit">
                <input 
                  type="number" 
                  step="0.01" 
                  bind:value={editingData.currentAccountDebit}
                  placeholder="0.00"
                  onblur={handleCurrentDebitBlur}
                  onfocus={handleFocus}
                  class="edit-input edit-amount"
                />
              </td>
              <td class="col-credit">
                <input 
                  type="number" 
                  step="0.01" 
                  bind:value={editingData.currentAccountCredit}
                  placeholder="0.00"
                  onblur={handleCurrentCreditBlur}
                  onfocus={handleFocus}
                  class="edit-input edit-amount"
                />
              </td>
              <td class="col-balance"></td>
            </tr>
            
            {#each editingData.splits as split (split.id)}
              <tr class="edit-entry-row edit-split-entry new-entry-row">
                <td class="col-expand"></td>
                <td class="col-date"></td>
                <td class="col-ref"></td>
                <td class="col-memo">
                  <input 
                    type="text" 
                    bind:value={split.note}
                    placeholder={$t('ledger.note')}
                    onfocus={handleFocus}
                    class="edit-input"
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
                    placeholder="0.00"
                    onblur={() => handleSplitDebitBlur(split.id)}
                    onfocus={handleFocus}
                    class="edit-input edit-amount"
                  />
                </td>
                <td class="col-credit">
                  <input 
                    type="number" 
                    step="0.01" 
                    bind:value={split.credit}
                    placeholder="0.00"
                    onblur={() => handleSplitCreditBlur(split.id)}
                    onfocus={handleFocus}
                    class="edit-input edit-amount"
                  />
                </td>
                <td class="col-balance">
                  {#if editingData.splits.length > 1}
                    <button 
                      class="btn-remove-split" 
                      onclick={() => removeSplitEntry(split.id)}
                      title={$t('ledger.remove_split')}
                    >
                      ×
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
            
            <tr class="edit-actions-row new-entry-row">
              <td colspan="8">
                <div class="edit-actions-container">
                  <div class="edit-actions-left">
                    <button class="btn-primary" onclick={saveEdit}>{$t('common.save')}</button>
                    <button class="btn-secondary" onclick={cancelEdit}>{$t('common.cancel')}</button>
                    <button class="btn-secondary" onclick={addSplitEntry}>+ {$t('ledger.add_split')}</button>
                  </div>
                  {#if editingData.splits.length > 1}
                    {@const totals = getEditTotals()}
                    <div class="edit-totals-right">
                      <span class="total-label">{$t('ledger.debits_total')}:</span>
                      <span class="total-amount">{unit?.symbol ?? ''}{totals.debits.toFixed(2)}</span>
                      <span class="total-label">{$t('ledger.credits_total')}:</span>
                      <span class="total-amount">{unit?.symbol ?? ''}{totals.credits.toFixed(2)}</span>
                      <span class="total-label">{$t('ledger.balance')}:</span>
                      {#if Math.abs(totals.balance) <= 1}
                        <span class="balanced">{unit?.symbol ?? ''}0.00 ✓</span>
                      {:else}
                        <span class="imbalanced">{unit?.symbol ?? ''}{formatAmount(totals.balance)} ⚠</span>
                      {/if}
                    </div>
                  {/if}
                </div>
              </td>
            </tr>
          {:else}
            <!-- Blank entry row (not yet activated) -->
            <tr class="new-entry-row blank-entry-row" onclick={activateNewEntry}>
              <td class="col-expand"></td>
              <td class="col-date">
                <span class="placeholder">{new Date().toISOString().split('T')[0]}</span>
              </td>
              <td class="col-ref">
                <span class="placeholder"></span>
              </td>
              <td class="col-memo">
                <span class="placeholder">{$t('ledger.enter_new_transaction')}</span>
              </td>
              <td class="col-offset"></td>
              <td class="col-debit"></td>
              <td class="col-credit"></td>
              <td class="col-balance"></td>
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
    height: 100vh;
  }
  
  /* Fixed Header */
  .ledger-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--surface-primary);
    border-bottom: 2px solid var(--border-color);
    padding: 1rem 1.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .header-top {
    margin-bottom: 0.75rem;
  }
  
  .back-link {
    color: var(--primary-color);
    text-decoration: none;
    font-size: 0.875rem;
  }
  
  .back-link:hover {
    text-decoration: underline;
  }
  
  .header-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .account-context {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;
  }
  
  .entity-name {
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 400;
  }
  
  .separator {
    color: var(--text-muted);
  }
  
  .account-path {
    font-weight: 600;
  }
  
  .account-code {
    color: var(--text-muted);
    font-family: 'Courier New', monospace;
  }
  
  .balance-display {
    font-size: 1.25rem;
    font-weight: 600;
    font-family: 'Courier New', monospace;
  }
  
  /* Ledger Container */
  .ledger-container {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }
  
  /* Table */
  .ledger-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  
  .ledger-table thead {
    position: sticky;
    top: 0;
    background: var(--surface-secondary);
    z-index: 10;
  }
  
  .ledger-table th {
    text-align: left;
    padding: 0.75rem 0.5rem;
    border-bottom: 2px solid var(--border-color);
    font-weight: 600;
    color: var(--text-muted);
    font-size: 0.8125rem;
    text-transform: uppercase;
  }
  
  .ledger-table td {
    padding: 0.5rem;
    border-bottom: 1px solid var(--border-light);
  }
  
  /* Column widths */
  .col-expand {
    width: 40px;
  }
  
  .col-date {
    width: 110px;
  }
  
  .col-ref {
    width: 100px;
  }
  
  .col-memo {
    min-width: 200px;
  }
  
  .col-offset {
    min-width: 150px;
  }
  
  .col-debit,
  .col-credit,
  .col-balance {
    width: 120px;
    text-align: right;
  }
  
  /* Amount alignment */
  .amount {
    font-family: 'Courier New', monospace;
    text-align: right;
  }
  
  /* Expand button in header */
  .expand-all-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    color: var(--text-primary);
    padding: 0.25rem;
  }
  
  .expand-all-btn:hover {
    color: var(--primary-color);
  }
  
  /* Expand/collapse buttons */
  .expand-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.75rem;
    color: var(--text-muted);
    padding: 0.25rem;
  }
  
  .expand-btn:hover {
    color: var(--primary-color);
  }
  
  /* Transaction rows */
  .transaction-line,
  .transaction-header {
    transition: background-color 0.15s;
  }
  
  .transaction-line.clickable:hover,
  .transaction-header.clickable:hover {
    background: var(--surface-hover);
    cursor: pointer;
  }
  
  .transaction-line.locked,
  .transaction-header.locked,
  .entry-line.locked {
    opacity: 0.6;
  }
  
  .entry-line {
    background: var(--surface-secondary);
  }
  
  /* Locked separator */
  .locked-separator td {
    padding: 0.5rem 0;
  }
  
  .separator-line {
    display: flex;
    align-items: center;
    justify-content: center;
    border-top: 2px solid var(--border-color);
    position: relative;
  }
  
  .lock-icon {
    position: absolute;
    background: var(--surface-primary);
    padding: 0 0.5rem;
    font-size: 1.25rem;
  }
  
  /* Split indicator */
  .split-indicator {
    color: var(--text-muted);
    font-style: italic;
  }
  
  /* Edit mode rows */
  .edit-metadata-row,
  .edit-entry-row {
    background: var(--surface-hover);
  }
  
  .edit-metadata-row {
    border-left: 4px solid var(--primary-color);
  }
  
  .edit-entry-row {
    border-left: 4px solid var(--primary-color);
  }
  
  .edit-current-account {
    background: var(--surface-secondary);
  }
  
  .edit-actions-row td {
    padding: 0;
    border-left: 4px solid var(--primary-color);
    background: var(--surface-hover);
  }
  
  /* Edit inputs */
  .edit-input {
    width: 100%;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--border-light);
    border-radius: 4px;
    background: var(--surface-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
  }
  
  .edit-input:focus {
    outline: none;
    border-color: var(--primary-color);
  }
  
  .edit-input.edit-disabled {
    background: var(--surface-secondary);
    color: var(--text-muted);
    cursor: not-allowed;
  }
  
  .edit-input.edit-amount {
    text-align: right;
    font-family: 'Courier New', monospace;
  }
  
  .edit-input.edit-input-wide {
    min-width: 300px;
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
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--surface-secondary);
    border-top: 1px solid var(--border-color);
    gap: 2rem;
  }
  
  .edit-actions-left {
    display: flex;
    gap: 0.5rem;
  }
  
  .edit-totals-right {
    display: flex;
    gap: 1rem;
    align-items: center;
    font-size: 0.875rem;
    font-family: 'Courier New', monospace;
    white-space: nowrap;
  }
  
  .total-label {
    color: var(--text-muted);
    font-weight: 500;
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
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
    border: none;
    font-weight: 500;
    transition: background-color 0.15s;
  }
  
  .btn-primary {
    background: var(--primary-color);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--primary-color-hover);
  }
  
  .btn-secondary {
    background: var(--surface-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--surface-hover);
  }
  
  .btn-danger {
    background: var(--danger-color);
    color: white;
  }
  
  .btn-danger:hover {
    background: var(--danger-color-hover);
  }
  
  /* Loading/Error states */
  .loading-state,
  .error-state,
  .empty-message {
    text-align: center;
    padding: 3rem 1rem;
  }
  
  .spinner {
    display: inline-block;
    width: 2rem;
    height: 2rem;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .text-muted {
    color: var(--text-muted);
    font-size: 0.875rem;
  }
  
  /* Blank entry row */
  .blank-entry-row {
    cursor: pointer;
    background: var(--surface-secondary);
    border-top: 2px dashed var(--border-color);
  }
  
  .blank-entry-row:hover {
    background: var(--surface-hover);
  }
  
  .blank-entry-row .placeholder {
    color: var(--text-muted);
    font-style: italic;
  }
  
  .new-entry-row {
    border-left: 4px solid var(--success-color);
  }
</style>

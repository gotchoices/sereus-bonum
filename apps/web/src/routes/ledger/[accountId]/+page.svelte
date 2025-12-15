<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  import { entities } from '$lib/stores/entities';
  import { accounts, accountGroups } from '$lib/stores/accounts';
  import { settings } from '$lib/stores/settings';
  import { loadViewState, saveViewState } from '$lib/stores/viewState';
  import { getDataService, type LedgerEntry, type Account, type Unit, type AccountGroup, type Entity } from '$lib/data';
  import AccountAutocomplete from '$lib/components/AccountAutocomplete.svelte';
  import TransactionEditor from '$lib/components/TransactionEditor.svelte';
  import { formatDate as formatDateUtil } from '$lib/utils/formatDate';
  
  // Route param
  let accountId = $derived($page.params.accountId);
  
  // Account info
  let account: Account | null = $state(null);
  let unit: Unit | null = $state(null);
  let entity: Entity | null = $state(null);
  let accountGroup: AccountGroup | null = $state(null);
  
  // Dev tools
  const ENABLE_TEST_DATA_GENERATOR = import.meta.env.DEV && import.meta.env.VITE_ENABLE_TEST_DATA === 'true';
  let generatingTestData = $state(false);
  let testDataProgress = $state<string | null>(null);
  let testDataCount = $state(1000);
  
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
      
      // Load account directly from backend (not from store)
      account = await dataService.getAccount(accountId);
      if (!account) {
        error = 'Account not found';
        loading = false;
        return;
      }
      
      // Load entity directly from backend
      entity = await dataService.getEntity(account.entityId);
      
      // Load unit
      const units = await dataService.getUnits();
      unit = units.find(u => u.code === account!.unit) || null;
      
      // Load account group directly from backend (for path)
      log.data.debug('[Ledger] Account accountGroupId:', account.accountGroupId);
      if (account.accountGroupId) {
        accountGroup = await dataService.getAccountGroup(account.accountGroupId);
        log.data.debug('[Ledger] Loaded accountGroup:', accountGroup?.name);
      } else {
        log.data.warn('[Ledger] Account has no accountGroupId');
        accountGroup = null;
      }
      
      // Load ledger entries
      // Pass sort order from settings
      entries = await dataService.getLedgerEntries(accountId, {
        sortOrder: $settings.transactionSortOrder
      });
      
      log.data.info('[Ledger] Loaded', entries.length, 'entries for account', accountId, 'sorted:', $settings.transactionSortOrder);
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
    if (!account) {
      log.ui.debug('[Ledger] getAccountPath: no account');
      return '';
    }
    
    if (!accountGroup) {
      log.ui.debug('[Ledger] getAccountPath: no accountGroup, account:', account.name, 'groupId:', account.groupId);
      return account.name;
    }
    
    const parts: string[] = [];
    let current: AccountGroup | null = accountGroup;
    
    while (current) {
      parts.unshift(current.name);
      current = current.parentId ? $accountGroups.find(g => g.id === current!.parentId) || null : null;
    }
    
    parts.push(account.name);
    const fullPath = parts.join(' : ');
    log.ui.debug('[Ledger] getAccountPath:', fullPath);
    return fullPath;
  }
  
  // Format amount
  function formatAmount(amount: number): string {
    const divisor = unit?.displayDivisor ?? 100;
    return (amount / divisor).toFixed(2);
  }
  
  // Format date according to user preference
  function formatDate(dateStr: string): string {
    return formatDateUtil(dateStr, $settings.dateFormat);
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
          log.ui.debug('[Ledger] Loading split entry:', {
            entryId: split.entryId,
            accountId: split.accountId,
            accountName: split.accountName,
            accountPath: split.accountPath,
            amount: split.amount
          });
          return {
            id: split.entryId,
            accountId: split.accountId,
            accountSearch: split.accountName || '',
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
    // If already in new entry mode with data, just silently return (re-focusing is fine)
    if (editingTransactionId === 'new' && isNewEntry && editingData) {
      log.ui.debug('[Ledger] Already in new entry mode, ignoring duplicate activation');
      return;
    }
    
    // If editing a different transaction, warn and block
    if (editingTransactionId && editingTransactionId !== 'new') {
      log.ui.warn('[Ledger] Already editing transaction:', editingTransactionId);
      return;
    }
    
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
    log.ui.debug('[Ledger] New entry editingData:', editingData);
    log.ui.debug('[Ledger] Splits length:', editingData.splits.length);
    
    // Focus the date field in the editor after it renders
    setTimeout(() => {
      const dateInput = document.querySelector<HTMLInputElement>('.new-entry-row.edit-simple-row input[type="date"], .new-entry-row.edit-metadata-row input[type="date"]');
      if (dateInput) {
        dateInput.focus();
        log.ui.debug('[Ledger] Focused date input in new entry editor');
      }
    }, 50);
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
  
  // DEV ONLY: Generate test data for performance testing
  async function generateTestData() {
    if (!account || !entity) return;
    
    const confirmed = confirm(
      `⚠️ This will generate ${testDataCount.toLocaleString()} test transactions in this account.\n\n` +
      'This is for performance testing only and cannot be undone.\n\n' +
      'Continue?'
    );
    
    if (!confirmed) return;
    
    generatingTestData = true;
    testDataProgress = 'Initializing...';
    log.ui.info(`[Dev] Generating ${testDataCount} test transactions`);
    
    try {
      const dataService = await getDataService();
      const allAccounts = await dataService.getAccounts(entity.id);
      
      // Get offset accounts (exclude current account)
      const offsetAccounts = allAccounts.filter(a => a.id !== accountId);
      if (offsetAccounts.length === 0) {
        throw new Error('Need at least one other account for test data');
      }
      
      // Generate 15,000 transactions over 2 years
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setFullYear(startDate.getFullYear() - 2);
      const oneYearAgo = new Date(endDate);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const batchSize = 100;
      const totalCount = testDataCount;
      const batches = Math.ceil(totalCount / batchSize);
      
      for (let batch = 0; batch < batches; batch++) {
        const batchTransactions = [];
        const batchStart = batch * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, totalCount);
        
        for (let i = batchStart; i < batchEnd; i++) {
          // Random date between start and end
          const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
          const date = new Date(randomTime).toISOString().split('T')[0];
          
          // Determine transaction type (70% simple, 20% 2-3 splits, 10% 4-6 splits)
          const typeRoll = Math.random();
          const splitCount = typeRoll < 0.7 ? 1 : typeRoll < 0.9 ? 2 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 3);
          
          // Random amount (between $10 and $5000, in cents)
          const baseAmount = Math.floor((Math.random() * 4990 + 10) * 100);
          
          // Build entries
          const entries: Array<{ accountId: string; amount: number; note?: string }> = [];
          
          if (splitCount === 1) {
            // Simple transaction
            const offsetAccount = offsetAccounts[Math.floor(Math.random() * offsetAccounts.length)];
            entries.push({
              accountId: accountId,
              amount: Math.random() > 0.5 ? baseAmount : -baseAmount,
            });
            entries.push({
              accountId: offsetAccount.id,
              amount: entries[0].amount * -1,
            });
          } else {
            // Split transaction
            // Current account entry (total amount)
            const isDebit = Math.random() > 0.5;
            entries.push({
              accountId: accountId,
              amount: isDebit ? baseAmount : -baseAmount,
            });
            
            // Split the offset across multiple accounts
            let remaining = baseAmount;
            for (let s = 0; s < splitCount; s++) {
              const offsetAccount = offsetAccounts[Math.floor(Math.random() * offsetAccounts.length)];
              const isLast = s === splitCount - 1;
              const amount = isLast ? remaining : Math.floor(remaining * (0.2 + Math.random() * 0.4));
              remaining -= amount;
              
              entries.push({
                accountId: offsetAccount.id,
                amount: isDebit ? -amount : amount,
                note: `Split ${s + 1}/${splitCount}`,
              });
            }
          }
          
          batchTransactions.push({
            entityId: entity!.id,
            date,
            reference: i % 5 === 0 ? `REF-${i}` : undefined,
            memo: `Test transaction ${i + 1}`,
            entries,
          });
        }
        
        // Insert batch
        testDataProgress = `Inserting batch ${batch + 1}/${batches} (${batchEnd}/${totalCount} transactions)...`;
        await Promise.all(batchTransactions.map(txn => {
          const { entries, ...txnData } = txn;
          return dataService.createTransaction(txnData, entries);
        }));
        
        // Brief pause to allow UI updates
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      testDataProgress = 'Reloading ledger...';
      await loadData();
      
      testDataProgress = `✅ Successfully generated ${totalCount} test transactions!`;
      log.ui.info('[Dev] Test data generation complete');
      
      setTimeout(() => {
        generatingTestData = false;
        testDataProgress = null;
      }, 3000);
    } catch (err) {
      log.ui.error('[Dev] Test data generation failed:', err);
      testDataProgress = `❌ Error: ${err instanceof Error ? err.message : String(err)}`;
      setTimeout(() => {
        generatingTestData = false;
        testDataProgress = null;
      }, 5000);
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
        
        <div class="header-right">
          <!-- DEV ONLY: Test Data Generator -->
          {#if ENABLE_TEST_DATA_GENERATOR}
            <div class="dev-test-tool">
              <input 
                type="number" 
                bind:value={testDataCount}
                min="1"
                max="50000"
                step="100"
                disabled={generatingTestData}
                class="dev-count-input"
                title="Number of test transactions to generate"
              />
              <button 
                class="dev-test-btn-compact"
                onclick={generateTestData}
                disabled={generatingTestData}
                title="Generate test transactions for performance testing"
              >
                {#if generatingTestData}⏳{:else}🧪{/if}
              </button>
            </div>
          {/if}
          
          <div class="balance-display">
            <span class="balance-value">
              {unit?.symbol ?? ''}{#if entries.length > 0}{formatAmount(entries[entries.length - 1].runningBalance)}{:else}0.00{/if}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Dev progress indicator -->
      {#if ENABLE_TEST_DATA_GENERATOR && testDataProgress}
        <div class="dev-progress-bar">
          <span class="dev-progress-text">{testDataProgress}</span>
        </div>
      {/if}
    {/if}
  </header>
  
  <!-- Column Headers (fixed, outside scroll area) -->
  {#if !loading && !error}
    <div class="column-headers ledger-grid" role="row" aria-rowindex="1">
      <div class="col-expand" role="columnheader" aria-colindex="1">
        <button 
          class="expand-all-btn" 
          onclick={toggleExpandAll}
          title={expandAll ? $t('ledger.collapse_all') : $t('ledger.expand_all')}
        >
          {expandAll ? '▼' : '▶'}
        </button>
      </div>
      <div class="col-date" role="columnheader" aria-colindex="2">{$t('ledger.date')}</div>
      <div class="col-ref" role="columnheader" aria-colindex="3">{$t('ledger.ref')}</div>
      <div class="col-memo" role="columnheader" aria-colindex="4">{$t('ledger.memo')}</div>
      <div class="col-offset" role="columnheader" aria-colindex="5">{$t('ledger.offset')}</div>
      <div class="col-debit" role="columnheader" aria-colindex="6">{$t('ledger.debit')}</div>
      <div class="col-credit" role="columnheader" aria-colindex="7">{$t('ledger.credit')}</div>
      <div class="col-balance" role="columnheader" aria-colindex="8">{$t('ledger.running_balance')}</div>
    </div>
  {/if}
  
  <!-- Ledger Grid (scrollable transactions) -->
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
      <div class="ledger-grid" role="grid" aria-label={$t('ledger.title')}>
          {#if transactions.length === 0}
            <div class="empty-row" role="row" aria-rowindex="2">
              <div class="empty-message" style="grid-column: 1 / -1;">
                <p>{$t('ledger.no_transactions')}</p>
                <p class="text-muted">{$t('ledger.enter_first')}</p>
              </div>
            </div>
          {/if}
          
          <!-- New Entry Row (top position when newest first) -->
          {#if $settings.transactionSortOrder === 'newest'}
            {#if isNewEntry && editingTransactionId === 'new' && editingData}
              <!-- NEW ENTRY at top (newest first) -->
              <TransactionEditor
                bind:editingData={editingData}
                {isNewEntry}
                entityId={account?.entityId ?? ''}
                {accountId}
                accountName={account?.name ?? ''}
                accountPath={getAccountPath()}
                {unit}
                onSave={saveEdit}
                onCancel={cancelEdit}
                onAddSplit={addSplitEntry}
                onRemoveSplit={removeSplitEntry}
                onCurrentDebitBlur={handleCurrentDebitBlur}
                onCurrentCreditBlur={handleCurrentCreditBlur}
                onSplitDebitBlur={handleSplitDebitBlur}
                onSplitCreditBlur={handleSplitCreditBlur}
                onFocus={handleFocus}
                {getEditTotals}
              />
            {:else}
              <!-- Blank entry row (keyboard-accessible with real inputs) -->
              <div class="new-entry-row blank-entry-row ledger-row" role="row">
                <div class="col-expand" role="gridcell"></div>
                <div class="col-date" role="gridcell">
                  <input 
                    type="date" 
                    class="blank-input"
                    value={new Date().toISOString().split('T')[0]}
                    onfocus={activateNewEntry}
                    placeholder=""
                  />
                </div>
                <div class="col-ref" role="gridcell">
                  <input 
                    type="text" 
                    class="blank-input"
                    onfocus={activateNewEntry}
                    placeholder={$t('ledger.ref')}
                  />
                </div>
                <div class="col-memo" role="gridcell">
                  <input 
                    type="text" 
                    class="blank-input"
                    onfocus={activateNewEntry}
                    placeholder={$t('ledger.enter_new_transaction')}
                  />
                </div>
                <div class="col-offset" role="gridcell"></div>
                <div class="col-debit" role="gridcell"></div>
                <div class="col-credit" role="gridcell"></div>
                <div class="col-balance" role="gridcell"></div>
              </div>
            {/if}
          {/if}
          
          {#each transactions as txn, idx (txn.transactionId)}
            <!-- Locked separator -->
            {#if hasLockedTransactions && idx === firstUnlockedIndex}
              <div class="locked-separator ledger-row" role="row">
                <div class="separator-line" style="grid-column: 1 / -1;">
                  <span class="lock-icon">🔒</span>
                </div>
              </div>
            {/if}
            
            <!-- Transaction in edit mode -->
            {#if editingTransactionId === txn.transactionId && editingData}
              <!-- EDIT EXISTING TRANSACTION -->
              <TransactionEditor
                bind:editingData={editingData}
                isNewEntry={false}
                entityId={account?.entityId ?? ''}
                {accountId}
                accountName={account?.name ?? ''}
                accountPath={getAccountPath()}
                {unit}
                onSave={saveEdit}
                onCancel={cancelEdit}
                onDelete={deleteTransaction}
                onAddSplit={addSplitEntry}
                onRemoveSplit={removeSplitEntry}
                onCurrentDebitBlur={handleCurrentDebitBlur}
                onCurrentCreditBlur={handleCurrentCreditBlur}
                onSplitDebitBlur={handleSplitDebitBlur}
                onSplitCreditBlur={handleSplitCreditBlur}
                onFocus={handleFocus}
                {getEditTotals}
                transactionId={txn.transactionId}
              />
            {:else}
              <!-- View mode: Collapsed or Expanded -->
              {#if txn.isExpanded}
                <!-- Expanded: Transaction header -->
                <div 
                  class="transaction-header ledger-row"
                  class:locked={txn.isLocked}
                  class:clickable={!txn.isLocked}
                  onclick={() => !txn.isLocked && enterEditMode(txn)}
                  role="row"
                  aria-expanded="true"
                >
                  <div class="col-expand" role="gridcell">
                    <button 
                      class="expand-btn" 
                      onclick={(e) => { e.stopPropagation(); toggleExpand(txn.transactionId); }}
                    >
                      ▼
                    </button>
                  </div>
                  <div class="col-date" role="gridcell">{formatDate(txn.date)}</div>
                  <div class="col-ref" role="gridcell">{txn.reference ?? ''}</div>
                  <div class="col-memo" role="gridcell">{txn.memo ?? ''}</div>
                  <div class="col-offset" role="gridcell"></div>
                  <div class="col-debit" role="gridcell"></div>
                  <div class="col-credit" role="gridcell"></div>
                  <div class="col-balance amount" role="gridcell">
                    {#if txn.entries[0]}
                      {formatAmount(txn.entries[0].runningBalance)}
                    {/if}
                  </div>
                </div>
                
                <!-- Expanded: Entry lines -->
                {#each txn.entries as entry (entry.entryId)}
                  <!-- Current account entry -->
                  <div class="entry-line ledger-row" class:locked={txn.isLocked} role="row">
                    <div class="col-expand" role="gridcell"></div>
                    <div class="col-date" role="gridcell"></div>
                    <div class="col-ref" role="gridcell"></div>
                    <div class="col-memo" role="gridcell">{entry.note ?? ''}</div>
                    <div class="col-offset" role="gridcell">
                      <a href="/ledger/{accountId}" title={getAccountPath()}>
                        {account?.name}
                      </a>
                    </div>
                    <div class="col-debit amount" role="gridcell">
                      {entry.amount > 0 ? formatAmount(entry.amount) : ''}
                    </div>
                    <div class="col-credit amount" role="gridcell">
                      {entry.amount < 0 ? formatAmount(Math.abs(entry.amount)) : ''}
                    </div>
                    <div class="col-balance" role="gridcell"></div>
                  </div>
                  
                  <!-- Offset account entry (simple) -->
                  {#if entry.offsetAccountName}
                    <div class="entry-line ledger-row" class:locked={txn.isLocked} role="row">
                      <div class="col-expand" role="gridcell"></div>
                      <div class="col-date" role="gridcell"></div>
                      <div class="col-ref" role="gridcell"></div>
                      <div class="col-memo" role="gridcell"></div>
                      <div class="col-offset" role="gridcell">
                        <a href="/ledger/{entry.offsetAccountId}" title={entry.offsetAccountPath || entry.offsetAccountName}>
                          {entry.offsetAccountName}
                        </a>
                      </div>
                      <div class="col-debit amount" role="gridcell">
                        {entry.amount < 0 ? formatAmount(Math.abs(entry.amount)) : ''}
                      </div>
                      <div class="col-credit amount" role="gridcell">
                        {entry.amount > 0 ? formatAmount(entry.amount) : ''}
                      </div>
                      <div class="col-balance" role="gridcell"></div>
                    </div>
                  {/if}
                  
                  <!-- Split entries -->
                  {#if entry.splitEntries}
                    {#each entry.splitEntries as split (split.entryId)}
                      <div class="entry-line ledger-row" class:locked={txn.isLocked} role="row">
                        <div class="col-expand" role="gridcell"></div>
                        <div class="col-date" role="gridcell"></div>
                        <div class="col-ref" role="gridcell"></div>
                        <div class="col-memo" role="gridcell">{split.note ?? ''}</div>
                        <div class="col-offset" role="gridcell">
                          <a href="/ledger/{split.accountId}" title={split.accountPath}>
                            {split.accountName}
                          </a>
                        </div>
                        <div class="col-debit amount" role="gridcell">
                          {split.amount > 0 ? formatAmount(split.amount) : ''}
                        </div>
                        <div class="col-credit amount" role="gridcell">
                          {split.amount < 0 ? formatAmount(Math.abs(split.amount)) : ''}
                        </div>
                        <div class="col-balance" role="gridcell"></div>
                      </div>
                    {/each}
                  {/if}
                {/each}
              {:else}
                <!-- Collapsed: Single line -->
                <div 
                  class="transaction-line ledger-row"
                  class:locked={txn.isLocked}
                  class:clickable={!txn.isLocked}
                  onclick={() => !txn.isLocked && enterEditMode(txn)}
                  role="row"
                  aria-expanded="false"
                >
                  <div class="col-expand" role="gridcell">
                    <button 
                      class="expand-btn" 
                      onclick={(e) => { e.stopPropagation(); toggleExpand(txn.transactionId); }}
                    >
                      ▶
                    </button>
                  </div>
                  <div class="col-date" role="gridcell">{formatDate(txn.date)}</div>
                  <div class="col-ref" role="gridcell">{txn.reference ?? ''}</div>
                  <div class="col-memo" role="gridcell">{txn.memo ?? ''}</div>
                  <div class="col-offset" role="gridcell">
                    {#if txn.entries[0]?.isSplit}
                      <span class="split-indicator">[{$t('ledger.split')}]</span>
                    {:else if txn.entries[0]?.offsetAccountName}
                      <a href="/ledger/{txn.entries[0].offsetAccountId}" title={txn.entries[0].offsetAccountPath || txn.entries[0].offsetAccountName}>
                        {txn.entries[0].offsetAccountName}
                      </a>
                    {/if}
                  </div>
                  <div class="col-debit amount" role="gridcell">
                    {#if txn.entries[0] && txn.entries[0].amount > 0}
                      {formatAmount(txn.entries[0].amount)}
                    {/if}
                  </div>
                  <div class="col-credit amount" role="gridcell">
                    {#if txn.entries[0] && txn.entries[0].amount < 0}
                      {formatAmount(Math.abs(txn.entries[0].amount))}
                    {/if}
                  </div>
                  <div class="col-balance amount" role="gridcell">
                    {#if txn.entries[0]}
                      {formatAmount(txn.entries[0].runningBalance)}
                    {/if}
                  </div>
                </div>
              {/if}
            {/if}
          {/each}
          
          <!-- New Entry Row (position depends on sort order) -->
          {#if $settings.transactionSortOrder === 'oldest'}
            {#if isNewEntry && editingTransactionId === 'new' && editingData}
              <!-- NEW ENTRY at bottom (oldest first) -->
              <TransactionEditor
                bind:editingData={editingData}
                {isNewEntry}
                entityId={account?.entityId ?? ''}
                {accountId}
                accountName={account?.name ?? ''}
                accountPath={getAccountPath()}
                {unit}
                onSave={saveEdit}
                onCancel={cancelEdit}
                onAddSplit={addSplitEntry}
                onRemoveSplit={removeSplitEntry}
                onCurrentDebitBlur={handleCurrentDebitBlur}
                onCurrentCreditBlur={handleCurrentCreditBlur}
                onSplitDebitBlur={handleSplitDebitBlur}
                onSplitCreditBlur={handleSplitCreditBlur}
                onFocus={handleFocus}
                {getEditTotals}
              />
            {:else}
            <!-- Blank entry row (keyboard-accessible with real inputs) -->
            <div class="new-entry-row blank-entry-row ledger-row" role="row">
              <div class="col-expand" role="gridcell"></div>
              <div class="col-date" role="gridcell">
                <input 
                  type="date" 
                  class="blank-input"
                  value={new Date().toISOString().split('T')[0]}
                  onfocus={activateNewEntry}
                  placeholder=""
                />
              </div>
              <div class="col-ref" role="gridcell">
                <input 
                  type="text" 
                  class="blank-input"
                  onfocus={activateNewEntry}
                  placeholder={$t('ledger.ref')}
                />
              </div>
              <div class="col-memo" role="gridcell">
                <input 
                  type="text" 
                  class="blank-input"
                  onfocus={activateNewEntry}
                  placeholder={$t('ledger.enter_new_transaction')}
                />
              </div>
              <div class="col-offset" role="gridcell"></div>
              <div class="col-debit" role="gridcell"></div>
              <div class="col-credit" role="gridcell"></div>
              <div class="col-balance" role="gridcell"></div>
            </div>
            {/if}
          {/if}
      </div>
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
  
  /* Column Headers (fixed, outside scroll area) */
  .column-headers {
    background: var(--surface-primary);
    flex-shrink: 0;
    border-bottom: 2px solid var(--border-color);
    padding: 0.75rem 0;
  }
  
  .column-headers > div {
    text-align: left;
    padding: 0 1rem;
    font-weight: 600;
    color: var(--text-muted);
    font-size: 0.8125rem;
    text-transform: uppercase;
  }
  
  /* Ledger Container (scrollable) */
  .ledger-container {
    flex: 1;
    overflow-y: auto;
    padding: 0;
  }
  
  /* Grid */
  .ledger-grid {
    display: grid;
    grid-template-columns: 
      40px      /* Expand/collapse button */
      135px     /* Date */
      100px     /* Reference */
      1fr       /* Memo (flexible) */
      200px     /* Offset account */
      160px     /* Debit */
      160px     /* Credit */
      160px;    /* Running balance */
    gap: 0;
    font-size: 0.875rem;
    width: 100%;
  }
  
  .ledger-row {
    display: contents; /* Children become grid items */
  }
  
  .ledger-row > div {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--border-light);
  }
  
  /* Performance: Browser-native virtualization */
  .transaction-line,
  .transaction-header,
  .entry-line {
    content-visibility: auto;
    contain-intrinsic-size: auto 40px; /* Height hint for browser */
  }
  
  /* Column alignment */
  .col-debit,
  .col-credit,
  .col-balance {
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
  .locked-separator {
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
  
  /* Edit mode rows - unified blue border */
  .edit-simple-row,
  .edit-metadata-row,
  .edit-entry-row,
  .edit-actions-row {
    background: var(--surface-hover, #f9f9f9) !important;
    position: relative;
  }
  
  /* First row in edit group gets top border */
  .edit-simple-row,
  .edit-metadata-row {
    border: 2px solid var(--primary-color, #0066cc);
    border-bottom: none;
  }
  
  /* Middle rows get left/right borders only */
  .edit-entry-row {
    border-left: 2px solid var(--primary-color, #0066cc);
    border-right: 2px solid var(--primary-color, #0066cc);
    border-bottom: none;
  }
  
  /* Last row (actions) gets bottom border */
  .edit-actions-row {
    border: 2px solid var(--primary-color, #0066cc);
    border-top: none;
  }
  
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
  
  .edit-current-account {
    background: var(--surface-secondary);
  }
  
  .edit-actions-row td {
    padding: 0 !important;
    background: var(--surface-hover, #f9f9f9) !important;
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
  
  /* Hide spinners on number inputs */
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  input[type="number"] {
    -moz-appearance: textfield;
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
    background: var(--surface-secondary);
    border-top: 2px dashed var(--border-color);
  }
  
  .blank-entry-row:hover {
    background: var(--surface-hover);
  }
  
  /* Blank entry row inputs - subtle styling */
  .blank-input {
    width: 100%;
    padding: 0.375rem 0.5rem;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    font-style: italic;
    transition: all 0.15s;
  }
  
  .blank-input:hover {
    border-color: var(--border-light);
    background: var(--surface-primary);
  }
  
  .blank-input:focus {
    outline: none;
    border-color: var(--primary-color);
    background: var(--surface-primary);
    color: var(--text-primary);
    font-style: normal;
  }
  
  .new-entry-row {
    border-left: 4px solid var(--success-color);
  }
  
  /* Current account link */
  .current-account-link {
    color: var(--text-muted);
    text-decoration: none;
    font-style: italic;
  }
  
  .current-account-link:hover {
    text-decoration: underline;
    color: var(--primary-color);
  }
  
  /* Dev tools (compact, config-controlled) */
  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .dev-test-tool {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: rgba(243, 156, 18, 0.1);
    border: 1px solid rgba(243, 156, 18, 0.3);
    border-radius: 4px;
  }
  
  .dev-count-input {
    width: 60px;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border-light);
    border-radius: 3px;
    font-size: 0.75rem;
    text-align: right;
    background: var(--surface-primary);
    color: var(--text-primary);
  }
  
  .dev-count-input:focus {
    outline: none;
    border-color: #f39c12;
  }
  
  .dev-test-btn-compact {
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    transition: transform 0.15s;
  }
  
  .dev-test-btn-compact:hover:not(:disabled) {
    transform: scale(1.1);
  }
  
  .dev-test-btn-compact:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .dev-progress-bar {
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
    border-top: 1px solid #f39c12;
    font-size: 0.8125rem;
  }
  
  .dev-progress-text {
    color: #856404;
    font-weight: 500;
  }
</style>

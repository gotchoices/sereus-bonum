<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  import { entities } from '$lib/stores/entities';
  import { accounts, accountGroups } from '$lib/stores/accounts';
  import { loadViewState, saveViewState } from '$lib/stores/viewState';
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
  
  // View state - use individual reactive variables for proper reactivity
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
        // Read from reactive state variables directly
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
    mainDebit: string;
    mainCredit: string;
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
    log.ui.debug('[Ledger] Toggling expand for:', transactionId);
    expandedTransactions = {
      ...expandedTransactions,
      [transactionId]: !expandedTransactions[transactionId]
    };
  }
  
  // Expand/Collapse All
  function handleExpandAll() {
    log.ui.debug('[Ledger] Expand all clicked');
    expandAll = true;
  }
  
  function handleCollapseAll() {
    log.ui.debug('[Ledger] Collapse all clicked');
    expandAll = false;
    expandedTransactions = {};
  }
  
  // Enter edit mode for existing transaction
  function enterEditMode(txn: TransactionGroup) {
    if (txn.isLocked) {
      log.ui.warn('[Ledger] Cannot edit locked transaction:', txn.transactionId);
      return;
    }
    
    log.ui.info('[Ledger] Entering edit mode for transaction:', txn.transactionId);
    log.ui.debug('[Ledger] Transaction data:', txn);
    editingTransactionId = txn.transactionId;
    
    // Load transaction data into edit form
    const mainEntry = txn.entries[0]; // Current account entry
    log.ui.debug('[Ledger] Main entry:', mainEntry);
    log.ui.debug('[Ledger] isSplit:', mainEntry.isSplit, 'splitEntries:', mainEntry.splitEntries);
    
    // Check if split transaction (more than 2 entries total)
    const isSplit = mainEntry.isSplit || (mainEntry.splitEntries && mainEntry.splitEntries.length > 0);
    
    if (isSplit && mainEntry.splitEntries) {
      // Split transaction - load all splits
      log.ui.info('[Ledger] Loading split transaction with', mainEntry.splitEntries.length, 'splits');
      editingData = {
        date: txn.date,
        reference: txn.reference || '',
        memo: txn.memo || '',
        mainDebit: mainEntry.amount > 0 ? formatAmount(mainEntry.amount) : '',
        mainCredit: mainEntry.amount < 0 ? formatAmount(Math.abs(mainEntry.amount)) : '',
        entries: mainEntry.splitEntries.map(split => {
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
      // Simple transaction - one offset account
      log.ui.info('[Ledger] Loading simple transaction, offset:', mainEntry.offsetAccountName);
      editingData = {
        date: txn.date,
        reference: txn.reference || '',
        memo: txn.memo || '',
        mainDebit: mainEntry.amount > 0 ? formatAmount(mainEntry.amount) : '',
        mainCredit: mainEntry.amount < 0 ? formatAmount(Math.abs(mainEntry.amount)) : '',
        entries: [{
          id: crypto.randomUUID(),
          accountId: mainEntry.offsetAccountId || '',
          accountSearch: mainEntry.offsetAccountName || '',
          debit: mainEntry.amount < 0 ? formatAmount(Math.abs(mainEntry.amount)) : '',
          credit: mainEntry.amount > 0 ? formatAmount(mainEntry.amount) : '',
          note: '',
        }],
      };
    }
    log.ui.debug('[Ledger] EditingData set to:', editingData);
  }
  
  // Add split entry in edit mode
  function addEditSplitEntry() {
    if (!editingData) return;
    editingData.entries = [
      ...editingData.entries,
      {
        id: crypto.randomUUID(),
        accountId: '',
        accountSearch: '',
        debit: '',
        credit: '',
        note: '',
      }
    ];
  }
  
  // Remove split entry in edit mode
  function removeEditSplitEntry(id: string) {
    if (!editingData) return;
    editingData.entries = editingData.entries.filter(e => e.id !== id);
    if (editingData.entries.length === 0) {
      addEditSplitEntry();
    }
  }
  
  // Calculate edit balance and totals
  function getEditBalance(): number {
    if (!editingData) return 0;
    
    const divisor = unit?.displayDivisor ?? 100;
    
    // Main entry amount
    const mainDebit = editingData.mainDebit ? parseFloat(editingData.mainDebit) : 0;
    const mainCredit = editingData.mainCredit ? parseFloat(editingData.mainCredit) : 0;
    const mainAmount = mainDebit || -mainCredit;
    
    // Other entries sum
    const entriesSum = editingData.entries.reduce((sum, entry) => {
      const debit = entry.debit ? parseFloat(entry.debit) : 0;
      const credit = entry.credit ? parseFloat(entry.credit) : 0;
      return sum + (debit || -credit);
    }, 0);
    
    return (mainAmount + entriesSum) * divisor;
  }
  
  function getEditTotals(): { debits: number; credits: number; balance: number } {
    if (!editingData) return { debits: 0, credits: 0, balance: 0 };
    
    const divisor = unit?.displayDivisor ?? 100;
    
    const mainDebit = editingData.mainDebit ? parseFloat(editingData.mainDebit) : 0;
    const mainCredit = editingData.mainCredit ? parseFloat(editingData.mainCredit) : 0;
    
    const debitsTotal = mainDebit + editingData.entries.reduce((sum, e) => {
      return sum + (e.debit ? parseFloat(e.debit) : 0);
    }, 0);
    
    const creditsTotal = mainCredit + editingData.entries.reduce((sum, e) => {
      return sum + (e.credit ? parseFloat(e.credit) : 0);
    }, 0);
    
    const balance = getEditBalance();
    
    return { debits: debitsTotal, credits: creditsTotal, balance };
  }
  
  // Handle blur in edit mode
  function handleEditDebitBlur(entryId: string) {
    if (!editingData) return;
    const entry = editingData.entries.find(e => e.id === entryId);
    if (entry && entry.debit) {
      entry.credit = '';
    }
  }
  
  function handleEditCreditBlur(entryId: string) {
    if (!editingData) return;
    const entry = editingData.entries.find(e => e.id === entryId);
    if (entry && entry.credit) {
      entry.debit = '';
    }
  }
  
  function handleEditMainDebitBlur() {
    if (!editingData) return;
    if (editingData.mainDebit) {
      editingData.mainCredit = '';
    }
  }
  
  function handleEditMainCreditBlur() {
    if (!editingData) return;
    if (editingData.mainCredit) {
      editingData.mainDebit = '';
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
    
    const divisor = unit?.displayDivisor ?? 100;
    const mainDebit = editingData.mainDebit ? parseFloat(editingData.mainDebit) * divisor : 0;
    const mainCredit = editingData.mainCredit ? parseFloat(editingData.mainCredit) * divisor : 0;
    const mainAmount = mainDebit || -mainCredit;
    
    // Validate
    if (!editingData.date || !mainAmount) {
      log.ui.warn('[Ledger] Edit validation failed: incomplete data');
      return;
    }
    
    // Validate all entries have accounts and amounts
    const validEntries = editingData.entries.filter(e => {
      const hasAccount = !!e.accountId;
      const hasAmount = !!(e.debit || e.credit);
      return hasAccount && hasAmount;
    });
    
    if (validEntries.length === 0) {
      log.ui.warn('[Ledger] Edit validation failed: no valid offset entries');
      return;
    }
    
    // Check balance
    const balance = getEditBalance();
    if (Math.abs(balance) > 1) {
      log.ui.warn('[Ledger] Edit validation failed: imbalanced by', balance / divisor);
      alert($t('ledger.transaction_must_balance'));
      return;
    }
    
    try {
      const ds = await getDataService();
      
      // Update transaction metadata
      await ds.updateTransaction(editingTransactionId, {
        date: editingData.date,
        reference: editingData.reference || undefined,
        memo: editingData.memo || undefined,
      });
      
      // For now, we'd need to delete old entries and create new ones
      // This would require additional DataService methods
      // Log for now and reload
      log.ui.info('[Ledger] Transaction metadata updated');
      
      cancelEdit();
      await loadData(); // Reload ledger
    } catch (e) {
      log.ui.error('[Ledger] Edit save failed:', e);
      alert($t('common.error') + ': ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
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
        <button class="btn-icon" onclick={handleExpandAll} title={$t('ledger.expand_all')}>
          ▼ {$t('ledger.expand_all')}
        </button>
        <button class="btn-icon" onclick={handleCollapseAll} title={$t('ledger.collapse_all')}>
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
                    
                    <!-- Full inline transaction editor -->
                    <table class="edit-table">
                      <thead>
                        <tr>
                          <th class="col-date">{$t('ledger.date')}</th>
                          <th class="col-ref">{$t('ledger.ref')}</th>
                          <th class="col-memo">{$t('ledger.memo')}</th>
                          <th class="col-offset">{$t('ledger.offset')}</th>
                          <th class="col-debit">{$t('ledger.debit')}</th>
                          <th class="col-credit">{$t('ledger.credit')}</th>
                          <th class="col-actions"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <!-- Main transaction line (current account) -->
                        <tr class="edit-main-line">
                          <td>
                            <input 
                              type="date" 
                              bind:value={editingData.date}
                              onfocus={handleFocus}
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              bind:value={editingData.reference}
                              placeholder={$t('ledger.ref')}
                              onfocus={handleFocus}
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              bind:value={editingData.memo}
                              placeholder={$t('ledger.memo')}
                              onfocus={handleFocus}
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              value={account?.name ?? ''}
                              disabled
                              class="current-account-disabled"
                            />
                          </td>
                          <td>
                            <input 
                              type="number" 
                              step="0.01" 
                              bind:value={editingData.mainDebit}
                              placeholder="0.00"
                              onblur={handleEditMainDebitBlur}
                              onfocus={handleFocus}
                            />
                          </td>
                          <td>
                            <input 
                              type="number" 
                              step="0.01" 
                              bind:value={editingData.mainCredit}
                              placeholder="0.00"
                              onblur={handleEditMainCreditBlur}
                              onfocus={handleFocus}
                            />
                          </td>
                          <td></td>
                        </tr>
                        
                        <!-- Offset/split entries -->
                        {#each editingData.entries as entry, idx (entry.id)}
                          {@const balance = getEditBalance()}
                          {@const divisor = unit?.displayDivisor ?? 100}
                          {@const autoFillAmount = idx === editingData.entries.length - 1 && !entry.debit && !entry.credit ? formatAmount(-balance) : ''}
                          {@const isDebit = balance < 0}
                          
                          <tr class="edit-split-line">
                            <td colspan="2"></td>
                            <td>
                              <input 
                                type="text" 
                                bind:value={entry.note}
                                placeholder={$t('ledger.note')}
                                onfocus={handleFocus}
                              />
                            </td>
                            <td>
                              <AccountAutocomplete
                                entityId={account?.entityId ?? ''}
                                bind:search={entry.accountSearch}
                                bind:selectedId={entry.accountId}
                                disabled={false}
                                onfocus={handleFocus}
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                step="0.01" 
                                bind:value={entry.debit}
                                placeholder={isDebit ? autoFillAmount : '0.00'}
                                onblur={() => handleEditDebitBlur(entry.id)}
                                onfocus={handleFocus}
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                step="0.01" 
                                bind:value={entry.credit}
                                placeholder={!isDebit ? autoFillAmount : '0.00'}
                                onblur={() => handleEditCreditBlur(entry.id)}
                                onfocus={handleFocus}
                              />
                            </td>
                            <td>
                              {#if editingData.entries.length > 1}
                                <button 
                                  class="btn-remove-split" 
                                  onclick={() => removeEditSplitEntry(entry.id)}
                                  title={$t('ledger.remove_split')}
                                >
                                  ×
                                </button>
                              {/if}
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                    
                    <!-- Actions Footer: Buttons on left, Totals on right -->
                    <div class="edit-actions-footer">
                      <div class="edit-actions-left">
                        <button class="btn-primary" onclick={saveEdit}>{$t('common.save')}</button>
                        <button class="btn-secondary" onclick={cancelEdit}>{$t('common.cancel')}</button>
                        <button class="btn-secondary" onclick={addEditSplitEntry}>+ {$t('ledger.add_split')}</button>
                        <button class="btn-danger" onclick={() => deleteTransaction(txn)}>{$t('common.delete')}</button>
                      </div>
                      <div class="edit-totals-right">
                        {#if editingData}
                          {@const totals = getEditTotals()}
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
                        {/if}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            {:else}
              <!-- Transaction header (collapsed or expanded) -->
              {#if txn.isExpanded}
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
                    {#if txn.entries[0]?.isSplit}
                      <span class="split-indicator">[{$t('ledger.split')}]</span>
                    {/if}
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
                    <td class="col-balance amount"></td>
                  </tr>
                  
                  <!-- Offset account entry (for simple transactions) -->
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
                      <td class="col-balance amount"></td>
                    </tr>
                  {/if}
                  
                  <!-- Split entries (for split transactions) -->
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
                        <td class="col-balance amount"></td>
                      </tr>
                    {/each}
                  {/if}
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
                    <button 
                      class="expand-btn" 
                      onclick={(e) => { e.stopPropagation(); toggleExpand(txn.transactionId); }}
                      aria-label={$t('ledger.expand')}
                    >
                      ▶
                    </button>
                  </td>
                  <td class="col-date">{txn.date}</td>
                  <td class="col-ref">{txn.reference ?? ''}</td>
                  <td class="col-memo">{txn.memo ?? ''}</td>
                  <td class="col-offset">
                    {#if txn.entries.length > 2 || txn.entries[0]?.isSplit}
                      <span class="split-indicator">[{$t('ledger.split')}]</span>
                    {:else if txn.entries[0]?.offsetAccountName}
                      <a href="/ledger/{txn.entries[0].offsetAccountId}" title={txn.entries[0].offsetAccountPath || txn.entries[0].offsetAccountName}>
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
  
  .edit-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  
  .edit-table thead th {
    text-align: left;
    padding: 0.5rem;
    border-bottom: 1px solid var(--border-color);
    font-weight: 600;
  }
  
  .edit-table tbody td {
    padding: 0.5rem;
  }
  
  .edit-table input {
    width: 100%;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border-light);
    border-radius: 4px;
    background: var(--surface-primary);
    color: var(--text-primary);
    font-size: inherit;
  }
  
  .edit-table input:focus {
    outline: none;
    border-color: var(--primary-color);
  }
  
  .edit-table input:disabled {
    background: var(--surface-secondary);
    color: var(--text-muted);
    cursor: not-allowed;
  }
  
  .edit-table input[type="number"] {
    text-align: right;
    font-family: 'Courier New', monospace;
  }
  
  .edit-main-line {
    background: var(--surface-primary);
  }
  
  .edit-split-line {
    background: var(--surface-secondary);
  }
  
  .edit-actions-footer {
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    background: var(--surface-secondary);
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 2rem;
  }
  
  .edit-actions-left {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
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

<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  import { entities } from '$lib/stores/entities';
  import { 
    accounts, 
    accountsLoading, 
    accountGroups,
    topLevelGroupsByType,
    childGroupsByParent,
    loadAccounts
  } from '$lib/stores/accounts';
  import { getDataService, type AccountType, type BalanceSheetData } from '$lib/data';
  import { loadViewState, saveViewState } from '$lib/stores/viewState';
  
  // Report modes
  type ReportMode = 'balance_sheet' | 'trial_balance' | 'income_statement' | 'cash_flow' | 'custom';
  
  // Get entity ID from route
  let entityId = $derived($page.params.id);
  let entity = $derived($entities.find(e => e.id === entityId));
  
  // Balance sheet data
  let balanceData = $state<BalanceSheetData | null>(null);
  let balanceLoading = $state(true);
  
  // View state - persisted
  let expandedGroups = $state<Record<string, boolean>>({});
  let reportMode = $state<ReportMode>('balance_sheet');
  let asOfDate = $state(new Date().toISOString().split('T')[0]);
  let retainedEarningsExpanded = $state(false);
  
  // Load persisted view state
  $effect(() => {
    if (browser && entityId) {
      expandedGroups = loadViewState(`accounts-expand-${entityId}`, {});
      reportMode = loadViewState(`accounts-mode-${entityId}`, 'balance_sheet');
      retainedEarningsExpanded = loadViewState(`accounts-re-expanded-${entityId}`, false);
      log.ui.debug('[Accounts] Loaded view state for entity:', entityId);
    }
  });
  
  // Load data when entity changes
  let lastEntityId: string | null = null;
  $effect(() => {
    if (browser && entityId && entityId !== lastEntityId) {
      lastEntityId = entityId;
      loadEntityData();
    }
  });
  
  async function loadEntityData() {
    log.ui.debug('[Accounts] Loading data for entity:', entityId);
    balanceLoading = true;
    try {
      const ds = await getDataService();
      await loadAccounts(entityId);
      balanceData = await ds.getBalanceSheet(entityId, asOfDate);
      log.ui.debug('[Accounts] Balance sheet loaded');
    } catch (e) {
      log.ui.error('[Accounts] Failed to load:', e);
    } finally {
      balanceLoading = false;
    }
  }
  
  // Reload when date changes
  async function handleDateChange() {
    if (browser && entityId) {
      balanceLoading = true;
      try {
        const ds = await getDataService();
        balanceData = await ds.getBalanceSheet(entityId, asOfDate);
      } catch (e) {
        log.ui.error('[Accounts] Failed to reload:', e);
      } finally {
        balanceLoading = false;
      }
    }
  }
  
  // Account type display info
  const typeInfo: Record<AccountType, { icon: string; color: string }> = {
    ASSET: { icon: '💰', color: 'var(--asset-color, #4ade80)' },
    LIABILITY: { icon: '📋', color: 'var(--liability-color, #f87171)' },
    EQUITY: { icon: '📊', color: 'var(--equity-color, #60a5fa)' },
    INCOME: { icon: '📈', color: 'var(--income-color, #34d399)' },
    EXPENSE: { icon: '📉', color: 'var(--expense-color, #fb923c)' },
  };
  
  // Types to show based on mode
  function getVisibleTypes(): AccountType[] {
    switch (reportMode) {
      case 'balance_sheet':
        return ['ASSET', 'LIABILITY', 'EQUITY'];
      case 'trial_balance':
        return ['ASSET', 'LIABILITY', 'EQUITY']; // Income/Expense shown under RE
      case 'income_statement':
        return ['INCOME', 'EXPENSE'];
      default:
        return ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
    }
  }
  
  let visibleTypes = $derived(getVisibleTypes());
  
  // Expand/collapse functions
  function toggleGroup(groupId: string) {
    expandedGroups[groupId] = !expandedGroups[groupId];
    expandedGroups = { ...expandedGroups };
    saveViewState(`accounts-expand-${entityId}`, expandedGroups);
  }
  
  function expandAll() {
    const allGroupIds = $accountGroups.map(g => g.id);
    allGroupIds.forEach(id => expandedGroups[id] = true);
    expandedGroups = { ...expandedGroups };
    saveViewState(`accounts-expand-${entityId}`, expandedGroups);
  }
  
  function collapseAll() {
    expandedGroups = {};
    saveViewState(`accounts-expand-${entityId}`, expandedGroups);
  }
  
  function toggleRetainedEarnings() {
    retainedEarningsExpanded = !retainedEarningsExpanded;
    saveViewState(`accounts-re-expanded-${entityId}`, retainedEarningsExpanded);
  }
  
  function setMode(mode: ReportMode) {
    reportMode = mode;
    saveViewState(`accounts-mode-${entityId}`, mode);
  }
  
  // Helper functions
  function getAccountsForGroup(groupId: string) {
    return $accounts.filter(a => a.accountGroupId === groupId);
  }
  
  function getAccountBalance(accountId: string): number {
    if (!balanceData) return 0;
    const ab = balanceData.accountBalances.find(b => b.accountId === accountId);
    return ab?.balance ?? 0;
  }
  
  function getGroupTotal(groupId: string): number {
    if (!balanceData) return 0;
    const gb = balanceData.groupBalances.find(b => b.groupId === groupId);
    return gb?.balance ?? 0;
  }
  
  function getTypeTotal(type: AccountType): number {
    if (!balanceData) return 0;
    switch (type) {
      case 'ASSET': return balanceData.totalAssets;
      case 'LIABILITY': return balanceData.totalLiabilities;
      case 'EQUITY': return balanceData.totalEquity;
      default: return 0;
    }
  }
  
  // Retained Earnings = Net Income (calculated)
  // For now, use total equity as it includes retained earnings
  let retainedEarnings = $derived(balanceData?.totalEquity ?? 0);
  
  // Verification: Assets should equal Liabilities + Equity
  let liabilitiesPlusEquity = $derived(
    balanceData ? balanceData.totalLiabilities + balanceData.totalEquity : 0
  );
  
  let isBalanced = $derived(
    !balanceData || Math.abs(balanceData.totalAssets - liabilitiesPlusEquity) < 0.01
  );
  
  let imbalanceAmount = $derived(
    balanceData ? balanceData.totalAssets - liabilitiesPlusEquity : 0
  );
  
  function formatCurrency(amount: number, unit: string = 'USD'): string {
    const value = amount / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: unit,
      minimumFractionDigits: 2,
    }).format(value);
  }
</script>

<div class="accounts-page">
  <header class="page-header">
    <div class="header-left">
      <a href="/" class="back-link">← {$t('nav.home')}</a>
      <h1>{entity?.name ?? $t('common.loading')}</h1>
    </div>
    
    <div class="header-controls">
      <!-- Mode selector -->
      <div class="mode-selector">
        <label for="mode-select">{$t('accounts.mode')}:</label>
        <select id="mode-select" bind:value={reportMode} onchange={() => setMode(reportMode)}>
          <option value="balance_sheet">{$t('accounts.mode_balance_sheet')}</option>
          <option value="trial_balance">{$t('accounts.mode_trial_balance')}</option>
          <option value="income_statement">{$t('accounts.mode_income_statement')}</option>
          <option value="cash_flow">{$t('accounts.mode_cash_flow')}</option>
          <option value="custom">{$t('accounts.mode_custom')}</option>
        </select>
      </div>
      
      <!-- Date picker -->
      <div class="date-picker">
        <label for="as-of-date">{$t('accounts.as_of')}:</label>
        <input 
          type="date" 
          id="as-of-date"
          bind:value={asOfDate}
          onchange={handleDateChange}
        />
      </div>
    </div>
  </header>
  
  <!-- Toolbar -->
  <div class="toolbar">
    <button class="btn-tool" onclick={expandAll}>
      {$t('common.expand_all')}
    </button>
    <button class="btn-tool" onclick={collapseAll}>
      {$t('common.collapse_all')}
    </button>
  </div>
  
  {#if !entity}
    <div class="loading">{$t('common.loading')}</div>
  {:else if balanceLoading || $accountsLoading}
    <div class="loading">{$t('common.loading')}</div>
  {:else if $accounts.length === 0}
    <div class="empty-state">
      <p>{$t('accounts.no_accounts')}</p>
      <p class="text-muted">{$t('accounts.create_prompt')}</p>
    </div>
  {:else}
    <div class="accounts-grid">
      {#each visibleTypes as type}
        {@const topGroups = $topLevelGroupsByType.get(type) || []}
        {@const info = typeInfo[type]}
        {@const typeTotal = getTypeTotal(type)}
        
        <section class="type-section">
          <div class="type-header" style="--type-color: {info.color}">
            <span class="type-icon">{info.icon}</span>
            <span class="type-name">{$t(`account_types.${type}`)}</span>
            <span class="type-total">{formatCurrency(typeTotal, entity.baseUnit)}</span>
          </div>
          
          <div class="groups-list">
            {#each topGroups as group}
              {@const children = $childGroupsByParent.get(group.id) || []}
              {@const hasKids = children.length > 0}
              {@const groupAccounts = getAccountsForGroup(group.id)}
              {@const hasAccounts = groupAccounts.length > 0 || children.some(c => getAccountsForGroup(c.id).length > 0)}
              {@const isExpanded = expandedGroups[group.id] ?? false}
              {@const groupTotal = getGroupTotal(group.id)}
              
              {#if hasAccounts || hasKids}
                <div class="group-item">
                  <button 
                    class="group-row expandable"
                    onclick={() => toggleGroup(group.id)}
                  >
                    <span class="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                    <span class="group-name">{group.name}</span>
                    <span class="group-total">{formatCurrency(groupTotal, entity.baseUnit)}</span>
                  </button>
                  
                  {#if isExpanded}
                    <div class="group-contents">
                      {#each groupAccounts as account}
                        <div class="account-row">
                          <span class="account-code">{account.code || ''}</span>
                          <a href="/ledger/{account.id}" class="account-name">{account.name}</a>
                          <span class="account-balance">{formatCurrency(getAccountBalance(account.id), account.unit)}</span>
                        </div>
                      {/each}
                      
                      {#each children as child}
                        {@const childAccounts = getAccountsForGroup(child.id)}
                        {@const childTotal = getGroupTotal(child.id)}
                        
                        {#if childAccounts.length > 0}
                          <div class="child-group">
                            <div class="child-group-header">
                              <span class="child-group-name">{child.name}</span>
                              <span class="child-group-total">{formatCurrency(childTotal, entity.baseUnit)}</span>
                            </div>
                            {#each childAccounts as account}
                              <div class="account-row child">
                                <span class="account-code">{account.code || ''}</span>
                                <a href="/ledger/{account.id}" class="account-name">{account.name}</a>
                                <span class="account-balance">{formatCurrency(getAccountBalance(account.id), account.unit)}</span>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}
            {/each}
            
            <!-- Retained Earnings (pseudo-account under Equity) -->
            {#if type === 'EQUITY' && (reportMode === 'balance_sheet' || reportMode === 'trial_balance')}
              <div class="group-item retained-earnings">
                <button 
                  class="group-row expandable"
                  onclick={toggleRetainedEarnings}
                >
                  {#if reportMode === 'trial_balance'}
                    <span class="expand-icon">{retainedEarningsExpanded ? '▼' : '▶'}</span>
                  {:else}
                    <span class="expand-icon"></span>
                  {/if}
                  <span class="group-name">{$t('accounts.retained_earnings')}</span>
                  <span class="group-total">{formatCurrency(retainedEarnings, entity.baseUnit)}</span>
                </button>
                
                {#if reportMode === 'trial_balance' && retainedEarningsExpanded}
                  <div class="group-contents re-breakdown">
                    <!-- Income section -->
                    <div class="re-type-section">
                      <div class="re-type-header">{$t('account_types.INCOME')}</div>
                      {#each $topLevelGroupsByType.get('INCOME') || [] as group}
                        {#each getAccountsForGroup(group.id) as account}
                          <div class="account-row child">
                            <span class="account-code">{account.code || ''}</span>
                            <a href="/ledger/{account.id}" class="account-name">{account.name}</a>
                            <span class="account-balance">{formatCurrency(getAccountBalance(account.id), account.unit)}</span>
                          </div>
                        {/each}
                      {/each}
                    </div>
                    
                    <!-- Expense section -->
                    <div class="re-type-section">
                      <div class="re-type-header">{$t('account_types.EXPENSE')}</div>
                      {#each $topLevelGroupsByType.get('EXPENSE') || [] as group}
                        {#each getAccountsForGroup(group.id) as account}
                          <div class="account-row child">
                            <span class="account-code">{account.code || ''}</span>
                            <a href="/ledger/{account.id}" class="account-name">{account.name}</a>
                            <span class="account-balance">{formatCurrency(getAccountBalance(account.id), account.unit)}</span>
                          </div>
                        {/each}
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </section>
      {/each}
      
      <!-- Footer: Net Worth and Verification -->
      {#if balanceData && (reportMode === 'balance_sheet' || reportMode === 'trial_balance')}
        <div class="footer-section">
          <!-- Net Worth -->
          <div class="net-worth-row">
            <span class="net-worth-label">{$t('accounts.net_worth')}</span>
            <span class="net-worth-value" class:negative={balanceData.netWorth < 0}>
              {formatCurrency(balanceData.netWorth, entity.baseUnit)}
            </span>
          </div>
          
          <!-- Verification Line -->
          <div class="verification-row" class:balanced={isBalanced} class:imbalanced={!isBalanced}>
            <span class="verification-label">{$t('accounts.verification')}:</span>
            <div class="verification-values">
              <span class="verification-item">
                {$t('account_types.ASSET')}: {formatCurrency(balanceData.totalAssets, entity.baseUnit)}
              </span>
              <span class="verification-equals">=</span>
              <span class="verification-item">
                {$t('accounts.liabilities_plus_equity')}: {formatCurrency(liabilitiesPlusEquity, entity.baseUnit)}
              </span>
              {#if isBalanced}
                <span class="verification-status">✓ {$t('accounts.balanced')}</span>
              {:else}
                <span class="verification-status warning">
                  ⚠ {$t('accounts.imbalance')}: {formatCurrency(imbalanceAmount, entity.baseUnit)}
                </span>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .accounts-page {
    max-width: 900px;
    margin: 0 auto;
  }
  
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: var(--space-md);
    flex-wrap: wrap;
    gap: var(--space-md);
  }
  
  .header-left {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }
  
  .back-link {
    font-size: 0.875rem;
    color: var(--text-muted);
    text-decoration: none;
  }
  
  .back-link:hover {
    color: var(--accent-color);
  }
  
  .page-header h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  
  .header-controls {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    flex-wrap: wrap;
  }
  
  .mode-selector,
  .date-picker {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 0.875rem;
  }
  
  .mode-selector label,
  .date-picker label {
    color: var(--text-muted);
  }
  
  .mode-selector select,
  .date-picker input {
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-primary);
    font-size: 0.875rem;
  }
  
  .toolbar {
    display: flex;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
  }
  
  .btn-tool {
    padding: var(--space-xs) var(--space-sm);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    font-size: 0.8125rem;
    color: var(--text-secondary);
    cursor: pointer;
  }
  
  .btn-tool:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  .loading, .empty-state {
    text-align: center;
    padding: var(--space-xl);
    color: var(--text-muted);
  }
  
  .accounts-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  
  .type-section {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  
  .type-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg);
    background: var(--bg-secondary);
    border-left: 4px solid var(--type-color);
    font-weight: 600;
  }
  
  .type-icon { font-size: 1.1rem; }
  .type-name { flex: 1; }
  .type-total {
    font-family: var(--font-mono);
    font-size: 1rem;
  }
  
  .groups-list {
    display: flex;
    flex-direction: column;
  }
  
  .group-item {
    border-top: 1px solid var(--border-color);
  }
  
  .group-item:first-child { border-top: none; }
  
  .group-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm) var(--space-lg);
    background: none;
    border: none;
    color: var(--text-primary);
    text-align: left;
    font-size: 0.9rem;
    cursor: pointer;
  }
  
  .group-row:hover {
    background: var(--bg-hover);
  }
  
  .expand-icon {
    font-size: 0.65rem;
    color: var(--text-muted);
    width: 1rem;
    flex-shrink: 0;
  }
  
  .group-name {
    flex: 1;
    font-weight: 500;
  }
  
  .group-total {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  .group-contents {
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-secondary);
  }
  
  .account-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-xs) var(--space-lg);
    padding-left: calc(var(--space-lg) + 2rem);
    font-size: 0.85rem;
  }
  
  .account-row.child {
    padding-left: calc(var(--space-lg) + 3rem);
  }
  
  .account-code {
    width: 60px;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  
  .account-name {
    flex: 1;
    color: var(--text-primary);
    text-decoration: none;
  }
  
  .account-name:hover {
    color: var(--accent-color);
  }
  
  .account-balance {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  .child-group {
    border-top: 1px solid var(--border-subtle);
  }
  
  .child-group-header {
    display: flex;
    align-items: center;
    padding: var(--space-xs) var(--space-lg);
    padding-left: calc(var(--space-lg) + 2rem);
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-secondary);
  }
  
  .child-group-name { flex: 1; }
  .child-group-total {
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }
  
  /* Retained Earnings styling */
  .retained-earnings {
    border-top: 2px solid var(--border-color);
  }
  
  .retained-earnings .group-name {
    font-style: italic;
  }
  
  .re-breakdown {
    padding: var(--space-sm) 0;
  }
  
  .re-type-section {
    margin-bottom: var(--space-sm);
  }
  
  .re-type-header {
    padding: var(--space-xs) var(--space-lg);
    padding-left: calc(var(--space-lg) + 2rem);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  /* Footer section */
  .footer-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .net-worth-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg);
    background: var(--bg-card);
    border: 2px solid var(--accent-color);
    border-radius: var(--radius-lg);
    font-size: 1.1rem;
    font-weight: 600;
  }
  
  .net-worth-value {
    font-family: var(--font-mono);
    color: var(--accent-color);
  }
  
  .net-worth-value.negative {
    color: var(--danger);
  }
  
  .verification-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    font-size: 0.875rem;
  }
  
  .verification-row.balanced {
    border-color: var(--success, #22c55e);
  }
  
  .verification-row.imbalanced {
    border-color: var(--warning, #f59e0b);
    background: rgba(245, 158, 11, 0.05);
  }
  
  .verification-label {
    font-weight: 500;
    color: var(--text-muted);
  }
  
  .verification-values {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex: 1;
    flex-wrap: wrap;
  }
  
  .verification-item {
    font-family: var(--font-mono);
  }
  
  .verification-equals {
    color: var(--text-muted);
  }
  
  .verification-status {
    margin-left: auto;
    font-weight: 500;
    color: var(--success, #22c55e);
  }
  
  .verification-status.warning {
    color: var(--warning, #f59e0b);
  }
</style>

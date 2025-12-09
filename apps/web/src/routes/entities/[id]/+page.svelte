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
    hasChildren,
    loadAccounts
  } from '$lib/stores/accounts';
  import { getDataService, type AccountType, type BalanceSheetData } from '$lib/data';
  
  console.log('[EntityAccounts] Script loaded');
  
  // Get entity ID from route
  let entityId = $derived($page.params.id);
  let entity = $derived($entities.find(e => e.id === entityId));
  
  // Balance sheet data - must use $state for reactivity
  let balanceData = $state<BalanceSheetData | null>(null);
  let balanceLoading = $state(true);
  
  // Load data when entity changes
  let lastEntityId: string | null = null;
  $effect(() => {
    console.log('[EntityAccounts] $effect running, entityId:', entityId, 'browser:', browser);
    if (browser && entityId && entityId !== lastEntityId) {
      lastEntityId = entityId;
      console.log('[EntityAccounts] Loading data for entity:', entityId);
      loadEntityData();
    }
  });
  
  async function loadEntityData() {
    console.log('[EntityAccounts] loadEntityData() called');
    balanceLoading = true;
    try {
      console.log('[EntityAccounts] Getting DataService...');
      const ds = await getDataService();
      
      // Load accounts for this entity (in case we navigated directly)
      console.log('[EntityAccounts] Loading accounts...');
      await loadAccounts(entityId);
      
      console.log('[EntityAccounts] Fetching balance sheet...');
      balanceData = await ds.getBalanceSheet(entityId);
      console.log('[EntityAccounts] Balance sheet loaded:', balanceData);
    } catch (e) {
      console.error('[EntityAccounts] Failed to load balance sheet:', e);
    } finally {
      balanceLoading = false;
      console.log('[EntityAccounts] Loading complete, balanceLoading:', balanceLoading);
    }
  }
  
  // Account type display info
  const typeInfo: Record<AccountType, { icon: string; color: string }> = {
    ASSET: { icon: '💰', color: 'var(--asset-color)' },
    LIABILITY: { icon: '📋', color: 'var(--liability-color)' },
    EQUITY: { icon: '📊', color: 'var(--equity-color)' },
    INCOME: { icon: '📈', color: 'var(--income-color)' },
    EXPENSE: { icon: '📉', color: 'var(--expense-color)' },
  };
  
  // Balance sheet shows only A/L/E
  const balanceSheetTypes: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY'];
  
  // Expanded state for groups
  let expandedGroups = $state<Set<string>>(new Set());
  
  function toggleGroup(groupId: string) {
    if (expandedGroups.has(groupId)) {
      expandedGroups.delete(groupId);
    } else {
      expandedGroups.add(groupId);
    }
    expandedGroups = new Set(expandedGroups);
  }
  
  // Get accounts for a specific group
  function getAccountsForGroup(groupId: string) {
    return $accounts.filter(a => a.accountGroupId === groupId);
  }
  
  // Get balance for an account from balance data
  function getAccountBalance(accountId: string): number {
    if (!balanceData) return 0;
    const ab = balanceData.accountBalances.find(b => b.accountId === accountId);
    return ab?.balance ?? 0;
  }
  
  // Get total for a group
  function getGroupTotal(groupId: string): number {
    if (!balanceData) return 0;
    const gb = balanceData.groupBalances.find(b => b.groupId === groupId);
    return gb?.balance ?? 0;
  }
  
  // Get type total
  function getTypeTotal(type: AccountType): number {
    if (!balanceData) return 0;
    switch (type) {
      case 'ASSET': return balanceData.totalAssets;
      case 'LIABILITY': return balanceData.totalLiabilities;
      case 'EQUITY': return balanceData.totalEquity;
      default: return 0;
    }
  }
  
  // Format currency
  function formatCurrency(amount: number, unit: string = 'USD'): string {
    const value = amount / 100; // Assuming cents
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
    
    <div class="header-right">
      <span class="as-of">{$t('accounts.as_of')}: {new Date().toLocaleDateString()}</span>
    </div>
  </header>
  
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
      {#each balanceSheetTypes as type}
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
              {@const isExpanded = expandedGroups.has(group.id)}
              {@const groupTotal = getGroupTotal(group.id)}
              
              {#if hasAccounts || hasKids}
                <div class="group-item">
                  <button 
                    class="group-row"
                    class:expandable={hasKids || groupAccounts.length > 0}
                    onclick={() => toggleGroup(group.id)}
                  >
                    {#if hasKids || groupAccounts.length > 0}
                      <span class="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                    {:else}
                      <span class="expand-icon"></span>
                    {/if}
                    <span class="group-name">{group.name}</span>
                    <span class="group-total">{formatCurrency(groupTotal, entity.baseUnit)}</span>
                  </button>
                  
                  {#if isExpanded}
                    <div class="group-contents">
                      <!-- Direct accounts in this group -->
                      {#each groupAccounts as account}
                        <div class="account-row">
                          <span class="account-code">{account.code || ''}</span>
                          <a href="/accounts/{account.id}" class="account-name">{account.name}</a>
                          <span class="account-balance">{formatCurrency(getAccountBalance(account.id), account.unit)}</span>
                        </div>
                      {/each}
                      
                      <!-- Child groups -->
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
                                <a href="/accounts/{account.id}" class="account-name">{account.name}</a>
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
          </div>
        </section>
      {/each}
      
      <!-- Net Worth -->
      {#if balanceData}
        <div class="net-worth-row">
          <span class="net-worth-label">{$t('accounts.net_worth')}</span>
          <span class="net-worth-value" class:negative={balanceData.netWorth < 0}>
            {formatCurrency(balanceData.netWorth, entity.baseUnit)}
          </span>
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
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-xl);
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
  
  .as-of {
    font-size: 0.875rem;
    color: var(--text-muted);
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
  
  .type-icon {
    font-size: 1.1rem;
  }
  
  .type-name {
    flex: 1;
  }
  
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
  
  .group-item:first-child {
    border-top: none;
  }
  
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
    cursor: default;
  }
  
  .group-row.expandable {
    cursor: pointer;
  }
  
  .group-row.expandable:hover {
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
  
  .child-group-name {
    flex: 1;
  }
  
  .child-group-total {
    font-family: var(--font-mono);
    font-size: 0.85rem;
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
</style>


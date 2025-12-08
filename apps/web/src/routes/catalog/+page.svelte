<script lang="ts">
  import { browser } from '$app/environment';
  import { t } from '$lib/i18n';
  import { 
    accountGroups, 
    accountGroupsLoading,
    topLevelGroupsByType,
    childGroupsByParent,
    hasChildren,
    loadAccountGroups 
  } from '$lib/stores/accounts';
  import type { AccountType, AccountGroup } from '$lib/data';
  
  // Load account groups on mount
  let groupsLoaded = false;
  $effect(() => {
    if (browser && !groupsLoaded && $accountGroups.length === 0) {
      groupsLoaded = true;
      loadAccountGroups();
    }
  });
  
  // Account type display info
  const typeInfo: Record<AccountType, { icon: string; color: string }> = {
    ASSET: { icon: '💰', color: 'var(--asset-color)' },
    LIABILITY: { icon: '📋', color: 'var(--liability-color)' },
    EQUITY: { icon: '📊', color: 'var(--equity-color)' },
    INCOME: { icon: '📈', color: 'var(--income-color)' },
    EXPENSE: { icon: '📉', color: 'var(--expense-color)' },
  };
  
  const accountTypes: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
  
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
  
  function expandAll() {
    const parentIds = $accountGroups
      .filter(g => hasChildren(g.id, $childGroupsByParent))
      .map(g => g.id);
    expandedGroups = new Set(parentIds);
  }
  
  function collapseAll() {
    expandedGroups = new Set();
  }
  
  // Count top-level groups per type
  function countGroups(type: AccountType): number {
    return $topLevelGroupsByType.get(type)?.length ?? 0;
  }
</script>

<div class="catalog-page">
  <header class="page-header">
    <h1>{$t('catalog.title')}</h1>
    
    <div class="header-actions">
      <button class="btn btn-secondary" onclick={expandAll}>{$t('common.expand_all')}</button>
      <button class="btn btn-secondary" onclick={collapseAll}>{$t('common.collapse_all')}</button>
      <button class="btn btn-primary">{$t('catalog.add_group')}</button>
    </div>
  </header>
  
  {#if $accountGroupsLoading}
    <div class="loading">{$t('common.loading')}</div>
  {:else if $accountGroups.length === 0}
    <div class="empty-state">
      <p>{$t('catalog.no_groups')}</p>
    </div>
  {:else}
    <div class="catalog-grid">
      {#each accountTypes as type}
        {@const topGroups = $topLevelGroupsByType.get(type) || []}
        {@const info = typeInfo[type]}
        
        <section class="type-section">
          <h2 class="type-header" style="--type-color: {info.color}">
            <span class="type-icon">{info.icon}</span>
            {$t(`account_types.${type}`)}
            <span class="type-count">{$t('catalog.groups_count', { count: countGroups(type) })}</span>
          </h2>
          
          <div class="groups-list">
            {#each topGroups as group}
              {@const children = $childGroupsByParent.get(group.id) || []}
              {@const hasKids = children.length > 0}
              {@const isExpanded = expandedGroups.has(group.id)}
              
              <div class="group-item">
                {#if hasKids}
                  <button 
                    class="group-row parent"
                    class:expanded={isExpanded}
                    onclick={() => toggleGroup(group.id)}
                  >
                    <span class="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                    <span class="group-name">{group.name}</span>
                    <span class="child-count">{children.length}</span>
                  </button>
                  
                  {#if isExpanded}
                    <div class="children">
                      {#each children as child}
                        <div class="group-row child">
                          <span class="group-name">{child.name}</span>
                        </div>
                      {/each}
                    </div>
                  {/if}
                {:else}
                  <div class="group-row leaf">
                    <span class="group-name">{group.name}</span>
                  </div>
                {/if}
              </div>
            {/each}
            
            {#if topGroups.length === 0}
              <div class="empty-type">
                <span class="text-muted">{$t('catalog.no_children')}</span>
              </div>
            {/if}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</div>

<style>
  .catalog-page {
    max-width: 1000px;
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
  
  .page-header h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  
  .header-actions {
    display: flex;
    gap: var(--space-sm);
  }
  
  .loading, .empty-state {
    text-align: center;
    padding: var(--space-xl);
    color: var(--text-muted);
  }
  
  .catalog-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
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
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    background: var(--bg-secondary);
    border-left: 4px solid var(--type-color);
  }
  
  .type-icon {
    font-size: 1.1rem;
  }
  
  .type-count {
    margin-left: auto;
    font-size: 0.8rem;
    font-weight: normal;
    color: var(--text-muted);
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
  }
  
  .group-row.parent {
    cursor: pointer;
    transition: background 0.15s;
  }
  
  .group-row.parent:hover {
    background: var(--bg-hover);
  }
  
  .group-row.leaf {
    padding-left: calc(var(--space-lg) + 1.25rem);
  }
  
  .group-row.child {
    padding-left: calc(var(--space-lg) + 2rem);
    color: var(--text-secondary);
    font-size: 0.85rem;
  }
  
  .expand-icon {
    font-size: 0.65rem;
    color: var(--text-muted);
    width: 1rem;
    flex-shrink: 0;
  }
  
  .group-name {
    flex: 1;
  }
  
  .child-count {
    font-size: 0.75rem;
    color: var(--text-muted);
    background: var(--bg-secondary);
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-full);
  }
  
  .children {
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-secondary);
  }
  
  .empty-type {
    padding: var(--space-md) var(--space-lg);
    font-size: 0.875rem;
  }
</style>

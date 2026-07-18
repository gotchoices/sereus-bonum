<script lang="ts">
  import type { AccountGroup, AccountType } from '$lib/data';
  import { ChevronRight, ChevronDown } from 'lucide-svelte';
  
  interface Props {
    groups: AccountGroup[];
    selected?: string | null;
    onSelect: (groupPath: string, groupId: string) => void;
    onClose: () => void;
  }
  
  let { groups, selected = null, onSelect, onClose }: Props = $props();
  
  let filterQuery = $state('');
  // Initially expand all top-level groups
  let expandedGroups = $state<Set<string>>(
    new Set(groups.filter(g => !g.parentId).map(g => g.id))
  );
  
  // Build group map for hierarchy
  const groupMap = $derived(new Map(groups.map(g => [g.id, g])));
  
  // Build hierarchical structure by type
  const groupsByType = $derived({
    ASSET: groups.filter(g => !g.parentId && g.accountType === 'ASSET'),
    LIABILITY: groups.filter(g => !g.parentId && g.accountType === 'LIABILITY'),
    EQUITY: groups.filter(g => !g.parentId && g.accountType === 'EQUITY'),
    INCOME: groups.filter(g => !g.parentId && g.accountType === 'INCOME'),
    EXPENSE: groups.filter(g => !g.parentId && g.accountType === 'EXPENSE')
  });
  
  // Get children for a group
  function getChildren(parentId: string): AccountGroup[] {
    return groups.filter(g => g.parentId === parentId);
  }
  
  // Build full path for a group
  function buildPath(groupId: string): string {
    const path: string[] = [];
    let current = groupMap.get(groupId);
    
    while (current) {
      path.unshift(current.name);
      current = current.parentId ? groupMap.get(current.parentId) : undefined;
    }
    
    return path.join(':');
  }
  
  // Check if group matches filter
  function matchesFilter(group: AccountGroup): boolean {
    if (!filterQuery) return true;
    const query = filterQuery.toLowerCase();
    const path = buildPath(group.id).toLowerCase();
    return path.includes(query) || group.name.toLowerCase().includes(query);
  }
  
  // Check if any descendant matches filter
  function hasMatchingDescendant(groupId: string): boolean {
    const children = getChildren(groupId);
    return children.some(child => 
      matchesFilter(child) || hasMatchingDescendant(child.id)
    );
  }
  
  // Toggle expand/collapse
  function toggleExpand(groupId: string) {
    if (expandedGroups.has(groupId)) {
      expandedGroups.delete(groupId);
    } else {
      expandedGroups.add(groupId);
    }
    expandedGroups = new Set(expandedGroups);
  }
  
  // Handle group selection
  function selectGroup(groupId: string) {
    const path = buildPath(groupId);
    onSelect(path, groupId);
  }
  
  // Type icons
  const typeIcons: Record<AccountType, string> = {
    ASSET: '💰',
    LIABILITY: '📋',
    EQUITY: '📊',
    INCOME: '📈',
    EXPENSE: '📉'
  };
  
  const typeLabels: Record<AccountType, string> = {
    ASSET: 'Assets',
    LIABILITY: 'Liabilities',
    EQUITY: 'Equity',
    INCOME: 'Income',
    EXPENSE: 'Expenses'
  };
</script>

<div class="tree-selector-overlay" onclick={onClose}>
  <div class="tree-selector" onclick={(e) => e.stopPropagation()}>
    <div class="tree-header">
      <input
        type="text"
        placeholder="Filter groups..."
        bind:value={filterQuery}
        class="tree-filter"
        autofocus
      />
      <button class="close-btn" onclick={onClose}>✕</button>
    </div>
    
    <div class="tree-content">
      {#each Object.entries(groupsByType) as [type, topGroups]}
        {#if topGroups.length > 0}
          <div class="type-section">
            <div class="type-header">
              <span class="type-icon">{typeIcons[type as AccountType]}</span>
              <span class="type-label">{typeLabels[type as AccountType]}</span>
            </div>
            
            {#each topGroups as group}
              {#if matchesFilter(group) || hasMatchingDescendant(group.id)}
                {@render groupNode(group, 0)}
              {/if}
            {/each}
          </div>
        {/if}
      {/each}
    </div>
  </div>
</div>

{#snippet groupNode(group: AccountGroup, depth: number)}
  {@const children = getChildren(group.id)}
  {@const hasChildren = children.length > 0}
  {@const isExpanded = expandedGroups.has(group.id)}
  {@const isSelected = selected === buildPath(group.id)}
  {@const isVisible = matchesFilter(group) || hasMatchingDescendant(group.id)}
  
  {#if isVisible}
    <div class="group-item" style="padding-left: {depth * 1.5}rem">
      {#if hasChildren}
        <button 
          class="group-row expandable"
          class:selected={isSelected}
          onclick={() => toggleExpand(group.id)}
          title={buildPath(group.id)}
        >
          <span class="expand-icon">
            {#if isExpanded}
              <ChevronDown size={16} />
            {:else}
              <ChevronRight size={16} />
            {/if}
          </span>
          <span class="group-name">{group.name}</span>
        </button>
        
        {#if isExpanded}
          {#each children as child}
            {@render groupNode(child, depth + 1)}
          {/each}
        {/if}
      {:else}
        <button 
          class="group-row leaf"
          class:selected={isSelected}
          onclick={() => selectGroup(group.id)}
          title={buildPath(group.id)}
        >
          <span class="group-name">{group.name}</span>
        </button>
      {/if}
    </div>
  {/if}
{/snippet}

<style>
  .tree-selector-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .tree-selector {
    background: var(--bg-primary, white);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    width: 90%;
    max-width: 500px;
    max-height: 600px;
    display: flex;
    flex-direction: column;
  }
  
  .tree-header {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color, #ddd);
  }
  
  .tree-filter {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--border-color, #ddd);
    border-radius: 4px;
    font-size: 0.875rem;
  }
  
  .close-btn {
    padding: 0.5rem 0.75rem;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 1.25rem;
    color: var(--text-secondary, #666);
  }
  
  .close-btn:hover {
    color: var(--text-primary, #000);
  }
  
  .tree-content {
    overflow-y: auto;
    flex: 1;
    padding: 0.5rem;
  }
  
  .type-section {
    margin-bottom: 1rem;
  }
  
  .type-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    font-weight: 600;
    color: var(--text-secondary, #666);
    font-size: 0.875rem;
  }
  
  .type-icon {
    font-size: 1rem;
  }
  
  .group-item {
    margin: 0;
  }
  
  .group-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border: none;
    background: transparent;
    cursor: pointer;
    width: 100%;
    text-align: left;
    border-radius: 4px;
    font-size: 0.875rem;
  }
  
  .group-row:hover {
    background: var(--bg-hover, #f5f5f5);
  }
  
  .group-row.selected {
    background: var(--accent-color, #007bff);
    color: white;
  }
  
  .expand-icon {
    display: flex;
    align-items: center;
    color: var(--text-secondary, #666);
  }
  
  .group-row.selected .expand-icon {
    color: white;
  }
  
  .group-name {
    flex: 1;
  }
  
  .group-row.leaf {
    padding-left: calc(0.5rem + 1.5rem); /* Account for missing expand icon */
  }
</style>


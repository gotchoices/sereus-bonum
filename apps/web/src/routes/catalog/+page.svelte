<script lang="ts">
  import { browser } from '$app/environment';
  import { t } from '$lib/i18n';
  import { 
    accountGroups, 
    accountGroupsLoading,
    topLevelGroupsByType,
    childGroupsByParent,
    hasChildren,
    loadAccountGroups,
    createAccountGroup,
    updateAccountGroup,
    deleteAccountGroup
  } from '$lib/stores/accounts';
  import type { AccountType, AccountGroup } from '$lib/data';
  
  // LocalStorage key for expanded state
  const EXPAND_STORAGE_KEY = 'bonum-catalog-expand';
  
  // Load account groups on mount and restore expanded state
  let groupsLoaded = false;
  $effect(() => {
    if (browser && !groupsLoaded && $accountGroups.length === 0) {
      groupsLoaded = true;
      loadAccountGroups();
      // Restore expanded state from localStorage
      try {
        const saved = localStorage.getItem(EXPAND_STORAGE_KEY);
        if (saved) {
          expandedGroups = new Set(JSON.parse(saved));
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  });
  
  // Set initial expand state: top-level groups expanded, others collapsed (spec line 49)
  $effect(() => {
    if (browser && $accountGroups.length > 0 && expandedGroups.size === 0) {
      // Check if localStorage had a saved state
      const saved = localStorage.getItem(EXPAND_STORAGE_KEY);
      if (!saved) {
        // No saved state - expand only top-level groups (Assets, Liabilities, etc.)
        const topLevelIds = $accountGroups
          .filter(g => !g.parentId)
          .map(g => g.id);
        expandedGroups = new Set(topLevelIds);
        saveExpandedState();
      }
    }
  });
  
  // Account type display info (icons per spec lines 39-43)
  const typeInfo: Record<AccountType, { icon: string; label: string; color: string }> = {
    ASSET: { icon: '💰', label: 'Assets', color: 'var(--asset-color)' },
    LIABILITY: { icon: '📋', label: 'Liabilities', color: 'var(--liability-color)' },
    EQUITY: { icon: '📊', label: 'Equity', color: 'var(--equity-color)' },
    INCOME: { icon: '📈', label: 'Income', color: 'var(--income-color)' },
    EXPENSE: { icon: '📉', label: 'Expenses', color: 'var(--expense-color)' },
  };
  
  const accountTypes: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
  
  // Expanded state for groups (persisted in localStorage)
  let expandedGroups = $state<Set<string>>(new Set());
  
  function saveExpandedState() {
    if (browser) {
      try {
        localStorage.setItem(EXPAND_STORAGE_KEY, JSON.stringify([...expandedGroups]));
      } catch (e) {
        // Ignore storage errors
      }
    }
  }
  
  function toggleGroup(groupId: string) {
    if (expandedGroups.has(groupId)) {
      expandedGroups.delete(groupId);
    } else {
      expandedGroups.add(groupId);
    }
    expandedGroups = new Set(expandedGroups);
    saveExpandedState();
  }
  
  function expandAll() {
    const parentIds = $accountGroups
      .filter(g => hasChildren(g.id, $childGroupsByParent))
      .map(g => g.id);
    expandedGroups = new Set(parentIds);
    saveExpandedState();
  }
  
  function collapseAll() {
    expandedGroups = new Set();
    saveExpandedState();
  }
  
  // Count ALL groups per type (not just top-level)
  function countGroups(type: AccountType): number {
    return $accountGroups.filter(g => g.accountType === type).length;
  }
  
  // ========== Modal State ==========
  let showModal = $state(false);
  let modalMode = $state<'add' | 'edit' | 'addChild'>('add');
  let editingGroup = $state<AccountGroup | null>(null);
  let parentForChild = $state<AccountGroup | null>(null);
  
  // Form fields
  let formName = $state('');
  let formType = $state<AccountType>('ASSET');
  let formParentId = $state<string | null>(null);
  let formDescription = $state('');
  let formSaving = $state(false);
  
  function openAddModal() {
    modalMode = 'add';
    editingGroup = null;
    parentForChild = null;
    formName = '';
    formType = 'ASSET';
    formParentId = null;
    formDescription = '';
    showModal = true;
  }
  
  function openEditModal(group: AccountGroup) {
    modalMode = 'edit';
    editingGroup = group;
    parentForChild = null;
    formName = group.name;
    formType = group.accountType;
    formParentId = group.parentId ?? null;
    formDescription = group.description ?? '';
    showModal = true;
  }
  
  function openAddChildModal(parent: AccountGroup) {
    modalMode = 'addChild';
    editingGroup = null;
    parentForChild = parent;
    formName = '';
    formType = parent.accountType;
    formParentId = parent.id;
    formDescription = '';
    showModal = true;
  }
  
  function closeModal() {
    showModal = false;
  }
  
  async function handleSave() {
    if (!formName.trim()) return;
    
    formSaving = true;
    try {
      if (modalMode === 'edit' && editingGroup) {
        await updateAccountGroup(editingGroup.id, {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
        });
      } else {
        await createAccountGroup({
          name: formName.trim(),
          accountType: formType,
          parentId: formParentId ?? undefined,
          description: formDescription.trim() || undefined,
        });
      }
      closeModal();
    } finally {
      formSaving = false;
    }
  }
  
  // Get potential parent groups for dropdown
  // If type is specified, filter to that type; otherwise show all groups
  function getParentOptions(type: AccountType | null): AccountGroup[] {
    if (type) {
      return $accountGroups.filter(g => g.accountType === type);
    }
    return $accountGroups;
  }
  
  // Handle parent selection change - update type to match parent
  function handleParentChange(parentId: string | null) {
    formParentId = parentId;
    if (parentId) {
      const parent = $accountGroups.find(g => g.id === parentId);
      if (parent) {
        formType = parent.accountType;
      }
    }
  }
  
  // ========== Context Menu ==========
  let contextMenu = $state<{ group: AccountGroup; x: number; y: number } | null>(null);
  
  function handleContextMenu(e: MouseEvent, group: AccountGroup) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { group, x: e.clientX, y: e.clientY };
  }
  
  function closeContextMenu() {
    contextMenu = null;
  }
  
  async function handleDeleteGroup(group: AccountGroup) {
    if (confirm($t('catalog.delete_confirm'))) {
      await deleteAccountGroup(group.id);
    }
    closeContextMenu();
  }
  
  // Close context menu on click outside
  function handleWindowClick() {
    closeContextMenu();
  }
</script>

{#snippet groupRow(group: AccountGroup, depth: number)}
  {@const children = $childGroupsByParent.get(group.id) || []}
  {@const hasKids = children.length > 0}
  {@const isExpanded = expandedGroups.has(group.id)}
  
  <div class="group-item">
    {#if hasKids}
      <button 
        class="group-row parent"
        class:expanded={isExpanded}
        style="padding-left: calc(var(--space-lg) + {depth * 1.25}rem);"
        onclick={() => toggleGroup(group.id)}
        oncontextmenu={(e) => handleContextMenu(e, group)}
      >
        <span class="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        <span class="group-name">{group.name}</span>
        <span class="child-count">{children.length}</span>
      </button>
      
      {#if isExpanded}
        <div class="children">
          {#each children as child}
            {@render groupRow(child, depth + 1)}
          {/each}
        </div>
      {/if}
    {:else}
      <button 
        class="group-row leaf"
        style="padding-left: calc(var(--space-lg) + {depth * 1.25}rem + 1.25rem);"
        oncontextmenu={(e) => handleContextMenu(e, group)}
      >
        <span class="group-name">{group.name}</span>
      </button>
    {/if}
  </div>
{/snippet}

<svelte:window on:click={handleWindowClick} />

<div class="catalog-page">
  <header class="page-header">
    <h1>{$t('catalog.title')}</h1>
    
    <div class="header-actions">
      <button class="btn btn-secondary" onclick={expandAll}>{$t('common.expand_all')}</button>
      <button class="btn btn-secondary" onclick={collapseAll}>{$t('common.collapse_all')}</button>
      <button class="btn btn-primary" onclick={openAddModal}>{$t('catalog.add_group')}</button>
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
            <span class="type-icon" title="{info.label}">{info.icon}</span>
            <span class="type-count">({countGroups(type)} groups)</span>
          </h2>
          
          <div class="groups-list">
            {#each topGroups as group}
              {@render groupRow(group, 0)}
            {/each}
            
            {#if topGroups.length === 0}
              <div class="empty-type">
                <span class="text-muted">{$t('catalog.no_groups_type')}</span>
              </div>
            {/if}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</div>

<!-- Context Menu -->
{#if contextMenu}
  <div 
    class="context-menu"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
    onclick={(e) => e.stopPropagation()}
  >
    <button class="menu-item" onclick={() => { openEditModal(contextMenu!.group); closeContextMenu(); }}>
      <span>📝</span> {$t('common.edit')}
    </button>
    <button class="menu-item" onclick={() => { openAddChildModal(contextMenu!.group); closeContextMenu(); }}>
      <span>➕</span> {$t('catalog.add_child')}
    </button>
    <hr />
    <button class="menu-item danger" onclick={() => handleDeleteGroup(contextMenu!.group)}>
      <span>🗑️</span> {$t('common.delete')}
    </button>
  </div>
{/if}

<!-- Add/Edit Modal -->
{#if showModal}
  <div class="modal-backdrop" onclick={closeModal}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>
          {#if modalMode === 'edit'}
            {$t('catalog.edit_group')}
          {:else if modalMode === 'addChild'}
            {$t('catalog.add_child')}
          {:else}
            {$t('catalog.add_group')}
          {/if}
        </h3>
        <button class="btn-close" onclick={closeModal}>✕</button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label for="group-name">{$t('catalog.name')}</label>
          <input 
            id="group-name"
            type="text" 
            bind:value={formName}
            placeholder="e.g., Cash & Bank"
          />
        </div>
        
        {#if modalMode === 'add'}
          <div class="form-group">
            <label for="group-parent">{$t('catalog.parent')}</label>
            <select 
              id="group-parent" 
              value={formParentId}
              onchange={(e) => handleParentChange(e.currentTarget.value || null)}
            >
              <option value="">{$t('catalog.none_top_level')}</option>
              {#each $accountGroups as group}
                <option value={group.id}>{group.name} ({typeInfo[group.accountType].label})</option>
              {/each}
            </select>
          </div>
          
          <div class="form-group">
            <label for="group-type">{$t('catalog.type')}</label>
            <select 
              id="group-type"
              bind:value={formType}
              disabled={formParentId !== null}
            >
              {#each accountTypes as type}
                <option value={type}>{$t(`account_types.${type}`)}</option>
              {/each}
            </select>
            {#if formParentId}
              <span class="form-hint">Type inherited from parent</span>
            {/if}
          </div>
        {:else if modalMode === 'addChild' && parentForChild}
          <div class="form-group">
            <label>{$t('catalog.parent')}</label>
            <input type="text" value={parentForChild.name} disabled />
          </div>
          
          <div class="form-group">
            <label>{$t('catalog.type')}</label>
            <input type="text" value={typeInfo[formType].label} disabled />
          </div>
        {:else if modalMode === 'edit'}
          <div class="form-group">
            <label>{$t('catalog.type')}</label>
            <input type="text" value={typeInfo[formType].label} disabled />
            <span class="form-hint">Type cannot be changed</span>
          </div>
        {/if}
        
        <div class="form-group">
          <label for="group-desc">{$t('catalog.description')}</label>
          <input 
            id="group-desc"
            type="text" 
            bind:value={formDescription}
            placeholder="Optional description"
          />
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={closeModal}>{$t('common.cancel')}</button>
        <button 
          class="btn btn-primary" 
          onclick={handleSave}
          disabled={!formName.trim() || formSaving}
        >
          {formSaving ? $t('common.loading') : $t('common.save')}
        </button>
      </div>
    </div>
  </div>
{/if}

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
    cursor: default;
  }
  
  .group-row.parent {
    cursor: pointer;
    transition: background 0.15s;
  }
  
  .group-row.parent:hover,
  .group-row.leaf:hover,
  .group-row.child:hover {
    background: var(--bg-hover);
  }
  
  .group-row.leaf {
    /* Dynamic padding via inline style */
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
  
  /* Context Menu */
  .context-menu {
    position: fixed;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    min-width: 160px;
    z-index: 1000;
    padding: var(--space-xs) 0;
  }
  
  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: none;
    background: none;
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
    text-align: left;
  }
  
  .menu-item:hover {
    background: var(--bg-hover);
  }
  
  .menu-item.danger {
    color: var(--danger);
  }
  
  .context-menu hr {
    border: none;
    border-top: 1px solid var(--border-color);
    margin: var(--space-xs) 0;
  }
  
  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 400px;
    box-shadow: var(--shadow-lg);
  }
  
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
  }
  
  .btn-close {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
  }
  
  .btn-close:hover {
    color: var(--text-primary);
  }
  
  .modal-body {
    padding: var(--space-lg);
  }
  
  .form-group {
    margin-bottom: var(--space-md);
  }
  
  .form-group:last-child {
    margin-bottom: 0;
  }
  
  .form-group label {
    display: block;
    margin-bottom: var(--space-xs);
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .form-hint {
    display: block;
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: var(--space-xs);
    font-style: italic;
  }
  
  .form-group input,
  .form-group select {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
  }
  
  .form-group input:disabled,
  .form-group select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--accent-color);
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg);
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  }
</style>

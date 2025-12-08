<!-- EntityList.svelte -->
<!-- Displays the list of entities with selection and context menu -->

<script lang="ts">
  import { 
    entities, 
    selectedEntityId, 
    entitiesLoading, 
    entitiesError,
    selectEntity, 
    deleteEntity 
  } from '$lib/stores/entities';
  
  let contextMenuEntityId: string | null = null;
  let contextMenuPosition = { x: 0, y: 0 };
  
  function handleSelect(id: string) {
    selectEntity(id);
  }
  
  function handleContextMenu(e: MouseEvent, id: string) {
    e.preventDefault();
    contextMenuEntityId = id;
    contextMenuPosition = { x: e.clientX, y: e.clientY };
  }
  
  function closeContextMenu() {
    contextMenuEntityId = null;
  }
  
  async function handleDelete(id: string) {
    if (confirm('Are you sure you want to delete this entity?')) {
      await deleteEntity(id);
    }
    closeContextMenu();
  }
  
  // Close context menu on click outside
  function handleWindowClick() {
    closeContextMenu();
  }
</script>

<svelte:window on:click={handleWindowClick} />

<div class="entity-list">
  {#if $entitiesLoading}
    <div class="loading-state">
      <span class="spinner"></span>
      <span>Loading entities...</span>
    </div>
  {:else if $entitiesError}
    <div class="error-state">
      <p>Failed to load entities</p>
      <p class="text-muted">{$entitiesError}</p>
    </div>
  {:else if $entities.length === 0}
    <div class="empty-state">
      <p>No entities yet</p>
      <p class="text-muted">Create one to get started</p>
    </div>
  {:else}
    {#each $entities as entity (entity.id)}
      <div 
        class="entity-item"
        class:selected={$selectedEntityId === entity.id}
        on:click={() => handleSelect(entity.id)}
        on:contextmenu={(e) => handleContextMenu(e, entity.id)}
        on:keydown={(e) => e.key === 'Enter' && handleSelect(entity.id)}
        role="button"
        tabindex="0"
      >
        <div class="entity-info">
          <a href="/entities/{entity.id}" class="entity-name" on:click|stopPropagation>
            {entity.name}
          </a>
          {#if entity.description}
            <span class="entity-description">{entity.description}</span>
          {/if}
        </div>
        <span class="entity-unit">{entity.baseUnit}</span>
      </div>
    {/each}
  {/if}
</div>

<!-- Context Menu -->
{#if contextMenuEntityId}
  <div 
    class="context-menu"
    style="left: {contextMenuPosition.x}px; top: {contextMenuPosition.y}px;"
    on:click|stopPropagation
  >
    <a href="/entities/{contextMenuEntityId}" class="menu-item">
      <span>📝</span> Edit
    </a>
    <a href="/entities/{contextMenuEntityId}" class="menu-item">
      <span>📊</span> Accounts
    </a>
    <button class="menu-item" on:click={() => {}}>
      <span>📥</span> Import
    </button>
    <button class="menu-item" on:click={() => {}}>
      <span>📋</span> Boilerplate
    </button>
    <hr />
    <button class="menu-item danger" on:click={() => handleDelete(contextMenuEntityId!)}>
      <span>🗑️</span> Delete
    </button>
  </div>
{/if}

<style>
  .entity-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-sm);
  }
  
  .entity-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s ease;
  }
  
  .entity-item:hover {
    background: var(--bg-hover);
  }
  
  .entity-item.selected {
    background: var(--bg-active);
  }
  
  .entity-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }
  
  .entity-name {
    font-weight: 500;
    color: var(--text-primary);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .entity-name:hover {
    color: var(--accent-color);
  }
  
  .entity-description {
    font-size: 0.8125rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .entity-unit {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }
  
  .empty-state, .loading-state, .error-state {
    padding: var(--space-xl);
    text-align: center;
  }
  
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-muted);
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
  
  .error-state {
    color: var(--danger);
  }
  
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
    text-decoration: none;
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
</style>

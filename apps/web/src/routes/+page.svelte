<script lang="ts">
  import { browser } from '$app/environment';
  import EntityList from '$lib/components/EntityList.svelte';
  import WelcomePanel from '$lib/components/WelcomePanel.svelte';
  import VisualBalanceSheet from '$lib/components/VisualBalanceSheet.svelte';
  import { entities, selectedEntityId } from '$lib/stores/entities';
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  
  let selectedEntity = $derived($entities.find(e => e.id === $selectedEntityId));
  
  // Check if welcome was permanently dismissed
  let welcomeDismissed = $state(false);
  
  $effect(() => {
    if (browser) {
      welcomeDismissed = localStorage.getItem('bonum-welcome-dismissed') === 'true';
      log.ui.debug('Welcome dismissed:', welcomeDismissed);
    }
  });
  
  // Debug: log when selected entity changes
  $effect(() => {
    log.ui.debug('Selected entity:', selectedEntity?.name ?? 'none');
  });
  
  // Show welcome if not dismissed AND no entity selected
  let showWelcomePanel = $derived(!welcomeDismissed && !selectedEntity);
</script>

<div class="home-layout">
  <section class="entities-panel">
    <div class="panel-header">
      <h2>{$t('entities.title')}</h2>
      <button class="btn-icon" title={$t('entities.add')}>
        <span>➕</span>
      </button>
    </div>
    <EntityList />
  </section>
  
  <section class="dashboard-panel">
    {#if showWelcomePanel}
      <WelcomePanel />
    {:else if selectedEntity}
      <div class="entity-dashboard">
        <a href="/entities/{selectedEntity.id}" class="entity-title">
          <h2>{selectedEntity.name}</h2>
        </a>
        {#if selectedEntity.description}
          <p class="text-secondary">{selectedEntity.description}</p>
        {/if}
        
        <div class="balance-sheet-container">
          <VisualBalanceSheet entityId={selectedEntity.id} />
        </div>
      </div>
    {:else}
      <div class="empty-state">
        <p class="text-muted">{$t('welcome.select_entity')}</p>
      </div>
    {/if}
  </section>
</div>

<style>
  .home-layout {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: var(--space-lg);
    height: calc(100vh - 3rem);
  }
  
  .entities-panel {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--border-color);
  }
  
  .panel-header h2 {
    font-size: 1rem;
    font-weight: 600;
  }
  
  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    font-size: 1.25rem;
    opacity: 0.7;
    transition: opacity 0.15s;
  }
  
  .btn-icon:hover {
    opacity: 1;
  }
  
  .dashboard-panel {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
    overflow: auto;
  }
  
  .entity-dashboard {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
  }
  
  .entity-title {
    text-decoration: none;
    color: var(--text-primary);
  }
  
  .entity-title:hover {
    color: var(--accent-color);
  }
  
  .entity-title h2 {
    margin: 0 0 var(--space-xs) 0;
    text-align: center;
  }
  
  .entity-dashboard .text-secondary {
    text-align: center;
    margin-bottom: var(--space-md);
  }
  
  .balance-sheet-container {
    display: flex;
    justify-content: center;
    flex: 1;
    align-items: center;
  }
  
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
</style>

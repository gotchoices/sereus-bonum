<script lang="ts">
  import EntityList from '$lib/components/EntityList.svelte';
  import WelcomePanel from '$lib/components/WelcomePanel.svelte';
  import VisualBalanceSheet from '$lib/components/VisualBalanceSheet.svelte';
  import { entities, selectedEntityId } from '$lib/stores/entities';
  import { t } from '$lib/i18n';
  
  let selectedEntity = $derived($entities.find(e => e.id === $selectedEntityId));
  
  // Demo: dismiss welcome after first use
  let showWelcome = true;
  
  function dismissWelcome() {
    showWelcome = false;
  }
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
    {#if showWelcome && !selectedEntity}
      <WelcomePanel on:dismiss={dismissWelcome} />
    {:else if selectedEntity}
      <div class="entity-dashboard">
        <h2>{selectedEntity.name}</h2>
        <p class="text-secondary">{selectedEntity.description || ''}</p>
        
        <div class="balance-sheet-container">
          <VisualBalanceSheet entityId={selectedEntity.id} />
        </div>
        
        <div class="quick-actions">
          <a href="/entities/{selectedEntity.id}" class="btn btn-primary">
            {$t('accounts.view')}
          </a>
          <button class="btn btn-secondary">
            {$t('accounts.import_transactions')}
          </button>
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
  
  .entity-dashboard h2 {
    margin-bottom: var(--space-xs);
  }
  
  .balance-sheet-container {
    display: flex;
    justify-content: center;
    margin: var(--space-xl) 0;
  }
  
  .quick-actions {
    display: flex;
    gap: var(--space-md);
    justify-content: center;
  }
  
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
</style>

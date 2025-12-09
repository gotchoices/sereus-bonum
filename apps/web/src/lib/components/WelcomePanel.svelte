<!-- WelcomePanel.svelte -->
<!-- Dismissible welcome message shown to new users -->

<script lang="ts">
  import { browser } from '$app/environment';
  import { t } from '$lib/i18n';
  
  // Checkbox state - when checked, persists to localStorage
  let dontShowAgain = $state(false);
  
  // Persist preference when checkbox changes
  $effect(() => {
    if (browser && dontShowAgain) {
      localStorage.setItem('bonum-welcome-dismissed', 'true');
    }
  });
</script>

<div class="welcome-panel">
  <div class="welcome-header">
    <h2>{$t('welcome.title')}</h2>
  </div>
  
  <div class="welcome-content">
    <p>{$t('welcome.intro')}</p>
    
    <h3>{$t('welcome.getting_started')}</h3>
    <ul>
      <li>{$t('welcome.select_entity')}</li>
      <li>{$t('welcome.import_books')}</li>
      <li>{$t('welcome.create_entity')}</li>
    </ul>
    
    <h3>{$t('welcome.nav_tips')}</h3>
    <ul>
      <li>{$t('welcome.click_navigate')}</li>
      <li>{$t('welcome.ctrl_click')}</li>
      <li>{$t('welcome.right_click')}</li>
    </ul>
  </div>
  
  <div class="welcome-footer">
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={dontShowAgain} />
      {$t('welcome.dont_show_again')}
    </label>
  </div>
</div>

<style>
  .welcome-panel {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    max-width: 600px;
    margin: 0 auto;
  }
  
  .welcome-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg);
    border-bottom: 1px solid var(--border-color);
  }
  
  .welcome-header h2 {
    margin: 0;
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
  
  .welcome-content {
    padding: var(--space-lg);
  }
  
  .welcome-content h3 {
    margin-top: var(--space-lg);
    margin-bottom: var(--space-sm);
    font-size: 1rem;
    color: var(--text-secondary);
  }
  
  .welcome-content h3:first-of-type {
    margin-top: var(--space-md);
  }
  
  .welcome-content ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .welcome-content li {
    padding: var(--space-sm) 0;
    padding-left: 1.5rem;
    position: relative;
  }
  
  .welcome-content li::before {
    content: '→';
    position: absolute;
    left: 0;
    color: var(--accent-color);
  }
  
  .welcome-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 0.875rem;
    color: var(--text-secondary);
    cursor: pointer;
  }
  
  .checkbox-label input {
    width: 1rem;
    height: 1rem;
  }
</style>

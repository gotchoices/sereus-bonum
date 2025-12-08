<!-- WelcomePanel.svelte -->
<!-- Dismissible welcome message shown to new users -->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher<{ dismiss: void }>();
  
  let dontShowAgain = false;
  
  function handleDismiss() {
    if (dontShowAgain) {
      localStorage.setItem('bonum-welcome-dismissed', 'true');
    }
    dispatch('dismiss');
  }
</script>

<div class="welcome-panel">
  <div class="welcome-header">
    <h2>Welcome to Bonum</h2>
    <button class="btn-close" on:click={handleDismiss} title="Close">
      ✕
    </button>
  </div>
  
  <div class="welcome-content">
    <p>
      <strong>Bonum</strong> helps you manage personal and business finances 
      with proper double-entry accounting.
    </p>
    
    <h3>Getting Started</h3>
    <ul>
      <li>
        <strong>Select an entity</strong> from the list to view its balance sheet
      </li>
      <li>
        <strong>Import existing books</strong> from GnuCash or QuickBooks using 
        <em>Import Books</em> in the menu
      </li>
      <li>
        <strong>Create a new entity</strong> using the + button, or use a template 
        as a starting point
      </li>
    </ul>
    
    <h3>Navigation Tips</h3>
    <ul>
      <li>
        <strong>Click</strong> any hyperlink to navigate in the current view
      </li>
      <li>
        <strong>Ctrl/Cmd + Click</strong> to open in a new window
      </li>
      <li>
        <strong>Right-click</strong> entities for quick actions
      </li>
    </ul>
    
    <p class="text-muted">
      Your data is stored locally and synced via Sereus Fabric.
    </p>
  </div>
  
  <div class="welcome-footer">
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={dontShowAgain} />
      Don't show this again
    </label>
    <button class="btn btn-primary" on:click={handleDismiss}>
      Get Started
    </button>
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


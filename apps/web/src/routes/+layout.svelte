<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { initializeEntities } from '$lib/stores/entities';
  import { log } from '$lib/logger';
  import '../app.css';
  
  console.log('[Layout] Script executing, browser:', browser);
  
  let initialized = $state(false);
  let initError = $state<string | null>(null);
  let initStarted = false;
  
  // Use $effect for Svelte 5 - runs after mount on client
  $effect(() => {
    if (browser && !initStarted) {
      initStarted = true;
      console.log('[Layout] $effect running, starting init...');
      
      initializeEntities()
        .then(() => {
          initialized = true;
          console.log('[Layout] Initialization complete');
        })
        .catch((e) => {
          initError = e instanceof Error ? e.message : 'Failed to initialize';
          console.error('[Layout] Init error:', e);
        });
    }
  });
</script>

{#if initError}
  <div class="init-error">
    <h2>Initialization Error</h2>
    <p>{initError}</p>
    <button on:click={() => window.location.reload()}>Reload</button>
  </div>
{:else}
  <div class="app-shell">
    <nav class="global-nav">
      <div class="nav-brand">
        <span class="brand-icon">📊</span>
        <span class="brand-name">Bonum</span>
      </div>
      
      <ul class="nav-links">
        <li>
          <a href="/" class:active={$page.url.pathname === '/'}>
            <span class="nav-icon">🏠</span>
            Home
          </a>
        </li>
        <li>
          <a href="/catalog" class:active={$page.url.pathname === '/catalog'}>
            <span class="nav-icon">📁</span>
            Account Catalog
          </a>
        </li>
        <li>
          <a href="/import" class:active={$page.url.pathname === '/import'}>
            <span class="nav-icon">📥</span>
            Import Books
          </a>
        </li>
        <li>
          <a href="/settings" class:active={$page.url.pathname === '/settings'}>
            <span class="nav-icon">⚙️</span>
            Settings
          </a>
        </li>
      </ul>
      
      {#if !initialized}
        <div class="nav-loading">Loading...</div>
      {/if}
    </nav>
    
    <main class="main-content">
      <slot />
    </main>
  </div>
{/if}

<style>
  .app-shell {
    display: flex;
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  
  .global-nav {
    width: 220px;
    background: var(--bg-nav);
    border-right: 1px solid var(--border-color);
    padding: 1rem 0;
    display: flex;
    flex-direction: column;
  }
  
  .nav-brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 1rem;
  }
  
  .brand-icon {
    font-size: 1.5rem;
  }
  
  .brand-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .nav-links {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  
  .nav-links li a {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    color: var(--text-secondary);
    text-decoration: none;
    transition: all 0.15s ease;
  }
  
  .nav-links li a:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  .nav-links li a.active {
    background: var(--bg-active);
    color: var(--accent-color);
    border-right: 3px solid var(--accent-color);
  }
  
  .nav-icon {
    font-size: 1.1rem;
  }
  
  .main-content {
    flex: 1;
    padding: 1.5rem;
    overflow: auto;
  }
  
  .nav-loading {
    padding: 1rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.875rem;
  }
  
  .init-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 1rem;
    padding: 2rem;
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  
  .init-error h2 {
    color: var(--danger);
  }
  
  .init-error button {
    padding: 0.75rem 1.5rem;
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
  }
</style>

<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { initializeEntities } from '$lib/stores/entities';
  import { loadAccountGroups } from '$lib/stores/accounts';
  import { settings } from '$lib/stores/settings';
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  import AIAssistant from '$lib/components/AIAssistant.svelte';
  import '../app.css';
  
  console.log('[Layout] Script executing, browser:', browser);
  
  let initialized = $state(false);
  let initError = $state<string | null>(null);
  let initStarted = false;
  let aiAssistantOpen = $state(false);
  let navVisible = $state(true);
  
  // Load nav visibility from localStorage
  if (browser) {
    const savedNavState = localStorage.getItem('bonum-nav-visible');
    if (savedNavState !== null) {
      navVisible = savedNavState === 'true';
    }
  }
  
  // Toggle nav visibility
  function toggleNav() {
    navVisible = !navVisible;
    if (browser) {
      localStorage.setItem('bonum-nav-visible', navVisible.toString());
    }
  }
  
  // Use $effect for Svelte 5 - runs after mount on client
  $effect(() => {
    if (browser && !initStarted) {
      initStarted = true;
      console.log('[Layout] $effect running, starting init...');
      
      // Load settings first (synchronous from localStorage)
      settings.load();
      
      Promise.all([
        initializeEntities(),
        loadAccountGroups()
      ])
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
    <button onclick={() => window.location.reload()}>Reload</button>
  </div>
{:else}
  <div class="app-shell">
    <!-- Navigation Menu -->
    <nav class="global-nav" class:hidden={!navVisible}>
      <div class="nav-content">
        <div class="nav-header">
          <div class="nav-brand">
            <span class="brand-icon">📊</span>
            <span class="brand-name">{$t('app.name')}</span>
          </div>
          <button class="btn-nav-toggle" onclick={toggleNav} title="Hide menu">
            «
          </button>
        </div>
        
        <ul class="nav-links">
          <li>
            <a href="/" class:active={$page.url.pathname === '/'}>
              <span class="nav-icon">🏠</span>
              {$t('nav.home')}
            </a>
          </li>
          <li>
            <a href="/catalog" class:active={$page.url.pathname === '/catalog'}>
              <span class="nav-icon">📁</span>
              {$t('nav.catalog')}
            </a>
          </li>
          <li>
            <a href="/search" class:active={$page.url.pathname === '/search'}>
              <span class="nav-icon">🔍</span>
              {$t('nav.search')}
            </a>
          </li>
          <li>
            <a href="/import" class:active={$page.url.pathname === '/import'}>
              <span class="nav-icon">📥</span>
              {$t('nav.import')}
            </a>
          </li>
          <li>
            <a href="/settings" class:active={$page.url.pathname === '/settings'}>
              <span class="nav-icon">⚙️</span>
              {$t('nav.settings')}
            </a>
          </li>
        </ul>
        
        <!-- Spacer to push AI button to bottom -->
        <div class="nav-spacer"></div>
        
        {#if !initialized}
          <div class="nav-loading">{$t('common.loading')}</div>
        {/if}
        
        <!-- AI Assistant button at bottom (hidden when pane open) -->
        {#if !aiAssistantOpen}
          <div class="nav-ai-button">
            <button class="btn-assistant" onclick={() => aiAssistantOpen = true}>
              Assistant
            </button>
          </div>
        {/if}
      </div>
    </nav>
    
    <!-- Floating show button when nav hidden -->
    {#if !navVisible}
      <button class="btn-nav-show" onclick={toggleNav} title="Show menu">
        ☰
      </button>
    {/if}
    
    <main class="main-content" class:expanded={!navVisible}>
      <slot />
    </main>
    
    <!-- AI Assistant -->
    <AIAssistant bind:isOpen={aiAssistantOpen} />
  </div>
{/if}

<style>
  .app-shell {
    display: flex;
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
    position: relative;
  }
  
  .global-nav {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 220px;
    background: var(--bg-nav);
    border-right: 1px solid var(--border-color);
    transition: transform 0.3s ease;
    z-index: 100;
  }
  
  .global-nav.hidden {
    transform: translateX(-100%);
  }
  
  .nav-content {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .nav-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1rem 0.5rem 1rem;
    flex-shrink: 0;
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
  
  .btn-nav-toggle {
    background: none;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    font-size: 1.25rem;
    color: var(--text-muted);
    line-height: 1;
    border-radius: var(--radius-sm);
  }
  
  .btn-nav-toggle:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  .btn-nav-show {
    position: fixed;
    left: 1rem;
    top: 1rem;
    z-index: 99;
    background: var(--bg-nav);
    border: 1px solid var(--border-color);
    padding: 0.75rem;
    cursor: pointer;
    font-size: 1.25rem;
    color: var(--text-primary);
    border-radius: var(--radius-md);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: all 0.2s;
  }
  
  .btn-nav-show:hover {
    background: var(--bg-hover);
    transform: scale(1.05);
  }
  
  .nav-links {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1;
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
  
  .nav-spacer {
    flex: 1;
  }
  
  .nav-ai-button {
    padding: 1rem;
  }
  
  .btn-assistant {
    width: 100%;
    background: var(--accent-color);
    color: white;
    border: none;
    padding: 0.75rem 1rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 24px;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .btn-assistant:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
  
  .main-content {
    flex: 1;
    margin-left: 220px;
    padding: 1.5rem;
    overflow: auto;
    transition: margin-left 0.3s ease;
  }
  
  .main-content.expanded {
    margin-left: 0;
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

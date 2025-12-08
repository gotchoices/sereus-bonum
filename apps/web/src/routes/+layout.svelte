<script lang="ts">
  import { page } from '$app/stores';
  import '../app.css';
</script>

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
  </nav>
  
  <main class="main-content">
    <slot />
  </main>
</div>

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
</style>

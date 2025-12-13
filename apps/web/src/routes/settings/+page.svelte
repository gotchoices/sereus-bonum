<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import { settings, type Theme, type DateFormat, type AccountDisplay, type TransactionSortOrder } from '$lib/stores/settings';
  import { getDateFormatPreview } from '$lib/utils/formatDate';
  
  // Local state for form
  let theme = $state<Theme>('system');
  let dateFormat = $state<DateFormat>('US');
  let accountDisplay = $state<AccountDisplay>('name');
  let transactionSortOrder = $state<TransactionSortOrder>('oldest');
  let hideNegativeSigns = $state(false); // Simplified: single toggle for Equity + Income
  
  // Date format preview
  let datePreview = $derived(getDateFormatPreview(dateFormat));
  
  // Load settings on mount and sync with store
  onMount(() => {
    settings.load();
  });
  
  // Sync local state with store reactively
  $effect(() => {
    theme = $settings.theme;
    dateFormat = $settings.dateFormat;
    accountDisplay = $settings.accountDisplay;
    transactionSortOrder = $settings.transactionSortOrder;
    // Simplified: if either equity or income is reversed, toggle is on
    hideNegativeSigns = $settings.signReversal.equity || $settings.signReversal.income;
  });
  
  // Auto-save on change
  function handleThemeChange() {
    settings.setTheme(theme);
  }
  
  function handleDateFormatChange() {
    settings.setDateFormat(dateFormat);
  }
  
  function handleAccountDisplayChange() {
    settings.setAccountDisplay(accountDisplay);
  }
  
  function handleTransactionSortOrderChange() {
    settings.setTransactionSortOrder(transactionSortOrder);
  }
  
  function handleSignReversalChange() {
    // Simplified: toggle applies to both Equity and Income
    settings.setSignReversal({
      equity: hideNegativeSigns,
      income: hideNegativeSigns,
      liability: false, // Liabilities stay as-is
    });
  }
</script>

<div class="settings-page">
  <header class="page-header">
    <a href="/" class="back-link">← {$t('settings.back_to_home')}</a>
    <h1>{$t('settings.title')}</h1>
  </header>
  
  <!-- Display Preferences -->
  <section class="settings-section">
    <h2>{$t('settings.display_prefs')}</h2>
    
    <!-- Theme -->
    <div class="setting-row">
      <label class="setting-label" for="theme-select">{$t('settings.theme')}</label>
      <select id="theme-select" bind:value={theme} onchange={handleThemeChange}>
        <option value="light">{$t('settings.theme_light')}</option>
        <option value="dark">{$t('settings.theme_dark')}</option>
        <option value="system">{$t('settings.theme_system')}</option>
      </select>
    </div>
    
    <!-- Language -->
    <div class="setting-row">
      <label class="setting-label" for="language-select">{$t('settings.language')}</label>
      <select id="language-select" disabled>
        <option value="en">{$t('settings.language_english')}</option>
      </select>
    </div>
    
    <!-- Date Format -->
    <div class="setting-row">
      <label class="setting-label" for="date-format-select">{$t('settings.date_format')}</label>
      <div class="select-with-preview">
        <select id="date-format-select" bind:value={dateFormat} onchange={handleDateFormatChange}>
          <option value="US">{$t('settings.date_format_us')}</option>
          <option value="EU">{$t('settings.date_format_eu')}</option>
          <option value="ISO">{$t('settings.date_format_iso')}</option>
        </select>
        <span class="preview-text">{datePreview}</span>
      </div>
    </div>
    
    <!-- Account Display -->
    <div class="setting-row">
      <label class="setting-label" for="account-display-select">{$t('settings.account_display')}</label>
      <select id="account-display-select" bind:value={accountDisplay} onchange={handleAccountDisplayChange}>
        <option value="code">{$t('settings.account_display_code')}</option>
        <option value="name">{$t('settings.account_display_name')}</option>
        <option value="path">{$t('settings.account_display_path')}</option>
        <option value="code-name">{$t('settings.account_display_code_name')}</option>
      </select>
    </div>
    
    <!-- Transaction Sort Order -->
    <div class="setting-row">
      <label class="setting-label" for="transaction-sort-select">{$t('settings.transaction_sort_order')}</label>
      <select id="transaction-sort-select" bind:value={transactionSortOrder} onchange={handleTransactionSortOrderChange}>
        <option value="oldest">{$t('settings.transaction_sort_oldest')}</option>
        <option value="newest">{$t('settings.transaction_sort_newest')}</option>
      </select>
    </div>
  </section>
  
  <!-- Accounting Preferences -->
  <section class="settings-section">
    <h2>{$t('settings.accounting_prefs')}</h2>
    
    <div class="setting-row">
      <label class="setting-label toggle-label">
        <input 
          type="checkbox" 
          bind:checked={hideNegativeSigns}
          onchange={handleSignReversalChange}
        />
        <span>{$t('settings.hide_negative_signs')}</span>
      </label>
      <p class="setting-note">{$t('settings.hide_negative_signs_note')}</p>
    </div>
  </section>
  
  <!-- Network (Future) -->
  <section class="settings-section network-section">
    <h2>{$t('settings.network')} <span class="future-badge">Future</span></h2>
    
    <div class="setting-row">
      <label class="setting-label">{$t('settings.sereus_nodes')}</label>
      <button class="btn-add" disabled title="Adding nodes coming soon">+ {$t('settings.add_node')}</button>
    </div>
    
    <div class="node-list">
      <div class="node-list-empty">
        {$t('settings.no_nodes_configured')}
      </div>
      <!-- Future: nodes will appear here as cards with remove buttons -->
      <!--
      <div class="node-card">
        <div class="node-info">
          <div class="node-url">wss://sereus.example.com:1234</div>
          <div class="node-status">⚠ Offline</div>
        </div>
        <button class="btn-remove" disabled>Remove</button>
      </div>
      -->
    </div>
  </section>
</div>

<style>
  .settings-page {
    max-width: 700px;
    margin: 0 auto;
    padding: var(--space-lg);
  }
  
  .page-header {
    margin-bottom: var(--space-xl);
  }
  
  .back-link {
    display: block;
    font-size: 0.875rem;
    color: var(--text-muted);
    text-decoration: none;
    margin-bottom: var(--space-sm);
  }
  
  .back-link:hover {
    color: var(--accent-color);
  }
  
  .page-header h1 {
    margin: 0;
    font-size: 1.75rem;
  }
  
  .settings-section {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    margin-bottom: var(--space-lg);
  }
  
  .settings-section h2 {
    margin: 0 0 var(--space-lg) 0;
    font-size: 1.125rem;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  
  .future-badge {
    font-size: 0.75rem;
    color: var(--text-muted);
    background: var(--bg-secondary);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
  }
  
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) 0;
    border-bottom: 1px solid var(--border-color);
    gap: var(--space-lg);
  }
  
  .setting-row:last-child {
    border-bottom: none;
  }
  
  .setting-label {
    font-weight: 500;
    color: var(--text-primary);
    flex: 1;
  }
  
  .toggle-label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    cursor: pointer;
  }
  
  .toggle-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
  
  .setting-note {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin: var(--space-xs) 0 0 0;
    padding-left: 26px; /* Align with checkbox text */
  }
  
  .select-with-preview {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }
  
  .preview-text {
    font-size: 0.875rem;
    color: var(--text-muted);
    white-space: nowrap;
  }
  
  select {
    min-width: 200px;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
  }
  
  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-add {
    padding: var(--space-xs) var(--space-md);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
  }
  
  .btn-add:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .node-list {
    margin-top: var(--space-md);
  }
  
  .node-list-empty {
    padding: var(--space-lg);
    text-align: center;
    color: var(--text-muted);
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
  }
  
  .node-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    margin-bottom: var(--space-sm);
  }
  
  .node-info {
    flex: 1;
  }
  
  .node-url {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--text-primary);
  }
  
  .node-status {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: var(--space-xs);
  }
  
  .btn-remove {
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--danger);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--danger);
    font-size: 0.875rem;
    cursor: pointer;
  }
  
  .btn-remove:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .network-section {
    opacity: 0.7;
  }
</style>


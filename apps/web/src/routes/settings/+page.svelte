<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import { settings, type Theme, type DateFormat, type AccountDisplay } from '$lib/stores/settings';
  import { getDateFormatPreview } from '$lib/utils/formatDate';
  
  // Local state for form
  let theme = $state<Theme>('system');
  let dateFormat = $state<DateFormat>('US');
  let accountDisplay = $state<AccountDisplay>('name');
  let signReversalEquity = $state(false);
  let signReversalIncome = $state(false);
  let signReversalLiability = $state(false);
  
  // Date format preview
  let datePreview = $derived(getDateFormatPreview(dateFormat));
  
  // Load settings on mount
  onMount(() => {
    settings.load();
    const currentSettings = $state.snapshot($settings);
    theme = currentSettings.theme;
    dateFormat = currentSettings.dateFormat;
    accountDisplay = currentSettings.accountDisplay;
    signReversalEquity = currentSettings.signReversal.equity;
    signReversalIncome = currentSettings.signReversal.income;
    signReversalLiability = currentSettings.signReversal.liability;
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
  
  function handleSignReversalChange() {
    settings.setSignReversal({
      equity: signReversalEquity,
      income: signReversalIncome,
      liability: signReversalLiability,
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
    <div class="setting-group">
      <label class="setting-label">{$t('settings.theme')}</label>
      <div class="radio-group">
        <label class="radio-option">
          <input 
            type="radio" 
            name="theme" 
            value="light" 
            bind:group={theme}
            onchange={handleThemeChange}
          />
          <span>{$t('settings.theme_light')}</span>
        </label>
        <label class="radio-option">
          <input 
            type="radio" 
            name="theme" 
            value="dark" 
            bind:group={theme}
            onchange={handleThemeChange}
          />
          <span>{$t('settings.theme_dark')}</span>
        </label>
        <label class="radio-option">
          <input 
            type="radio" 
            name="theme" 
            value="system" 
            bind:group={theme}
            onchange={handleThemeChange}
          />
          <span>{$t('settings.theme_system')}</span>
        </label>
      </div>
    </div>
    
    <!-- Language -->
    <div class="setting-group">
      <label class="setting-label" for="language">{$t('settings.language')}</label>
      <select id="language" disabled>
        <option value="en">{$t('settings.language_english')}</option>
      </select>
      <p class="setting-note">Additional languages coming soon</p>
    </div>
    
    <!-- Date Format -->
    <div class="setting-group">
      <label class="setting-label">{$t('settings.date_format')}</label>
      <div class="radio-group">
        <label class="radio-option">
          <input 
            type="radio" 
            name="dateFormat" 
            value="US" 
            bind:group={dateFormat}
            onchange={handleDateFormatChange}
          />
          <span>{$t('settings.date_format_us')}</span>
        </label>
        <label class="radio-option">
          <input 
            type="radio" 
            name="dateFormat" 
            value="EU" 
            bind:group={dateFormat}
            onchange={handleDateFormatChange}
          />
          <span>{$t('settings.date_format_eu')}</span>
        </label>
        <label class="radio-option">
          <input 
            type="radio" 
            name="dateFormat" 
            value="ISO" 
            bind:group={dateFormat}
            onchange={handleDateFormatChange}
          />
          <span>{$t('settings.date_format_iso')}</span>
        </label>
      </div>
      <p class="setting-note">{$t('settings.date_format_preview')}: {datePreview}</p>
    </div>
    
    <!-- Account Display -->
    <div class="setting-group">
      <label class="setting-label">{$t('settings.account_display')}</label>
      <div class="radio-group">
        <label class="radio-option">
          <input 
            type="radio" 
            name="accountDisplay" 
            value="code" 
            bind:group={accountDisplay}
            onchange={handleAccountDisplayChange}
          />
          <span>{$t('settings.account_display_code')}</span>
        </label>
        <label class="radio-option">
          <input 
            type="radio" 
            name="accountDisplay" 
            value="name" 
            bind:group={accountDisplay}
            onchange={handleAccountDisplayChange}
          />
          <span>{$t('settings.account_display_name')}</span>
        </label>
        <label class="radio-option">
          <input 
            type="radio" 
            name="accountDisplay" 
            value="path" 
            bind:group={accountDisplay}
            onchange={handleAccountDisplayChange}
          />
          <span>{$t('settings.account_display_path')}</span>
        </label>
        <label class="radio-option">
          <input 
            type="radio" 
            name="accountDisplay" 
            value="code-name" 
            bind:group={accountDisplay}
            onchange={handleAccountDisplayChange}
          />
          <span>{$t('settings.account_display_code_name')}</span>
        </label>
      </div>
    </div>
  </section>
  
  <!-- Accounting Preferences -->
  <section class="settings-section">
    <h2>{$t('settings.accounting_prefs')}</h2>
    
    <div class="setting-group">
      <label class="setting-label">{$t('settings.sign_reversal')}</label>
      <div class="checkbox-group">
        <label class="checkbox-option">
          <input 
            type="checkbox" 
            bind:checked={signReversalEquity}
            onchange={handleSignReversalChange}
          />
          <span>{$t('settings.sign_reversal_equity')}</span>
        </label>
        <label class="checkbox-option">
          <input 
            type="checkbox" 
            bind:checked={signReversalIncome}
            onchange={handleSignReversalChange}
          />
          <span>{$t('settings.sign_reversal_income')}</span>
        </label>
        <label class="checkbox-option">
          <input 
            type="checkbox" 
            bind:checked={signReversalLiability}
            onchange={handleSignReversalChange}
          />
          <span>{$t('settings.sign_reversal_liability')}</span>
        </label>
      </div>
      <p class="setting-note">{$t('settings.sign_reversal_note')}</p>
    </div>
  </section>
  
  <!-- Network (Future) -->
  <section class="settings-section network-section">
    <h2>{$t('settings.network')} <span class="future-badge">Future</span></h2>
    
    <div class="setting-group">
      <label class="setting-label">{$t('settings.sereus_node')}</label>
      <div class="node-config">
        <span class="node-status">{$t('settings.node_not_configured')}</span>
        <button class="btn-secondary" disabled>{$t('settings.node_configure')}</button>
      </div>
      <p class="setting-note">
        {$t('settings.node_status')}: ⚠ {$t('settings.node_offline')}
      </p>
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
  
  .setting-group {
    margin-bottom: var(--space-lg);
  }
  
  .setting-group:last-child {
    margin-bottom: 0;
  }
  
  .setting-label {
    display: block;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: var(--space-sm);
  }
  
  .setting-note {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-top: var(--space-sm);
    margin-bottom: 0;
  }
  
  .radio-group,
  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .radio-option,
  .checkbox-option {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .radio-option:hover,
  .checkbox-option:hover {
    background: var(--bg-hover);
  }
  
  .radio-option input,
  .checkbox-option input {
    cursor: pointer;
  }
  
  .radio-option span,
  .checkbox-option span {
    color: var(--text-primary);
  }
  
  select {
    width: 100%;
    padding: var(--space-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.875rem;
  }
  
  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .node-config {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
  }
  
  .node-status {
    flex: 1;
    color: var(--text-muted);
  }
  
  .btn-secondary {
    padding: var(--space-xs) var(--space-md);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
  }
  
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .network-section {
    opacity: 0.7;
  }
</style>


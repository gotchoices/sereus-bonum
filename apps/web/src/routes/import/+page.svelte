<script lang="ts">
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  import { importService, type ParsedBooks, type ImportResult } from '$lib/import';
  
  let entityName = $state('');
  let selectedFile = $state<File | null>(null);
  let isDragging = $state(false);
  let step: 'upload' | 'processing' | 'mapping' | 'complete' = $state('upload');
  let progress = $state(0);
  let statusMessage = $state('');
  let accountCount = $state(0);
  let transactionCount = $state(0);
  let parsedData = $state<ParsedBooks | null>(null);
  let importResult = $state<ImportResult | null>(null);
  let error = $state<string | null>(null);
  
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }
  
  function handleDragLeave() {
    isDragging = false;
  }
  
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  }
  
  function handleFileInput(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      handleFileSelection(target.files[0]);
    }
  }
  
  function handleFileSelection(file: File) {
    const validExtensions = ['.gnucash', '.iif'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValid) {
      error = 'Invalid file type. Please select a .gnucash or .iif file.';
      selectedFile = null;
      return;
    }
    
    error = null;
    selectedFile = file;
    log.ui.info('[Import] File selected:', file.name, file.size);
  }
  
  function cancel() {
    window.location.href = '/';
  }
  
  async function processFile() {
    if (!entityName.trim()) {
      error = 'Please enter an entity name.';
      return;
    }
    
    if (!selectedFile) {
      error = 'Please select a file to import.';
      return;
    }
    
    error = null;
    step = 'processing';
    statusMessage = 'Parsing file...';
    
    try {
      // Parse file using import service
      parsedData = await importService.parseFile(selectedFile);
      
      accountCount = parsedData.accounts.length;
      transactionCount = parsedData.transactions.length;
      
      log.ui.info('[Import] Parse complete:', { 
        accounts: accountCount, 
        transactions: transactionCount,
        commodities: parsedData.commodities.length 
      });
      
      // Go directly to mapping
      step = 'mapping';
      
    } catch (err) {
      log.ui.error('[Import] Error processing file:', err);
      error = `Failed to process file: ${err instanceof Error ? err.message : 'Unknown error'}`;
      step = 'upload';
    }
  }
  
  function goBack() {
    step = 'upload';
    progress = 0;
    statusMessage = '';
    error = null;
  }
  
  async function completeImport() {
    if (!parsedData) {
      error = 'No data to import';
      return;
    }
    
    try {
      log.ui.info('[Import] Starting import for entity:', entityName);
      
      importResult = await importService.importBooks(parsedData, {
        entityName: entityName.trim(),
        skipDuplicates: true,
        createMissingAccounts: true
      });
      
      if (importResult.errors.length > 0) {
        error = importResult.errors.join(', ');
        return;
      }
      
      log.ui.info('[Import] Import complete:', importResult);
      step = 'complete';
      
    } catch (err) {
      log.ui.error('[Import] Error during import:', err);
      error = `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }
</script>

<div class="import-page">
  <div class="import-container">
    
    {#if step === 'upload'}
      <!-- Step 1: Upload Dialog -->
      <div class="dialog">
        <div class="dialog-header">
          <h2>{$t('import.title')}</h2>
          <button class="close-btn" onclick={cancel}>×</button>
        </div>
        
        <div class="dialog-body">
          <div class="form-group">
            <label for="entity-name">{$t('import.entity_name')}:</label>
            <input
              id="entity-name"
              type="text"
              bind:value={entityName}
              placeholder="e.g., Home Books"
              class="input"
            />
          </div>
          
          <div class="form-group">
            <label>{$t('import.source_file')}:</label>
            <div
              class="drop-zone"
              class:dragging={isDragging}
              ondragover={handleDragOver}
              ondragleave={handleDragLeave}
              ondrop={handleDrop}
            >
              {#if selectedFile}
                <div class="file-selected">
                  <span class="file-icon">📄</span>
                  <span class="file-name">{selectedFile.name}</span>
                  <span class="file-size">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              {:else}
                <p>{$t('import.drag_drop')}</p>
                <p class="or-text">{$t('common.or') || 'or'}</p>
              {/if}
              
              <label class="browse-btn">
                <input
                  type="file"
                  accept=".gnucash,.iif"
                  onchange={handleFileInput}
                  style="display: none;"
                />
                {selectedFile ? $t('import.change_file') : $t('import.browse_files')}
              </label>
            </div>
            
            <p class="help-text">{$t('import.supported_formats')}: .gnucash, .iif</p>
          </div>
          
          {#if error}
            <div class="error-message">{error}</div>
          {/if}
        </div>
        
        <div class="dialog-footer">
          <button class="btn-secondary" onclick={cancel}>{$t('common.cancel') || 'Cancel'}</button>
          <button class="btn-primary" onclick={processFile} disabled={!entityName.trim() || !selectedFile}>
            {$t('common.next') || 'Next'}
          </button>
        </div>
      </div>
      
    {:else if step === 'processing'}
      <!-- Step 2: Processing -->
      <div class="dialog">
        <div class="dialog-header">
          <h2>{$t('import.processing')}</h2>
        </div>
        
        <div class="dialog-body">
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {progress}%"></div>
            </div>
            <p class="progress-text">{progress}%</p>
          </div>
          
          <p class="status-message">{statusMessage}</p>
        </div>
      </div>
      
    {:else if step === 'mapping'}
      <!-- Step 3: Account Mapping -->
      <div class="dialog dialog-wide">
        <div class="dialog-header">
          <h2>{$t('import.review_mapping')}</h2>
        </div>
        
        <div class="dialog-body">
          <div class="mapping-summary">
            <div class="summary-stats">
              <div class="stat-item">
                <span class="stat-label">Accounts:</span>
                <span class="stat-value">{accountCount}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Transactions:</span>
                <span class="stat-value">{transactionCount}</span>
              </div>
              {#if parsedData}
                <div class="stat-item">
                  <span class="stat-label">Commodities:</span>
                  <span class="stat-value">{parsedData.commodities.length}</span>
                </div>
              {/if}
            </div>
            <p class="help-text">{$t('import.review_accounts')}</p>
          </div>
          
          {#if parsedData}
            <div class="accounts-preview">
              <div class="accounts-header">
                <div class="col-source">Source Account</div>
                <div class="col-type">Type</div>
                <div class="col-guid">GUID</div>
              </div>
              <div class="accounts-list">
                {#each parsedData.accounts.slice(0, 20) as account}
                  <div class="account-row">
                    <div class="col-source">
                      <span class="account-name">{account.name}</span>
                      {#if account.code}
                        <span class="account-code">({account.code})</span>
                      {/if}
                    </div>
                    <div class="col-type">
                      <span class="account-type">{account.type}</span>
                    </div>
                    <div class="col-guid">
                      <span class="account-guid">{account.guid.substring(0, 8)}...</span>
                    </div>
                  </div>
                {/each}
                {#if parsedData.accounts.length > 20}
                  <div class="account-row more-accounts">
                    <div class="col-source">
                      <span class="text-muted">... and {parsedData.accounts.length - 20} more accounts</span>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
          
          {#if error}
            <div class="error-message">{error}</div>
          {/if}
        </div>
        
        <div class="dialog-footer">
          <button class="btn-secondary" onclick={goBack}>{$t('common.back') || 'Back'}</button>
          <button class="btn-primary" onclick={completeImport}>
            {$t('import.complete_import') || 'Complete Import'}
          </button>
        </div>
      </div>
      
    {:else if step === 'complete'}
      <!-- Step 4: Complete -->
      <div class="dialog">
        <div class="dialog-header">
          <h2>{$t('import.import_complete')}</h2>
        </div>
        
        <div class="dialog-body">
          <div class="success-message">
            <span class="success-icon">✓</span>
            <p>{$t('import.entity_created', { name: entityName })}</p>
            <p>{$t('import.imported_counts', { accounts: accountCount, transactions: transactionCount })}</p>
          </div>
        </div>
        
        <div class="dialog-footer">
          <button class="btn-primary" onclick={() => window.location.href = '/'}>
            {$t('import.view_entity') || 'View Entity'}
          </button>
        </div>
      </div>
    {/if}
    
  </div>
</div>

<style>
  .import-page {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: var(--surface-secondary);
    padding: 2rem;
  }
  
  .import-container {
    width: 100%;
    max-width: 600px;
  }
  
  .dialog {
    background: var(--surface-primary);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    overflow: hidden;
  }
  
  .dialog-wide {
    max-width: 900px;
  }
  
  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .dialog-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .close-btn:hover {
    color: var(--text-primary);
  }
  
  .dialog-body {
    padding: 2rem;
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 1rem;
    background: var(--surface-primary);
    color: var(--text-primary);
  }
  
  .input:focus {
    outline: none;
    border-color: var(--primary-color);
  }
  
  .drop-zone {
    border: 2px dashed var(--border-color);
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    background: var(--surface-secondary);
    transition: all 0.2s;
  }
  
  .drop-zone.dragging {
    border-color: var(--primary-color);
    background: var(--primary-color-light, rgba(0, 102, 204, 0.1));
  }
  
  .file-selected {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .file-icon {
    font-size: 2rem;
  }
  
  .file-name {
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .file-size {
    color: var(--text-muted);
    font-size: 0.875rem;
  }
  
  .or-text {
    margin: 0.5rem 0;
    color: var(--text-muted);
    font-size: 0.875rem;
  }
  
  .browse-btn {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    background: var(--primary-color);
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.15s;
  }
  
  .browse-btn:hover {
    background: var(--primary-color-hover, #0052a3);
  }
  
  .help-text {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-muted);
  }
  
  .error-message {
    padding: 1rem;
    background: var(--danger-color-light, rgba(220, 53, 69, 0.1));
    border: 1px solid var(--danger-color);
    border-radius: 4px;
    color: var(--danger-color);
    margin-top: 1rem;
  }
  
  .progress-container {
    margin: 2rem 0;
  }
  
  .progress-bar {
    width: 100%;
    height: 8px;
    background: var(--surface-secondary);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: var(--primary-color);
    transition: width 0.3s ease;
  }
  
  .progress-text {
    text-align: center;
    margin-top: 0.5rem;
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .status-message {
    text-align: center;
    margin-top: 1rem;
    color: var(--text-muted);
  }
  
  .mapping-summary {
    margin-bottom: 1.5rem;
  }
  
  .summary-stats {
    display: flex;
    gap: 2rem;
    padding: 1rem 1.5rem;
    background: var(--surface-secondary);
    border-radius: 4px;
    margin-bottom: 1rem;
  }
  
  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .stat-label {
    color: var(--text-muted);
    font-size: 0.875rem;
  }
  
  .stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--primary-color);
  }
  
  .accounts-preview {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .accounts-header {
    display: grid;
    grid-template-columns: 2fr 1fr 1.5fr;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--surface-secondary);
    border-bottom: 2px solid var(--border-color);
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }
  
  .accounts-list {
    max-height: 400px;
    overflow-y: auto;
  }
  
  .account-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1.5fr;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-light);
  }
  
  .account-row:hover:not(.more-accounts) {
    background: var(--surface-hover, #f9f9f9);
  }
  
  .account-row.more-accounts {
    grid-template-columns: 1fr;
    font-style: italic;
  }
  
  .account-name {
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .account-code {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-left: 0.5rem;
  }
  
  .account-type {
    color: var(--text-primary);
    font-size: 0.875rem;
    font-family: monospace;
  }
  
  .account-guid {
    color: var(--text-muted);
    font-size: 0.75rem;
    font-family: monospace;
  }
  
  .success-message {
    text-align: center;
    padding: 2rem 0;
  }
  
  .success-icon {
    display: inline-block;
    width: 64px;
    height: 64px;
    line-height: 64px;
    border-radius: 50%;
    background: var(--success-color);
    color: white;
    font-size: 2rem;
    font-weight: bold;
    margin-bottom: 1rem;
  }
  
  .success-message p {
    margin: 0.5rem 0;
    font-size: 1.125rem;
    color: var(--text-primary);
  }
  
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: background-color 0.15s;
  }
  
  .btn-primary {
    background: var(--primary-color, #0066cc) !important;
    color: white !important;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--primary-color-hover, #0052a3);
  }
  
  .btn-primary:active:not(:disabled) {
    background: var(--primary-color-active, #003d7a);
  }
  
  .btn-primary:disabled {
    opacity: 1;
    cursor: not-allowed;
    background: var(--surface-secondary, #e0e0e0);
    color: var(--text-muted, #999);
    border: 1px solid var(--border-color, #ccc);
  }
  
  .btn-secondary {
    background: var(--surface-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--surface-hover, #e8e8e8);
  }
</style>


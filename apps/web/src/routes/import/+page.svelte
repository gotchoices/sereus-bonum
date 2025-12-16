<script lang="ts">
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  import { importService, type ParsedBooks, type ImportResult, type AccountMapping } from '$lib/import';
  
  let entityName = $state('');
  let selectedFile = $state<File | null>(null);
  let isDragging = $state(false);
  let step: 'upload' | 'processing' | 'mapping' | 'importing' | 'complete' = $state('upload');
  let statusMessage = $state('');
  let parsedData = $state<ParsedBooks | null>(null);
  let mappings = $state<AccountMapping[]>([]);
  let selectedMappings = $state<Set<number>>(new Set());
  let importResult = $state<ImportResult | null>(null);
  let error = $state<string | null>(null);
  
  // Computed state
  let allResolved = $derived(mappings.every(m => m.isResolved));
  let accountCount = $derived(parsedData?.accounts.length ?? 0);
  let transactionCount = $derived(parsedData?.transactions.length ?? 0);
  
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
      
      log.ui.info('[Import] Parse complete:', { 
        accounts: parsedData.accounts.length, 
        transactions: parsedData.transactions.length,
        commodities: parsedData.commodities.length 
      });
      
      // Build hierarchical mappings with auto-matching
      statusMessage = 'Analyzing account structure...';
      mappings = buildAccountMappings(parsedData.accounts);
      
      log.ui.info('[Import] Mappings built:', mappings.length);
      
      // Go to mapping review
      step = 'mapping';
      
    } catch (err) {
      log.ui.error('[Import] Error processing file:', err);
      error = `Failed to process file: ${err instanceof Error ? err.message : 'Unknown error'}`;
      step = 'upload';
    }
  }
  
  function buildAccountMappings(accounts: typeof parsedData.accounts): AccountMapping[] {
    if (!accounts) return [];
    
    // Build parent-child hierarchy
    const accountMap = new Map(accounts.map(acc => [acc.guid, acc]));
    const childMap = new Map<string, typeof accounts>();
    
    for (const account of accounts) {
      if (account.parentGuid) {
        if (!childMap.has(account.parentGuid)) {
          childMap.set(account.parentGuid, []);
        }
        childMap.get(account.parentGuid)!.push(account);
      }
    }
    
    // Calculate depth for each account
    const depthMap = new Map<string, number>();
    function calculateDepth(guid: string, visited = new Set<string>()): number {
      if (depthMap.has(guid)) return depthMap.get(guid)!;
      if (visited.has(guid)) return 0; // Circular reference protection
      
      const account = accountMap.get(guid);
      if (!account?.parentGuid) {
        depthMap.set(guid, 0);
        return 0;
      }
      
      visited.add(guid);
      const depth = 1 + calculateDepth(account.parentGuid, visited);
      depthMap.set(guid, depth);
      return depth;
    }
    
    accounts.forEach(acc => calculateDepth(acc.guid));
    
    // Build mappings in hierarchical order
    const result: AccountMapping[] = [];
    const processed = new Set<string>();
    
    function addAccountAndChildren(account: typeof accounts[0]) {
      if (processed.has(account.guid)) return;
      processed.add(account.guid);
      
      const depth = depthMap.get(account.guid) ?? 0;
      const hasChildren = childMap.has(account.guid);
      const isImplicitPlaceholder = hasChildren && !account.placeholder;
      
      // Auto-match based on account type and name
      const autoMatch = autoMatchAccount(account);
      
      result.push({
        sourceAccount: account,
        targetGroup: autoMatch.group,
        targetAccount: autoMatch.account,
        isSettled: false,
        isResolved: autoMatch.confidence === 'high' || (account.placeholder && autoMatch.group !== null),
        confidence: autoMatch.confidence,
        depth,
        isImplicitPlaceholder
      });
      
      // Add children recursively
      const children = childMap.get(account.guid) || [];
      children.sort((a, b) => a.name.localeCompare(b.name));
      children.forEach(child => addAccountAndChildren(child));
    }
    
    // Start with root accounts
    const rootAccounts = accounts.filter(acc => !acc.parentGuid);
    rootAccounts.sort((a, b) => a.name.localeCompare(b.name));
    rootAccounts.forEach(acc => addAccountAndChildren(acc));
    
    return result;
  }
  
  function autoMatchAccount(account: typeof parsedData.accounts[0]): {
    group: string | null;
    account: string | null;
    confidence: 'high' | 'medium' | 'low';
  } {
    // Simple auto-matching logic based on GnuCash account types
    // In production, this would query existing account groups from the database
    
    const typeMap: Record<string, string> = {
      'BANK': 'Cash & Bank',
      'CASH': 'Cash & Bank',
      'ASSET': 'Other Assets',
      'STOCK': 'Investments',
      'MUTUAL': 'Investments',
      'CREDIT': 'Credit Cards',
      'LIABILITY': 'Loans & Other Liabilities',
      'PAYABLE': 'Loans & Other Liabilities',
      'EQUITY': 'Owner\'s Equity',
      'INCOME': 'Income',
      'EXPENSE': 'Expenses',
    };
    
    const group = typeMap[account.type] || null;
    const confidence: 'high' | 'medium' | 'low' = 
      typeMap[account.type] ? 'high' : 'low';
    
    // Placeholder accounts map to group only (no specific account)
    if (account.placeholder) {
      return { group, account: null, confidence };
    }
    
    // Regular accounts map to group + account name
    return { group, account: account.name, confidence };
  }
  
  function toggleSettled(index: number) {
    mappings[index].isSettled = !mappings[index].isSettled;
  }
  
  function toggleAllSelected() {
    if (selectedMappings.size > 0) {
      selectedMappings.clear();
    } else {
      selectedMappings = new Set(mappings.map((_, i) => i));
    }
  }
  
  function toggleSelection(index: number) {
    if (selectedMappings.has(index)) {
      selectedMappings.delete(index);
    } else {
      selectedMappings.add(index);
    }
    selectedMappings = selectedMappings; // Trigger reactivity
  }
  
  function markSelectedAsSettled() {
    selectedMappings.forEach(index => {
      if (mappings[index].isResolved) {
        mappings[index].isSettled = true;
      }
    });
    selectedMappings.clear();
    mappings = mappings; // Trigger reactivity
  }
  
  function rescanMappings() {
    // Re-attempt automatic matching for unsettled accounts only
    mappings = mappings.map(mapping => {
      if (mapping.isSettled) {
        return mapping; // Don't touch settled mappings
      }
      
      // Re-run auto-matching
      const autoMatch = autoMatchAccount(mapping.sourceAccount);
      return {
        ...mapping,
        targetGroup: autoMatch.group,
        targetAccount: autoMatch.account,
        isResolved: autoMatch.confidence === 'high' || 
          (mapping.sourceAccount.placeholder && autoMatch.group !== null),
        confidence: autoMatch.confidence
      };
    });
    
    log.ui.info('[Import] Rescan complete');
  }
  
  function updateMapping(index: number, targetGroup: string | null, targetAccount: string | null) {
    mappings[index].targetGroup = targetGroup;
    mappings[index].targetAccount = targetAccount;
    mappings[index].isResolved = targetGroup !== null;
    mappings = mappings; // Trigger reactivity
  }
  
  function goBack() {
    step = 'upload';
    error = null;
  }
  
  async function executeImport() {
    if (!parsedData || !allResolved) {
      error = 'Not all accounts are resolved';
      return;
    }
    
    step = 'importing';
    statusMessage = 'Creating entity and importing data...';
    error = null;
    
    try {
      log.ui.info('[Import] Starting import for entity:', entityName);
      
      // Pass mappings to import service
      // In production, this would use the mappings to create the correct account structure
      importResult = await importService.importBooks(parsedData, {
        entityName: entityName.trim(),
        skipDuplicates: true,
        createMissingAccounts: true
      });
      
      if (importResult.errors.length > 0) {
        error = importResult.errors.join(', ');
        step = 'mapping'; // Stay on mapping screen so user can fix
        return;
      }
      
      log.ui.info('[Import] Import complete:', importResult);
      step = 'complete';
      
    } catch (err) {
      log.ui.error('[Import] Error during import:', err);
      error = `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      step = 'mapping'; // Return to mapping screen with error
    }
  }
  
  function getConfidenceIcon(confidence: 'high' | 'medium' | 'low'): string {
    switch (confidence) {
      case 'high': return '✓';
      case 'medium': return '⚠';
      case 'low': return '✗';
    }
  }
  
  function getConfidenceClass(confidence: 'high' | 'medium' | 'low'): string {
    switch (confidence) {
      case 'high': return 'confidence-high';
      case 'medium': return 'confidence-medium';
      case 'low': return 'confidence-low';
    }
  }
</script>

<div class="import-page">
  <div class="import-container" class:wide={step === 'mapping'}>
    
    {#if step === 'upload'}
      <!-- Step 1: File Selection Dialog -->
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
            <div class="spinner"></div>
            <p class="status-message">{statusMessage}</p>
          </div>
        </div>
      </div>
      
    {:else if step === 'mapping'}
      <!-- Step 3: Account Mapping Review -->
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
              <div class="stat-item">
                <span class="stat-label">Resolved:</span>
                <span class="stat-value" class:resolved={allResolved}>
                  {mappings.filter(m => m.isResolved).length} / {mappings.length}
                </span>
              </div>
            </div>
            <p class="help-text">Review account mappings. Mark rows as settled to protect them from rescan.</p>
          </div>
          
          <div class="mapping-toolbar">
            <button class="btn-small" onclick={toggleAllSelected}>
              {selectedMappings.size > 0 ? 'Deselect All' : 'Select All'}
            </button>
            {#if selectedMappings.size > 0}
              <button class="btn-small" onclick={markSelectedAsSettled}>
                Mark Selected as Settled ({selectedMappings.size})
              </button>
            {/if}
            <button class="btn-small btn-rescan" onclick={rescanMappings}>
              ↻ Rescan Unsettled
            </button>
          </div>
          
          <div class="mappings-container">
            <div class="mappings-header">
              <div class="col-select"></div>
              <div class="col-source">Source Account</div>
              <div class="col-placeholder">Placeholder</div>
              <div class="col-target">Bonum Target</div>
              <div class="col-status">Status</div>
            </div>
            <div class="mappings-list">
              {#each mappings as mapping, i}
                <div class="mapping-row" class:selected={selectedMappings.has(i)}>
                  <div class="col-select">
                    <input
                      type="checkbox"
                      checked={selectedMappings.has(i)}
                      onchange={() => toggleSelection(i)}
                    />
                  </div>
                  <div class="col-source" style="padding-left: {mapping.depth * 1.5}rem;">
                    <span class="account-name">{mapping.sourceAccount.name}</span>
                    {#if mapping.sourceAccount.code}
                      <span class="account-code">({mapping.sourceAccount.code})</span>
                    {/if}
                    <span class="account-type">{mapping.sourceAccount.type}</span>
                  </div>
                  <div class="col-placeholder">
                    {#if mapping.sourceAccount.placeholder}
                      <span class="badge badge-placeholder">Explicit</span>
                    {:else if mapping.isImplicitPlaceholder}
                      <span class="badge badge-implicit">Implicit</span>
                    {:else}
                      <span class="text-muted">—</span>
                    {/if}
                  </div>
                  <div class="col-target">
                    {#if mapping.targetGroup}
                      <div class="target-display">
                        <span class="target-group">{mapping.targetGroup}</span>
                        {#if mapping.targetAccount}
                          <span class="target-separator">:</span>
                          <span class="target-account">{mapping.targetAccount}</span>
                        {/if}
                      </div>
                    {:else}
                      <span class="text-muted">Not mapped</span>
                    {/if}
                  </div>
                  <div class="col-status">
                    <div class="status-indicators">
                      <span 
                        class="confidence-icon {getConfidenceClass(mapping.confidence)}"
                        title="{mapping.confidence} confidence"
                      >
                        {getConfidenceIcon(mapping.confidence)}
                      </span>
                      {#if mapping.isSettled}
                        <span class="settled-icon" title="Settled">✓</span>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
          
          {#if error}
            <div class="error-message">{error}</div>
          {/if}
        </div>
        
        <div class="dialog-footer">
          <button class="btn-secondary" onclick={goBack}>{$t('common.back') || 'Back'}</button>
          <button class="btn-primary" onclick={executeImport} disabled={!allResolved}>
            {$t('import.import') || 'Import'} {!allResolved ? '(resolve all accounts first)' : ''}
          </button>
        </div>
      </div>
      
    {:else if step === 'importing'}
      <!-- Step 4: Import Execution -->
      <div class="dialog">
        <div class="dialog-header">
          <h2>{$t('import.importing')}</h2>
        </div>
        
        <div class="dialog-body">
          <div class="progress-container">
            <div class="spinner"></div>
            <p class="status-message">{statusMessage}</p>
            <p class="help-text">Please wait, creating entity and importing data...</p>
          </div>
        </div>
      </div>
      
    {:else if step === 'complete'}
      <!-- Step 5: Complete -->
      <div class="dialog">
        <div class="dialog-header">
          <h2>{$t('import.import_complete')}</h2>
        </div>
        
        <div class="dialog-body">
          <div class="success-message">
            <span class="success-icon">✓</span>
            <p><strong>Entity "{entityName}" created successfully</strong></p>
            {#if importResult}
              <div class="import-stats">
                <p>{importResult.accountsCreated} accounts created</p>
                <p>{importResult.transactionsImported} transactions imported</p>
                {#if parsedData}
                  <p class="text-muted">
                    Date range: {parsedData.transactions[0]?.date} to {parsedData.transactions[parsedData.transactions.length - 1]?.date}
                  </p>
                {/if}
              </div>
            {/if}
          </div>
        </div>
        
        <div class="dialog-footer">
          <button class="btn-secondary" onclick={cancel}>{$t('common.close') || 'Close'}</button>
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
    transition: max-width 0.3s ease;
  }
  
  .import-container.wide {
    max-width: 1200px;
  }
  
  .dialog {
    background: var(--surface-primary);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    overflow: hidden;
  }
  
  .dialog-wide {
    max-width: none;
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
    text-align: center;
    padding: 2rem 0;
  }
  
  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--surface-secondary);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 1rem;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .status-message {
    font-weight: 500;
    color: var(--text-primary);
    margin: 0.5rem 0;
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
    margin-bottom: 0.75rem;
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
  
  .stat-value.resolved {
    color: var(--success-color);
  }
  
  .mapping-toolbar {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .btn-small {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    background: var(--surface-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-primary);
  }
  
  .btn-small:hover {
    background: var(--surface-hover, #f0f0f0);
  }
  
  .btn-rescan {
    margin-left: auto;
    background: var(--primary-color);
    color: white;
    border: none;
  }
  
  .btn-rescan:hover {
    background: var(--primary-color-hover, #0052a3);
  }
  
  .mappings-container {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 1rem;
  }
  
  .mappings-header {
    display: grid;
    grid-template-columns: 40px 2fr 120px 2fr 100px;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--surface-secondary);
    border-bottom: 2px solid var(--border-color);
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }
  
  .mappings-list {
    max-height: 500px;
    overflow-y: auto;
  }
  
  .mapping-row {
    display: grid;
    grid-template-columns: 40px 2fr 120px 2fr 100px;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-light);
    align-items: center;
  }
  
  .mapping-row:hover {
    background: var(--surface-hover, #f9f9f9);
  }
  
  .mapping-row.selected {
    background: var(--primary-color-light, rgba(0, 102, 204, 0.05));
  }
  
  .col-select input[type="checkbox"] {
    cursor: pointer;
  }
  
  .col-source {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .account-name {
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .account-code {
    color: var(--text-muted);
    font-size: 0.875rem;
  }
  
  .account-type {
    font-family: monospace;
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    background: var(--surface-secondary);
    border-radius: 3px;
    color: var(--text-muted);
  }
  
  .badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-weight: 500;
  }
  
  .badge-placeholder {
    background: var(--warning-color-light, rgba(255, 193, 7, 0.2));
    color: var(--warning-color, #ff9800);
  }
  
  .badge-implicit {
    background: var(--info-color-light, rgba(33, 150, 243, 0.2));
    color: var(--info-color, #2196f3);
  }
  
  .target-display {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  
  .target-group {
    font-weight: 500;
    color: var(--primary-color);
  }
  
  .target-separator {
    color: var(--text-muted);
  }
  
  .target-account {
    color: var(--text-primary);
  }
  
  .status-indicators {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .confidence-icon {
    font-weight: bold;
    font-size: 1.125rem;
  }
  
  .confidence-high {
    color: var(--success-color);
  }
  
  .confidence-medium {
    color: var(--warning-color, #ff9800);
  }
  
  .confidence-low {
    color: var(--danger-color);
  }
  
  .settled-icon {
    color: var(--success-color);
    font-weight: bold;
  }
  
  .text-muted {
    color: var(--text-muted);
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
  
  .import-stats {
    margin-top: 1rem;
  }
  
  .import-stats p {
    margin: 0.25rem 0;
    font-size: 1rem;
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
  
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

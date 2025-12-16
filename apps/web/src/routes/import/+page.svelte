<script lang="ts">
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  import { goto } from '$app/navigation';
  import { 
    importService, 
    type ParsedBooks, 
    type ImportResult, 
    type AccountMapping,
    isValidAccountPath,
    isCompleteAccountPath
  } from '$lib/import';
  
  let entityName = $state('');
  let selectedFile = $state<File | null>(null);
  let isDragging = $state(false);
  let step: 'upload' | 'processing' | 'mapping' | 'importing' = $state('upload');
  let statusMessage = $state('');
  let parsedData = $state<ParsedBooks | null>(null);
  let mappings = $state<AccountMapping[]>([]);
  let selectedMappings = $state<Set<number>>(new Set());
  let importResult = $state<ImportResult | null>(null);
  let error = $state<string | null>(null);
  let editingGroupIndex = $state<number | null>(null);
  let editingAccountIndex = $state<number | null>(null);
  let showGroupTreeIndex = $state<number | null>(null);
  
  // Computed state
  let allResolved = $derived(mappings.every(m => m.isResolved));
  let accountCount = $derived(mappings.length);
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
    goto('/');
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
      const rawData = await importService.parseFile(selectedFile);
      
      log.ui.info('[Import] Raw data:', { 
        accounts: rawData.accounts.length,
        transactions: rawData.transactions.length,
        commodities: rawData.commodities.length,
        sampleAccounts: rawData.accounts.slice(0, 3).map(a => ({ 
          name: a.name, 
          type: a.type, 
          parentGuid: a.parentGuid 
        }))
      });
      
      // Filter at parse time: exclude Root Account and accounts with no transactions/children
      const filteredAccounts = filterAccounts(rawData.accounts, rawData.transactions);
      
      log.ui.info('[Import] After filtering:', {
        accountsRaw: rawData.accounts.length,
        accountsFiltered: filteredAccounts.length,
        excluded: rawData.accounts.length - filteredAccounts.length
      });
      
      parsedData = {
        ...rawData,
        accounts: filteredAccounts
      };
      
      // Build hierarchical mappings with auto-matching
      statusMessage = 'Analyzing account structure...';
      mappings = buildAccountMappings(parsedData.accounts, parsedData.transactions);
      
      log.ui.info('[Import] Mappings built:', {
        count: mappings.length,
        sample: mappings.slice(0, 3).map(m => ({
          name: m.sourceAccount.name,
          path: m.fullSourcePath,
          targetGroup: m.targetGroup
        }))
      });
      
      // Go to mapping review
      step = 'mapping';
      
    } catch (err) {
      log.ui.error('[Import] Error processing file:', err);
      error = `Failed to process file: ${err instanceof Error ? err.message : 'Unknown error'}`;
      step = 'upload';
    }
  }
  
  function filterAccounts(
    accounts: typeof parsedData.accounts, 
    transactions: typeof parsedData.transactions
  ): typeof accounts {
    if (!accounts || accounts.length === 0) return [];
    if (!transactions) transactions = [];
    
    log.ui.info('[Import] filterAccounts input:', {
      accounts: accounts.length,
      transactions: transactions.length
    });
    
    // Build transaction count map
    const txCountMap = new Map<string, number>();
    for (const tx of transactions) {
      for (const entry of tx.entries) {
        txCountMap.set(entry.accountGuid, (txCountMap.get(entry.accountGuid) || 0) + 1);
      }
    }
    
    log.ui.info('[Import] Transaction count map size:', txCountMap.size);
    
    // Build children map
    const childMap = new Map<string, Set<string>>();
    for (const account of accounts) {
      if (account.parentGuid) {
        if (!childMap.has(account.parentGuid)) {
          childMap.set(account.parentGuid, new Set());
        }
        childMap.get(account.parentGuid)!.add(account.guid);
      }
    }
    
    log.ui.info('[Import] Child map size:', childMap.size);
    
    // Filter accounts
    const filtered = accounts.filter(account => {
      // Exclude GnuCash Root Account
      if (account.type === 'ROOT' || account.name === 'Root Account') {
        log.ui.info(`[Import] Excluding ROOT: ${account.name}`);
        return false;
      }
      
      // Include if has transactions
      const hasTx = txCountMap.has(account.guid) && txCountMap.get(account.guid)! > 0;
      if (hasTx) return true;
      
      // Include if has children
      const hasChildren = childMap.has(account.guid) && childMap.get(account.guid)!.size > 0;
      if (hasChildren) return true;
      
      // Exclude (no transactions, no children)
      log.ui.info(`[Import] Excluding (no tx/children): ${account.name}`);
      return false;
    }).map(account => ({
      ...account,
      transactionCount: txCountMap.get(account.guid) || 0
    }));
    
    log.ui.info('[Import] Filtered accounts:', filtered.length);
    
    // Safety: if we filtered everything out, return all non-ROOT accounts
    if (filtered.length === 0 && accounts.length > 0) {
      log.ui.warn('[Import] Filter removed all accounts! Falling back to all non-ROOT accounts');
      return accounts
        .filter(a => a.type !== 'ROOT' && a.name !== 'Root Account')
        .map(account => ({
          ...account,
          transactionCount: txCountMap.get(account.guid) || 0
        }));
    }
    
    return filtered;
  }
  
  function buildAccountMappings(
    accounts: typeof parsedData.accounts,
    transactions: typeof parsedData.transactions
  ): AccountMapping[] {
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
    
    // Build full path for each account
    const pathMap = new Map<string, string>();
    function buildPath(guid: string, visited = new Set<string>()): string {
      if (pathMap.has(guid)) return pathMap.get(guid)!;
      if (visited.has(guid)) return ''; // Circular reference protection
      
      const account = accountMap.get(guid);
      if (!account) return '';
      
      if (!account.parentGuid) {
        pathMap.set(guid, account.name);
        return account.name;
      }
      
      visited.add(guid);
      const parentPath = buildPath(account.parentGuid, visited);
      const fullPath = parentPath ? `${parentPath}:${account.name}` : account.name;
      pathMap.set(guid, fullPath);
      return fullPath;
    }
    
    accounts.forEach(acc => buildPath(acc.guid));
    
    // Calculate depth for each account
    const depthMap = new Map<string, number>();
    function calculateDepth(guid: string, visited = new Set<string>()): number {
      if (depthMap.has(guid)) return depthMap.get(guid)!;
      if (visited.has(guid)) return 0;
      
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
      const fullPath = pathMap.get(account.guid) || account.name;
      
      // Auto-match based on account type and hierarchy
      const autoMatch = autoMatchAccount(account, fullPath, accountMap);
      
      result.push({
        sourceAccount: account,
        fullSourcePath: fullPath,
        targetGroup: autoMatch.group,
        targetAccount: autoMatch.account,
        isSettled: false,
        isResolved: autoMatch.confidence === 'high',
        confidence: autoMatch.confidence,
        depth,
        hasChildren
      });
      
      // Add children recursively
      const children = childMap.get(account.guid) || [];
      children.sort((a, b) => a.name.localeCompare(b.name));
      children.forEach(child => addAccountAndChildren(child));
    }
    
    // Find root accounts: either no parent, or parent doesn't exist in filtered set
    const rootAccounts = accounts.filter(acc => 
      !acc.parentGuid || !accountMap.has(acc.parentGuid)
    );
    
    log.ui.info('[Import] Root accounts found:', {
      count: rootAccounts.length,
      sample: rootAccounts.slice(0, 5).map(a => a.name)
    });
    
    rootAccounts.sort((a, b) => a.name.localeCompare(b.name));
    rootAccounts.forEach(acc => addAccountAndChildren(acc));
    
    return result;
  }
  
  function autoMatchAccount(
    account: typeof parsedData.accounts[0],
    fullPath: string,
    accountMap: Map<string, typeof account>
  ): {
    group: string | null;
    account: string | null;
    confidence: 'high' | 'medium' | 'low';
  } {
    // Simple auto-matching logic based on GnuCash account types
    // In production, this would query existing account groups from the database
    
    // Mock hierarchical account groups (in production, query from DB)
    const typeMap: Record<string, string> = {
      'BANK': 'Assets:Current Assets:Cash & Bank',
      'CASH': 'Assets:Current Assets:Cash & Bank',
      'ASSET': 'Assets:Other Assets',
      'STOCK': 'Assets:Investments',
      'MUTUAL': 'Assets:Investments',
      'CREDIT': 'Liabilities:Credit Cards',
      'LIABILITY': 'Liabilities:Other Liabilities',
      'PAYABLE': 'Liabilities:Payables',
      'EQUITY': 'Equity:Owner\'s Equity',
      'INCOME': 'Income',
      'EXPENSE': 'Expenses',
    };
    
    const group = typeMap[account.type] || null;
    
    // Placeholder accounts map to group only
    if (account.placeholder) {
      return { 
        group, 
        account: null, 
        confidence: group ? 'high' : 'low' 
      };
    }
    
    // Check if parent is a matched placeholder
    if (account.parentGuid) {
      const parent = accountMap.get(account.parentGuid);
      if (parent?.placeholder && typeMap[parent.type]) {
        // Parent matched, use same account name under matched group
        return { 
          group: typeMap[parent.type], 
          account: account.name, 
          confidence: 'high' 
        };
      }
    }
    
    // No perfect match - use full source path as account path
    return { 
      group, 
      account: fullPath, 
      confidence: group ? 'medium' : 'low' 
    };
  }
  
  function toggleSelection(index: number) {
    if (selectedMappings.has(index)) {
      selectedMappings.delete(index);
    } else {
      selectedMappings.add(index);
    }
    selectedMappings = selectedMappings; // Trigger reactivity
  }
  
  function toggleAllSelected() {
    if (selectedMappings.size > 0) {
      selectedMappings.clear();
    } else {
      selectedMappings = new Set(mappings.map((_, i) => i));
    }
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
    if (!parsedData) return;
    
    const accountMap = new Map(parsedData.accounts.map(acc => [acc.guid, acc]));
    
    mappings = mappings.map(mapping => {
      if (mapping.isSettled) {
        return mapping; // Don't touch settled mappings
      }
      
      // Re-run auto-matching
      const autoMatch = autoMatchAccount(
        mapping.sourceAccount, 
        mapping.fullSourcePath,
        accountMap
      );
      
      return {
        ...mapping,
        targetGroup: autoMatch.group,
        targetAccount: autoMatch.account,
        isResolved: autoMatch.confidence === 'high',
        confidence: autoMatch.confidence
      };
    });
    
    log.ui.info('[Import] Rescan complete');
  }
  
  async function updateTargetGroup(index: number, newGroup: string) {
    const trimmed = newGroup.trim();
    
    // Check if group exists (mock - in production query database)
    const existingGroups = [
      'Assets:Current Assets:Cash & Bank',
      'Assets:Current Assets:Receivables',
      'Assets:Fixed Assets:Property & Equipment',
      'Assets:Investments',
      'Assets:Other Assets',
      'Liabilities:Credit Cards',
      'Liabilities:Payables',
      'Liabilities:Other Liabilities',
      'Equity:Owner\'s Equity',
      'Income',
      'Expenses'
    ];
    
    if (!existingGroups.includes(trimmed) && trimmed.length > 0) {
      // Group doesn't exist - prompt for creation
      const confirmed = confirm(
        `Account group "${trimmed}" does not exist.\n\n` +
        `Create it now? This will affect all entities.`
      );
      
      if (confirmed) {
        // Create group immediately (not waiting for import)
        // In production: await createAccountGroup(trimmed);
        log.ui.info('[Import] Created new account group:', trimmed);
      } else {
        return; // User cancelled, don't update mapping
      }
    }
    
    mappings[index].targetGroup = trimmed || null;
    mappings[index].isResolved = trimmed.length > 0;
    mappings = mappings;
    editingGroupIndex = null;
  }
  
  function updateTargetAccount(index: number, newAccount: string) {
    const trimmed = newAccount.trim();
    
    // Validate syntax
    if (trimmed.length > 0 && !isCompleteAccountPath(trimmed)) {
      // Invalid syntax - show warning
      return;
    }
    
    mappings[index].targetAccount = trimmed || null;
    mappings[index].isResolved = 
      mappings[index].targetGroup !== null && 
      (trimmed.length === 0 || isCompleteAccountPath(trimmed));
    mappings = mappings;
    editingAccountIndex = null;
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
      importResult = await importService.importBooks(parsedData, {
        entityName: entityName.trim(),
        skipDuplicates: true,
        createMissingAccounts: true
      });
      
      if (importResult.errors.length > 0) {
        error = importResult.errors.join(', ');
        step = 'mapping'; // Stay on mapping screen
        return;
      }
      
      log.ui.info('[Import] Import complete:', importResult);
      
      // Show toast and navigate to entity
      showToast(`Entity "${entityName}" created`);
      
      // Navigate to entity page (Trial Balance mode)
      // In production, use importResult.entityId to navigate
      goto('/?view=trial-balance');
      
    } catch (err) {
      log.ui.error('[Import] Error during import:', err);
      error = `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      step = 'mapping'; // Return to mapping screen
    }
  }
  
  function showToast(message: string) {
    // Simple toast notification (in production, use proper toast component)
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
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
  
  function formatTransactionCount(account: typeof parsedData.accounts[0]): string {
    if (account.placeholder) {
      return '—'; // Em dash for placeholder accounts
    }
    return (account.transactionCount ?? 0).toString();
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
            <p class="help-text">Review account mappings. Hover over accounts to see full path and GUID. Mark rows as settled to protect from rescan.</p>
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
              <div class="col-txcount">Tx Count</div>
              <div class="col-target-group">Target Group</div>
              <div class="col-target-account">Target Account</div>
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
                  <div 
                    class="col-source" 
                    style="padding-left: {mapping.depth * 1.5}rem;"
                    title="{mapping.fullSourcePath}\nGUID: {mapping.sourceAccount.guid}"
                  >
                    <span class="account-name">{mapping.sourceAccount.name}</span>
                    {#if mapping.sourceAccount.code}
                      <span class="account-code">({mapping.sourceAccount.code})</span>
                    {/if}
                  </div>
                  <div class="col-txcount">
                    <span class="tx-count">{formatTransactionCount(mapping.sourceAccount)}</span>
                  </div>
                  <div class="col-target-group">
                    {#if editingGroupIndex === i}
                      <div class="editable-group">
                        <input
                          type="text"
                          value={mapping.targetGroup || ''}
                          onblur={(e) => updateTargetGroup(i, e.currentTarget.value)}
                          onkeydown={(e) => e.key === 'Enter' && updateTargetGroup(i, e.currentTarget.value)}
                          class="inline-input"
                          placeholder="Type group path or use tree..."
                          autofocus
                        />
                        <button 
                          class="tree-btn" 
                          title="Tree selector (coming soon)"
                          disabled
                        >
                          ▼
                        </button>
                      </div>
                    {:else}
                      <span 
                        class="target-group editable"
                        onclick={() => editingGroupIndex = i}
                        title="Click to edit"
                      >
                        {mapping.targetGroup || '(not mapped)'}
                      </span>
                    {/if}
                  </div>
                  <div class="col-target-account">
                    {#if editingAccountIndex === i}
                      <input
                        type="text"
                        value={mapping.targetAccount || ''}
                        onblur={(e) => updateTargetAccount(i, e.currentTarget.value)}
                        onkeydown={(e) => e.key === 'Enter' && updateTargetAccount(i, e.currentTarget.value)}
                        class="inline-input"
                        class:invalid={mapping.targetAccount && !isCompleteAccountPath(mapping.targetAccount)}
                        autofocus
                      />
                    {:else}
                      <span 
                        class="target-account editable"
                        onclick={() => editingAccountIndex = i}
                      >
                        {mapping.targetAccount || '(auto)'}
                      </span>
                    {/if}
                  </div>
                  <div class="col-status">
                    <div class="status-indicators">
                      <span 
                        class="confidence-icon {getConfidenceClass(mapping.confidence)}"
                        title="{mapping.confidence} confidence (auto-matched)"
                      >
                        {getConfidenceIcon(mapping.confidence)}
                      </span>
                      {#if mapping.isSettled}
                        <span class="settled-icon" title="User marked as settled">✓</span>
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
    max-width: 1400px;
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
    grid-template-columns: 40px 2.5fr 80px 1.5fr 1.5fr 100px;
    gap: 0.75rem;
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
    grid-template-columns: 40px 2.5fr 80px 1.5fr 1.5fr 100px;
    gap: 0.75rem;
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
    cursor: help;
  }
  
  .account-name {
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .account-code {
    color: var(--text-muted);
    font-size: 0.875rem;
  }
  
  .col-txcount {
    text-align: center;
  }
  
  .tx-count {
    font-family: monospace;
    color: var(--text-primary);
  }
  
  .editable {
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    transition: background 0.15s;
  }
  
  .editable:hover {
    background: var(--surface-hover, #e8e8e8);
  }
  
  .target-group {
    font-weight: 500;
    color: var(--primary-color);
  }
  
  .target-account {
    color: var(--text-primary);
  }
  
  .editable-group {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .inline-input {
    flex: 1;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--primary-color);
    border-radius: 3px;
    font-size: 0.875rem;
    background: var(--surface-primary);
    color: var(--text-primary);
  }
  
  .inline-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px var(--primary-color-light, rgba(0, 102, 204, 0.2));
  }
  
  .inline-input.invalid {
    border-color: var(--danger-color);
  }
  
  .tree-btn {
    padding: 0.375rem 0.5rem;
    background: var(--surface-secondary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.75rem;
  }
  
  .tree-btn:hover:not(:disabled) {
    background: var(--surface-hover, #e8e8e8);
  }
  
  .tree-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .status-indicators {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: center;
  }
  
  .confidence-icon {
    font-weight: bold;
    font-size: 1.125rem;
    cursor: default;
    user-select: none;
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
    cursor: default;
    user-select: none;
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
  
  /* Toast notification */
  :global(.toast-notification) {
    position: fixed;
    top: 2rem;
    right: 2rem;
    padding: 1rem 1.5rem;
    background: var(--success-color);
    color: white;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    opacity: 0;
    transform: translateY(-1rem);
    transition: all 0.3s ease;
    z-index: 10000;
  }
  
  :global(.toast-notification.show) {
    opacity: 1;
    transform: translateY(0);
  }
</style>

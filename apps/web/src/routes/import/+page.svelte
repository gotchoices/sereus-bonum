<script lang="ts">
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import {
    importService,
    type ParsedBooks,
    type MergePlan,
    type PreviewTransaction,
    type ResolvedAccount,
  } from '$lib/import';
  import { importNativeBooks, type BonumBooksFile } from '$lib/import/native';
  import { initializeEntities, entities } from '$lib/stores/entities';

  // Plan-driven merge import: parse → build a merge plan (accounts + transaction dispositions) with no
  // writes → review the exact preview → execute. What the user sees here is what gets written.
  // See design/specs/web/screens/import.md and design/specs/domain/import.md (Merge Model).

  type Step = 'upload' | 'planning' | 'preview' | 'importing';
  let step = $state<Step>('upload');
  let statusMessage = $state('');
  let error = $state<string | null>(null);

  // Target
  let targetMode = $state<'new' | 'existing'>('new');
  let entityName = $state('');
  let selectedEntityId = $state('');

  // File
  let selectedFile = $state<File | null>(null);
  let isDragging = $state(false);
  let isNativeFile = $derived(!!selectedFile && selectedFile.name.toLowerCase().endsWith('.json'));

  // Plan / preview state
  let parsedData = $state<ParsedBooks | null>(null);
  let plan = $state<MergePlan | null>(null);
  let showAlreadyImported = $state(false);
  let excluded = $state<Set<string>>(new Set());      // source guids the user chose to skip
  let forceInclude = $state<Set<string>>(new Set());  // already-imported txns the user force-writes
  let expanded = $state<Set<string>>(new Set());      // expanded transaction rows
  let accountsOpen = $state(false);

  onMount(() => { initializeEntities(); });

  // --- File selection ------------------------------------------------------
  function handleDragOver(e: DragEvent) { e.preventDefault(); isDragging = true; }
  function handleDragLeave() { isDragging = false; }
  function handleDrop(e: DragEvent) {
    e.preventDefault(); isDragging = false;
    const f = e.dataTransfer?.files;
    if (f && f.length) selectFile(f[0]);
  }
  function handleFileInput(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length) selectFile(target.files[0]);
  }
  function selectFile(file: File) {
    const ok = ['.gnucash', '.iif', '.json'].some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!ok) { error = 'Invalid file type. Choose a .gnucash, .iif, or .json file.'; selectedFile = null; return; }
    error = null; selectedFile = file;
    log.ui.info('[Import] File selected:', file.name, file.size);
  }

  function cancel() { goto('/'); }

  // --- Step 1 → plan -------------------------------------------------------
  async function next() {
    if (!selectedFile) { error = 'Please select a file to import.'; return; }
    if (isNativeFile) { await restoreNativeFile(selectedFile); return; }
    if (targetMode === 'new' && !entityName.trim()) { error = 'Please enter an entity name.'; return; }
    if (targetMode === 'existing' && !selectedEntityId) { error = 'Please choose an entity to merge into.'; return; }

    error = null; step = 'planning'; statusMessage = 'Parsing and analyzing…';
    try {
      parsedData = await importService.parseFile(selectedFile);
      statusMessage = 'Building merge preview…';
      plan = await importService.buildMergePlan(parsedData, targetMode === 'existing' ? selectedEntityId : null);
      excluded = new Set(); forceInclude = new Set(); expanded = new Set();
      showAlreadyImported = false; accountsOpen = false;
      step = 'preview';
      log.ui.info('[Import] Plan built:', plan.counts);
    } catch (e) {
      log.ui.error('[Import] Planning failed:', e);
      error = `Failed to analyze file: ${e instanceof Error ? e.message : 'Unknown error'}`;
      step = 'upload';
    }
  }

  async function restoreNativeFile(file: File) {
    error = null; step = 'importing'; statusMessage = 'Reading native books file…';
    try {
      const data = JSON.parse(await file.text()) as BonumBooksFile;
      if (data?.format !== 'bonum-books') throw new Error('Not a Bonum books file.');
      statusMessage = `Restoring "${data.entity?.name ?? 'books'}"…`;
      const entityId = await importNativeBooks(data);
      await initializeEntities();
      showToast(`Restored "${data.entity?.name ?? 'books'}"`);
      goto(`/entities/${entityId}?view=trial-balance`);
    } catch (e) {
      error = `Restore failed: ${e instanceof Error ? e.message : 'Unknown error'}`;
      step = 'upload';
    }
  }

  // --- Preview groupings ---------------------------------------------------
  let resolvedByGuid = $derived(new Map((plan?.resolved ?? []).map((r) => [r.sourceGuid, r])));
  let incompleteTxns = $derived((plan?.transactions ?? []).filter((tx) => tx.disposition === 'incomplete'));
  let newTxns = $derived((plan?.transactions ?? []).filter((tx) => tx.disposition === 'new'));
  let existsTxns = $derived((plan?.transactions ?? []).filter((tx) => tx.disposition === 'exists'));
  let accountsToCreate = $derived((plan?.resolved ?? []).filter((r) => r.disposition === 'create'));
  let accountsMatched = $derived((plan?.resolved ?? []).filter((r) => r.disposition === 'existing').length);

  // Import allowed only when no Incomplete transaction remains (each must be excluded — inline
  // completion is a later enhancement).
  let blockingIncomplete = $derived(incompleteTxns.filter((tx) => !excluded.has(tx.sourceGuid)).length);
  let willImportCount = $derived(
    newTxns.filter((tx) => !excluded.has(tx.sourceGuid)).length
    + existsTxns.filter((tx) => forceInclude.has(tx.sourceGuid)).length,
  );
  let canImport = $derived(!!plan && blockingIncomplete === 0);

  function toggleExclude(g: string) { excluded.has(g) ? excluded.delete(g) : excluded.add(g); excluded = new Set(excluded); }
  function toggleInclude(g: string) { forceInclude.has(g) ? forceInclude.delete(g) : forceInclude.add(g); forceInclude = new Set(forceInclude); }
  function toggleExpand(g: string) { expanded.has(g) ? expanded.delete(g) : expanded.add(g); expanded = new Set(expanded); }

  // Nesting depth of a to-create account (by its parentSourceGuid chain) for indented display.
  function accountDepth(r: ResolvedAccount): number {
    let d = 0; let p = r.parentSourceGuid;
    const byGuid = resolvedByGuid;
    while (p && d < 12) { d++; p = byGuid.get(p)?.parentSourceGuid; }
    return d;
  }

  function txnAmount(tx: PreviewTransaction): number {
    return tx.entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  }
  function acctLabel(guid: string): string {
    const r = resolvedByGuid.get(guid);
    return r ? (r.targetGroupPath ? `${r.targetGroupPath} : ${r.targetAccountName ?? r.sourceName}` : r.sourceName) : guid;
  }
  function formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  }

  function goBack() { step = 'upload'; error = null; }

  // --- Step 4: execute -----------------------------------------------------
  async function doImport() {
    if (!plan || !parsedData || !canImport) return;
    step = 'importing'; statusMessage = 'Creating accounts and writing transactions…'; error = null;
    try {
      const entityId = targetMode === 'existing'
        ? selectedEntityId
        : await importService.createOrGetEntity({ entityName: entityName.trim() }, parsedData);

      // New (not excluded) + force-included already-imported (promoted to 'new').
      const toWrite: PreviewTransaction[] = plan.transactions.map((tx) => {
        if (tx.disposition === 'exists' && forceInclude.has(tx.sourceGuid)) return { ...tx, disposition: 'new', excluded: false };
        return { ...tx, excluded: excluded.has(tx.sourceGuid) };
      });

      const result = await importService.executeMerge({ ...plan, entityId }, toWrite);
      if (result.errors.length) { error = result.errors.join(', '); step = 'preview'; return; }

      await initializeEntities();
      const name = targetMode === 'existing' ? ($entities.find((e) => e.id === entityId)?.name ?? 'entity') : entityName;
      showToast(`Imported ${result.transactionsImported} transactions into "${name}"`);
      goto(`/entities/${entityId}?view=trial-balance`);
    } catch (e) {
      log.ui.error('[Import] Execute failed:', e);
      error = `Import failed: ${e instanceof Error ? e.message : 'Unknown error'}`;
      step = 'preview';
    }
  }

  function showToast(message: string) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
  }
</script>

<div class="import-page">
  <div class="import-container" class:wide={step === 'preview'}>

    {#if step === 'upload'}
      <div class="dialog">
        <div class="dialog-header">
          <h2>{$t('import.title')}</h2>
          <button class="close-btn" onclick={cancel}>×</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <span class="label">Target:</span>
            <div class="seg">
              <button class:active={targetMode === 'new'} onclick={() => (targetMode = 'new')}>New entity</button>
              <button class:active={targetMode === 'existing'} onclick={() => (targetMode = 'existing')} disabled={$entities.length === 0}>Merge into existing</button>
            </div>
          </div>

          {#if targetMode === 'new'}
            <div class="form-group">
              <label for="entity-name">{$t('import.entity_name')}:</label>
              <input id="entity-name" type="text" bind:value={entityName} placeholder="e.g., Home Books" class="input" disabled={isNativeFile} />
              {#if isNativeFile}<p class="help-text">Native books file — the entity name comes from the file.</p>{/if}
            </div>
          {:else}
            <div class="form-group">
              <label for="entity-pick">Merge into:</label>
              <select id="entity-pick" bind:value={selectedEntityId} class="input">
                <option value="" disabled>Choose an entity…</option>
                {#each $entities as e}<option value={e.id}>{e.name}</option>{/each}
              </select>
            </div>
          {/if}

          <div class="form-group">
            <span class="label">{$t('import.source_file')}:</span>
            <div class="drop-zone" class:dragging={isDragging} ondragover={handleDragOver} ondragleave={handleDragLeave} ondrop={handleDrop}>
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
                <input type="file" accept=".gnucash,.iif,.json" onchange={handleFileInput} style="display:none;" />
                {selectedFile ? $t('import.change_file') : $t('import.browse_files')}
              </label>
            </div>
            <p class="help-text">{$t('import.supported_formats')}: .gnucash, .iif, .json (native)</p>
          </div>

          {#if error}<div class="error-message">{error}</div>{/if}
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" onclick={cancel}>{$t('common.cancel') || 'Cancel'}</button>
          <button class="btn-primary" onclick={next} disabled={!selectedFile || (!isNativeFile && targetMode === 'new' && !entityName.trim()) || (!isNativeFile && targetMode === 'existing' && !selectedEntityId)}>
            {isNativeFile ? 'Restore' : ($t('common.next') || 'Next')}
          </button>
        </div>
      </div>

    {:else if step === 'planning' || step === 'importing'}
      <div class="dialog">
        <div class="dialog-header"><h2>{step === 'planning' ? 'Analyzing' : $t('import.importing')}</h2></div>
        <div class="dialog-body">
          <div class="progress-container">
            <div class="spinner"></div>
            <p class="status-message">{statusMessage}</p>
          </div>
        </div>
      </div>

    {:else if step === 'preview' && plan}
      <div class="dialog dialog-wide">
        <div class="dialog-header"><h2>Review &amp; Merge</h2></div>
        <div class="dialog-body">

          <!-- Summary -->
          <div class="summary-stats">
            <div class="stat-item"><span class="stat-value stat-new">{newTxns.filter((tx) => !excluded.has(tx.sourceGuid)).length}</span><span class="stat-label">New</span></div>
            <div class="stat-item"><span class="stat-value stat-incomplete">{blockingIncomplete}</span><span class="stat-label">Incomplete</span></div>
            <div class="stat-item"><span class="stat-value stat-muted">{existsTxns.length}</span><span class="stat-label">Already imported</span></div>
            <div class="stat-item"><span class="stat-value">{accountsToCreate.length}</span><span class="stat-label">Accounts to create</span></div>
            {#if accountsMatched > 0}<div class="stat-item"><span class="stat-value stat-muted">{accountsMatched}</span><span class="stat-label">Accounts matched</span></div>{/if}
          </div>

          <!-- Accounts to create (hierarchy) -->
          <div class="section">
            <button class="section-head" onclick={() => (accountsOpen = !accountsOpen)}>
              <span class="tri">{accountsOpen ? '▼' : '▶'}</span> {accountsToCreate.length} accounts will be created
              <span class="help-text inline">general levels map to shared groups; specific ones nest as accounts</span>
            </button>
            {#if accountsOpen}
              <div class="acct-list">
                {#each accountsToCreate as r}
                  <div class="acct-row" style="padding-left:{accountDepth(r) * 1.25 + 0.5}rem" title={r.sourcePath}>
                    <span class="acct-name">{r.targetAccountName ?? r.sourceName}</span>
                    <span class="acct-group">{r.targetGroupPath}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Transactions -->
          {#if incompleteTxns.length > 0}
            <div class="section">
              <div class="section-head static"><span class="badge badge-incomplete">Incomplete</span> {incompleteTxns.length} — must be excluded to proceed (inline completion coming later)</div>
              {#each incompleteTxns as tx (tx.sourceGuid)}
                {@render txnRow(tx, 'incomplete')}
              {/each}
            </div>
          {/if}

          <div class="section">
            <div class="section-head static"><span class="badge badge-new">New</span> {newTxns.length}</div>
            {#each newTxns as tx (tx.sourceGuid)}
              {@render txnRow(tx, 'new')}
            {/each}
            {#if newTxns.length === 0}<div class="empty-row">No new transactions.</div>{/if}
          </div>

          {#if existsTxns.length > 0}
            <div class="section">
              <button class="section-head" onclick={() => (showAlreadyImported = !showAlreadyImported)}>
                <span class="tri">{showAlreadyImported ? '▼' : '▶'}</span>
                <span class="badge badge-muted">Already imported</span> {existsTxns.length} — hidden (won't be re-imported)
              </button>
              {#if showAlreadyImported}
                {#each existsTxns as tx (tx.sourceGuid)}
                  {@render txnRow(tx, 'exists')}
                {/each}
              {/if}
            </div>
          {/if}

          {#if error}<div class="error-message">{error}</div>{/if}
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" onclick={goBack}>{$t('common.back') || 'Back'}</button>
          <button class="btn-primary" onclick={doImport} disabled={!canImport}>
            Import {willImportCount} transaction{willImportCount === 1 ? '' : 's'}{blockingIncomplete > 0 ? ` (${blockingIncomplete} incomplete)` : ''}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

{#snippet txnRow(tx: PreviewTransaction, kind: 'incomplete' | 'new' | 'exists')}
  <div class="txn" class:excluded={excluded.has(tx.sourceGuid)}>
    <div class="txn-main">
      <button class="tri-btn" onclick={() => toggleExpand(tx.sourceGuid)}>{expanded.has(tx.sourceGuid) ? '▼' : '▶'}</button>
      <span class="txn-date">{tx.date}</span>
      <span class="txn-desc">{tx.description || '(no description)'}{tx.reference ? ` · ${tx.reference}` : ''}</span>
      <span class="txn-amount">{formatCurrency(txnAmount(tx))}</span>
      {#if kind === 'incomplete'}
        <span class="txn-reason" title={tx.reason}>⚠ {tx.reason}</span>
        <button class="mini-btn" onclick={() => toggleExclude(tx.sourceGuid)}>{excluded.has(tx.sourceGuid) ? 'Excluded' : 'Exclude'}</button>
      {:else if kind === 'new'}
        <button class="mini-btn" onclick={() => toggleExclude(tx.sourceGuid)}>{excluded.has(tx.sourceGuid) ? 'Excluded' : 'Exclude'}</button>
      {:else}
        <button class="mini-btn" onclick={() => toggleInclude(tx.sourceGuid)}>{forceInclude.has(tx.sourceGuid) ? 'Will import' : 'Import anyway'}</button>
      {/if}
    </div>
    {#if expanded.has(tx.sourceGuid)}
      <div class="txn-entries">
        {#each tx.entries as e}
          <div class="entry-row">
            <span class="entry-acct">{acctLabel(e.accountGuid)}</span>
            <span class="entry-debit">{e.amount > 0 ? formatCurrency(e.amount) : ''}</span>
            <span class="entry-credit">{e.amount < 0 ? formatCurrency(-e.amount) : ''}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<style>
  .import-page { display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; background: var(--bg-secondary); padding: 2rem; }
  .import-container { width: 100%; max-width: 600px; transition: max-width 0.3s ease; }
  .import-container.wide { max-width: 1100px; }
  .dialog { background: var(--bg-card); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); overflow: hidden; }
  .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid var(--border-color); }
  .dialog-header h2 { margin: 0; font-size: 1.4rem; color: var(--text-primary); }
  .close-btn { background: none; border: none; font-size: 2rem; color: var(--text-muted); cursor: pointer; line-height: 1; }
  .dialog-body { padding: 1.5rem; max-height: 72vh; overflow-y: auto; }
  .form-group { margin-bottom: 1.25rem; }
  .form-group label, .form-group .label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--text-primary); }
  .input { width: 100%; padding: 0.65rem; border: 1px solid var(--border-color); border-radius: 4px; font-size: 1rem; background: var(--bg-card); color: var(--text-primary); }
  .seg { display: inline-flex; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; }
  .seg button { padding: 0.5rem 1rem; background: var(--bg-card); border: none; cursor: pointer; color: var(--text-primary); }
  .seg button.active { background: var(--accent-color); color: #fff; }
  .seg button:disabled { opacity: 0.4; cursor: not-allowed; }
  .drop-zone { border: 2px dashed var(--border-color); border-radius: 8px; padding: 1.5rem; text-align: center; background: var(--bg-secondary); }
  .drop-zone.dragging { border-color: var(--accent-color); }
  .file-selected { display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 0.75rem; }
  .file-name { font-weight: 500; } .file-size { color: var(--text-muted); font-size: 0.85rem; }
  .or-text { margin: 0.4rem 0; color: var(--text-muted); font-size: 0.85rem; }
  .browse-btn { display: inline-block; padding: 0.6rem 1.25rem; background: var(--accent-color); color: #fff; border-radius: 4px; cursor: pointer; font-weight: 500; }
  .help-text { margin-top: 0.4rem; font-size: 0.8rem; color: var(--text-muted); }
  .help-text.inline { display: inline; margin-left: 0.5rem; }
  .error-message { padding: 0.85rem; background: rgba(220,53,69,0.1); border: 1px solid var(--danger); border-radius: 4px; color: var(--danger); margin-top: 1rem; }
  .progress-container { text-align: center; padding: 2rem 0; }
  .spinner { width: 48px; height: 48px; border: 4px solid var(--bg-secondary); border-top-color: var(--accent-color); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .status-message { font-weight: 500; color: var(--text-primary); }

  .summary-stats { display: flex; gap: 1.5rem; padding: 1rem 1.25rem; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 1.25rem; }
  .stat-item { display: flex; flex-direction: column; align-items: center; }
  .stat-value { font-size: 1.4rem; font-weight: 700; color: var(--accent-color); }
  .stat-value.stat-new { color: var(--success, #16a34a); }
  .stat-value.stat-incomplete { color: var(--warning, #d97706); }
  .stat-value.stat-muted { color: var(--text-muted); }
  .stat-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; }

  .section { border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 1rem; overflow: hidden; }
  .section-head { display: block; width: 100%; text-align: left; padding: 0.6rem 0.9rem; background: var(--bg-secondary); border: none; border-bottom: 1px solid var(--border-color); font-size: 0.9rem; color: var(--text-primary); cursor: pointer; }
  .section-head.static { cursor: default; }
  .tri { display: inline-block; width: 1rem; color: var(--text-muted); }
  .badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 10px; font-size: 0.75rem; font-weight: 600; }
  .badge-new { background: rgba(22,163,74,0.15); color: #16a34a; }
  .badge-incomplete { background: rgba(217,119,6,0.15); color: #d97706; }
  .badge-muted { background: var(--bg-hover, #eee); color: var(--text-muted); }

  .acct-list { max-height: 260px; overflow-y: auto; }
  .acct-row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.3rem 0.9rem; border-bottom: 1px solid var(--border-light, #f0f0f0); }
  .acct-name { font-weight: 500; color: var(--text-primary); }
  .acct-group { color: var(--accent-color); font-size: 0.85rem; }

  .txn { border-bottom: 1px solid var(--border-light, #f0f0f0); }
  .txn.excluded { opacity: 0.45; }
  .txn-main { display: grid; grid-template-columns: 1.5rem 6rem 1fr auto auto auto; gap: 0.6rem; align-items: center; padding: 0.4rem 0.9rem; }
  .tri-btn, .mini-btn { background: none; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; color: var(--text-primary); }
  .tri-btn { border: none; color: var(--text-muted); }
  .mini-btn { padding: 0.15rem 0.55rem; font-size: 0.75rem; }
  .txn-date { font-family: var(--font-mono, monospace); color: var(--text-muted); font-size: 0.85rem; }
  .txn-desc { color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .txn-amount { font-family: var(--font-mono, monospace); text-align: right; }
  .txn-reason { color: var(--warning, #d97706); font-size: 0.8rem; }
  .txn-entries { padding: 0.25rem 0.9rem 0.6rem 3rem; }
  .entry-row { display: grid; grid-template-columns: 1fr 8rem 8rem; gap: 0.5rem; font-size: 0.85rem; padding: 0.1rem 0; }
  .entry-acct { color: var(--text-secondary, #555); }
  .entry-debit, .entry-credit { text-align: right; font-family: var(--font-mono, monospace); }
  .empty-row { padding: 0.6rem 0.9rem; color: var(--text-muted); font-size: 0.85rem; }

  .dialog-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1.25rem 1.5rem; border-top: 1px solid var(--border-color); }
  .btn-primary, .btn-secondary { padding: 0.65rem 1.4rem; border-radius: 4px; font-size: 0.9rem; font-weight: 500; cursor: pointer; border: none; }
  .btn-primary { background: var(--accent-color, #0066cc); color: #fff; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); }

  :global(.toast-notification) { position: fixed; top: 2rem; right: 2rem; padding: 1rem 1.5rem; background: var(--success, #16a34a); color: #fff; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); opacity: 0; transform: translateY(-1rem); transition: all 0.3s ease; z-index: 10000; }
  :global(.toast-notification.show) { opacity: 1; transform: translateY(0); }
</style>

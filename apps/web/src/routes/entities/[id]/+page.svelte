<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  import { entities } from '$lib/stores/entities';
  import { 
    accounts, 
    accountsLoading, 
    accountGroups,
    topLevelGroupsByType,
    loadAccounts
  } from '$lib/stores/accounts';
  import { getDataService, NORMAL_BALANCE, type AccountType, type BalanceSheetData } from '$lib/data';

  // Present a raw signed balance for display: credit-normal types (Liability/Equity/Income) read
  // positive when they carry a (normal) credit balance, so signs match balance-sheet convention.
  const presentBalance = (raw: number, type: AccountType): number =>
    NORMAL_BALANCE[type] === 'credit' ? -raw : raw;
  import { loadViewState, saveViewState } from '$lib/stores/viewState';
  
  // Report modes
  type ReportMode = 'balance_sheet' | 'trial_balance' | 'income_statement' | 'cash_flow' | 'custom';
  
  // Get entity ID from route
  let entityId = $derived($page.params.id!);
  let entity = $derived($entities.find(e => e.id === entityId));
  
  // Balance sheet data
  let balanceData = $state<BalanceSheetData | null>(null);
  let balanceLoading = $state(true);
  
  // View state - persisted
  let expandedGroups = $state<Record<string, boolean>>({});
  let reportMode = $state<ReportMode>('balance_sheet');
  let endDate = $state(new Date().toISOString().split('T')[0]);
  let startDate = $state<string | undefined>(undefined);
  let retainedEarningsExpanded = $state(false);

  // Display filters (persisted per entity) — surfaced via the ⚙ View menu.
  let hideZeroBalance = $state(false);   // suppress accounts/groups whose total is $0
  let showClosedAccounts = $state(false); // reveal retired (isActive=false) accounts, hidden by default

  // Transient menu open/close (not persisted)
  let showOptionsMenu = $state(false);
  let showExportMenu = $state(false);
  
  // Track if we need to reload data (used for onblur optimization)
  let needsReload = $state(false);
  
  // Load persisted view state
  $effect(() => {
    if (browser && entityId) {
      expandedGroups = loadViewState(`accounts-expand-${entityId}`, {});
      reportMode = loadViewState(`accounts-mode-${entityId}`, 'balance_sheet');
      retainedEarningsExpanded = loadViewState(`accounts-re-expanded-${entityId}`, false);
      hideZeroBalance = loadViewState(`accounts-hidezero-${entityId}`, false);
      showClosedAccounts = loadViewState(`accounts-showclosed-${entityId}`, false);

      // Load persisted dates (or use defaults)
      const savedDates = loadViewState(`accounts-dates-${entityId}`, {
        endDate: new Date().toISOString().split('T')[0],
        startDate: undefined
      });
      endDate = savedDates.endDate;
      startDate = savedDates.startDate;
      
      log.ui.debug('[Accounts] Loaded view state for entity:', entityId);
    }
  });
  
  // Load data when entity changes
  let lastEntityId: string | null = null;
  $effect(() => {
    if (browser && entityId && entityId !== lastEntityId) {
      lastEntityId = entityId;
      loadEntityData();
    }
  });
  
  async function loadEntityData() {
    log.ui.debug('[Accounts] Loading data for entity:', entityId);
    balanceLoading = true;
    try {
      const ds = await getDataService();
      await loadAccounts(entityId);
      balanceData = await ds.getBalanceSheet(entityId, endDate, startDate);
      log.ui.debug('[Accounts] Balance sheet loaded');
    } catch (e) {
      log.ui.error('[Accounts] Failed to load:', e);
    } finally {
      balanceLoading = false;
    }
  }
  
  // Mark that dates have changed
  function handleDateInput() {
    needsReload = true;
  }
  
  // Reload when date input loses focus (optimization for large datasets)
  async function handleDateBlur() {
    if (browser && entityId && needsReload) {
      needsReload = false;
      await reloadBalance();
    }
  }
  
  async function reloadBalance() {
    if (!browser || !entityId) return;
    balanceLoading = true;
    try {
      const ds = await getDataService();
      balanceData = await ds.getBalanceSheet(entityId, endDate, startDate);
      persistViewState();
    } catch (e) {
      log.ui.error('[Accounts] Failed to reload:', e);
    } finally {
      balanceLoading = false;
    }
  }

  // Relative date presets. For "as of" modes only the end date matters; range modes get both bounds.
  const iso = (d: Date) => d.toISOString().split('T')[0];
  function presetRange(preset: string): { start?: string; end: string } {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const q = Math.floor(m / 3) * 3;
    switch (preset) {
      case 'today': return { start: iso(now), end: iso(now) };
      case 'this_month': return { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m + 1, 0)) };
      case 'last_month': return { start: iso(new Date(y, m - 1, 1)), end: iso(new Date(y, m, 0)) };
      case 'this_quarter': return { start: iso(new Date(y, q, 1)), end: iso(new Date(y, q + 3, 0)) };
      case 'this_year': return { start: iso(new Date(y, 0, 1)), end: iso(new Date(y, 11, 31)) };
      case 'last_year': return { start: iso(new Date(y - 1, 0, 1)), end: iso(new Date(y - 1, 11, 31)) };
      case 'all_time': return { start: '1900-01-01', end: iso(now) };
      default: return { end: iso(now) };
    }
  }
  const datePresets = ['today', 'this_month', 'last_month', 'this_quarter', 'this_year', 'last_year', 'all_time'];
  function applyDatePreset(preset: string) {
    const { start, end } = presetRange(preset);
    endDate = end;
    if (requiresDateRange) startDate = start;
    showOptionsMenu = false;
    reloadBalance();
  }

  // Print/PDF: the browser print dialog renders the report (print CSS hides app chrome).
  // "Save as PDF" in that dialog produces the PDF — no separate PDF pipeline yet.
  function printReport() {
    showExportMenu = false;
    if (browser) window.print();
  }

  // Check if current mode requires date range
  let requiresDateRange = $derived(
    reportMode === 'income_statement' || reportMode === 'cash_flow'
  );
  
  // Auto-set default start date for modes that require it
  $effect(() => {
    if (requiresDateRange && !startDate) {
      // Default to first day of current year
      const year = new Date().getFullYear();
      startDate = `${year}-01-01`;
    } else if (!requiresDateRange && startDate) {
      // Clear start date for modes that don't need it
      startDate = undefined;
    }
  });
  
  // Account type display info
  const typeInfo: Record<AccountType, { icon: string; color: string }> = {
    ASSET: { icon: '💰', color: 'var(--asset-color, #4ade80)' },
    LIABILITY: { icon: '📋', color: 'var(--liability-color, #f87171)' },
    EQUITY: { icon: '📊', color: 'var(--equity-color, #60a5fa)' },
    INCOME: { icon: '📈', color: 'var(--income-color, #34d399)' },
    EXPENSE: { icon: '📉', color: 'var(--expense-color, #fb923c)' },
  };
  
  // Types to show based on mode
  function getVisibleTypes(): AccountType[] {
    switch (reportMode) {
      case 'balance_sheet':
        return ['ASSET', 'LIABILITY', 'EQUITY'];
      case 'trial_balance':
        return ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']; // All 5 at top level
      case 'income_statement':
        return ['INCOME', 'EXPENSE'];
      default:
        return ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
    }
  }
  
  let visibleTypes = $derived(getVisibleTypes());
  
  // Should we show RE under Equity? (Balance Sheet and Trial Balance modes)
  let showRetainedEarningsInEquity = $derived(
    reportMode === 'balance_sheet' || reportMode === 'trial_balance'
  );
  
  // Should RE be expandable? (Balance Sheet mode only)
  let retainedEarningsExpandable = $derived(reportMode === 'balance_sheet');
  
  // Expand/collapse functions
  // Unified function to save all view state
  function persistViewState() {
    saveViewState(`accounts-expand-${entityId}`, expandedGroups);
    saveViewState(`accounts-mode-${entityId}`, reportMode);
    saveViewState(`accounts-re-expanded-${entityId}`, retainedEarningsExpanded);
    saveViewState(`accounts-dates-${entityId}`, { endDate, startDate });
    saveViewState(`accounts-hidezero-${entityId}`, hideZeroBalance);
    saveViewState(`accounts-showclosed-${entityId}`, showClosedAccounts);
  }

  function toggleHideZeroBalance() {
    hideZeroBalance = !hideZeroBalance;
    saveViewState(`accounts-hidezero-${entityId}`, hideZeroBalance);
  }
  function toggleShowClosedAccounts() {
    showClosedAccounts = !showClosedAccounts;
    saveViewState(`accounts-showclosed-${entityId}`, showClosedAccounts);
  }
  
  function toggleGroup(groupId: string) {
    expandedGroups[groupId] = !expandedGroups[groupId];
    expandedGroups = { ...expandedGroups };
    saveViewState(`accounts-expand-${entityId}`, expandedGroups);
  }
  
  function expandAll() {
    // Expand every collapsible node on the path: account groups AND parent accounts (accounts that
    // are some other account's parent). The account path is part of the same hierarchy.
    for (const g of $accountGroups) expandedGroups[g.id] = true;
    for (const a of $accounts) if (a.parentId) expandedGroups[a.parentId] = true;
    expandedGroups = { ...expandedGroups };
    saveViewState(`accounts-expand-${entityId}`, expandedGroups);
  }
  
  function collapseAll() {
    expandedGroups = {};
    saveViewState(`accounts-expand-${entityId}`, expandedGroups);
  }
  
  function toggleRetainedEarnings() {
    retainedEarningsExpanded = !retainedEarningsExpanded;
    saveViewState(`accounts-re-expanded-${entityId}`, retainedEarningsExpanded);
  }
  
  function setMode(mode: ReportMode) {
    reportMode = mode;
    saveViewState(`accounts-mode-${entityId}`, mode);
  }
  
  
  function getTypeTotal(type: AccountType): number {
    if (!balanceData) return 0;
    switch (type) {
      case 'ASSET': return balanceData.totalAssets;
      case 'LIABILITY': return balanceData.totalLiabilities;
      case 'EQUITY':
        // In both Balance Sheet and Trial Balance modes, include Retained Earnings
        // (since RE is shown as a line item under Equity in both modes)
        if (reportMode === 'balance_sheet' || reportMode === 'trial_balance') {
          return balanceData.totalEquity + netIncome();
        }
        return balanceData.totalEquity;
      case 'INCOME': return balanceData.totalIncome;
      case 'EXPENSE': return balanceData.totalExpense;
      default: return 0;
    }
  }
  
  // Calculate Net Income / Retained Earnings
  // Net Income = Total Income - Total Expenses
  // Backend returns Income/Expense as positive values
  // Retained Earnings = Net Income (accumulated over time)
  
  let netIncome = $derived(() => {
    if (!balanceData) return 0;
    return balanceData.totalIncome - balanceData.totalExpense;
  });
  
  // Verification: Assets should equal Liabilities + Equity (+ Retained Earnings in Balance Sheet mode)
  let liabilitiesPlusEquity = $derived(() => {
    if (!balanceData) return 0;
    // In both Balance Sheet and Trial Balance, we need to add net income
    // because backend returns totalEquity without net income
    return balanceData.totalLiabilities + balanceData.totalEquity + netIncome();
  });
  
  let isBalanced = $derived(() => {
    if (!balanceData) return true;
    return Math.abs(balanceData.totalAssets - liabilitiesPlusEquity()) < 0.01;
  });
  
  let imbalanceAmount = $derived(() => {
    if (!balanceData) return 0;
    return balanceData.totalAssets - liabilitiesPlusEquity();
  });

  // --- Hierarchical report rows -------------------------------------------
  // Flatten the group tree + account (parentId) tree of each type into depth-tagged rows with
  // rolled-up subtotals, honoring expand/collapse. Names indent forward, amounts reverse-indent by
  // depth (see .report-row CSS). Type headers are rendered separately (depth 0, rightmost).
  interface ReportRow {
    key: string;
    depth: number;          // 1 = top-level group; deeper = subgroups / nested accounts
    label: string;
    amount: number;         // presented (sign convention applied)
    kind: 'group' | 'account';
    accountId?: string;
    code?: string;
    toggleId?: string;      // set → row is expand/collapse-able (group id, parent-account id, or 're')
    expanded?: boolean;
    direct?: boolean;       // synthetic "(direct)" row: a parent account's own postings
  }

  const byDisplay = (a: { displayOrder?: number; name: string }, b: { displayOrder?: number; name: string }) =>
    (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name);
  const byCodeName = (a: { code?: string; name: string }, b: { code?: string; name: string }) =>
    (a.code ?? '').localeCompare(b.code ?? '') || a.name.localeCompare(b.name);

  let reportRowsByType = $derived.by(() => {
    const out = new Map<AccountType, ReportRow[]>();
    if (!balanceData) return out;

    // One logical hierarchy: group-path (group→child-group) then account-path (account→child-account).
    // Per the schema invariant a nested account shares its parent's group, so groups and accounts are
    // just two flavours of node on the same path — emitGroup/emitAccount are parallel and each handle
    // collapse, rolled-up subtotal, and the expand toggle identically (differ only by kind + children).
    const rawById = new Map<string, number>();
    for (const ab of balanceData.accountBalances) rawById.set(ab.accountId, ab.balance);
    const push = <T,>(m: Map<string, T[]>, k: string, v: T) => (m.get(k) ?? m.set(k, []).get(k)!).push(v);
    const childGroups = new Map<string, typeof $accountGroups>();
    for (const g of $accountGroups) if (g.parentId) push(childGroups, g.parentId, g);
    const rootAccts = new Map<string, typeof $accounts>();     // accounts directly in a group (parent_id null)
    const childAccts = new Map<string, typeof $accounts>();    // accounts nested under a parent account
    const acctsByGroup = new Map<string, typeof $accounts>();  // every account by group (for the RE breakdown)
    for (const a of $accounts) {
      push(acctsByGroup, a.accountGroupId, a);
      if (a.parentId) push(childAccts, a.parentId, a);
      else push(rootAccts, a.accountGroupId, a);
    }
    const acctVisible = (a: (typeof $accounts)[number]) => showClosedAccounts || a.isActive;

    const acctRaw = (a: (typeof $accounts)[number]): number =>
      (rawById.get(a.id) ?? 0) + (childAccts.get(a.id) ?? []).reduce((s, k) => s + acctRaw(k), 0);
    const groupRaw = (gid: string): number => {
      let s = 0;
      for (const a of rootAccts.get(gid) ?? []) s += acctRaw(a);
      for (const c of childGroups.get(gid) ?? []) s += groupRaw(c.id);
      return s;
    };
    const groupHasContent = (gid: string): boolean =>
      (rootAccts.get(gid)?.length ?? 0) > 0 || (childGroups.get(gid) ?? []).some((c) => groupHasContent(c.id));

    const build = (type: AccountType): ReportRow[] => {
      const rows: ReportRow[] = [];
      // Account node: collapsible when it has children; when expanded shows a "(direct)" row for its own
      // postings (if non-zero) then its child accounts. Returns [] when the zero filter suppresses it.
      const emitAccount = (a: (typeof $accounts)[number], depth: number): ReportRow[] => {
        const kids = (childAccts.get(a.id) ?? []).filter(acctVisible).slice().sort(byCodeName);
        const expanded = kids.length > 0 && (expandedGroups[a.id] ?? false);
        const childRows: ReportRow[] = [];
        if (expanded) {
          const ownRaw = rawById.get(a.id) ?? 0;
          if (ownRaw !== 0) childRows.push({ key: `a-${a.id}-direct`, depth: depth + 1, label: `(${$t('accounts.direct')})`, kind: 'account', amount: presentBalance(ownRaw, type), direct: true });
          for (const k of kids) childRows.push(...emitAccount(k, depth + 1));
        }
        const rolled = presentBalance(acctRaw(a), type);
        if (hideZeroBalance && rolled === 0 && childRows.length === 0) return [];
        return [{ key: `a-${a.id}`, depth, label: a.name, code: a.code || undefined, kind: 'account', accountId: a.id, amount: rolled, toggleId: kids.length > 0 ? a.id : undefined, expanded }, ...childRows];
      };
      // Group node: same shape — collapsible, rolled-up subtotal; children are its root accounts + child groups.
      const emitGroup = (group: (typeof $accountGroups)[number], depth: number): ReportRow[] => {
        if (!groupHasContent(group.id)) return [];
        const expanded = expandedGroups[group.id] ?? false;
        const childRows: ReportRow[] = [];
        if (expanded) {
          for (const a of (rootAccts.get(group.id) ?? []).filter(acctVisible).slice().sort(byCodeName)) childRows.push(...emitAccount(a, depth + 1));
          for (const c of (childGroups.get(group.id) ?? []).slice().sort(byDisplay)) childRows.push(...emitGroup(c, depth + 1));
        }
        const total = presentBalance(groupRaw(group.id), type);
        if (hideZeroBalance && total === 0 && childRows.length === 0) return [];
        return [{ key: `g-${group.id}`, depth, label: group.name, kind: 'group', toggleId: group.id, expanded, amount: total }, ...childRows];
      };
      for (const g of ($topLevelGroupsByType.get(type) ?? []).slice().sort(byDisplay)) rows.push(...emitGroup(g, 1));
      // Retained Earnings pseudo-node under Equity.
      if (type === 'EQUITY' && showRetainedEarningsInEquity) {
        rows.push({ key: 're', depth: 1, label: $t('accounts.retained_earnings'), kind: 'group', amount: netIncome(), toggleId: retainedEarningsExpandable ? 're' : undefined, expanded: retainedEarningsExpanded });
        if (retainedEarningsExpandable && retainedEarningsExpanded) {
          for (const it of ['INCOME', 'EXPENSE'] as AccountType[]) {
            rows.push({ key: `re-${it}`, depth: 2, label: $t(`account_types.${it}`), kind: 'group', amount: getTypeTotal(it) });
            for (const g of ($topLevelGroupsByType.get(it) ?? []).slice().sort(byDisplay)) {
              for (const a of (acctsByGroup.get(g.id) ?? []).slice().sort(byCodeName)) {
                rows.push({ key: `re-a-${a.id}`, depth: 3, label: a.name, code: a.code || undefined, kind: 'account', accountId: a.id, amount: presentBalance(rawById.get(a.id) ?? 0, it) });
              }
            }
          }
        }
      }
      return rows;
    };

    for (const type of visibleTypes) out.set(type, build(type));
    return out;
  });

  function toggleReportRow(id: string | undefined) {
    if (!id) return;
    if (id === 're') toggleRetainedEarnings();
    else toggleGroup(id);
  }

  // Dump this entity's full books to a native .json file the browser downloads.
  let exporting = $state(false);
  async function exportNative() {
    if (!entityId || exporting) return;
    exporting = true;
    try {
      const { exportBooks } = await import('$lib/import/native');
      const books = await exportBooks(entityId);
      const blob = new Blob([JSON.stringify(books)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (entity?.name ?? 'books').replace(/[^\w.-]+/g, '-').toLowerCase();
      a.href = url;
      a.download = `${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      log.ui.error('[Accounts] Native export failed:', e);
    } finally {
      exporting = false;
    }
  }

  function formatCurrency(amount: number, unit: string = 'USD'): string {
    const value = amount / 100 || 0; // normalize -0 → 0 (avoids "-$0.00")
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: unit,
      minimumFractionDigits: 2,
    }).format(value);
  }
</script>

<div class="accounts-page">
  {#if showOptionsMenu || showExportMenu}
    <div class="menu-backdrop" onclick={() => { showOptionsMenu = false; showExportMenu = false; }} role="presentation"></div>
  {/if}
  <header class="page-header">
    <div class="header-left">
      <a href="/" class="back-link">← {$t('nav.home')}</a>
      <h1>{entity?.name ?? $t('common.loading')}</h1>
    </div>
    
    <div class="header-controls">
      <!-- Mode selector (left side) -->
      <div class="mode-selector">
        <label for="mode-select">{$t('accounts.mode')}:</label>
        <select id="mode-select" bind:value={reportMode} onchange={() => setMode(reportMode)}>
          <option value="balance_sheet">{$t('accounts.mode_balance_sheet')}</option>
          <option value="trial_balance">{$t('accounts.mode_trial_balance')}</option>
          <option value="income_statement">{$t('accounts.mode_income_statement')}</option>
          <option value="cash_flow">{$t('accounts.mode_cash_flow')}</option>
          <option value="custom">{$t('accounts.mode_custom')}</option>
        </select>
      </div>
      
      <!-- Saved Reports dropdown (placeholder — see saved-reports-ux.md) -->
      <button
        class="saved-reports-btn"
        disabled
        title="Saved reports coming soon"
      >
        ⭐ {$t('accounts.saved_reports')}
      </button>

      <!-- Export menu: native JSON works; CSV/XLSX are stubbed (see domain/export.md) -->
      <div class="menu-wrap">
        <button
          class="saved-reports-btn"
          onclick={() => (showExportMenu = !showExportMenu)}
          disabled={!entity}
          title="Export the current books / view"
        >
          ⬇ {exporting ? $t('common.loading') : $t('accounts.export')} ▾
        </button>
        {#if showExportMenu}
          <div class="dropdown-menu" role="menu">
            <button class="menu-item" role="menuitem" onclick={() => { showExportMenu = false; exportNative(); }}>
              🗄 {$t('accounts.export_native')}
            </button>
            <button class="menu-item" role="menuitem" disabled title="Coming soon">
              📄 {$t('accounts.export_csv')}
            </button>
            <button class="menu-item" role="menuitem" disabled title="Coming soon">
              📊 {$t('accounts.export_xlsx')}
            </button>
          </div>
        {/if}
      </div>

      <!-- Print / Save-as-PDF via the browser print dialog -->
      <button
        class="saved-reports-btn"
        onclick={printReport}
        disabled={!entity}
        title="Print or save the current view as PDF"
      >
        🖨 {$t('accounts.print')}
      </button>

      <!-- Spacer to push date picker right -->
      <div class="spacer"></div>
      
      <!-- Date picker group (right-aligned) -->
      <div class="date-picker-group">
        <!-- Date picker - conditional based on report mode -->
        <div class="date-picker">
          {#if requiresDateRange}
            <!-- Date range: vertical stack -->
            <div class="date-range-stack">
              <div class="date-input-row">
                <label for="start-date">{$t('accounts.from_date')}:</label>
                <input 
                  type="date" 
                  id="start-date"
                  bind:value={startDate}
                  oninput={handleDateInput}
                  onblur={handleDateBlur}
                />
              </div>
              <div class="date-input-row">
                <label for="end-date">{$t('accounts.to_date')}:</label>
                <input 
                  type="date" 
                  id="end-date"
                  bind:value={endDate}
                  oninput={handleDateInput}
                  onblur={handleDateBlur}
                />
              </div>
            </div>
          {:else}
            <!-- Single "As of" date -->
            <div class="date-input-row">
              <label for="as-of-date">{$t('accounts.as_of')}:</label>
              <input 
                type="date" 
                id="as-of-date"
                bind:value={endDate}
                oninput={handleDateInput}
                onblur={handleDateBlur}
              />
            </div>
          {/if}
        </div>
        
        <!-- Add Column button (compact icon-only) -->
        <button 
          class="add-column-btn" 
          disabled 
          title="Multi-column view coming soon"
        >
          +
        </button>
      </div>
    </div>
  </header>
  
  <!-- Toolbar -->
  <div class="toolbar">
    <button class="btn-tool" onclick={expandAll}>
      {$t('common.expand_all')}
    </button>
    <button class="btn-tool" onclick={collapseAll}>
      {$t('common.collapse_all')}
    </button>

    <!-- View menu: display filters + relative date presets -->
    <div class="menu-wrap">
      <button class="btn-tool" onclick={() => (showOptionsMenu = !showOptionsMenu)}>
        ⚙ {$t('accounts.view_options')} ▾
      </button>
      {#if showOptionsMenu}
        <div class="dropdown-menu wide" role="menu">
          <button class="menu-item check" role="menuitemcheckbox" aria-checked={hideZeroBalance} onclick={toggleHideZeroBalance}>
            <span class="check-box">{hideZeroBalance ? '☑' : '☐'}</span> {$t('accounts.hide_zero')}
          </button>
          <button class="menu-item check" role="menuitemcheckbox" aria-checked={showClosedAccounts} onclick={toggleShowClosedAccounts}>
            <span class="check-box">{showClosedAccounts ? '☑' : '☐'}</span> {$t('accounts.show_closed')}
          </button>
          <div class="menu-divider"></div>
          <div class="menu-label">{$t('accounts.date_preset')}</div>
          {#each datePresets as p}
            <button class="menu-item" role="menuitem" onclick={() => applyDatePreset(p)}>
              {$t(`accounts.preset_${p}`)}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  
  {#if !entity}
    <div class="loading">{$t('common.loading')}</div>
  {:else if balanceLoading || $accountsLoading}
    <div class="loading">{$t('common.loading')}</div>
  {:else if $accounts.length === 0}
    <div class="empty-state">
      <p>{$t('accounts.no_accounts')}</p>
      <p class="text-muted">{$t('accounts.create_prompt')}</p>
    </div>
  {:else}
    <div class="accounts-grid">
      {#each visibleTypes as type}
        {@const info = typeInfo[type]}
        <section class="type-section">
          <!-- Level 0: the type total sits flush at the right column -->
          <div class="type-header" style="--type-color: {info.color}">
            <span class="type-icon">{info.icon}</span>
            <span class="type-name">{$t(`account_types.${type}`)}</span>
            <span class="type-total">{formatCurrency(getTypeTotal(type), entity.baseUnit)}</span>
          </div>

          <!-- Groups + accounts, flattened with depth: name indents forward, amount reverse-indents -->
          <div class="report-rows">
            {#each reportRowsByType.get(type) ?? [] as row (row.key)}
              <div class="report-row {row.kind}" class:rr-direct={row.direct} style="--depth: {row.depth}">
                <span class="rr-name">
                  {#if row.toggleId}
                    <button class="rr-toggle" onclick={() => toggleReportRow(row.toggleId)} aria-label="Toggle">
                      {row.expanded ? '▼' : '▶'}
                    </button>
                  {:else}
                    <span class="rr-toggle rr-toggle-empty"></span>
                  {/if}
                  {#if row.code}<span class="rr-code">{row.code}</span>{/if}
                  {#if row.accountId}
                    <a href="/ledger/{row.accountId}" class="rr-label link" title={row.label}>{row.label}</a>
                  {:else}
                    <span class="rr-label">{row.label}</span>
                  {/if}
                </span>
                <span class="rr-amount">{formatCurrency(row.amount, entity.baseUnit)}</span>
              </div>
            {/each}
          </div>
        </section>
      {/each}
      
      <!-- Footer: Mode-specific summaries -->
      {#if balanceData}
        <div class="footer-section">
          
          <!-- Balance Sheet & Trial Balance: Verification -->
          {#if reportMode === 'balance_sheet' || reportMode === 'trial_balance'}
            <div class="verification-row" class:balanced={isBalanced()} class:imbalanced={!isBalanced()}>
              <span class="verification-label">{$t('accounts.verification')}:</span>
              <div class="verification-values">
                <span class="verification-item">
                  {$t('account_types.ASSET')}: {formatCurrency(balanceData.totalAssets, entity.baseUnit)}
                </span>
                <span class="verification-equals">=</span>
                <span class="verification-item">
                  {$t('accounts.liabilities_plus_equity')}: {formatCurrency(liabilitiesPlusEquity(), entity.baseUnit)}
                </span>
                {#if isBalanced()}
                  <span class="verification-status">✓ {$t('accounts.balanced')}</span>
                {:else}
                  <span class="verification-status warning">
                    ⚠ {$t('accounts.imbalance')}: {formatCurrency(imbalanceAmount(), entity.baseUnit)}
                  </span>
                {/if}
              </div>
            </div>
          {/if}
          
          <!-- Income Statement: Net Income Line -->
          {#if reportMode === 'income_statement'}
            <div class="net-income-row">
              <div class="net-income-calculation">
                <span class="calc-label">{$t('account_types.INCOME')}:</span>
                <span class="calc-value">{formatCurrency(getTypeTotal('INCOME'), entity.baseUnit)}</span>
              </div>
              <div class="net-income-calculation">
                <span class="calc-label">{$t('account_types.EXPENSE')}:</span>
                <span class="calc-value">({formatCurrency(getTypeTotal('EXPENSE'), entity.baseUnit)})</span>
              </div>
              <div class="net-income-total">
                <span class="total-label">{$t('accounts.net_income')}</span>
                <span class="total-value" class:negative={netIncome() < 0}>
                  {formatCurrency(netIncome(), entity.baseUnit)}
                </span>
              </div>
            </div>
          {/if}
          
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .accounts-page {
    max-width: 900px;
    margin: 0 auto;
  }
  
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: var(--space-md);
    flex-wrap: wrap;
    gap: var(--space-md);
  }
  
  .header-left {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }
  
  .back-link {
    font-size: 0.875rem;
    color: var(--text-muted);
    text-decoration: none;
  }
  
  .back-link:hover {
    color: var(--accent-color);
  }
  
  .page-header h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  
  .header-controls {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
  }
  
  .mode-selector {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 0.875rem;
  }
  
  .spacer {
    flex: 1;
    min-width: var(--space-lg);
  }
  
  .date-picker-group {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  
  .date-picker {
    font-size: 0.875rem;
  }
  
  .date-range-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    padding: var(--space-sm);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
  }
  
  .date-input-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  
  .mode-selector label,
  .date-input-row label {
    color: var(--text-muted);
    min-width: 3rem;
  }
  
  .mode-selector select,
  .date-input-row input {
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-primary);
    font-size: 0.875rem;
  }
  
  /* Future feature placeholders */
  .saved-reports-btn {
    padding: var(--space-xs) var(--space-md);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    font-size: 0.875rem;
    cursor: not-allowed;
  }
  
  .add-column-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    font-size: 1rem;
    font-weight: bold;
    cursor: not-allowed;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  /* Improved contrast for disabled items in dark mode */
  .saved-reports-btn:disabled,
  .add-column-btn:disabled {
    opacity: 0.6;
    color: var(--text-muted);
    border-color: rgba(255, 255, 255, 0.2);
  }
  
  /* Better visibility in dark theme */
  @media (prefers-color-scheme: dark) {
    .saved-reports-btn:disabled,
    .add-column-btn:disabled {
      opacity: 0.7;
      border-color: rgba(255, 255, 255, 0.25);
      background: rgba(255, 255, 255, 0.05);
    }
  }
  
  .toolbar {
    display: flex;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
  }
  
  .btn-tool {
    padding: var(--space-xs) var(--space-sm);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    font-size: 0.8125rem;
    color: var(--text-secondary);
    cursor: pointer;
  }
  
  .btn-tool:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  /* Dropdown menus (View options, Export) */
  .menu-wrap { position: relative; display: inline-flex; }
  .menu-backdrop { position: fixed; inset: 0; z-index: 40; }
  .dropdown-menu {
    position: absolute; top: calc(100% + 4px); left: 0; z-index: 50;
    min-width: 12rem;
    background: var(--bg-card); border: 1px solid var(--border-color);
    border-radius: var(--radius-md); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
    padding: 0.25rem; display: flex; flex-direction: column;
  }
  .dropdown-menu.wide { min-width: 14rem; }
  .menu-item {
    display: flex; align-items: center; gap: 0.5rem;
    width: 100%; text-align: left;
    padding: 0.4rem 0.6rem; background: none; border: none; border-radius: var(--radius-sm);
    font-size: 0.85rem; color: var(--text-primary); cursor: pointer;
  }
  .menu-item:hover:not(:disabled) { background: var(--bg-hover); }
  .menu-item:disabled { color: var(--text-muted); cursor: default; }
  .menu-item.check .check-box { font-size: 0.95rem; }
  .menu-divider { height: 1px; background: var(--border-light); margin: 0.25rem 0; }
  .menu-label { padding: 0.3rem 0.6rem 0.15rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }

  /* Synthetic "(direct)" breakdown row for a parent account's own postings */
  .report-row.rr-direct .rr-label { font-style: italic; color: var(--text-muted); }
  .report-row.rr-direct .rr-amount { color: var(--text-muted); }

  /* Print / Save-as-PDF: show only the report, drop app chrome. */
  @media print {
    :global(.global-nav), :global(.ai-assistant),
    .page-header .header-controls, .toolbar, .back-link, .menu-backdrop {
      display: none !important;
    }
    .accounts-page { padding: 0; }
    .report-row { break-inside: avoid; }
    .type-section { break-inside: avoid; }
  }
  
  .loading, .empty-state {
    text-align: center;
    padding: var(--space-xl);
    color: var(--text-muted);
  }
  
  .accounts-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  
  .type-section {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  
  .type-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg);
    background: var(--bg-secondary);
    border-left: 4px solid var(--type-color);
    font-weight: 600;
  }
  
  .type-icon { font-size: 1.1rem; }
  .type-name { flex: 1; }
  .type-total {
    font-family: var(--font-mono);
    font-size: 1rem;
  }

  /* Hierarchical rows: name indents forward, amount reverse-indents, both by --depth.
     Type total (level 0, above) sits flush right; each level steps the amount ~2.5 chars left. */
  .report-rows { display: flex; flex-direction: column; }
  .report-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.22rem var(--space-lg);
    border-top: 1px solid var(--border-light);
  }
  .report-row.group { font-weight: 600; }
  .report-row.account { color: var(--text-secondary); font-weight: 400; }
  .rr-name {
    display: flex; align-items: center; gap: 0.35rem;
    min-width: 0; flex: 1;
    padding-left: calc(var(--depth) * 1.4rem);
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .rr-toggle {
    background: none; border: none; cursor: pointer; color: var(--text-muted);
    width: 1rem; padding: 0; font-size: 0.7rem; flex-shrink: 0;
  }
  .rr-toggle-empty { visibility: hidden; }
  .rr-code { color: var(--text-muted); font-size: 0.8rem; font-family: var(--font-mono); flex-shrink: 0; }
  .rr-label { overflow: hidden; text-overflow: ellipsis; }
  .rr-label.link { color: inherit; text-decoration: none; }
  .rr-label.link:hover { color: var(--accent-color); text-decoration: underline; }
  .rr-amount {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    text-align: right; white-space: nowrap; flex-shrink: 0;
    padding-right: calc(var(--depth) * 1.4rem);
  }

  /* Footer section */
  .footer-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .net-worth-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg);
    background: var(--bg-card);
    border: 2px solid var(--accent-color);
    border-radius: var(--radius-lg);
    font-size: 1.1rem;
    font-weight: 600;
  }
  
  .net-worth-value {
    font-family: var(--font-mono);
    color: var(--accent-color);
  }
  
  .net-worth-value.negative {
    color: var(--danger);
  }
  
  .verification-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    font-size: 0.875rem;
  }
  
  .verification-row.balanced {
    border-color: var(--success, #22c55e);
  }
  
  .verification-row.imbalanced {
    border-color: var(--warning, #f59e0b);
    background: rgba(245, 158, 11, 0.05);
  }
  
  .verification-label {
    font-weight: 500;
    color: var(--text-muted);
  }
  
  .verification-values {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex: 1;
    flex-wrap: wrap;
  }
  
  .verification-item {
    font-family: var(--font-mono);
  }
  
  .verification-equals {
    color: var(--text-muted);
  }
  
  .verification-status {
    margin-left: auto;
    font-weight: 500;
    color: var(--success, #22c55e);
  }
  
  .verification-status.warning {
    color: var(--warning, #f59e0b);
  }
  
  /* Net Income (Income Statement mode) */
  .net-income-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-lg);
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
  }
  
  .net-income-calculation {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  .calc-value {
    font-family: var(--font-mono);
  }
  
  .net-income-total {
    display: flex;
    justify-content: space-between;
    padding-top: var(--space-sm);
    margin-top: var(--space-sm);
    border-top: 2px solid var(--border-color);
    font-size: 1.1rem;
    font-weight: 600;
  }
  
  .total-value {
    font-family: var(--font-mono);
    color: var(--success, #22c55e);
  }
  
  .total-value.negative {
    color: var(--danger, #ef4444);
  }
</style>

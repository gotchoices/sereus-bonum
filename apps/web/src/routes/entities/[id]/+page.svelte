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
  import { savedReports, upsertReport, deleteReport, touchReport, type SavedReport, type DateFieldValue } from '$lib/stores/savedReports';

  // Report modes
  type ReportMode = 'balance_sheet' | 'trial_balance' | 'income_statement' | 'cash_flow' | 'custom';

  // --- Date abstraction ---------------------------------------------------
  // A date field carries a `basis`: 'fixed' (use fixedDate) or a relative token resolved against today.
  // Storing the basis (not a resolved date) lets a saved report auto-adjust — "End of this year" always
  // means the current year's end. See accounts-view.md § Date Inputs.
  const todayIso = () => new Date().toISOString().split('T')[0];
  // Relative tokens offered per field role: "end" dates (As of / To) get end-of-period; "start" dates
  // (From) get start-of-period. For anything else the user picks a Fixed date.
  const END_TOKENS = ['today', 'eom', 'eoq', 'eoy', 'eoly'] as const;
  const START_TOKENS = ['today', 'som', 'soq', 'soy', 'soly'] as const;
  function resolveToken(token: string): string {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth(), q = Math.floor(m / 3) * 3;
    const iso = (d: Date) => d.toISOString().split('T')[0];
    switch (token) {
      case 'today': return iso(now);
      case 'som': return iso(new Date(y, m, 1));
      case 'eom': return iso(new Date(y, m + 1, 0));
      case 'soq': return iso(new Date(y, q, 1));
      case 'eoq': return iso(new Date(y, q + 3, 0));
      case 'soy': return iso(new Date(y, 0, 1));
      case 'eoy': return iso(new Date(y, 11, 31));
      case 'soly': return iso(new Date(y - 1, 0, 1));
      case 'eoly': return iso(new Date(y - 1, 11, 31));
      default: return iso(now);
    }
  }
  const resolveField = (f: DateFieldValue): string => (f.basis === 'fixed' ? f.fixedDate : resolveToken(f.basis));
  const fieldLabel = (f: DateFieldValue): string => (f.basis === 'fixed' ? f.fixedDate : $t(`accounts.basis_${f.basis}`));
  
  // Get entity ID from route
  let entityId = $derived($page.params.id!);
  let entity = $derived($entities.find(e => e.id === entityId));
  
  // Report columns: each is an independent period (name + date basis fields), rendered as its own amount
  // column. A single-column report is just columns.length === 1. Persisted + saved with reports.
  interface ReportColumn { id: string; name: string; endField: DateFieldValue; startField?: DateFieldValue; }
  const makeColumn = (name: string, end?: DateFieldValue, start?: DateFieldValue): ReportColumn => ({
    id: crypto.randomUUID(), name,
    endField: end ?? { basis: 'fixed', fixedDate: todayIso() },
    startField: start,
  });
  const MAX_COLUMNS = 12;

  // View state - persisted
  let expandedGroups = $state<Record<string, boolean>>({});
  let reportMode = $state<ReportMode>('balance_sheet');
  let columns = $state<ReportColumn[]>([makeColumn('Column 1')]);
  let retainedEarningsExpanded = $state(false);

  // Per-column balance data (index-aligned with `columns`).
  let balanceByColumn = $state<(BalanceSheetData | null)[]>([]);
  let balanceLoading = $state(true);

  // Display filters (persisted per entity) — surfaced via the ⚙ View menu.
  let hideZeroBalance = $state(false);   // suppress accounts/groups whose total is $0
  let showClosedAccounts = $state(false); // reveal retired (isActive=false) accounts, hidden by default

  // Transient menu / dialog open state (not persisted)
  let showOptionsMenu = $state(false);
  let showExportMenu = $state(false);
  let showReportsMenu = $state(false);
  let showSaveDialog = $state(false);
  let saveName = $state('');
  
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

      // Restore columns, migrating older persisted shapes: {columns} → {endField,startField} → {endDate,startDate}.
      const saved = loadViewState<any>(`accounts-dates-${entityId}`, null);
      if (saved?.columns?.length) {
        columns = saved.columns;
      } else if (saved?.endField) {
        columns = [makeColumn('Column 1', saved.endField, saved.startField ?? undefined)];
      } else if (saved?.endDate) {
        columns = [makeColumn('Column 1',
          { basis: 'fixed', fixedDate: saved.endDate },
          saved.startDate ? { basis: 'fixed', fixedDate: saved.startDate } : undefined)];
      } else {
        columns = [makeColumn('Column 1')];
      }

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
  
  // Load balance data for every column (one getBalanceSheet per column period).
  async function loadColumns(ds: Awaited<ReturnType<typeof getDataService>>) {
    balanceByColumn = await Promise.all(columns.map((c) =>
      ds.getBalanceSheet(entityId, resolveField(c.endField), c.startField ? resolveField(c.startField) : undefined)));
  }

  async function loadEntityData() {
    log.ui.debug('[Accounts] Loading data for entity:', entityId);
    balanceLoading = true;
    try {
      const ds = await getDataService();
      await loadAccounts(entityId);
      await loadColumns(ds);
      log.ui.debug('[Accounts] Balance data loaded for', columns.length, 'column(s)');
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
      await loadColumns(ds);
      persistViewState();
    } catch (e) {
      log.ui.error('[Accounts] Failed to reload:', e);
    } finally {
      balanceLoading = false;
    }
  }

  // A date field's basis changed (or its fixed date blurred) → reload with the new resolved date(s).
  function onDateFieldChange() {
    reloadBalance();
  }

  // --- Column management ---------------------------------------------------
  function addColumn() {
    if (columns.length >= MAX_COLUMNS) return;
    const prev = columns[columns.length - 1];
    columns = [...columns, makeColumn(`Column ${columns.length + 1}`,
      { ...prev.endField }, prev.startField ? { ...prev.startField } : (requiresDateRange ? defaultStartField() : undefined))];
    reloadBalance();
  }
  function removeColumn(id: string) {
    if (columns.length <= 1) return;
    columns = columns.filter((c) => c.id !== id);
    reloadBalance();
  }
  function renameColumn(id: string, name: string) {
    columns = columns.map((c) => (c.id === id ? { ...c, name } : c));
    persistViewState();
  }

  // Print/PDF: the browser print dialog renders the report (print CSS hides app chrome).
  // "Save as PDF" in that dialog produces the PDF — no separate structured-PDF pipeline yet.
  function printReport() {
    showExportMenu = false;
    if (browser) window.print();
  }

  // Check if current mode requires date range
  let requiresDateRange = $derived(
    reportMode === 'income_statement' || reportMode === 'cash_flow'
  );
  const defaultStartField = (): DateFieldValue => ({ basis: 'soy', fixedDate: `${new Date().getFullYear()}-01-01` });

  // Auto-manage each column's start-date field for modes that require a range (default: start of this year).
  $effect(() => {
    let changed = false;
    const next = columns.map((c) => {
      if (requiresDateRange && !c.startField) { changed = true; return { ...c, startField: defaultStartField() }; }
      if (!requiresDateRange && c.startField) { changed = true; return { ...c, startField: undefined }; }
      return c;
    });
    if (changed) columns = next;
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
    saveViewState(`accounts-dates-${entityId}`, { columns });
    saveViewState(`accounts-hidezero-${entityId}`, hideZeroBalance);
    saveViewState(`accounts-showclosed-${entityId}`, showClosedAccounts);
  }

  // --- Saved reports ------------------------------------------------------
  const modeLabel = (m: ReportMode) => $t(`accounts.mode_${m}`);
  function openSaveDialog() {
    saveName = '';
    showReportsMenu = false;
    showSaveDialog = true;
  }
  function confirmSaveReport() {
    const name = saveName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const report: SavedReport = {
      id: crypto.randomUUID(), name, mode: reportMode,
      columns: columns.map((c) => ({ name: c.name, endField: { ...c.endField }, startField: c.startField ? { ...c.startField } : undefined })),
      hideZeroBalance, showClosedAccounts,
      createdAt: now, lastUsedAt: now,
    };
    upsertReport(report);
    showSaveDialog = false;
  }
  function applySavedReport(r: SavedReport) {
    reportMode = r.mode;
    columns = r.columns.map((c) => makeColumn(c.name, { ...c.endField }, c.startField ? { ...c.startField } : undefined));
    hideZeroBalance = r.hideZeroBalance;
    showClosedAccounts = r.showClosedAccounts;
    touchReport(r.id, new Date().toISOString());
    showReportsMenu = false;
    saveViewState(`accounts-mode-${entityId}`, reportMode);
    reloadBalance();
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
  
  
  // All totals/verification are per-column: they take a column's BalanceSheetData (or null).
  const netIncomeOf = (bd: BalanceSheetData | null): number => (bd ? bd.totalIncome - bd.totalExpense : 0);

  function typeTotalOf(bd: BalanceSheetData | null, type: AccountType): number {
    if (!bd) return 0;
    switch (type) {
      case 'ASSET': return bd.totalAssets;
      case 'LIABILITY': return bd.totalLiabilities;
      case 'EQUITY':
        // Balance Sheet & Trial Balance show Retained Earnings under Equity, so include net income.
        return (reportMode === 'balance_sheet' || reportMode === 'trial_balance')
          ? bd.totalEquity + netIncomeOf(bd) : bd.totalEquity;
      case 'INCOME': return bd.totalIncome;
      case 'EXPENSE': return bd.totalExpense;
      default: return 0;
    }
  }
  // Per-column arrays for the type header + verification (index-aligned with `columns`).
  const typeTotals = (type: AccountType): number[] => balanceByColumn.map((bd) => typeTotalOf(bd, type));
  const liabPlusEquityOf = (bd: BalanceSheetData | null): number =>
    bd ? bd.totalLiabilities + bd.totalEquity + netIncomeOf(bd) : 0;
  const isBalancedOf = (bd: BalanceSheetData | null): boolean =>
    !bd || Math.abs(bd.totalAssets - liabPlusEquityOf(bd)) < 0.01;
  const imbalanceOf = (bd: BalanceSheetData | null): number =>
    bd ? bd.totalAssets - liabPlusEquityOf(bd) : 0;

  // --- Hierarchical report rows -------------------------------------------
  // Flatten the group tree + account (parentId) tree of each type into depth-tagged rows with
  // rolled-up subtotals, honoring expand/collapse. Names indent forward, amounts reverse-indent by
  // depth (see .report-row CSS). Type headers are rendered separately (depth 0, rightmost).
  interface ReportRow {
    key: string;
    depth: number;          // 1 = top-level group; deeper = subgroups / nested accounts
    label: string;
    amounts: number[];      // one presented amount per report column (sign convention applied)
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
    if (!balanceByColumn.length) return out;

    // One logical hierarchy: group-path (group→child-group) then account-path (account→child-account).
    // Per the schema invariant a nested account shares its parent's group, so groups and accounts are
    // just two flavours of node on the same path — emitGroup/emitAccount are parallel and each handle
    // collapse, rolled-up subtotal, and the expand toggle identically (differ only by kind + children).
    // Every amount is an array with one entry per report column.
    const rawByCol = balanceByColumn.map((bd) => {
      const m = new Map<string, number>();
      if (bd) for (const ab of bd.accountBalances) m.set(ab.accountId, ab.balance);
      return m;
    });
    const cols = rawByCol.map((_, i) => i);
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
    const allZero = (arr: number[]) => arr.every((v) => v === 0);

    const acctRawCol = (a: (typeof $accounts)[number], ci: number): number =>
      (rawByCol[ci].get(a.id) ?? 0) + (childAccts.get(a.id) ?? []).reduce((s, k) => s + acctRawCol(k, ci), 0);
    const groupRawCol = (gid: string, ci: number): number => {
      let s = 0;
      for (const a of rootAccts.get(gid) ?? []) s += acctRawCol(a, ci);
      for (const c of childGroups.get(gid) ?? []) s += groupRawCol(c.id, ci);
      return s;
    };
    const groupHasContent = (gid: string): boolean =>
      (rootAccts.get(gid)?.length ?? 0) > 0 || (childGroups.get(gid) ?? []).some((c) => groupHasContent(c.id));

    const build = (type: AccountType): ReportRow[] => {
      const rows: ReportRow[] = [];
      const emitAccount = (a: (typeof $accounts)[number], depth: number): ReportRow[] => {
        const kids = (childAccts.get(a.id) ?? []).filter(acctVisible).slice().sort(byCodeName);
        const expanded = kids.length > 0 && (expandedGroups[a.id] ?? false);
        const childRows: ReportRow[] = [];
        if (expanded) {
          const ownRaw = cols.map((ci) => rawByCol[ci].get(a.id) ?? 0);
          if (!allZero(ownRaw)) childRows.push({ key: `a-${a.id}-direct`, depth: depth + 1, label: `(${$t('accounts.direct')})`, kind: 'account', amounts: ownRaw.map((v) => presentBalance(v, type)), direct: true });
          for (const k of kids) childRows.push(...emitAccount(k, depth + 1));
        }
        const rolled = cols.map((ci) => presentBalance(acctRawCol(a, ci), type));
        if (hideZeroBalance && allZero(rolled) && childRows.length === 0) return [];
        return [{ key: `a-${a.id}`, depth, label: a.name, code: a.code || undefined, kind: 'account', accountId: a.id, amounts: rolled, toggleId: kids.length > 0 ? a.id : undefined, expanded }, ...childRows];
      };
      const emitGroup = (group: (typeof $accountGroups)[number], depth: number): ReportRow[] => {
        if (!groupHasContent(group.id)) return [];
        const expanded = expandedGroups[group.id] ?? false;
        const childRows: ReportRow[] = [];
        if (expanded) {
          for (const a of (rootAccts.get(group.id) ?? []).filter(acctVisible).slice().sort(byCodeName)) childRows.push(...emitAccount(a, depth + 1));
          for (const c of (childGroups.get(group.id) ?? []).slice().sort(byDisplay)) childRows.push(...emitGroup(c, depth + 1));
        }
        const total = cols.map((ci) => presentBalance(groupRawCol(group.id, ci), type));
        if (hideZeroBalance && allZero(total) && childRows.length === 0) return [];
        return [{ key: `g-${group.id}`, depth, label: group.name, kind: 'group', toggleId: group.id, expanded, amounts: total }, ...childRows];
      };
      for (const g of ($topLevelGroupsByType.get(type) ?? []).slice().sort(byDisplay)) rows.push(...emitGroup(g, 1));
      // Retained Earnings pseudo-node under Equity.
      if (type === 'EQUITY' && showRetainedEarningsInEquity) {
        rows.push({ key: 're', depth: 1, label: $t('accounts.retained_earnings'), kind: 'group', amounts: balanceByColumn.map(netIncomeOf), toggleId: retainedEarningsExpandable ? 're' : undefined, expanded: retainedEarningsExpanded });
        if (retainedEarningsExpandable && retainedEarningsExpanded) {
          for (const it of ['INCOME', 'EXPENSE'] as AccountType[]) {
            rows.push({ key: `re-${it}`, depth: 2, label: $t(`account_types.${it}`), kind: 'group', amounts: typeTotals(it) });
            for (const g of ($topLevelGroupsByType.get(it) ?? []).slice().sort(byDisplay)) {
              for (const a of (acctsByGroup.get(g.id) ?? []).slice().sort(byCodeName)) {
                rows.push({ key: `re-a-${a.id}`, depth: 3, label: a.name, code: a.code || undefined, kind: 'account', accountId: a.id, amounts: cols.map((ci) => presentBalance(rawByCol[ci].get(a.id) ?? 0, it)) });
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
  {#if showOptionsMenu || showExportMenu || showReportsMenu}
    <div class="menu-backdrop" onclick={() => { showOptionsMenu = false; showExportMenu = false; showReportsMenu = false; }} role="presentation"></div>
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
          <!-- 'custom' mode deferred (pending scope — see accounts-view.md / saved-reports-ux.md) -->
        </select>
      </div>
      
      <!-- Saved Reports dropdown -->
      <div class="menu-wrap">
        <button
          class="saved-reports-btn"
          onclick={() => (showReportsMenu = !showReportsMenu)}
          disabled={!entity}
          title="Save & recall report configurations"
        >
          ⭐ {$t('accounts.saved_reports')} ▾
        </button>
        {#if showReportsMenu}
          <div class="dropdown-menu wide" role="menu">
            <button class="menu-item" role="menuitem" onclick={openSaveDialog}>
              💾 {$t('accounts.save_current')}
            </button>
            {#if $savedReports.length}
              <div class="menu-divider"></div>
              {#each $savedReports as r (r.id)}
                <div class="sr-row">
                  <button class="menu-item sr-load" role="menuitem" onclick={() => applySavedReport(r)}>
                    <span class="sr-name">{r.name}</span>
                    <span class="sr-sub">{modeLabel(r.mode)} · {fieldLabel(r.columns[0].endField)}{r.columns.length > 1 ? ` · ${r.columns.length} cols` : ''}</span>
                  </button>
                  <button class="sr-del" title={$t('common.delete')} onclick={() => deleteReport(r.id)}>✕</button>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>

      <!-- Export menu: native JSON works; CSV/XLSX/PDF stubbed; Print uses the browser dialog -->
      <div class="menu-wrap">
        <button
          class="saved-reports-btn"
          onclick={() => (showExportMenu = !showExportMenu)}
          disabled={!entity}
          title="Export or print the current view"
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
            <button class="menu-item" role="menuitem" disabled title="Coming soon">
              📕 {$t('accounts.export_pdf')}
            </button>
            <div class="menu-divider"></div>
            <button class="menu-item" role="menuitem" onclick={printReport}>
              🖨 {$t('accounts.print')}
            </button>
          </div>
        {/if}
      </div>

      <!-- Spacer to push date picker right -->
      <div class="spacer"></div>
      
      <!-- Date field: a basis selector (fixed vs relative token) + a date picker (fixed) or resolved date. -->
      {#snippet dateField(id: string, label: string, field: DateFieldValue, tokens: readonly string[])}
        <div class="date-input-row">
          <label for={id}>{label}:</label>
          <div class="smart-date">
            <select class="basis-select" bind:value={field.basis} onchange={onDateFieldChange} aria-label="{label} basis">
              <option value="fixed">{$t('accounts.basis_fixed')}</option>
              {#each tokens as tok}
                <option value={tok}>{$t(`accounts.basis_${tok}`)}</option>
              {/each}
            </select>
            {#if field.basis === 'fixed'}
              <input type="date" {id} bind:value={field.fixedDate} oninput={handleDateInput} onblur={handleDateBlur} />
            {:else}
              <span class="resolved-date" title={$t('accounts.resolves_to')}>{resolveField(field)}</span>
            {/if}
          </div>
        </div>
      {/snippet}

      <!-- Date/column group (right-aligned). Each column is an independent period. -->
      <div class="date-picker-group">
        <div class="columns-bar">
          {#each columns as col, ci (col.id)}
            <div class="col-config">
              {#if columns.length > 1}
                <div class="col-head">
                  <input class="col-name" bind:value={col.name} onchange={() => renameColumn(col.id, col.name)} aria-label="Column name" />
                  <button class="col-del" onclick={() => removeColumn(col.id)} title={$t('accounts.remove_column')}>✕</button>
                </div>
              {/if}
              <div class="date-stack">
                {#if requiresDateRange}
                  {#if col.startField}{@render dateField(`c${ci}-from`, $t('accounts.from_date'), col.startField, START_TOKENS)}{/if}
                  {@render dateField(`c${ci}-to`, $t('accounts.to_date'), col.endField, END_TOKENS)}
                {:else}
                  {@render dateField(`c${ci}-asof`, $t('accounts.as_of'), col.endField, END_TOKENS)}
                {/if}
              </div>
            </div>
          {/each}
          <button class="add-column-btn" onclick={addColumn} disabled={columns.length >= MAX_COLUMNS}
            title={columns.length >= MAX_COLUMNS ? $t('accounts.max_columns') : $t('accounts.add_column')}>+</button>
        </div>
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
        </div>
      {/if}
    </div>
  </div>

  <!-- Save Report dialog -->
  {#if showSaveDialog}
    <div class="dialog-backdrop" onclick={() => (showSaveDialog = false)} role="presentation">
      <div class="save-dialog" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{$t('accounts.save_report')}</h3>
        <label for="save-name">{$t('accounts.report_name')}</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input id="save-name" bind:value={saveName} autofocus placeholder={$t('accounts.report_name')}
          onkeydown={(e) => { if (e.key === 'Enter') confirmSaveReport(); if (e.key === 'Escape') showSaveDialog = false; }} />
        <div class="dialog-summary">
          {modeLabel(reportMode)} · {columns.length} {columns.length === 1 ? $t('accounts.column_one') : $t('accounts.column_many')}
        </div>
        <div class="dialog-actions">
          <button class="btn-tool" onclick={() => (showSaveDialog = false)}>{$t('common.cancel')}</button>
          <button class="btn-tool btn-primary" onclick={confirmSaveReport} disabled={!saveName.trim()}>{$t('common.save')}</button>
        </div>
      </div>
    </div>
  {/if}
  
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
    <div class="accounts-grid" style="--ncols: {columns.length}">
      <!-- Column header row (multi-column only) — names align above their amount columns -->
      {#if columns.length > 1}
        <div class="column-headers">
          <span class="ch-spacer"></span>
          {#each columns as col (col.id)}
            <span class="ch-name" title={col.name}>{col.name}</span>
          {/each}
        </div>
      {/if}

      {#each visibleTypes as type}
        {@const info = typeInfo[type]}
        <section class="type-section">
          <div class="type-header" style="--type-color: {info.color}">
            <span class="type-icon">{info.icon}</span>
            <span class="type-name">{$t(`account_types.${type}`)}</span>
            <span class="rr-amounts" class:multi={columns.length > 1}>
              {#each typeTotals(type) as tot}
                <span class="type-total">{formatCurrency(tot, entity.baseUnit)}</span>
              {/each}
            </span>
          </div>

          <!-- Single continuous path: name indents forward; one amount cell per column. -->
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
                <span class="rr-amounts" class:multi={columns.length > 1}>
                  {#each row.amounts as amt}
                    <span class="rr-amount">{formatCurrency(amt, entity.baseUnit)}</span>
                  {/each}
                </span>
              </div>
            {/each}
          </div>
        </section>
      {/each}

      <!-- Footer: per-column verification (BS/TB) or net income (Income Statement) -->
      {#if balanceByColumn.length}
        <div class="footer-section">
          {#if reportMode === 'balance_sheet' || reportMode === 'trial_balance'}
            {#each columns as col, ci (col.id)}
              {@const bd = balanceByColumn[ci]}
              <div class="verification-row" class:balanced={isBalancedOf(bd)} class:imbalanced={!isBalancedOf(bd)}>
                <span class="verification-label">{columns.length > 1 ? col.name : $t('accounts.verification')}:</span>
                <div class="verification-values">
                  <span class="verification-item">{$t('account_types.ASSET')}: {formatCurrency(bd?.totalAssets ?? 0, entity.baseUnit)}</span>
                  <span class="verification-equals">=</span>
                  <span class="verification-item">{$t('accounts.liabilities_plus_equity')}: {formatCurrency(liabPlusEquityOf(bd), entity.baseUnit)}</span>
                  {#if isBalancedOf(bd)}
                    <span class="verification-status">✓ {$t('accounts.balanced')}</span>
                  {:else}
                    <span class="verification-status warning">⚠ {$t('accounts.imbalance')}: {formatCurrency(imbalanceOf(bd), entity.baseUnit)}</span>
                  {/if}
                </div>
              </div>
            {/each}
          {/if}

          {#if reportMode === 'income_statement'}
            {#each columns as col, ci (col.id)}
              {@const bd = balanceByColumn[ci]}
              <div class="net-income-row">
                {#if columns.length > 1}<div class="net-income-calculation"><span class="calc-label">{col.name}</span></div>{/if}
                <div class="net-income-calculation">
                  <span class="calc-label">{$t('account_types.INCOME')}:</span>
                  <span class="calc-value">{formatCurrency(typeTotalOf(bd, 'INCOME'), entity.baseUnit)}</span>
                </div>
                <div class="net-income-calculation">
                  <span class="calc-label">{$t('account_types.EXPENSE')}:</span>
                  <span class="calc-value">({formatCurrency(typeTotalOf(bd, 'EXPENSE'), entity.baseUnit)})</span>
                </div>
                <div class="net-income-total">
                  <span class="total-label">{$t('accounts.net_income')}</span>
                  <span class="total-value" class:negative={netIncomeOf(bd) < 0}>{formatCurrency(netIncomeOf(bd), entity.baseUnit)}</span>
                </div>
              </div>
            {/each}
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
  
  /* Header dropdown trigger buttons (Reports / Export) */
  .saved-reports-btn {
    padding: var(--space-xs) var(--space-md);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    white-space: nowrap;
  }
  .saved-reports-btn:hover:not(:disabled) { background: var(--bg-hover); }

  .add-column-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: center;
  }
  .add-column-btn:hover:not(:disabled) { background: var(--bg-hover); }

  /* Multi-column date bar: one config box per column, side by side, then the [+] add button */
  .columns-bar { display: flex; align-items: flex-start; gap: var(--space-sm); flex-wrap: wrap; }
  .col-config {
    display: flex; flex-direction: column; gap: 0.3rem;
    padding: var(--space-xs) var(--space-sm);
    background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  }
  .col-head { display: flex; align-items: center; gap: 0.25rem; }
  .col-name {
    flex: 1; min-width: 6rem; width: 8rem; font-size: 0.8rem; font-weight: 600;
    padding: 0.1rem 0.35rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);
    background: var(--bg-primary); color: var(--text-primary);
  }
  .col-del {
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    padding: 0 0.3rem; border-radius: var(--radius-sm); font-size: 0.8rem;
  }
  .col-del:hover { background: var(--danger, #f87171); color: #fff; }
  .date-stack { display: flex; flex-direction: column; gap: var(--space-xs); }
  
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

  /* Saved-report rows in the Reports dropdown (sr- prefix avoids colliding with the .report-row body rows) */
  .sr-row { display: flex; align-items: stretch; }
  .sr-row .sr-load { flex: 1; flex-direction: column; align-items: flex-start; gap: 0.05rem; cursor: pointer; }
  .sr-name { font-weight: 500; }
  .sr-sub { font-size: 0.72rem; color: var(--text-muted); }
  .sr-del {
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    padding: 0 0.5rem; border-radius: var(--radius-sm); font-size: 0.8rem;
  }
  .sr-del:hover { background: var(--danger, #f87171); color: #fff; }

  /* Smart date field: basis selector + fixed picker / resolved date (kept on one compact line) */
  .smart-date { display: flex; align-items: center; gap: 0.35rem; flex-wrap: nowrap; white-space: nowrap; }
  .smart-date input[type="date"] { width: 9.5rem; }
  .basis-select {
    font-size: 0.78rem; padding: 0.15rem 0.25rem;
    border: 1px solid var(--border-color); border-radius: var(--radius-sm);
    background: var(--bg-secondary); color: var(--text-primary); max-width: 10rem;
  }
  .resolved-date {
    font-family: var(--font-mono); font-variant-numeric: tabular-nums;
    font-size: 0.8rem; color: var(--text-secondary);
    padding: 0.15rem 0.4rem; border: 1px dashed var(--border-color); border-radius: var(--radius-sm);
  }

  /* Save-report dialog */
  .dialog-backdrop {
    position: fixed; inset: 0; z-index: 100;
    background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center;
  }
  .save-dialog {
    background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg);
    padding: var(--space-lg); width: min(24rem, 90vw); display: flex; flex-direction: column; gap: 0.5rem;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  }
  .save-dialog h3 { margin: 0 0 0.25rem; font-size: 1rem; }
  .save-dialog label { font-size: 0.8rem; color: var(--text-secondary); }
  .save-dialog input {
    padding: 0.45rem 0.6rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);
    background: var(--bg-secondary); color: var(--text-primary); font-size: 0.9rem;
  }
  .dialog-summary { font-size: 0.78rem; color: var(--text-muted); }
  .dialog-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }
  .btn-primary { background: var(--accent-color); color: #fff; border-color: var(--accent-color); }
  .btn-primary:disabled { opacity: 0.5; cursor: default; }

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
  .type-total { font-family: var(--font-mono); font-size: 1rem; white-space: nowrap; }

  /* Column width for multi-column mode (header names + amount cells share it). */
  .accounts-grid { --col-w: 7.5rem; }

  /* Multi-column header row — names align above their amount columns. */
  .column-headers { display: flex; align-items: flex-end; padding: 0.15rem var(--space-lg) 0.35rem; }
  .ch-spacer { flex: 1; }
  .ch-name {
    width: var(--col-w); text-align: right; padding-right: var(--space-md);
    font-size: 0.72rem; font-weight: 700; color: var(--text-muted);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  /* Hierarchical rows: name indents forward. Single column → amount reverse-indents by --depth (funnel);
     multi-column → fixed-width aligned amount cells (no reverse-indent). */
  .report-rows { display: flex; flex-direction: column; }
  .report-row {
    display: flex;
    align-items: center;
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
  .rr-amounts { display: flex; flex-shrink: 0; }
  .rr-amount {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    text-align: right; white-space: nowrap; flex-shrink: 0;
  }
  /* Single column: reverse-indent funnel. */
  .rr-amounts:not(.multi) .rr-amount { padding-right: calc(var(--depth) * 1.4rem); }
  /* Multi column: fixed aligned cells (applies to body amounts + header type totals). */
  .rr-amounts.multi > * { width: var(--col-w); text-align: right; padding-right: var(--space-md); flex-shrink: 0; }

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

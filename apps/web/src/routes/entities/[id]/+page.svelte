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
  import { getDataService, type AccountType, type BalanceSheetData } from '$lib/data';
  import { presentBalance, formatVariance } from '$lib/report/present';
  import { isoOf, endTokens, startTokens, migrateField, resolveColumnChain } from '$lib/report/dates';
  import { loadViewState, saveViewState } from '$lib/stores/viewState';
  import { savedReports, upsertReport, deleteReport, touchReport, type SavedReport, type DateFieldValue } from '$lib/stores/savedReports';

  // Report modes
  type ReportMode = 'balance_sheet' | 'trial_balance' | 'income_statement' | 'cash_flow' | 'custom';

  // --- Date abstraction ---------------------------------------------------
  // A date field's `basis` is 'fixed' (use fixedDate) or a relative token {c|p}{m|q|y}-{start|end}
  // ("current/previous month/quarter/year"), or 'today'. Storing the basis (not a resolved date) lets a
  // saved report auto-adjust. Columns resolve as a CHAIN (see resolvedColumns): the rightmost column
  // resolves against today; each column left of it resolves against its right neighbour's resolved date
  // and offers only "previous" tokens — so left columns reach abstractly into prior periods.
  const fieldLabel = (f: DateFieldValue): string => (f.basis === 'fixed' ? f.fixedDate : $t(`accounts.basis_${migrateField(f).basis}`));
  
  // Get entity ID from route
  let entityId = $derived($page.params.id!);
  let entity = $derived($entities.find(e => e.id === entityId));
  
  // Report columns: each is an independent period (name + date basis fields), rendered as its own amount
  // column. A single-column report is just columns.length === 1. Persisted + saved with reports.
  // varianceLeft: show a Δ (change) column in the gap to this column's LEFT — i.e. the change INTO this
  // (newer) column from its older/left neighbour. Never on the leftmost column (nothing before it).
  interface ReportColumn { id: string; name: string; endField: DateFieldValue; startField?: DateFieldValue; varianceLeft?: boolean; }
  // Default as-of / period-end is the end of the PRIOR month (last closed month) rather than mid-month today —
  // the usual thing to report on, and it keeps the default period (beginning-of-year → prior-month-end) valid.
  const priorMonthEndIso = () => { const n = new Date(); return isoOf(new Date(n.getFullYear(), n.getMonth(), 0)); };
  const makeColumn = (name: string, end?: DateFieldValue, start?: DateFieldValue, varianceLeft = false): ReportColumn => ({
    id: crypto.randomUUID(), name,
    endField: end ?? { basis: 'pm-end', fixedDate: priorMonthEndIso() },
    startField: start, varianceLeft,
  });
  const MAX_COLUMNS = 12;
  type VarianceFormat = 'dollar' | 'percent' | 'both';

  // View state - persisted
  let expandedGroups = $state<Record<string, boolean>>({});
  let reportMode = $state<ReportMode>('balance_sheet');
  let columns = $state<ReportColumn[]>([makeColumn('')]);
  let varianceFormat = $state<VarianceFormat>('both');
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
  let openColMenu = $state<string | null>(null); // id of the column whose ☰ header menu is open
  
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
      varianceFormat = loadViewState<VarianceFormat>(`accounts-varfmt-${entityId}`, 'both');

      // Restore columns, migrating older persisted shapes: {columns} → {endField,startField} → {endDate,startDate}.
      const saved = loadViewState<any>(`accounts-dates-${entityId}`, null);
      if (saved?.columns?.length) {
        columns = saved.columns.map((c: ReportColumn) =>
          ({ ...c, endField: migrateField(c.endField), startField: c.startField ? migrateField(c.startField) : undefined }));
      } else if (saved?.endField) {
        columns = [makeColumn('', migrateField(saved.endField), saved.startField ? migrateField(saved.startField) : undefined)];
      } else if (saved?.endDate) {
        columns = [makeColumn('',
          { basis: 'fixed', fixedDate: saved.endDate },
          saved.startDate ? { basis: 'fixed', fixedDate: saved.startDate } : undefined)];
      } else {
        columns = [makeColumn('')];
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
  
  // Chained resolution: rightmost column resolves against today; each column to its left resolves against
  // its right neighbour's resolved end date. Returns index-aligned { end, start? } ISO strings.
  let resolvedColumns = $derived.by<{ end: string; start?: string }[]>(() => resolveColumnChain(columns, new Date()));

  // Load balance data for every column (one getBalanceSheet per resolved column period). Guard against a
  // start later than the end (e.g. beginning-of-year vs prior-month-end in January): drop the start so the
  // column degrades to an as-of report rather than a nonsensical negative range.
  async function loadColumns(ds: Awaited<ReturnType<typeof getDataService>>) {
    const rc = resolvedColumns;
    balanceByColumn = await Promise.all(columns.map((_, i) => {
      const start = rc[i].start && rc[i].start! <= rc[i].end ? rc[i].start : undefined;
      return ds.getBalanceSheet(entityId, rc[i].end, start);
    }));
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
  // Columns grow leftward into the past: the rightmost stays the today-anchor, and a new column is
  // PREPENDED as an "End previous year" period (chains one period back from the current leftmost).
  // Insert a new "older" column immediately to the LEFT of `id` (defaults to End previous year, which
  // chains one period further back). Insert-left never disturbs the today-anchor and reaches into the past.
  function insertColumnBefore(id: string) {
    if (columns.length >= MAX_COLUMNS) return;
    const y = new Date().getFullYear();
    const newCol = makeColumn('', { basis: 'py-end', fixedDate: `${y - 1}-12-31` },
      requiresDateRange ? { basis: 'py-start', fixedDate: `${y - 1}-01-01` } : undefined);
    const i = columns.findIndex((c) => c.id === id);
    const at = i < 0 ? 0 : i;
    columns = [...columns.slice(0, at), newCol, ...columns.slice(at)];
    openColMenu = null;
    reloadBalance();
  }
  function removeColumn(id: string) {
    if (columns.length <= 1) return;
    columns = columns.filter((c) => c.id !== id);
    openColMenu = null;
    reloadBalance();
  }
  function toggleColumnVariance(id: string) {
    columns = columns.map((c) => (c.id === id ? { ...c, varianceLeft: !c.varianceLeft } : c));
    openColMenu = null;
    persistViewState();
  }
  function setVarianceFormat(fmt: VarianceFormat) {
    varianceFormat = fmt;
    saveViewState(`accounts-varfmt-${entityId}`, fmt);
  }

  // --- Column slots: interleave data columns with the variance columns their left-neighbour enables. ---
  interface DataSlot { kind: 'data'; ci: number; }
  interface VarSlot { kind: 'variance'; a: number; b: number; } // older=a (left), newer=b (right)
  let columnSlots = $derived.by<(DataSlot | VarSlot)[]>(() => {
    const slots: (DataSlot | VarSlot)[] = [];
    for (let i = 0; i < columns.length; i++) {
      // A Δ column sits to the LEFT of a column that has varianceLeft: older=i-1, newer=i.
      if (i > 0 && columns[i].varianceLeft) slots.push({ kind: 'variance', a: i - 1, b: i });
      slots.push({ kind: 'data', ci: i });
    }
    return slots;
  });
  // Variance rendering lives in $lib/report/present (formatVariance); the format + currency fn are
  // injected from component state below at each call site.

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
  const defaultStartField = (): DateFieldValue => ({ basis: 'cy-start', fixedDate: `${new Date().getFullYear()}-01-01` });

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
    saveViewState(`accounts-varfmt-${entityId}`, varianceFormat);
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
      columns: columns.map((c) => ({ name: c.name, endField: { ...c.endField }, startField: c.startField ? { ...c.startField } : undefined, varianceLeft: c.varianceLeft })),
      varianceFormat,
      hideZeroBalance, showClosedAccounts,
      createdAt: now, lastUsedAt: now,
    };
    upsertReport(report);
    showSaveDialog = false;
  }
  function applySavedReport(r: SavedReport) {
    reportMode = r.mode;
    columns = r.columns.map((c) => makeColumn(c.name, migrateField(c.endField), c.startField ? migrateField(c.startField) : undefined, c.varianceLeft ?? false));
    varianceFormat = r.varianceFormat ?? 'both';
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
  {#if openColMenu}
    <div class="menu-backdrop" onclick={() => (openColMenu = null)} role="presentation"></div>
  {/if}
  <header class="page-header">
    <div class="header-left">
      <a href="/" class="back-link">← {$t('nav.home')}</a>
      <h1>{entity?.name ?? $t('common.loading')}</h1>
      <a href="/entities/{entityId}/accounts" class="back-link manage-link">⚙ {$t('manage_accounts.title')}</a>
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
                    <span class="sr-sub">{modeLabel(r.mode)}{r.columns?.[0] ? ` · ${fieldLabel(r.columns[0].endField)}` : ''}{(r.columns?.length ?? 0) > 1 ? ` · ${r.columns.length} cols` : ''}</span>
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

    </div>
  </header>

  <!-- A single date cell: compact vertical stack — basis selector on top, fixed picker / resolved below. -->
  {#snippet dateCell(label: string, field: DateFieldValue, tokens: string[], resolved: string)}
    <div class="date-cell">
      <select class="basis-select" bind:value={field.basis} onchange={onDateFieldChange} aria-label="{label} basis">
        <option value="fixed">{$t('accounts.basis_fixed')}</option>
        {#each tokens as tok}<option value={tok}>{$t(`accounts.basis_${tok}`)}</option>{/each}
      </select>
      {#if field.basis === 'fixed'}
        <input type="date" bind:value={field.fixedDate} oninput={handleDateInput} onblur={handleDateBlur} aria-label={label} />
      {:else}
        <span class="resolved-date" title="{label}: {$t('accounts.resolves_to')}">{resolved}</span>
      {/if}
    </div>
  {/snippet}

  <!-- A column's header: its date field(s) sit directly above its number column. -->
  {#snippet columnHeader(col: ReportColumn, ci: number)}
    {@const rightmost = ci === columns.length - 1}
    {@const rc = resolvedColumns[ci]}
    <div class="colhdr">
      <div class="col-ctrl">
        <button class="col-ham" aria-label={$t('accounts.column_menu')} title={$t('accounts.column_menu')}
          onclick={(e) => { e.stopPropagation(); openColMenu = openColMenu === col.id ? null : col.id; }}>☰</button>
        {#if openColMenu === col.id}
          <div class="dropdown-menu col-menu" role="menu">
            <button class="menu-item" role="menuitem" disabled={columns.length >= MAX_COLUMNS} onclick={() => insertColumnBefore(col.id)}>
              ➕ {$t('accounts.insert_older')}
            </button>
            {#if ci > 0}
              <button class="menu-item check" role="menuitemcheckbox" aria-checked={col.varianceLeft} onclick={() => toggleColumnVariance(col.id)}>
                <span class="check-box">{col.varianceLeft ? '☑' : '☐'}</span> Δ {$t('accounts.show_change')}
              </button>
            {/if}
            {#if columns.length > 1}
              <button class="menu-item danger" role="menuitem" onclick={() => removeColumn(col.id)}>✕ {$t('accounts.remove_column')}</button>
            {/if}
          </div>
        {/if}
      </div>
      <div class="col-dates">
        {#if requiresDateRange && col.startField}
          {@render dateCell($t('accounts.from_date'), col.startField, startTokens(rightmost), rc?.start ?? '')}
          {@render dateCell($t('accounts.to_date'), col.endField, endTokens(rightmost), rc?.end ?? '')}
        {:else}
          {@render dateCell($t('accounts.as_of'), col.endField, endTokens(rightmost), rc?.end ?? '')}
        {/if}
      </div>
    </div>
  {/snippet}
  
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
          <div class="menu-label">{$t('accounts.variance_format')}</div>
          <div class="seg-group">
            <button class="seg" class:active={varianceFormat === 'dollar'} onclick={() => setVarianceFormat('dollar')}>$</button>
            <button class="seg" class:active={varianceFormat === 'percent'} onclick={() => setVarianceFormat('percent')}>%</button>
            <button class="seg" class:active={varianceFormat === 'both'} onclick={() => setVarianceFormat('both')}>{$t('accounts.variance_both')}</button>
          </div>
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
    <!-- Report as one aligned grid: name column + one number column per report column. Columns size to
         content and the whole grid scrolls horizontally if it exceeds the viewport. Date selectors sit in
         the header row directly above their number column. -->
    <div class="report-scroll">
      <div class="report-grid" style="grid-template-columns: minmax(max-content, 1fr) {columnSlots.map(() => 'max-content').join(' ')};">
        <!-- Header: name lead, then per-slot date selectors (data) / Δ headers (variance) -->
        <div class="grid-row grid-header">
          <div class="gcell gname gh-lead"></div>
          {#each columnSlots as slot (slot.kind === 'data' ? `d${slot.ci}` : `v${slot.a}`)}
            {#if slot.kind === 'data'}
              <div class="gcell gamount gh-col">{@render columnHeader(columns[slot.ci], slot.ci)}</div>
            {:else}
              <div class="gcell gamount gh-var" title={$t('accounts.change')}>Δ</div>
            {/if}
          {/each}
        </div>

        {#each visibleTypes as type}
          {@const info = typeInfo[type]}
          {@const tt = typeTotals(type)}
          <div class="grid-row grid-type" style="--type-color: {info.color}; --depth: 0;">
            <div class="gcell gname">
              <span class="type-icon">{info.icon}</span>
              <span class="type-name">{$t(`account_types.${type}`)}</span>
            </div>
            {#each columnSlots as slot (slot.kind === 'data' ? `d${slot.ci}` : `v${slot.a}`)}
              {#if slot.kind === 'data'}
                <div class="gcell gamount type-total">{formatCurrency(tt[slot.ci], entity.baseUnit)}</div>
              {:else}
                <div class="gcell gamount gv" class:up={tt[slot.b] > tt[slot.a]} class:down={tt[slot.b] < tt[slot.a]}>{formatVariance(tt[slot.a], tt[slot.b], entity.baseUnit, varianceFormat, formatCurrency)}</div>
              {/if}
            {/each}
          </div>
          {#each reportRowsByType.get(type) ?? [] as row (row.key)}
            <div class="grid-row grid-body {row.kind}" class:rr-direct={row.direct} style="--depth: {row.depth};">
              <div class="gcell gname">
                {#if row.toggleId}
                  <button class="rr-toggle" onclick={() => toggleReportRow(row.toggleId)} aria-label="Toggle">{row.expanded ? '▼' : '▶'}</button>
                {:else}
                  <span class="rr-toggle rr-toggle-empty"></span>
                {/if}
                {#if row.code}<span class="rr-code">{row.code}</span>{/if}
                {#if row.accountId}
                  <a href="/ledger/{row.accountId}" class="rr-label link" title={row.label}>{row.label}</a>
                {:else}
                  <span class="rr-label">{row.label}</span>
                {/if}
              </div>
              {#each columnSlots as slot (slot.kind === 'data' ? `d${slot.ci}` : `v${slot.a}`)}
                {#if slot.kind === 'data'}
                  <div class="gcell gamount">{formatCurrency(row.amounts[slot.ci], entity.baseUnit)}</div>
                {:else}
                  <div class="gcell gamount gv" class:up={row.amounts[slot.b] > row.amounts[slot.a]} class:down={row.amounts[slot.b] < row.amounts[slot.a]}>{formatVariance(row.amounts[slot.a], row.amounts[slot.b], entity.baseUnit, varianceFormat, formatCurrency)}</div>
                {/if}
              {/each}
            </div>
          {/each}
        {/each}

        <!-- Footer: verification (BS/TB) or net income (IS); variance shown for net income only -->
        {#if balanceByColumn.length && (reportMode === 'balance_sheet' || reportMode === 'trial_balance')}
          <div class="grid-row grid-foot" style="--depth: 0;">
            <div class="gcell gname foot-label">{$t('accounts.verification')}</div>
            {#each columnSlots as slot (slot.kind === 'data' ? `d${slot.ci}` : `v${slot.a}`)}
              {#if slot.kind === 'data'}
                {@const bd = balanceByColumn[slot.ci]}
                <div class="gcell gamount foot-cell" class:imbalanced={!isBalancedOf(bd)}>{#if isBalancedOf(bd)}✓ {$t('accounts.balanced')}{:else}⚠ {formatCurrency(imbalanceOf(bd), entity.baseUnit)}{/if}</div>
              {:else}
                <div class="gcell gamount"></div>
              {/if}
            {/each}
          </div>
        {/if}
        {#if balanceByColumn.length && reportMode === 'income_statement'}
          <div class="grid-row grid-foot" style="--depth: 0;">
            <div class="gcell gname foot-label">{$t('accounts.net_income')}</div>
            {#each columnSlots as slot (slot.kind === 'data' ? `d${slot.ci}` : `v${slot.a}`)}
              {#if slot.kind === 'data'}
                <div class="gcell gamount foot-cell" class:negative={netIncomeOf(balanceByColumn[slot.ci]) < 0}>{formatCurrency(netIncomeOf(balanceByColumn[slot.ci]), entity.baseUnit)}</div>
              {:else}
                <div class="gcell gamount gv" class:up={netIncomeOf(balanceByColumn[slot.b]) > netIncomeOf(balanceByColumn[slot.a])} class:down={netIncomeOf(balanceByColumn[slot.b]) < netIncomeOf(balanceByColumn[slot.a])}>{formatVariance(netIncomeOf(balanceByColumn[slot.a]), netIncomeOf(balanceByColumn[slot.b]), entity.baseUnit, varianceFormat, formatCurrency)}</div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .accounts-page {
    max-width: 1200px;
    margin: 0 auto;
  }

  /* ===== Report grid: name column + one number column per report column ===== */
  /* Columns size to content; the whole grid scrolls horizontally when it exceeds the viewport. */
  .report-scroll { overflow-x: auto; padding-bottom: 0.4rem; }
  .report-grid { display: grid; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); }
  .grid-row { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; align-items: center; }

  .gcell { padding: 0.22rem var(--space-sm); min-width: 0; }
  /* Name column sticks to the left while the number columns scroll horizontally. */
  .gname {
    display: flex; align-items: center; gap: 0.35rem; white-space: nowrap;
    padding-left: calc(var(--depth, 0) * 1.4rem + var(--space-md));
    position: sticky; left: 0; z-index: 2;
    background: var(--bg-card); box-shadow: 1px 0 0 var(--border-light);
  }
  .grid-type .gname { background: var(--bg-secondary); }
  .grid-body:hover .gname { background: var(--bg-hover); }
  .gamount { font-family: var(--font-mono); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
  /* Reverse-indent funnel: deeper rows step their numbers left. */
  .grid-body .gamount, .grid-type .gamount { padding-right: calc(var(--depth, 0) * 1.4rem + var(--space-md)); }

  /* Header row: each column's date selector sits above its number column. */
  .grid-header { align-items: end; }
  .grid-header .gcell { padding-bottom: 0.4rem; }
  .gh-lead { align-items: flex-end; }
  .gh-col { display: flex; justify-content: flex-end; }
  /* Column header: a ☰ control gutter on the left + the stacked date field(s). */
  .colhdr { display: flex; flex-direction: row; align-items: flex-start; gap: 0.3rem; padding-right: var(--space-md); min-width: 8rem; }
  .col-dates { display: flex; flex-direction: column; gap: 0.1rem; flex: 1; min-width: 0; }
  .date-cell { display: flex; flex-direction: column; gap: 0.1rem; }
  .date-cell .basis-select { width: 100%; max-width: none; }
  .date-cell input[type="date"] { width: 100%; box-sizing: border-box; padding: 0.15rem 0.3rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-primary); font-size: 0.8rem; }
  .date-cell .resolved-date { text-align: right; }

  .col-ctrl { position: relative; flex-shrink: 0; }
  .col-ham {
    background: none; border: none; cursor: pointer; color: var(--text-muted);
    font-size: 0.85rem; line-height: 1; padding: 0.15rem 0.15rem; border-radius: var(--radius-sm);
  }
  .col-ham:hover, .col-ctrl:has(.col-menu) .col-ham { color: var(--text-primary); background: var(--bg-hover); }
  .col-menu { top: calc(100% + 2px); left: 0; min-width: 12rem; }

  /* Variance (Δ) header + cells */
  .gh-var { display: flex; justify-content: flex-end; align-items: flex-end; color: var(--text-muted); font-weight: 700; padding-right: var(--space-md); }
  .gv { color: var(--text-secondary); }
  .gv.up { color: var(--success, #22a06b); }
  .gv.down { color: var(--danger, #d1493f); }

  /* Type header rows */
  .grid-type { background: var(--bg-secondary); border-left: 4px solid var(--type-color); font-weight: 600; margin-top: var(--space-md); }
  .grid-type .type-icon { font-size: 1.05rem; }
  .grid-type .type-name { flex: 1; }
  .grid-type .gamount { padding-top: 0.4rem; padding-bottom: 0.4rem; font-size: 0.95rem; }

  /* Body rows */
  .grid-body { border-top: 1px solid var(--border-light); }
  .grid-body.account { color: var(--text-secondary); font-weight: 400; }
  .grid-body.group { font-weight: 600; }
  .grid-body:hover { background: var(--bg-hover); }
  .grid-body.rr-direct .rr-label { font-style: italic; color: var(--text-muted); }
  .grid-body.rr-direct .gamount { color: var(--text-muted); }

  /* Footer row (verification / net income per column) */
  .grid-foot { border-top: 2px solid var(--border-color); font-weight: 600; margin-top: var(--space-sm); }
  .grid-foot .foot-label { color: var(--text-muted); font-weight: 500; }
  .foot-cell { padding-right: var(--space-md); color: var(--success, #22a06b); white-space: nowrap; }
  .foot-cell.imbalanced, .foot-cell.negative { color: var(--danger, #f87171); }

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
  
  .mode-selector label {
    color: var(--text-muted);
    min-width: 3rem;
  }

  .mode-selector select {
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

  /* Improved contrast for disabled dropdown triggers */
  .saved-reports-btn:disabled {
    opacity: 0.6;
    color: var(--text-muted);
    border-color: rgba(255, 255, 255, 0.2);
  }
  @media (prefers-color-scheme: dark) {
    .saved-reports-btn:disabled {
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
  /* Segmented control (variance format: $ / % / Both) */
  .seg-group { display: flex; gap: 0.25rem; padding: 0.15rem 0.6rem 0.35rem; }
  .seg {
    flex: 1; padding: 0.2rem 0.4rem; font-size: 0.8rem; cursor: pointer;
    border: 1px solid var(--border-color); border-radius: var(--radius-sm);
    background: var(--bg-secondary); color: var(--text-secondary);
  }
  .seg.active { background: var(--accent-color); color: #fff; border-color: var(--accent-color); }

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

  /* Basis selector + resolved-date chip (used in the per-column date header). */
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

  /* Print / Save-as-PDF: show only the report, drop app chrome. */
  @media print {
    :global(.global-nav), :global(.ai-assistant),
    .page-header .header-controls, .toolbar, .back-link, .menu-backdrop {
      display: none !important;
    }
    .accounts-page { padding: 0; }
    .grid-row { break-inside: avoid; }
  }
  
  .loading, .empty-state {
    text-align: center;
    padding: var(--space-xl);
    color: var(--text-muted);
  }
  
  /* Name-cell controls (toggle triangle, account code, label) — used inside .gname grid cells. */
  .rr-toggle {
    background: none; border: none; cursor: pointer; color: var(--text-muted);
    width: 1rem; padding: 0; font-size: 0.7rem; flex-shrink: 0;
  }
  .rr-toggle-empty { visibility: hidden; }
  .rr-code { color: var(--text-muted); font-size: 0.8rem; font-family: var(--font-mono); flex-shrink: 0; }
  .rr-label { overflow: hidden; text-overflow: ellipsis; }
  .rr-label.link { color: inherit; text-decoration: none; }
  .rr-label.link:hover { color: var(--accent-color); text-decoration: underline; }
</style>

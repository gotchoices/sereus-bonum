<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { t } from '$lib/i18n';
  import { log } from '$lib/logger';
  import { entities } from '$lib/stores/entities';
  import { accounts, accountGroups, loadAccounts, loadAccountGroups } from '$lib/stores/accounts';
  import { getDataService, type Account, type AccountGroup, type Unit, type CostingMethod } from '$lib/data';
  import { notifyError, notifySuccess } from '$lib/stores/notifications';

  let entityId = $derived($page.params.id!);
  let entity = $derived($entities.find((e) => e.id === entityId));

  let units = $state<Unit[]>([]);
  let balances = $state<Record<string, number>>({});
  let loading = $state(true);

  // Inline editor state. `editingId` = account being edited; `adding` = the blank new-account form.
  let editingId = $state<string | null>(null);
  let adding = $state(false);
  let saving = $state(false);
  let formError = $state<string | null>(null);
  interface Form { id?: string; name: string; code: string; description: string; accountGroupId: string; parentId: string; unit: string; costingMethod: string; isActive: boolean; }
  let form = $state<Form>(blankForm());
  function blankForm(): Form {
    return { name: '', code: '', description: '', accountGroupId: '', parentId: '', unit: entity?.baseUnit ?? 'USD', costingMethod: '', isActive: true };
  }

  let lastEntity: string | null = null;
  $effect(() => {
    if (browser && entityId && entityId !== lastEntity) { lastEntity = entityId; loadAll(); }
  });
  async function loadAll() {
    loading = true;
    try {
      const ds = await getDataService();
      await Promise.all([loadAccounts(entityId), loadAccountGroups()]);
      units = await ds.getUnits();
      await reloadBalances();
    } catch (e) { notifyError(e, 'Loading accounts'); } finally { loading = false; }
  }
  async function reloadBalances() {
    const ds = await getDataService();
    const bs = await ds.getBalanceSheet(entityId);
    const m: Record<string, number> = {};
    for (const ab of bs.accountBalances) m[ab.accountId] = ab.balance;
    balances = m;
  }

  const groupsById = $derived(new Map($accountGroups.map((g) => [g.id, g])));
  const accountsById = $derived(new Map($accounts.map((a) => [a.id, a])));

  // "Where it lives": the group chain + any parent-account chain (excludes the account's own name).
  function pathOf(a: Account): string {
    const parts: string[] = [];
    const gp: string[] = [];
    let g: AccountGroup | undefined = groupsById.get(a.accountGroupId);
    while (g) { gp.unshift(g.name); g = g.parentId ? groupsById.get(g.parentId) : undefined; }
    parts.push(...gp);
    const ap: string[] = [];
    let p: Account | undefined = a.parentId ? accountsById.get(a.parentId) : undefined;
    while (p) { ap.unshift(p.name); p = p.parentId ? accountsById.get(p.parentId) : undefined; }
    parts.push(...ap);
    return parts.join(' : ');
  }
  const groupPathOf = (id: string): string => {
    const gp: string[] = [];
    let g: AccountGroup | undefined = groupsById.get(id);
    while (g) { gp.unshift(g.name); g = g.parentId ? groupsById.get(g.parentId) : undefined; }
    return gp.join(' : ');
  };

  let sortedAccounts = $derived(
    [...$accounts].sort((a, b) => pathOf(a).localeCompare(pathOf(b)) || (a.code ?? '').localeCompare(b.code ?? '') || a.name.localeCompare(b.name))
  );
  // Groups offered in the picker, ordered by type then path.
  let groupOptions = $derived(
    [...$accountGroups].map((g) => ({ id: g.id, label: groupPathOf(g.id) })).sort((a, b) => a.label.localeCompare(b.label))
  );
  // Effective group = parent's group when a parent is chosen (single-path invariant), else the picked group.
  let effectiveGroupId = $derived(form.parentId ? (accountsById.get(form.parentId)?.accountGroupId ?? '') : form.accountGroupId);

  function descendants(id: string): Set<string> {
    const kids = new Map<string, string[]>();
    for (const a of $accounts) if (a.parentId) (kids.get(a.parentId) ?? kids.set(a.parentId, []).get(a.parentId)!).push(a.id);
    const out = new Set<string>();
    const stack = [id];
    while (stack.length) { const x = stack.pop()!; for (const c of kids.get(x) ?? []) if (!out.has(c)) { out.add(c); stack.push(c); } }
    return out;
  }
  // Valid parents: any account in the entity except self + its descendants (no cycles).
  let parentOptions = $derived.by(() => {
    const exclude = form.id ? new Set([form.id, ...descendants(form.id)]) : new Set<string>();
    return sortedAccounts.filter((a) => !exclude.has(a.id)).map((a) => ({ id: a.id, label: `${a.code ? a.code + ' ' : ''}${a.name}  ·  ${pathOf(a)}` }));
  });

  function startAdd() { adding = true; editingId = null; formError = null; form = blankForm(); }
  function startEdit(a: Account) {
    adding = false; editingId = a.id; formError = null;
    form = { id: a.id, name: a.name, code: a.code ?? '', description: a.description ?? '', accountGroupId: a.accountGroupId, parentId: a.parentId ?? '', unit: a.unit, costingMethod: a.costingMethod ?? '', isActive: a.isActive };
  }
  function cancel() { adding = false; editingId = null; formError = null; }

  async function save() {
    formError = null;
    const name = form.name.trim();
    if (!name) { formError = $t('manage_accounts.err_name'); return; }
    if (form.code && $accounts.some((a) => a.id !== form.id && (a.code ?? '') === form.code)) { formError = $t('manage_accounts.err_code'); return; }
    const groupId = effectiveGroupId;
    if (!groupId) { formError = $t('manage_accounts.err_group'); return; }
    saving = true;
    try {
      const ds = await getDataService();
      if (adding) {
        await ds.createAccount({
          entityId, accountGroupId: groupId, parentId: form.parentId || undefined, code: form.code || undefined,
          name, description: form.description || undefined, unit: form.unit, costingMethod: (form.costingMethod || undefined) as CostingMethod | undefined, isActive: true,
        });
        notifySuccess($t('manage_accounts.created'));
      } else {
        const orig = accountsById.get(form.id!)!;
        if (orig.isActive && !form.isActive) {
          // Use the already-loaded balances (from getBalanceSheet's optimized JS join) — avoids
          // getAccountBalance's slow txn⋈entry JOIN on the store.
          if (Math.abs(balances[form.id!] ?? 0) > 0) { formError = $t('manage_accounts.err_retire'); saving = false; return; }
        }
        await ds.updateAccount(form.id!, {
          code: form.code || undefined, name, description: form.description || undefined,
          unit: form.unit, costingMethod: (form.costingMethod || undefined) as CostingMethod | undefined, isActive: form.isActive,
        });
        const moved = orig.accountGroupId !== groupId || (orig.parentId ?? '') !== form.parentId;
        if (moved) {
          const hasKids = $accounts.some((a) => a.parentId === form.id);
          if (hasKids && !confirm($t('manage_accounts.confirm_move'))) { saving = false; return; }
          await ds.moveAccountSubtree(form.id!, groupId, form.parentId || null);
        }
        notifySuccess($t('manage_accounts.saved'));
      }
      await loadAccounts(entityId);
      await reloadBalances();
      cancel();
    } catch (e) {
      formError = e instanceof Error ? e.message : String(e);
      notifyError(e, 'Saving account');
    } finally { saving = false; }
  }

  async function del(a: Account) {
    if (!browser || !confirm(`Delete "${a.name}"?`)) return;
    // Child guard in JS (fast). The transactions guard is left to the DB: entry.account_id → account FK
    // rejects a delete when the account has entries (an index probe — avoids the slow txn⋈entry JOIN of
    // getTransactions/getAccountBalance on the store).
    if ($accounts.some((x) => x.parentId === a.id)) { notifyError(new Error($t('manage_accounts.err_children'))); return; }
    try {
      const ds = await getDataService();
      await ds.deleteAccount(a.id);
      await loadAccounts(entityId);
      cancel();
      notifySuccess($t('manage_accounts.deleted'));
    } catch {
      notifyError(new Error($t('manage_accounts.err_txns')));
    }
  }

  function fmt(cents: number, unit = 'USD'): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: unit, minimumFractionDigits: 2 }).format((cents / 100) || 0);
  }
</script>

<div class="manage-page">
  <header class="mp-header">
    <a href="/entities/{entityId}" class="back-link">← {$t('manage_accounts.back_to_reports')}</a>
    <h1>{$t('manage_accounts.title')} <span class="mp-entity">{entity?.name ?? ''}</span></h1>
    <button class="btn-primary" onclick={startAdd} disabled={adding}>＋ {$t('manage_accounts.add')}</button>
  </header>

  {#if loading}
    <div class="mp-loading">{$t('common.loading')}</div>
  {:else}
    {#if adding}
      {@render editor(true)}
    {/if}
    {#if sortedAccounts.length === 0 && !adding}
      <div class="mp-empty">{$t('manage_accounts.no_accounts')}</div>
    {:else}
      <div class="acct-list">
        {#each sortedAccounts as a (a.id)}
          <div class="acct-row" class:editing={editingId === a.id} class:retired={!a.isActive}>
            <button class="acct-main" onclick={() => (editingId === a.id ? cancel() : startEdit(a))}>
              <span class="acct-line">
                {#if a.code}<span class="acct-code">{a.code}</span>{/if}
                <span class="acct-name">{a.name}</span>
                {#if !a.isActive}<span class="acct-badge">{$t('manage_accounts.retired')}</span>{/if}
              </span>
              <span class="acct-path">{pathOf(a)}</span>
            </button>
            <span class="acct-bal">{fmt(balances[a.id] ?? 0, a.unit)}</span>
          </div>
          {#if editingId === a.id}
            {@render editor(false)}
          {/if}
        {/each}
      </div>
    {/if}
  {/if}
</div>

{#snippet editor(isNew: boolean)}
  <div class="acct-editor">
    <div class="fld"><label for="f-name">{$t('manage_accounts.name')}</label><input id="f-name" bind:value={form.name} /></div>
    <div class="fld sm"><label for="f-code">{$t('manage_accounts.code')}</label><input id="f-code" bind:value={form.code} /></div>
    <div class="fld wide"><label for="f-desc">{$t('manage_accounts.description')}</label><input id="f-desc" bind:value={form.description} /></div>
    <div class="fld"><label for="f-parent">{$t('manage_accounts.parent')}</label>
      <select id="f-parent" bind:value={form.parentId}>
        <option value="">{$t('manage_accounts.none')}</option>
        {#each parentOptions as p}<option value={p.id}>{p.label}</option>{/each}
      </select>
    </div>
    <div class="fld"><label for="f-group">{$t('manage_accounts.group')}</label>
      {#if form.parentId}
        <input id="f-group" value={groupPathOf(effectiveGroupId)} readonly title="Derived from parent account" />
      {:else}
        <select id="f-group" bind:value={form.accountGroupId}>
          <option value="" disabled>—</option>
          {#each groupOptions as g}<option value={g.id}>{g.label}</option>{/each}
        </select>
      {/if}
    </div>
    <div class="fld sm"><label for="f-unit">{$t('manage_accounts.unit')}</label>
      <select id="f-unit" bind:value={form.unit}>{#each units as u}<option value={u.code}>{u.code}</option>{/each}</select>
    </div>
    <div class="fld sm"><label for="f-cost">{$t('manage_accounts.costing')}</label>
      <select id="f-cost" bind:value={form.costingMethod}>
        <option value="">—</option><option value="FIFO">FIFO</option><option value="LIFO">LIFO</option><option value="AVERAGE">AVERAGE</option>
      </select>
    </div>
    {#if !isNew}
      <div class="fld sm"><label for="f-active">{$t('manage_accounts.status')}</label>
        <label class="chk"><input id="f-active" type="checkbox" bind:checked={form.isActive} /> {form.isActive ? $t('manage_accounts.active') : $t('manage_accounts.retired')}</label>
      </div>
    {/if}
    {#if formError}<div class="fld wide err">{formError}</div>{/if}
    <div class="editor-actions">
      {#if !isNew}<button class="btn-danger" onclick={() => del(accountsById.get(form.id!)!)}>{$t('common.delete')}</button>{/if}
      <span class="spacer"></span>
      <button class="btn-tool" onclick={cancel}>{$t('common.cancel')}</button>
      <button class="btn-primary" onclick={save} disabled={saving || !form.name.trim()}>{$t('common.save')}</button>
    </div>
  </div>
{/snippet}

<style>
  .manage-page { max-width: 900px; margin: 0 auto; }
  .mp-header { display: flex; align-items: center; gap: var(--space-md); flex-wrap: wrap; margin-bottom: var(--space-md); }
  .back-link { font-size: 0.875rem; color: var(--text-muted); text-decoration: none; }
  .back-link:hover { color: var(--accent-color); }
  .mp-header h1 { flex: 1; font-size: 1.3rem; margin: 0; }
  .mp-entity { color: var(--text-muted); font-weight: 400; }
  .mp-loading, .mp-empty { text-align: center; padding: var(--space-xl); color: var(--text-muted); }

  .acct-list { border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; background: var(--bg-card); }
  .acct-row { display: flex; align-items: center; border-top: 1px solid var(--border-light); }
  .acct-row:first-child { border-top: none; }
  .acct-row.editing { background: var(--bg-hover); }
  .acct-row.retired .acct-name { color: var(--text-muted); }
  .acct-main { flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 0.1rem; background: none; border: none; text-align: left; cursor: pointer; padding: 0.5rem var(--space-lg); min-width: 0; }
  .acct-main:hover { background: var(--bg-hover); }
  .acct-line { display: flex; align-items: center; gap: 0.4rem; }
  .acct-code { font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); }
  .acct-name { font-weight: 500; }
  .acct-badge { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--danger, #d1493f); border: 1px solid var(--danger, #d1493f); border-radius: var(--radius-sm); padding: 0 0.3rem; }
  .acct-path { font-size: 0.72rem; color: var(--text-muted); }
  .acct-bal { font-family: var(--font-mono); font-variant-numeric: tabular-nums; padding-right: var(--space-lg); white-space: nowrap; color: var(--text-secondary); }

  .acct-editor { display: flex; flex-wrap: wrap; gap: var(--space-sm) var(--space-md); padding: var(--space-md) var(--space-lg); background: var(--bg-secondary); border-top: 2px solid var(--accent-color); }
  .fld { display: flex; flex-direction: column; gap: 0.15rem; flex: 1 1 12rem; min-width: 0; }
  .fld.sm { flex: 0 0 8rem; }
  .fld.wide { flex: 1 1 100%; }
  .fld label { font-size: 0.72rem; color: var(--text-muted); }
  .fld input, .fld select { padding: 0.3rem 0.4rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-primary); color: var(--text-primary); font-size: 0.85rem; }
  .fld input[readonly] { color: var(--text-muted); background: var(--bg-secondary); }
  .fld.err { color: var(--danger, #d1493f); font-size: 0.8rem; }
  .chk { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; }
  .editor-actions { flex: 1 1 100%; display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem; }
  .editor-actions .spacer { flex: 1; }

  .btn-primary { padding: var(--space-xs) var(--space-md); border: 1px solid var(--accent-color); border-radius: var(--radius-sm); background: var(--accent-color); color: #fff; cursor: pointer; font-size: 0.875rem; }
  .btn-primary:disabled { opacity: 0.5; cursor: default; }
  .btn-tool { padding: var(--space-xs) var(--space-sm); border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 0.85rem; }
  .btn-danger { padding: var(--space-xs) var(--space-sm); border: 1px solid var(--danger, #d1493f); border-radius: var(--radius-sm); background: transparent; color: var(--danger, #d1493f); cursor: pointer; font-size: 0.85rem; }
</style>

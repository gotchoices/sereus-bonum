import { parseGnuCashXML } from './gnucash-parser';
import type {
  ParsedBooks, ParsedAccount, ImportResult, ImportOptions,
  ResolvedAccount, PreviewTransaction, PreviewEntry, MergePlan,
} from './types';
import { getDataService } from '$lib/data';
import type { AccountGroup, AccountType, Account, Transaction, Entry } from '$lib/data';
import { log } from '$lib/logger';
import * as pako from 'pako';

/**
 * Import service — parses external books and MERGES them into a target entity.
 * See design/specs/domain/import.md (Merge Model) and web/screens/import.md.
 *
 * Flow (driven by the import screen):
 *   parseFile → buildMergePlan (resolve accounts + classify transactions) → executeMerge.
 * Import is idempotent: re-importing an unchanged source writes nothing.
 */
export class ImportService {
  // ---------------------------------------------------------------------------
  // Parsing
  // ---------------------------------------------------------------------------

  async parseFile(file: File): Promise<ParsedBooks> {
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.gnucash')) return this.parseGnuCash(file);
    if (fileName.endsWith('.iif')) throw new Error('QuickBooks IIF import not yet implemented');
    throw new Error('Unsupported file type');
  }

  private async parseGnuCash(file: File): Promise<ParsedBooks> {
    log.data.info('[Import] Parsing GnuCash file:', file.name);
    const header = await this.readFileHeader(file);
    const isGzipped = header[0] === 0x1f && header[1] === 0x8b;
    let content: string;
    if (isGzipped) {
      const buffer = await file.arrayBuffer();
      content = new TextDecoder('utf-8').decode(pako.ungzip(new Uint8Array(buffer)));
    } else {
      content = await file.text();
    }
    return parseGnuCashXML(content);
  }

  private async readFileHeader(file: File): Promise<Uint8Array> {
    return new Uint8Array(await file.slice(0, 2).arrayBuffer());
  }

  // ---------------------------------------------------------------------------
  // Entity target
  // ---------------------------------------------------------------------------

  /** Create a new entity or return the chosen existing one. */
  async createOrGetEntity(options: ImportOptions, parsed: ParsedBooks): Promise<string> {
    const ds = await getDataService();
    if (options.entityId) return options.entityId;
    if (!options.entityName) throw new Error('No target entity provided');
    const baseUnit = this.pickBaseUnit(parsed);
    const entity = await ds.createEntity({
      name: options.entityName,
      baseUnit,
      description: 'Imported from GnuCash',
      fiscalYearEnd: '12-31',
    });
    log.data.info('[Import] Created entity', entity.id, 'baseUnit', baseUnit);
    return entity.id;
  }

  private pickBaseUnit(parsed: ParsedBooks): string {
    // First currency-like commodity (3-letter code), else USD.
    const cur = parsed.commodities.find((c) => /^[A-Z]{3}$/.test(c.symbol || c.id));
    return (cur?.symbol || cur?.id || 'USD').toUpperCase();
  }

  // ---------------------------------------------------------------------------
  // Merge plan: resolve accounts + classify transactions
  // ---------------------------------------------------------------------------

  /**
   * Build the merge plan (accounts + transaction dispositions) WITHOUT writing anything.
   * `targetEntityId` null → planning a brand-new entity (nothing exists yet, so everything is new);
   * the entity is created only at executeMerge time so a cancelled preview leaves no empty entity.
   */
  async buildMergePlan(parsed: ParsedBooks, targetEntityId: string | null): Promise<MergePlan> {
    const ds = await getDataService();
    const groups = await ds.getAccountGroups();
    const existingAccounts = targetEntityId ? await ds.getAccounts(targetEntityId) : [];
    const existingTxns = targetEntityId ? await ds.getTransactions(targetEntityId) : [];

    // Existing identity indexes for merge/dedup.
    const acctBySourceId = new Map<string, string>();
    const acctByName = new Map<string, string>();
    for (const a of existingAccounts) {
      if (a.sourceId) acctBySourceId.set(a.sourceId, a.id);
      acctByName.set(a.name.toLowerCase(), a.id);
    }
    const txnSourceIds = new Set<string>();
    for (const t of existingTxns) if (t.sourceId) txnSourceIds.add(t.sourceId);

    const resolved = this.resolveAccounts(parsed, groups, acctBySourceId, acctByName);
    const resolvedByGuid = new Map(resolved.map((r) => [r.sourceGuid, r]));
    const transactions = this.classifyTransactions(parsed, resolvedByGuid, txnSourceIds);

    const counts = { exists: 0, new: 0, incomplete: 0 };
    for (const t of transactions) counts[t.disposition]++;

    return { entityId: targetEntityId ?? '', resolved, transactions, counts };
  }

  /**
   * Resolve each source account. General source levels whose names match a Bonum catalog group
   * (e.g. "Fixed Assets", "Current Assets") map to that shared group and create NO account; specific
   * levels below the nearest such group become entity accounts nested via parentId (e.g.
   * `Fixed Assets:Jeppson:AOF Loan` → group "Fixed Assets", account "Jeppson" with child "AOF Loan").
   * See design/specs/domain/import.md (Account Mapping) — this preserves the source hierarchy without
   * polluting the globally-shared group catalog with per-entity names.
   */
  private resolveAccounts(
    parsed: ParsedBooks,
    groups: AccountGroup[],
    acctBySourceId: Map<string, string>,
    acctByName: Map<string, string>,
  ): ResolvedAccount[] {
    const accByGuid = new Map(parsed.accounts.map((a) => [a.guid, a]));
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const groupByName = new Map(groups.map((g) => [g.name.toLowerCase(), g]));
    const topGroupByType = new Map<AccountType, AccountGroup>();
    for (const g of groups) if (!g.parentId) topGroupByType.set(g.accountType, g);

    const parentOf = (a: ParsedAccount): ParsedAccount | undefined =>
      a.parentGuid ? accByGuid.get(a.parentGuid) : undefined;

    // Which source accounts are referenced by transaction entries, and which are ancestors of one.
    const usedGuids = new Set<string>();
    for (const t of parsed.transactions) for (const e of t.entries) usedGuids.add(e.accountGuid);
    const ancestorOfUsed = new Set<string>();
    for (const guid of usedGuids) {
      let cur = accByGuid.get(guid) && parentOf(accByGuid.get(guid)!);
      while (cur) { ancestorOfUsed.add(cur.guid); cur = parentOf(cur); }
    }

    // A source node is represented by a catalog group (not an account) only if its name matches a
    // catalog group AND it is NOT posted to directly. A node with its own postings must become an
    // account — a group can't hold a balance — otherwise it splits into a group PLUS a same-named
    // sibling account (the "Vehicles" duplicate). When it becomes an account, its children nest under
    // it as sub-accounts and its direct balance shows on the account's "(direct)" row.
    const isGroupNode = (a: ParsedAccount): boolean =>
      groupByName.has(a.name.toLowerCase()) && !usedGuids.has(a.guid);

    const groupPath = (g: AccountGroup): string => {
      const parts: string[] = [];
      let cur: AccountGroup | undefined = g;
      while (cur) { parts.unshift(cur.name); cur = cur.parentId ? groupById.get(cur.parentId) : undefined; }
      return parts.join(' : ');
    };
    const sourcePathOf = (a: ParsedAccount): string => {
      const parts: string[] = [];
      let cur: ParsedAccount | undefined = a;
      while (cur) { parts.unshift(cur.name); cur = parentOf(cur); }
      return parts.join(':');
    };

    // A source node becomes a Bonum account iff it's used, or it's a non-group intermediate that a
    // used account descends from (so the parent chain is preserved). Group nodes never do.
    const becomesAccount = (a: ParsedAccount): boolean =>
      usedGuids.has(a.guid) || (ancestorOfUsed.has(a.guid) && !isGroupNode(a));

    // Group + boundary for an account node: nearest STRICT ancestor that is a group node.
    const boundaryFor = (a: ParsedAccount): { group?: AccountGroup; boundaryGuid?: string } => {
      let cur = parentOf(a);
      while (cur) {
        if (isGroupNode(cur)) return { group: groupByName.get(cur.name.toLowerCase()), boundaryGuid: cur.guid };
        cur = parentOf(cur);
      }
      const type = mapGnuCashType(a.type);
      return { group: type ? topGroupByType.get(type) : undefined };
    };

    // Nearest strict ancestor (above a, below the group boundary) that is itself an account node.
    const parentAccountGuid = (a: ParsedAccount, boundaryGuid?: string): string | undefined => {
      let cur = parentOf(a);
      while (cur && cur.guid !== boundaryGuid) {
        if (becomesAccount(cur)) return cur.guid;
        cur = parentOf(cur);
      }
      return undefined;
    };

    return parsed.accounts.map((a): ResolvedAccount => {
      const base = {
        sourceGuid: a.guid,
        sourceName: a.name,
        sourcePath: sourcePathOf(a),
        usedInTransactions: usedGuids.has(a.guid),
      };
      // Already imported (stored source id) or same-name existing account.
      const existingId = acctBySourceId.get(a.guid) ?? acctByName.get(a.name.toLowerCase());
      if (existingId) return { ...base, disposition: 'existing', existingAccountId: existingId };
      // Group nodes / unused containers create no account.
      if (!becomesAccount(a)) return { ...base, disposition: 'skip' };
      // Create an entity account under the resolved group, nested under any intermediate parent.
      const { group, boundaryGuid } = boundaryFor(a);
      if (!group) return { ...base, disposition: 'unresolved' };
      return {
        ...base, disposition: 'create',
        targetGroupId: group.id, targetGroupPath: groupPath(group), targetAccountName: a.name,
        parentSourceGuid: parentAccountGuid(a, boundaryGuid),
      };
    });
  }

  /** Classify each source transaction against the target's current books. */
  private classifyTransactions(
    parsed: ParsedBooks,
    resolvedByGuid: Map<string, ResolvedAccount>,
    txnSourceIds: Set<string>,
  ): PreviewTransaction[] {
    return parsed.transactions.map((t): PreviewTransaction => {
      const entries: PreviewEntry[] = t.entries.map((e) => {
        const r = resolvedByGuid.get(e.accountGuid);
        return { accountGuid: e.accountGuid, accountId: r?.existingAccountId, amount: e.amount, note: e.memo };
      });
      const base = {
        sourceGuid: t.guid, date: t.date, description: t.description, reference: t.reference, entries,
      };
      if (txnSourceIds.has(t.guid)) return { ...base, disposition: 'exists' };

      // Incomplete if any account is unresolved, or the entries don't balance.
      const unresolved = t.entries.find((e) => {
        const r = resolvedByGuid.get(e.accountGuid);
        return !r || r.disposition === 'unresolved';
      });
      if (unresolved) return { ...base, disposition: 'incomplete', reason: 'An account could not be mapped' };
      const sum = t.entries.reduce((s, e) => s + e.amount, 0);
      if (Math.abs(sum) > 0.001) return { ...base, disposition: 'incomplete', reason: `Entries do not balance (off by ${sum})` };

      return { ...base, disposition: 'new' };
    });
  }

  // ---------------------------------------------------------------------------
  // Execute the merge
  // ---------------------------------------------------------------------------

  /**
   * Write the merge: create needed accounts (with source identity), then write the given
   * transactions (New + user-completed, not excluded), each stamped with its source id.
   * Writes go through a single atomic `DataService.bulkImport` (one BEGIN…COMMIT).
   */
  async executeMerge(plan: MergePlan, transactionsToWrite: PreviewTransaction[]): Promise<ImportResult> {
    const ds = await getDataService();
    const result: ImportResult = {
      entityId: plan.entityId, accountsCreated: 0, accountsMatched: 0, accountsSkipped: 0,
      transactionsImported: 0, transactionsDuplicate: plan.counts.exists, transactionsReview: [], errors: [],
    };

    const entity = await ds.getEntity(plan.entityId);
    const unit = entity?.baseUnit ?? 'USD';
    const ts = new Date().toISOString();
    const guidToId = new Map<string, string>();

    // Resolve accounts: reuse matched existing ones; pre-assign ids to all to-create accounts so
    // parentId can point at intermediate accounts created in the same batch.
    const creates = plan.resolved.filter((r) => r.disposition === 'create' && r.targetGroupId);
    for (const r of plan.resolved) {
      if (r.disposition === 'existing' && r.existingAccountId) {
        guidToId.set(r.sourceGuid, r.existingAccountId);
        result.accountsMatched++;
      } else if (r.disposition === 'skip' || r.disposition === 'unresolved') {
        result.accountsSkipped++;
      }
    }
    for (const r of creates) guidToId.set(r.sourceGuid, crypto.randomUUID());
    const created: Account[] = creates.map((r) => ({
      id: guidToId.get(r.sourceGuid)!, entityId: plan.entityId, accountGroupId: r.targetGroupId!,
      parentId: r.parentSourceGuid ? guidToId.get(r.parentSourceGuid) : undefined,
      name: r.targetAccountName ?? r.sourceName, unit, isActive: true,
      sourceId: r.sourceGuid, createdAt: ts, updatedAt: ts,
    }));
    result.accountsCreated = created.length;
    // Order parents before children so the account.parent_id FK is satisfied on insert.
    const accounts = topoSortByParent(created);
    // Force each nested account into its parent's group (single-path invariant). Seed with existing
    // accounts' groups so children of a pre-existing matched account resolve correctly.
    const seedGroups = new Map((await ds.getAccounts(plan.entityId)).map((a) => [a.id, a.accountGroupId]));
    normalizeAccountGroupsToParent(accounts, seedGroups);

    // Build the transactions + entries to write.
    const transactions: Transaction[] = [];
    const entries: Entry[] = [];
    for (const t of transactionsToWrite) {
      if (t.excluded || t.disposition === 'exists') continue;
      const mapped = t.entries.map((e) => ({ accountId: guidToId.get(e.accountGuid) ?? '', amount: e.amount, note: e.note }));
      if (mapped.some((m) => !m.accountId)) {
        result.errors.push(`Skipped transaction ${t.sourceGuid}: unmapped account`);
        continue;
      }
      const txnId = crypto.randomUUID();
      transactions.push({
        id: txnId, entityId: plan.entityId, date: t.date, memo: t.description,
        reference: t.reference, sourceId: t.sourceGuid, createdAt: ts, updatedAt: ts,
      });
      for (const m of mapped) {
        entries.push({ id: crypto.randomUUID(), transactionId: txnId, accountId: m.accountId, amount: m.amount, note: m.note });
      }
      result.transactionsImported++;
    }

    // One atomic write.
    try {
      await ds.bulkImport({ accounts, transactions, entries });
      log.data.info(`[Import] Merge complete: +${result.accountsCreated} accts, +${result.transactionsImported} txns (${result.transactionsDuplicate} already present)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.data.error('[Import] Merge failed (rolled back):', error);
      result.errors.push(message);
      result.accountsCreated = 0;
      result.transactionsImported = 0;
    }
    return result;
  }

  /**
   * Convenience wrapper (used by the current screen until the preview UI lands in M3):
   * create/get the entity, plan the merge, and write the New transactions.
   */
  async importBooks(parsed: ParsedBooks, options: ImportOptions): Promise<ImportResult> {
    const entityId = await this.createOrGetEntity(options, parsed);
    const plan = await this.buildMergePlan(parsed, entityId);
    const toWrite = plan.transactions.filter((t) => t.disposition === 'new');
    return this.executeMerge(plan, toWrite);
  }
}

/** Order accounts so each parent precedes its children (satisfies the account.parent_id FK on insert). */
export function topoSortByParent(accounts: Account[]): Account[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const out: Account[] = [];
  const seen = new Set<string>();
  const visit = (a: Account) => {
    if (seen.has(a.id)) return;
    seen.add(a.id);
    if (a.parentId && byId.has(a.parentId)) visit(byId.get(a.parentId)!);
    out.push(a);
  };
  for (const a of accounts) visit(a);
  return out;
}

/**
 * Single-path invariant: a nested account must live in its parent account's group (enforced by the
 * composite FK fk_account_parent). Given accounts in topo order (parents first), force each child into
 * its parent's group. `seedGroups` supplies groups for parents outside the set (e.g. pre-existing
 * matched accounts when merging into an entity). Mutates in place.
 */
export function normalizeAccountGroupsToParent(accounts: Account[], seedGroups?: Map<string, string>): void {
  const groupById = new Map<string, string>(seedGroups);
  for (const a of accounts) {
    if (a.parentId) {
      const parentGroup = groupById.get(a.parentId);
      if (parentGroup) a.accountGroupId = parentGroup;
    }
    groupById.set(a.id, a.accountGroupId);
  }
}

/** GnuCash account type → Bonum account type (see domain/import.md). */
function mapGnuCashType(type: string): AccountType | null {
  switch (type.toUpperCase()) {
    case 'BANK': case 'ASSET': case 'CASH': case 'STOCK': case 'MUTUAL': case 'RECEIVABLE':
      return 'ASSET';
    case 'CREDIT': case 'LIABILITY': case 'PAYABLE':
      return 'LIABILITY';
    case 'EQUITY':
      return 'EQUITY';
    case 'INCOME':
      return 'INCOME';
    case 'EXPENSE':
      return 'EXPENSE';
    default:
      return null; // ROOT and unknown types are skipped
  }
}

// Singleton instance
export const importService = new ImportService();

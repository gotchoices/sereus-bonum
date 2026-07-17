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

  async buildMergePlan(parsed: ParsedBooks, targetEntityId: string): Promise<MergePlan> {
    const ds = await getDataService();
    const groups = await ds.getAccountGroups();
    const existingAccounts = await ds.getAccounts(targetEntityId);
    const existingTxns = await ds.getTransactions(targetEntityId);

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

    return { entityId: targetEntityId, resolved, transactions, counts };
  }

  /** Resolve each source account to an existing Bonum account or a to-create target group. */
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

    const groupPath = (g: AccountGroup): string => {
      const parts: string[] = [];
      let cur: AccountGroup | undefined = g;
      while (cur) { parts.unshift(cur.name); cur = cur.parentId ? groupById.get(cur.parentId) : undefined; }
      return parts.join(' : ');
    };

    // Which source accounts are actually referenced by transaction entries.
    const usedGuids = new Set<string>();
    for (const t of parsed.transactions) for (const e of t.entries) usedGuids.add(e.accountGuid);

    const sourcePathOf = (a: ParsedAccount): string => {
      const parts: string[] = [];
      let cur: ParsedAccount | undefined = a;
      while (cur) { parts.unshift(cur.name); cur = cur.parentGuid ? accByGuid.get(cur.parentGuid) : undefined; }
      return parts.join(':');
    };

    // Nearest self-or-ancestor whose name matches a group; else type fallback.
    const groupForAccount = (a: ParsedAccount): AccountGroup | undefined => {
      let cur: ParsedAccount | undefined = a;
      while (cur) {
        const g = groupByName.get(cur.name.toLowerCase());
        if (g) return g;
        cur = cur.parentGuid ? accByGuid.get(cur.parentGuid) : undefined;
      }
      const type = mapGnuCashType(a.type);
      return type ? topGroupByType.get(type) : undefined;
    };

    return parsed.accounts.map((a): ResolvedAccount => {
      const base = {
        sourceGuid: a.guid,
        sourceName: a.name,
        sourcePath: sourcePathOf(a),
        usedInTransactions: usedGuids.has(a.guid),
      };
      // 1) already imported (stored source id), or 2) same-name existing account
      const existingId = acctBySourceId.get(a.guid) ?? acctByName.get(a.name.toLowerCase());
      if (existingId) return { ...base, disposition: 'existing', existingAccountId: existingId };
      // 3) resolve a target group to create under
      const g = groupForAccount(a);
      if (g) return { ...base, disposition: 'create', targetGroupId: g.id, targetGroupPath: groupPath(g), targetAccountName: a.name };
      return { ...base, disposition: 'unresolved' };
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
   * NOTE: writes are sequential — true atomicity needs a DataService batch/transaction API (TODO).
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

    // Build the accounts to create (used-in-transactions, not already existing).
    const accounts: Account[] = [];
    for (const r of plan.resolved) {
      if (r.disposition === 'existing' && r.existingAccountId) {
        guidToId.set(r.sourceGuid, r.existingAccountId);
        result.accountsMatched++;
      } else if (r.disposition === 'create' && r.usedInTransactions && r.targetGroupId) {
        const id = crypto.randomUUID();
        accounts.push({
          id, entityId: plan.entityId, accountGroupId: r.targetGroupId,
          name: r.targetAccountName ?? r.sourceName, unit, isActive: true,
          sourceId: r.sourceGuid, createdAt: ts, updatedAt: ts,
        });
        guidToId.set(r.sourceGuid, id);
        result.accountsCreated++;
      } else {
        result.accountsSkipped++;
      }
    }

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

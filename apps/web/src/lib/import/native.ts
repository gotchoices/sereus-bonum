// Native Bonum books dump / restore — a lossless round-trip of a single entity.
// See design/specs/domain/import.md (Native Books). Import-only (not a merge), non-interactive.

import { getDataService } from '$lib/data';
import type { Account, Transaction, Entry } from '$lib/data';

export interface BonumBooksFile {
  format: 'bonum-books';
  version: 1;
  exportedAt?: string;
  entity: {
    name: string;
    description?: string;
    baseUnit: string;
    fiscalYearEnd?: string;
    defaultCostingMethod?: 'FIFO' | 'LIFO' | 'AVERAGE';
  };
  units: Array<{ code: string; name: string; symbol?: string; unitType: string; displayDivisor: number }>;
  accounts: Array<{ ref: string; code?: string; name: string; accountGroupId: string; unit: string; parentRef?: string }>;
  transactions: Array<{
    date: string; memo?: string; reference?: string; sourceId?: string;
    entries: Array<{ accountRef: string; amount: number; note?: string }>;
  }>;
}

/** Dump an entity's full books to a native file object. */
export async function exportBooks(entityId: string): Promise<BonumBooksFile> {
  const ds = await getDataService();
  const entity = await ds.getEntity(entityId);
  if (!entity) throw new Error(`Entity ${entityId} not found`);
  const accounts = await ds.getAccounts(entityId);
  const txns = await ds.getTransactions(entityId);

  const unitCodes = new Set<string>([entity.baseUnit, ...accounts.map((a) => a.unit)]);
  const units = (await ds.getUnits())
    .filter((u) => unitCodes.has(u.code))
    .map((u) => ({ code: u.code, name: u.name, symbol: u.symbol, unitType: u.unitType, displayDivisor: u.displayDivisor }));

  const transactions: BonumBooksFile['transactions'] = [];
  for (const t of txns) {
    const es = await ds.getEntries(t.id); // NOTE: O(txns) queries — fine for dumps, optimize if needed
    transactions.push({
      date: t.date, memo: t.memo, reference: t.reference, sourceId: t.sourceId,
      entries: es.map((e) => ({ accountRef: e.accountId, amount: e.amount, note: e.note })),
    });
  }

  return {
    format: 'bonum-books', version: 1, exportedAt: new Date().toISOString(),
    entity: {
      name: entity.name, description: entity.description, baseUnit: entity.baseUnit,
      fiscalYearEnd: entity.fiscalYearEnd, defaultCostingMethod: entity.defaultCostingMethod,
    },
    units,
    accounts: accounts.map((a) => ({ ref: a.id, code: a.code, name: a.name, accountGroupId: a.accountGroupId, unit: a.unit, parentRef: a.parentId })),
    transactions,
  };
}

/** Restore a native file into a FRESH entity (new ids). Atomic bulk write. Returns the new entity id. */
export async function importNativeBooks(file: BonumBooksFile): Promise<string> {
  if (file?.format !== 'bonum-books') throw new Error('Not a Bonum books file');
  const ds = await getDataService();

  // Ensure referenced units exist.
  const existing = new Set((await ds.getUnits()).map((u) => u.code));
  for (const u of file.units) {
    if (!existing.has(u.code)) {
      await ds.createUnit({ code: u.code, name: u.name, symbol: u.symbol, unitType: u.unitType as never, displayDivisor: u.displayDivisor });
    }
  }

  const entity = await ds.createEntity({
    name: file.entity.name, description: file.entity.description, baseUnit: file.entity.baseUnit,
    fiscalYearEnd: file.entity.fiscalYearEnd, defaultCostingMethod: file.entity.defaultCostingMethod,
  });
  const ts = new Date().toISOString();

  // Accounts — assign new ids, map ref → id (parents resolved in a second pass).
  const refToId = new Map<string, string>();
  const accounts: Account[] = file.accounts.map((a) => {
    const id = crypto.randomUUID();
    refToId.set(a.ref, id);
    return {
      id, entityId: entity.id, accountGroupId: a.accountGroupId, name: a.name, code: a.code,
      unit: a.unit, isActive: true, createdAt: ts, updatedAt: ts,
    };
  });
  file.accounts.forEach((a, i) => { if (a.parentRef) accounts[i].parentId = refToId.get(a.parentRef); });

  // Transactions + entries.
  const transactions: Transaction[] = [];
  const entries: Entry[] = [];
  for (const t of file.transactions) {
    const txnId = crypto.randomUUID();
    transactions.push({ id: txnId, entityId: entity.id, date: t.date, memo: t.memo, reference: t.reference, sourceId: t.sourceId, createdAt: ts, updatedAt: ts });
    for (const e of t.entries) {
      const accountId = refToId.get(e.accountRef);
      if (!accountId) throw new Error(`Unknown account ref: ${e.accountRef}`);
      entries.push({ id: crypto.randomUUID(), transactionId: txnId, accountId, amount: e.amount, note: e.note });
    }
  }

  await ds.bulkImport({ accounts, transactions, entries });
  return entity.id;
}

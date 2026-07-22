// Quereus/Sereus implementation of DataService.
// See: design/specs/web/global/data-backend.md, design/specs/domain/interfaces.md
//
// Connection + schema live in ./db.ts (branches quereus-local IndexedDB vs quereus-p2p
// Optimystic on USE_OPTIMYSTIC). This file maps the DataService surface onto SQL over the
// Quereus Database. Schema: design/specs/domain/schema.qsql (mirrored in ./schema.qsql).
//
// STATUS: entities, units, and account groups are implemented (proof vertical). Accounts,
// transactions/entries, balances, ledger, and search are stubbed pending runtime verification
// (Track C2). Fresh-DB seeding (base units + account-group catalog) is also C2.

import type {
  DataService,
  Entity, EntityInput,
  AccountGroup, AccountGroupInput,
  Account, AccountInput,
  Transaction, TransactionInput,
  Entry, EntryInput,
  Unit, UnitInput,
  BalanceSheetData, AccountBalance, GroupBalance,
  LedgerEntry, SplitEntry, BulkImportData
} from '../types';
import type { Database, SqlValue } from '@quereus/quereus';
import { getQuereusDb, closeQuereusDb, all, get, run, uuid, nowIso } from './db';
import { log } from '$lib/logger';

const NOT_IMPLEMENTED = 'Quereus backend: method not yet implemented (Track C2)';

// --- Row mappers (snake_case columns → camelCase domain types) ------------
type Row = Record<string, any>;

function toEntity(r: Row): Entity {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    fiscalYearEnd: r.fiscal_year_end ?? undefined,
    baseUnit: r.base_unit,
    defaultCostingMethod: r.default_costing_method ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toUnit(r: Row): Unit {
  return {
    code: r.code,
    name: r.name,
    symbol: r.symbol ?? undefined,
    unitType: r.unit_type,
    displayDivisor: Number(r.display_divisor),
  };
}

function toAccountGroup(r: Row): AccountGroup {
  return {
    id: r.id,
    name: r.name,
    accountType: r.account_type,
    parentId: r.parent_id ?? undefined,
    description: r.description ?? undefined,
    displayOrder: r.display_order ?? undefined,
  };
}

function toAccount(r: Row): Account {
  return {
    id: r.id,
    entityId: r.entity_id,
    accountGroupId: r.account_group_id,
    parentId: r.parent_id ?? undefined,
    code: r.code ?? undefined,
    name: r.name,
    description: r.description ?? undefined,
    unit: r.unit,
    costingMethod: r.costing_method ?? undefined,
    closedDate: r.closed_date ?? undefined,
    partnerId: r.partner_id ?? undefined,
    linkedAccountId: r.linked_account_id ?? undefined,
    isActive: Boolean(r.is_active),
    sourceId: r.source_id ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toTransaction(r: Row): Transaction {
  return {
    id: r.id,
    entityId: r.entity_id,
    date: r.date,
    memo: r.memo ?? undefined,
    reference: r.reference ?? undefined,
    sourceId: r.source_id ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toEntry(r: Row): Entry {
  return {
    id: r.id,
    transactionId: r.txn_id,
    accountId: r.account_id,
    amount: Number(r.amount),
    note: r.note ?? undefined,
    tagId: r.tag_id ?? undefined,
    reconciliationId: r.reconciliation_id ?? undefined,
  };
}

const TYPE_NAMES: Record<string, string> = {
  ASSET: 'Assets', LIABILITY: 'Liabilities', EQUITY: 'Equity', INCOME: 'Income', EXPENSE: 'Expenses',
};
function pathFor(accountType: string, groupName: string, accountName: string): string {
  return `${TYPE_NAMES[accountType] ?? accountType} : ${groupName} : ${accountName}`;
}

class QuereusDataService implements DataService {
  private db: Database | null = null;

  async initialize(): Promise<void> {
    this.db = await getQuereusDb();
  }

  async close(): Promise<void> {
    await closeQuereusDb();
    this.db = null;
  }

  private getDb(): Database {
    if (!this.db) throw new Error('Quereus backend not initialized. Call initialize() first.');
    return this.db;
  }

  // ===========================================================================
  // Entities
  // ===========================================================================

  async getEntities(): Promise<Entity[]> {
    const rows = await all<Row>(this.getDb(), 'SELECT * FROM entity ORDER BY name');
    return rows.map(toEntity);
  }

  async getEntity(id: string): Promise<Entity | null> {
    const row = await get<Row>(this.getDb(), 'SELECT * FROM entity WHERE id = ?', [id]);
    return row ? toEntity(row) : null;
  }

  async createEntity(data: EntityInput): Promise<Entity> {
    const id = uuid();
    const ts = nowIso();
    await run(this.getDb(),
      `INSERT INTO entity (id, name, description, fiscal_year_end, base_unit, default_costing_method, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.description ?? null, data.fiscalYearEnd ?? null, data.baseUnit,
        data.defaultCostingMethod ?? null, ts, ts]);
    return { id, ...data, createdAt: ts, updatedAt: ts };
  }

  async updateEntity(id: string, data: Partial<EntityInput>): Promise<Entity> {
    const cols: Record<string, string> = {
      name: 'name', description: 'description', fiscalYearEnd: 'fiscal_year_end',
      baseUnit: 'base_unit', defaultCostingMethod: 'default_costing_method',
    };
    const sets: string[] = [];
    const vals: SqlValue[] = [];
    for (const [key, col] of Object.entries(cols)) {
      if (key in data) { sets.push(`${col} = ?`); vals.push((data as Row)[key] ?? null); }
    }
    sets.push('updated_at = ?');
    vals.push(nowIso(), id);
    await run(this.getDb(), `UPDATE entity SET ${sets.join(', ')} WHERE id = ?`, vals);
    const updated = await this.getEntity(id);
    if (!updated) throw new Error(`Entity ${id} not found after update`);
    return updated;
  }

  async deleteEntity(id: string): Promise<void> {
    // Manual cascade (Quereus has no ON DELETE CASCADE): entries → txns → accounts → entity.
    //
    // Two Quereus/store perf gaps shape this (both filed under tmp/):
    //  1. FK RESTRICT enforcement on DELETE costs ~35ms per deleted parent row on the IndexedDB store —
    //     even with the child FK column indexed (idx_entry_txn etc.) and the check matching nothing.
    //     (The same schema in-memory is ~0.5ms/row: the index IS used; the store's per-row referential
    //     probe just isn't batched.) Deleting a 1k-txn entity took ~49s. Since we cascade manually in
    //     child→parent order, FK checks are redundant here — disable them for the batch (standard SQL
    //     idiom for bulk cascade). This is the ~30x win. See tmp/quereus-fk-delete-perf.md.
    //  2. `DELETE … WHERE txn_id IN (SELECT …)` re-executes the subquery per row. We delete entries via a
    //     materialized account_id IN list instead. See tmp/quereus-delete-subquery-perf.md.
    const db = this.getDb();
    await run(db, 'PRAGMA foreign_keys = off');
    const acctIds = (await all<{ id: string }>(db, 'SELECT id FROM account WHERE entity_id = ?', [id])).map((r) => r.id);
    await run(db, 'BEGIN');
    try {
      for (let i = 0; i < acctIds.length; i += 200) {
        const chunk = acctIds.slice(i, i + 200);
        await run(db, `DELETE FROM entry WHERE account_id IN (${chunk.map(() => '?').join(',')})`, chunk);
      }
      await run(db, 'DELETE FROM txn WHERE entity_id = ?', [id]);
      await run(db, 'DELETE FROM account WHERE entity_id = ?', [id]);
      await run(db, 'DELETE FROM entity WHERE id = ?', [id]);
      await run(db, 'COMMIT');
    } catch (e) {
      try { await run(db, 'ROLLBACK'); } catch { /* ignore */ }
      throw e;
    } finally {
      try { await run(db, 'PRAGMA foreign_keys = on'); } catch { /* ignore */ }
    }
  }

  // ===========================================================================
  // Account Groups
  // ===========================================================================

  async getAccountGroups(): Promise<AccountGroup[]> {
    const rows = await all<Row>(this.getDb(), 'SELECT * FROM account_group ORDER BY display_order, name');
    return rows.map(toAccountGroup);
  }

  async getAccountGroup(id: string): Promise<AccountGroup | null> {
    const row = await get<Row>(this.getDb(), 'SELECT * FROM account_group WHERE id = ?', [id]);
    return row ? toAccountGroup(row) : null;
  }

  async createAccountGroup(data: AccountGroupInput): Promise<AccountGroup> {
    const id = uuid();
    await run(this.getDb(),
      `INSERT INTO account_group (id, name, account_type, parent_id, description, display_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.accountType, data.parentId ?? null, data.description ?? null, data.displayOrder ?? null]);
    return { id, ...data };
  }

  async updateAccountGroup(id: string, data: Partial<AccountGroupInput>): Promise<AccountGroup> {
    const cols: Record<string, string> = {
      name: 'name', description: 'description', displayOrder: 'display_order',
    };
    const sets: string[] = [];
    const vals: SqlValue[] = [];
    for (const [key, col] of Object.entries(cols)) {
      if (key in data) { sets.push(`${col} = ?`); vals.push((data as Row)[key] ?? null); }
    }
    if (sets.length === 0) {
      const existing = await this.getAccountGroup(id);
      if (!existing) throw new Error(`Account group ${id} not found`);
      return existing;
    }
    vals.push(id);
    await run(this.getDb(), `UPDATE account_group SET ${sets.join(', ')} WHERE id = ?`, vals);
    const updated = await this.getAccountGroup(id);
    if (!updated) throw new Error(`Account group ${id} not found after update`);
    return updated;
  }

  async deleteAccountGroup(id: string): Promise<void> {
    await run(this.getDb(), 'DELETE FROM account_group WHERE id = ?', [id]);
  }

  // ===========================================================================
  // Units
  // ===========================================================================

  async getUnits(): Promise<Unit[]> {
    const rows = await all<Row>(this.getDb(), 'SELECT * FROM unit ORDER BY code');
    return rows.map(toUnit);
  }

  async getUnit(code: string): Promise<Unit | null> {
    const row = await get<Row>(this.getDb(), 'SELECT * FROM unit WHERE code = ?', [code]);
    return row ? toUnit(row) : null;
  }

  async createUnit(data: UnitInput): Promise<Unit> {
    await run(this.getDb(),
      `INSERT INTO unit (code, name, symbol, unit_type, display_divisor) VALUES (?, ?, ?, ?, ?)`,
      [data.code, data.name, data.symbol ?? null, data.unitType, data.displayDivisor]);
    return { ...data };
  }

  async updateUnit(code: string, data: Partial<UnitInput>): Promise<Unit> {
    const cols: Record<string, string> = {
      name: 'name', symbol: 'symbol', unitType: 'unit_type', displayDivisor: 'display_divisor',
    };
    const sets: string[] = [];
    const vals: SqlValue[] = [];
    for (const [key, col] of Object.entries(cols)) {
      if (key in data) { sets.push(`${col} = ?`); vals.push((data as Row)[key] ?? null); }
    }
    if (sets.length > 0) {
      vals.push(code);
      await run(this.getDb(), `UPDATE unit SET ${sets.join(', ')} WHERE code = ?`, vals);
    }
    const updated = await this.getUnit(code);
    if (!updated) throw new Error(`Unit ${code} not found after update`);
    return updated;
  }

  // ===========================================================================
  // Accounts
  // ===========================================================================

  async getAccounts(entityId: string): Promise<Account[]> {
    const rows = await all<Row>(this.getDb(),
      'SELECT * FROM account WHERE entity_id = ? ORDER BY code, name', [entityId]);
    return rows.map(toAccount);
  }

  async getAccount(id: string): Promise<Account | null> {
    const row = await get<Row>(this.getDb(), 'SELECT * FROM account WHERE id = ?', [id]);
    return row ? toAccount(row) : null;
  }

  async createAccount(data: AccountInput): Promise<Account> {
    const id = uuid();
    const ts = nowIso();
    await run(this.getDb(),
      `INSERT INTO account (id, entity_id, account_group_id, parent_id, code, name, description,
        unit, costing_method, closed_date, partner_id, linked_account_id, is_active, source_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.entityId, data.accountGroupId, data.parentId ?? null, data.code ?? null, data.name,
        data.description ?? null, data.unit, data.costingMethod ?? null, data.closedDate ?? null,
        data.partnerId ?? null, data.linkedAccountId ?? null, data.isActive ? 1 : 0, data.sourceId ?? null, ts, ts]);
    return (await this.getAccount(id))!;
  }

  async updateAccount(id: string, data: Partial<AccountInput>): Promise<Account> {
    const cols: Record<string, string> = {
      accountGroupId: 'account_group_id', parentId: 'parent_id', code: 'code', name: 'name',
      description: 'description', unit: 'unit', costingMethod: 'costing_method', closedDate: 'closed_date',
      partnerId: 'partner_id', linkedAccountId: 'linked_account_id',
    };
    const sets: string[] = [];
    const vals: SqlValue[] = [];
    for (const [key, col] of Object.entries(cols)) {
      if (key in data) { sets.push(`${col} = ?`); vals.push((data as Row)[key] ?? null); }
    }
    if ('isActive' in data) { sets.push('is_active = ?'); vals.push(data.isActive ? 1 : 0); }
    sets.push('updated_at = ?');
    vals.push(nowIso(), id);
    await run(this.getDb(), `UPDATE account SET ${sets.join(', ')} WHERE id = ?`, vals);
    return (await this.getAccount(id))!;
  }

  async deleteAccount(id: string): Promise<void> {
    await run(this.getDb(), 'DELETE FROM account WHERE id = ?', [id]);
  }

  // Move an account (and its subtree) to a new group / parent. The composite FK (child.group must equal
  // parent.group) makes any per-row order invalid mid-move, so — like the manual cascade in deleteEntity —
  // we disable FK enforcement for the batch (all descendants get the new group; the root also gets the new
  // parent). See tmp/quereus-fk-delete-perf.md for the FK-on-the-store rationale.
  async moveAccountSubtree(rootId: string, newGroupId: string, newParentId: string | null): Promise<void> {
    const db = this.getDb();
    const root = await this.getAccount(rootId);
    if (!root) return;
    const rows = await all<{ id: string; parent_id: string | null }>(db,
      'SELECT id, parent_id FROM account WHERE entity_id = ?', [root.entityId]);
    const kids = new Map<string, string[]>();
    for (const a of rows) if (a.parent_id) (kids.get(a.parent_id) ?? kids.set(a.parent_id, []).get(a.parent_id)!).push(a.id);
    const subtree: string[] = [];
    const stack = [rootId];
    while (stack.length) { const x = stack.pop()!; subtree.push(x); for (const c of kids.get(x) ?? []) stack.push(c); }
    const descendants = subtree.filter((x) => x !== rootId);
    const ts = nowIso();
    await run(db, 'PRAGMA foreign_keys = off');
    await run(db, 'BEGIN');
    try {
      await run(db, 'UPDATE account SET account_group_id = ?, parent_id = ?, updated_at = ? WHERE id = ?',
        [newGroupId, newParentId, ts, rootId]);
      for (let i = 0; i < descendants.length; i += 200) {
        const chunk = descendants.slice(i, i + 200);
        await run(db, `UPDATE account SET account_group_id = ?, updated_at = ? WHERE id IN (${chunk.map(() => '?').join(',')})`,
          [newGroupId, ts, ...chunk]);
      }
      await run(db, 'COMMIT');
    } catch (e) {
      try { await run(db, 'ROLLBACK'); } catch { /* ignore */ }
      throw e;
    } finally {
      try { await run(db, 'PRAGMA foreign_keys = on'); } catch { /* ignore */ }
    }
  }

  // ===========================================================================
  // Transactions & Entries
  // ===========================================================================

  async getTransactions(entityId: string, options?: {
    accountId?: string; startDate?: string; endDate?: string; limit?: number;
  }): Promise<Transaction[]> {
    let sql = 'SELECT DISTINCT t.id, t.entity_id, t.date, t.memo, t.reference, t.created_at, t.updated_at FROM txn t';
    const params: SqlValue[] = [entityId];
    const conds = ['t.entity_id = ?'];
    if (options?.accountId) { sql += ' JOIN entry e ON e.txn_id = t.id'; conds.push('e.account_id = ?'); params.push(options.accountId); }
    if (options?.startDate) { conds.push('t.date >= ?'); params.push(options.startDate); }
    if (options?.endDate) { conds.push('t.date <= ?'); params.push(options.endDate); }
    sql += ` WHERE ${conds.join(' AND ')} ORDER BY t.date DESC, t.created_at DESC`;
    if (options?.limit) { sql += ' LIMIT ?'; params.push(options.limit); }
    const rows = await all<Row>(this.getDb(), sql, params);
    return rows.map(toTransaction);
  }

  async getTransaction(id: string): Promise<Transaction | null> {
    const row = await get<Row>(this.getDb(), 'SELECT * FROM txn WHERE id = ?', [id]);
    return row ? toTransaction(row) : null;
  }

  async createTransaction(data: TransactionInput, entries: EntryInput[]): Promise<Transaction> {
    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    if (Math.abs(total) > 0.001) throw new Error(`Transaction entries do not balance: ${total}`);
    const db = this.getDb();
    const id = uuid();
    const ts = nowIso();
    await run(db, 'INSERT INTO txn (id, entity_id, date, memo, reference, source_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.entityId, data.date, data.memo ?? null, data.reference ?? null, data.sourceId ?? null, ts, ts]);
    for (const e of entries) {
      await run(db, 'INSERT INTO entry (id, txn_id, account_id, amount, note, tag_id, reconciliation_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uuid(), id, e.accountId, e.amount, e.note ?? null, e.tagId ?? null, e.reconciliationId ?? null]);
    }
    return (await this.getTransaction(id))!;
  }

  async updateTransaction(id: string, data: Partial<TransactionInput>, entries?: EntryInput[]): Promise<Transaction> {
    if (entries) {
      const total = entries.reduce((sum, e) => sum + e.amount, 0);
      if (Math.abs(total) > 0.001) throw new Error(`Transaction entries do not balance: ${total}`);
    }
    const cols: Record<string, string> = { date: 'date', memo: 'memo', reference: 'reference' };
    const sets: string[] = [];
    const vals: SqlValue[] = [];
    for (const [key, col] of Object.entries(cols)) {
      if (key in data) { sets.push(`${col} = ?`); vals.push((data as Row)[key] ?? null); }
    }
    sets.push('updated_at = ?');
    vals.push(nowIso());

    const db = this.getDb();
    await run(db, 'BEGIN');
    try {
      await run(db, `UPDATE txn SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
      if (entries) {
        // Replace the transaction's entries wholesale (simplest correct edit).
        await run(db, 'DELETE FROM entry WHERE txn_id = ?', [id]);
        for (const e of entries) {
          await run(db, 'INSERT INTO entry (id, txn_id, account_id, amount, note, tag_id, reconciliation_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuid(), id, e.accountId, e.amount, e.note ?? null, e.tagId ?? null, e.reconciliationId ?? null]);
        }
      }
      await run(db, 'COMMIT');
    } catch (err) {
      try { await run(db, 'ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
    return (await this.getTransaction(id))!;
  }

  async deleteTransaction(id: string): Promise<void> {
    // Manual cascade (no ON DELETE CASCADE): entries first, then the transaction.
    const db = this.getDb();
    await run(db, 'DELETE FROM entry WHERE txn_id = ?', [id]);
    await run(db, 'DELETE FROM txn WHERE id = ?', [id]);
  }

  async getEntries(transactionId: string): Promise<Entry[]> {
    const rows = await all<Row>(this.getDb(), 'SELECT * FROM entry WHERE txn_id = ?', [transactionId]);
    return rows.map(toEntry);
  }

  async getEntriesForAccount(accountId: string, options?: {
    startDate?: string; endDate?: string; unreconciled?: boolean;
  }): Promise<Entry[]> {
    let sql = 'SELECT e.* FROM entry e JOIN txn t ON t.id = e.txn_id WHERE e.account_id = ?';
    const params: SqlValue[] = [accountId];
    if (options?.startDate) { sql += ' AND t.date >= ?'; params.push(options.startDate); }
    if (options?.endDate) { sql += ' AND t.date <= ?'; params.push(options.endDate); }
    if (options?.unreconciled) { sql += ' AND e.reconciliation_id IS NULL'; }
    sql += ' ORDER BY t.date';
    const rows = await all<Row>(this.getDb(), sql, params);
    return rows.map(toEntry);
  }

  // ===========================================================================
  // Balances
  // ===========================================================================

  async getAccountBalance(accountId: string, asOf?: string): Promise<number> {
    let sql = 'SELECT COALESCE(SUM(e.amount), 0) as balance FROM entry e JOIN txn t ON t.id = e.txn_id WHERE e.account_id = ?';
    const params: SqlValue[] = [accountId];
    if (asOf) { sql += ' AND t.date <= ?'; params.push(asOf); }
    const row = await get<Row>(this.getDb(), sql, params);
    return row ? Number(row.balance) : 0;
  }

  // Aggregation done in JS (avoids Quereus GROUP BY quirks).
  async getBalanceSheet(entityId: string, endDate?: string, startDate?: string): Promise<BalanceSheetData> {
    const end = endDate || new Date().toISOString().split('T')[0];
    const db = this.getDb();
    const tA = performance.now();
    const accts = await all<Row>(db,
      `SELECT a.id, a.name, a.code, a.unit, g.id as group_id, g.name as group_name,
              g.account_type, g.display_order
       FROM account a JOIN account_group g ON g.id = a.account_group_id
       WHERE a.entity_id = ? AND a.is_active = 1
       ORDER BY g.display_order, a.code`, [entityId]);
    const tB = performance.now();
    // Two single-table reads (each index-eligible), joined in JS — avoids the
    // per-row async nested-loop that a SQL JOIN incurs on the IndexedDB store
    // (a 3-way JOIN here measured ~140x slower than this at 1k txns).
    const txns = await all<Row>(db,
      `SELECT id, date FROM txn WHERE entity_id = ? AND date <= ?`, [entityId, end]);
    const tB2 = performance.now();
    const dateByTxn = new Map<string, string>(txns.map((r) => [r.id, r.date]));
    const acctIds = accts.map((a) => a.id);
    const placeholders = acctIds.map(() => '?').join(',');
    const rawEntries = acctIds.length
      ? await all<Row>(db,
          `SELECT account_id, amount, txn_id FROM entry WHERE account_id IN (${placeholders})`,
          acctIds)
      : [];
    const tC = performance.now();
    const entries = rawEntries
      .filter((e) => dateByTxn.has(e.txn_id))
      .map((e) => ({ account_id: e.account_id, amount: e.amount, date: dateByTxn.get(e.txn_id)! }));
    log.data.debug(`[BalanceSheet] accts=${accts.length} (${(tB - tA).toFixed(0)}ms) txns=${txns.length} (${(tB2 - tB).toFixed(0)}ms) rawEntries=${rawEntries.length} (${(tC - tB2).toFixed(0)}ms) → entries=${entries.length}`);

    const typeByAccount = new Map<string, string>(accts.map((a) => [a.id, a.account_type]));
    const balByAccount = new Map<string, number>();
    for (const e of entries) {
      const t = typeByAccount.get(e.account_id);
      // A/L/E: cumulative through end. I/E: whole period through end, or [start,end] if start given.
      if ((t === 'INCOME' || t === 'EXPENSE') && startDate && !(e.date >= startDate && e.date <= end)) continue;
      balByAccount.set(e.account_id, (balByAccount.get(e.account_id) ?? 0) + Number(e.amount));
    }

    const accountBalances: AccountBalance[] = [];
    const groupTotals = new Map<string, GroupBalance>();
    let totalAssets = 0, totalLiabilities = 0, totalEquity = 0, totalIncome = 0, totalExpense = 0;
    for (const a of accts) {
      const balance = balByAccount.get(a.id) ?? 0;
      accountBalances.push({
        accountId: a.id, accountName: a.name, accountCode: a.code ?? undefined,
        groupId: a.group_id, groupName: a.group_name, accountType: a.account_type, balance, unit: a.unit,
      });
      if (!groupTotals.has(a.group_id)) {
        groupTotals.set(a.group_id, { groupId: a.group_id, groupName: a.group_name, accountType: a.account_type, balance: 0 });
      }
      groupTotals.get(a.group_id)!.balance += balance;
      switch (a.account_type) {
        case 'ASSET': totalAssets += balance; break;
        case 'LIABILITY': totalLiabilities += balance; break;
        case 'EQUITY': totalEquity += balance; break;
        case 'INCOME': totalIncome += balance; break;
        case 'EXPENSE': totalExpense += balance; break;
      }
    }
    // Present credit-normal totals by NEGATING the signed sum (not Math.abs): abs is only correct when
    // a total has its usual sign, but equity/liabilities/income can legitimately be net-debit (e.g. a
    // debit-heavy equity account or an accumulated deficit). Negation keeps the balance-sheet identity
    // Assets = -(Liabilities + Equity + Income + Expense_signed) exact in every case.
    return {
      entityId, endDate: end, startDate: startDate || undefined,
      netWorth: totalAssets + totalLiabilities,
      totalAssets,
      totalLiabilities: -totalLiabilities,
      totalEquity: -totalEquity,
      totalIncome: -totalIncome,
      totalExpense,
      groupBalances: Array.from(groupTotals.values()),
      accountBalances,
    };
  }

  // ===========================================================================
  // Ledger view
  // ===========================================================================

  // JS-side joins over single-table indexed reads — SQL JOINs on the store are O(n²) (see
  // tmp/quereus-join-index-perf.md). Loads the entity's entries once and resolves offset/split
  // siblings in memory instead of an N+1 per-row lookup.
  async getLedgerEntries(accountId: string, options?: {
    startDate?: string; endDate?: string; limit?: number; sortOrder?: 'oldest' | 'newest';
  }): Promise<LedgerEntry[]> {
    const db = this.getDb();
    const acct = await get<Row>(db, 'SELECT entity_id FROM account WHERE id = ?', [accountId]);
    if (!acct) return [];
    const entityId = acct.entity_id as string;

    const acctDir = await this.buildAccountDir(entityId);
    const txnRows = await all<Row>(db, 'SELECT id, date, reference, memo, created_at FROM txn WHERE entity_id = ?', [entityId]);
    const txnById = new Map<string, Row>(txnRows.map((t) => [t.id, t]));
    const byTxn = await this.entriesByTxn(txnById);

    // This account's own entries, decorated with txn fields; filter by date; sort; limit.
    let own: Array<{ e: Row; t: Row }> = [];
    for (const arr of byTxn.values()) {
      for (const e of arr) {
        if (e.account_id !== accountId) continue;
        const t = txnById.get(e.txn_id)!;
        if (options?.startDate && t.date < options.startDate) continue;
        if (options?.endDate && t.date > options.endDate) continue;
        own.push({ e, t });
      }
    }
    const dir = options?.sortOrder === 'newest' ? -1 : 1;
    own.sort((a, b) => {
      if (a.t.date !== b.t.date) return (a.t.date < b.t.date ? -1 : 1) * dir;
      const ca = a.t.created_at ?? '', cb = b.t.created_at ?? '';
      if (ca !== cb) return (ca < cb ? -1 : 1) * dir;
      return 0;
    });
    if (options?.limit) own = own.slice(0, options.limit);

    const result: LedgerEntry[] = [];
    let running = 0;
    for (const { e, t } of own) {
      const amount = Number(e.amount);
      running += amount;
      const group = byTxn.get(e.txn_id) ?? [];
      const isSplit = group.length > 2;
      const le: LedgerEntry = {
        entryId: e.id, transactionId: e.txn_id, date: t.date,
        reference: t.reference ?? undefined, memo: t.memo ?? undefined,
        accountId, amount, note: e.note ?? undefined, runningBalance: running, isSplit,
      };
      const siblings = group.filter((s) => s.id !== e.id);
      if (isSplit) {
        le.splitEntries = siblings
          .sort((x, y) => Number(y.amount) - Number(x.amount))
          .map((s) => this.toSplit(s, acctDir));
      } else if (siblings[0]) {
        const d = acctDir.get(siblings[0].account_id);
        le.offsetAccountId = siblings[0].account_id;
        le.offsetAccountName = d?.name;
        le.offsetAccountPath = d?.path;
      }
      result.push(le);
    }
    return result;
  }

  // accountId → {name, path, code, entityId} built from two single-table reads (no SQL join).
  private async buildAccountDir(entityId?: string): Promise<Map<string, { name: string; path: string; code?: string; entityId: string }>> {
    const db = this.getDb();
    const accts = entityId
      ? await all<Row>(db, 'SELECT id, name, code, account_group_id, entity_id FROM account WHERE entity_id = ?', [entityId])
      : await all<Row>(db, 'SELECT id, name, code, account_group_id, entity_id FROM account');
    const groups = await all<Row>(db, 'SELECT id, name, account_type FROM account_group');
    const gById = new Map<string, Row>(groups.map((g) => [g.id, g]));
    const dir = new Map<string, { name: string; path: string; code?: string; entityId: string }>();
    for (const a of accts) {
      const g = gById.get(a.account_group_id);
      dir.set(a.id, {
        name: a.name,
        path: g ? pathFor(g.account_type, g.name, a.name) : a.name,
        code: a.code ?? undefined,
        entityId: a.entity_id,
      });
    }
    return dir;
  }

  // Full single-table entry scan grouped by txn; keeps only txns present in txnById (the target scope).
  private async entriesByTxn(txnById: Map<string, Row>): Promise<Map<string, Row[]>> {
    const rows = await all<Row>(this.getDb(), 'SELECT id, txn_id, account_id, amount, note FROM entry');
    const byTxn = new Map<string, Row[]>();
    for (const e of rows) {
      if (!txnById.has(e.txn_id)) continue;
      let arr = byTxn.get(e.txn_id);
      if (!arr) { arr = []; byTxn.set(e.txn_id, arr); }
      arr.push(e);
    }
    return byTxn;
  }

  private toSplit(s: Row, acctDir: Map<string, { name: string; path: string }>): SplitEntry {
    const d = acctDir.get(s.account_id);
    return {
      entryId: s.id, accountId: s.account_id, accountName: d?.name ?? s.account_id,
      accountPath: d?.path ?? '', amount: Number(s.amount), note: s.note ?? undefined,
    };
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  async searchAccounts(entityId: string, query: string): Promise<Array<{
    id: string; name: string; path: string; code?: string;
  }>> {
    const q = query.toLowerCase();
    const db = this.getDb();
    // Two single-table reads joined in JS (no SQL join — see tmp/quereus-join-index-perf.md).
    const accts = await all<Row>(db,
      'SELECT id, name, code, account_group_id FROM account WHERE entity_id = ? AND is_active = 1', [entityId]);
    const groups = await all<Row>(db, 'SELECT id, name, account_type, display_order FROM account_group');
    const gById = new Map<string, Row>(groups.map((g) => [g.id, g]));
    accts.sort((a, b) => {
      const ga = gById.get(a.account_group_id), gb = gById.get(b.account_group_id);
      const oa = ga?.display_order ?? 0, ob = gb?.display_order ?? 0;
      if (oa !== ob) return oa - ob;
      return (a.code ?? '').localeCompare(b.code ?? '') || a.name.localeCompare(b.name);
    });
    const results: Array<{ id: string; name: string; path: string; code?: string }> = [];
    for (const a of accts) {
      const g = gById.get(a.account_group_id);
      const groupName = g?.name ?? '';
      const path = g ? pathFor(g.account_type, g.name, a.name) : a.name;
      const code: string | undefined = a.code ?? undefined;
      if (a.name.toLowerCase().includes(q) || groupName.toLowerCase().includes(q) ||
          path.toLowerCase().includes(q) || (code && code.toLowerCase().includes(q))) {
        results.push({ id: a.id, name: a.name, path, code });
      }
    }
    results.sort((a, b) => {
      const ap = a.path.toLowerCase(), bp = b.path.toLowerCase();
      const an = a.name.toLowerCase(), bn = b.name.toLowerCase();
      if (an === q) return -1; if (bn === q) return 1;
      if (ap.startsWith(q) && !bp.startsWith(q)) return -1;
      if (!ap.startsWith(q) && bp.startsWith(q)) return 1;
      if (an.startsWith(q) && !bn.startsWith(q)) return -1;
      if (!an.startsWith(q) && bn.startsWith(q)) return 1;
      return 0;
    });
    return results;
  }

  // Cross-entity ledger for the search browser. JS-side joins over single-table reads (the 5-way SQL
  // JOIN + N+1 here was the worst offender at scale — see tmp/quereus-join-index-perf.md).
  async getAllTransactions(): Promise<LedgerEntry[]> {
    const db = this.getDb();
    const entities = await all<Row>(db, 'SELECT id, name FROM entity');
    const entName = new Map<string, string>(entities.map((e) => [e.id, e.name]));
    const acctDir = await this.buildAccountDir();
    const txnRows = await all<Row>(db, 'SELECT id, date, reference, memo, created_at FROM txn');
    const txnById = new Map<string, Row>(txnRows.map((t) => [t.id, t]));
    const byTxn = await this.entriesByTxn(txnById);

    // Flatten to entries, ordered date DESC, created_at DESC, entry id ASC (matches prior behavior).
    const ordered: Row[] = [];
    for (const arr of byTxn.values()) ordered.push(...arr);
    ordered.sort((a, b) => {
      const ta = txnById.get(a.txn_id)!, tb = txnById.get(b.txn_id)!;
      if (ta.date !== tb.date) return ta.date < tb.date ? 1 : -1;
      const ca = ta.created_at ?? '', cb = tb.created_at ?? '';
      if (ca !== cb) return ca < cb ? 1 : -1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    const result: LedgerEntry[] = [];
    const processedTxns = new Set<string>();
    for (const e of ordered) {
      const t = txnById.get(e.txn_id)!;
      const group = byTxn.get(e.txn_id) ?? [];
      const isSplit = group.length > 2;
      const d = acctDir.get(e.account_id);
      const le = {
        entryId: e.id, transactionId: e.txn_id, date: t.date,
        reference: t.reference ?? undefined, memo: t.memo ?? undefined,
        accountId: e.account_id, amount: Number(e.amount), note: e.note ?? undefined,
        runningBalance: 0, isSplit,
      } as LedgerEntry & { entityId?: string; entityName?: string; accountName?: string; accountPath?: string };

      if (!processedTxns.has(e.txn_id)) {
        processedTxns.add(e.txn_id);
        const siblings = group.filter((s) => s.id !== e.id);
        if (isSplit) {
          le.splitEntries = siblings
            .sort((x, y) => Number(y.amount) - Number(x.amount))
            .map((s) => this.toSplit(s, acctDir));
        } else if (siblings[0]) {
          const od = acctDir.get(siblings[0].account_id);
          le.offsetAccountId = siblings[0].account_id;
          le.offsetAccountName = od?.name;
          le.offsetAccountPath = od?.path;
        }
      }
      le.entityId = d?.entityId;
      le.entityName = d ? entName.get(d.entityId) : undefined;
      le.accountName = d?.name;
      le.accountPath = d?.path;
      result.push(le);
    }
    return result;
  }

  // ===========================================================================
  // Bulk import (atomic)
  // ===========================================================================

  async bulkImport(data: BulkImportData): Promise<void> {
    const db = this.getDb();
    await run(db, 'BEGIN');
    try {
      await bulkInsert(db,
        `INSERT INTO account (id, entity_id, account_group_id, parent_id, code, name, description,
          unit, costing_method, closed_date, partner_id, linked_account_id, is_active, source_id, created_at, updated_at)`,
        16, data.accounts, (a) => [a.id, a.entityId, a.accountGroupId, a.parentId ?? null, a.code ?? null,
          a.name, a.description ?? null, a.unit, a.costingMethod ?? null, a.closedDate ?? null,
          a.partnerId ?? null, a.linkedAccountId ?? null, a.isActive ? 1 : 0, a.sourceId ?? null,
          a.createdAt, a.updatedAt]);
      await bulkInsert(db,
        'INSERT INTO txn (id, entity_id, date, memo, reference, source_id, created_at, updated_at)',
        8, data.transactions, (t) => [t.id, t.entityId, t.date, t.memo ?? null, t.reference ?? null,
          t.sourceId ?? null, t.createdAt, t.updatedAt]);
      await bulkInsert(db,
        'INSERT INTO entry (id, txn_id, account_id, amount, note, tag_id, reconciliation_id)',
        7, data.entries, (e) => [e.id, e.transactionId, e.accountId, e.amount, e.note ?? null,
          e.tagId ?? null, e.reconciliationId ?? null]);
      await run(db, 'COMMIT');
    } catch (err) {
      try { await run(db, 'ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
  }
}

// Insert rows in multi-row VALUES batches — one exec per batch instead of per row.
// The IndexedDB store round-trips per statement, so batching is a large win at scale.
async function bulkInsert<T>(
  db: Database, insertPrefix: string, cols: number, rows: T[], toParams: (row: T) => SqlValue[],
): Promise<void> {
  if (rows.length === 0) return;
  const tuple = `(${Array(cols).fill('?').join(',')})`;
  const perBatch = Math.max(1, Math.floor(2000 / cols)); // cap params/statement ~2000
  for (let i = 0; i < rows.length; i += perBatch) {
    const chunk = rows.slice(i, i + perBatch);
    const sql = `${insertPrefix} VALUES ${chunk.map(() => tuple).join(',')}`;
    const params: SqlValue[] = [];
    for (const r of chunk) params.push(...toParams(r));
    await run(db, sql, params);
  }
}

// Export singleton
export const quereusService = new QuereusDataService();

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
    const db = this.getDb();
    await run(db, 'DELETE FROM entry WHERE txn_id IN (SELECT id FROM txn WHERE entity_id = ?)', [id]);
    await run(db, 'DELETE FROM txn WHERE entity_id = ?', [id]);
    await run(db, 'DELETE FROM account WHERE entity_id = ?', [id]);
    await run(db, 'DELETE FROM entity WHERE id = ?', [id]);
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

  async updateTransaction(id: string, data: Partial<TransactionInput>): Promise<Transaction> {
    const cols: Record<string, string> = { date: 'date', memo: 'memo', reference: 'reference' };
    const sets: string[] = [];
    const vals: SqlValue[] = [];
    for (const [key, col] of Object.entries(cols)) {
      if (key in data) { sets.push(`${col} = ?`); vals.push((data as Row)[key] ?? null); }
    }
    sets.push('updated_at = ?');
    vals.push(nowIso(), id);
    await run(this.getDb(), `UPDATE txn SET ${sets.join(', ')} WHERE id = ?`, vals);
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
    const accts = await all<Row>(db,
      `SELECT a.id, a.name, a.code, a.unit, g.id as group_id, g.name as group_name,
              g.account_type, g.display_order
       FROM account a JOIN account_group g ON g.id = a.account_group_id
       WHERE a.entity_id = ? AND a.is_active = 1
       ORDER BY g.display_order, a.code`, [entityId]);
    const entries = await all<Row>(db,
      `SELECT e.account_id, e.amount, t.date
       FROM entry e JOIN txn t ON t.id = e.txn_id JOIN account a ON a.id = e.account_id
       WHERE a.entity_id = ? AND t.date <= ?`, [entityId, end]);

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
    return {
      entityId, endDate: end, startDate: startDate || undefined,
      netWorth: totalAssets + totalLiabilities,
      totalAssets,
      totalLiabilities: Math.abs(totalLiabilities),
      totalEquity: Math.abs(totalEquity),
      totalIncome: Math.abs(totalIncome),
      totalExpense,
      groupBalances: Array.from(groupTotals.values()),
      accountBalances,
    };
  }

  // ===========================================================================
  // Ledger view
  // ===========================================================================

  async getLedgerEntries(accountId: string, options?: {
    startDate?: string; endDate?: string; limit?: number; sortOrder?: 'oldest' | 'newest';
  }): Promise<LedgerEntry[]> {
    const db = this.getDb();
    let sql = `SELECT e.id as entry_id, t.id as txn_id, t.date, t.reference, t.memo, e.amount, e.note,
                      (SELECT count(*) FROM entry WHERE txn_id = t.id) as entry_count
               FROM entry e JOIN txn t ON t.id = e.txn_id WHERE e.account_id = ?`;
    const params: SqlValue[] = [accountId];
    if (options?.startDate) { sql += ' AND t.date >= ?'; params.push(options.startDate); }
    if (options?.endDate) { sql += ' AND t.date <= ?'; params.push(options.endDate); }
    sql += (options?.sortOrder === 'newest')
      ? ' ORDER BY t.date DESC, t.created_at DESC'
      : ' ORDER BY t.date ASC, t.created_at ASC';
    if (options?.limit) { sql += ' LIMIT ?'; params.push(options.limit); }

    const rows = await all<Row>(db, sql, params);
    const result: LedgerEntry[] = [];
    let running = 0;
    for (const r of rows) {
      const amount = Number(r.amount);
      running += amount;
      const isSplit = Number(r.entry_count) > 2;
      const le: LedgerEntry = {
        entryId: r.entry_id, transactionId: r.txn_id, date: r.date,
        reference: r.reference ?? undefined, memo: r.memo ?? undefined,
        accountId, amount, note: r.note ?? undefined, runningBalance: running, isSplit,
      };
      if (isSplit) {
        le.splitEntries = await this.splitsFor(r.txn_id, r.entry_id);
      } else {
        const off = await get<Row>(db,
          `SELECT e.account_id, a.name, g.name as group_name, g.account_type
           FROM entry e JOIN account a ON a.id = e.account_id JOIN account_group g ON g.id = a.account_group_id
           WHERE e.txn_id = ? AND e.id != ? LIMIT 1`, [r.txn_id, r.entry_id]);
        if (off) {
          le.offsetAccountId = off.account_id;
          le.offsetAccountName = off.name;
          le.offsetAccountPath = pathFor(off.account_type, off.group_name, off.name);
        }
      }
      result.push(le);
    }
    return result;
  }

  private async splitsFor(txnId: string, excludeEntryId: string): Promise<SplitEntry[]> {
    const rows = await all<Row>(this.getDb(),
      `SELECT e.id, e.account_id, a.name, g.name as group_name, g.account_type, e.amount, e.note
       FROM entry e JOIN account a ON a.id = e.account_id JOIN account_group g ON g.id = a.account_group_id
       WHERE e.txn_id = ? AND e.id != ? ORDER BY e.amount DESC`, [txnId, excludeEntryId]);
    return rows.map((r) => ({
      entryId: r.id, accountId: r.account_id, accountName: r.name,
      accountPath: pathFor(r.account_type, r.group_name, r.name),
      amount: Number(r.amount), note: r.note ?? undefined,
    }));
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  async searchAccounts(entityId: string, query: string): Promise<Array<{
    id: string; name: string; path: string; code?: string;
  }>> {
    const q = query.toLowerCase();
    const rows = await all<Row>(this.getDb(),
      `SELECT a.id, a.name, a.code, g.name as group_name, g.account_type
       FROM account a JOIN account_group g ON g.id = a.account_group_id
       WHERE a.entity_id = ? AND a.is_active = 1
       ORDER BY g.display_order, a.code, a.name`, [entityId]);
    const results: Array<{ id: string; name: string; path: string; code?: string }> = [];
    for (const r of rows) {
      const path = pathFor(r.account_type, r.group_name, r.name);
      const code: string | undefined = r.code ?? undefined;
      if (r.name.toLowerCase().includes(q) || r.group_name.toLowerCase().includes(q) ||
          path.toLowerCase().includes(q) || (code && code.toLowerCase().includes(q))) {
        results.push({ id: r.id, name: r.name, path, code });
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

  async getAllTransactions(): Promise<LedgerEntry[]> {
    const db = this.getDb();
    const rows = await all<Row>(db,
      `SELECT e.id as entry_id, t.id as txn_id, t.date, t.reference, t.memo, e.account_id, e.amount, e.note,
              a.name as account_name, a.entity_id, en.name as entity_name, g.name as group_name, g.account_type,
              (SELECT count(*) FROM entry WHERE txn_id = t.id) as entry_count
       FROM entry e
       JOIN txn t ON t.id = e.txn_id
       JOIN account a ON a.id = e.account_id
       JOIN entity en ON en.id = a.entity_id
       JOIN account_group g ON g.id = a.account_group_id
       ORDER BY t.date DESC, t.created_at DESC, e.id ASC`);
    const result: LedgerEntry[] = [];
    const processedTxns = new Set<string>();
    for (const r of rows) {
      const isSplit = Number(r.entry_count) > 2;
      const le = {
        entryId: r.entry_id, transactionId: r.txn_id, date: r.date,
        reference: r.reference ?? undefined, memo: r.memo ?? undefined,
        accountId: r.account_id, amount: Number(r.amount), note: r.note ?? undefined,
        runningBalance: 0, isSplit,
      } as LedgerEntry & { entityId?: string; entityName?: string; accountName?: string; accountPath?: string };

      if (!processedTxns.has(r.txn_id)) {
        processedTxns.add(r.txn_id);
        if (isSplit) {
          le.splitEntries = await this.splitsFor(r.txn_id, r.entry_id);
        } else {
          const off = await get<Row>(db,
            `SELECT e.account_id, a.name, g.name as group_name, g.account_type
             FROM entry e JOIN account a ON a.id = e.account_id JOIN account_group g ON g.id = a.account_group_id
             WHERE e.txn_id = ? AND e.id != ? LIMIT 1`, [r.txn_id, r.entry_id]);
          if (off) {
            le.offsetAccountId = off.account_id;
            le.offsetAccountName = off.name;
            le.offsetAccountPath = pathFor(off.account_type, off.group_name, off.name);
          }
        }
      }
      le.entityId = r.entity_id;
      le.entityName = r.entity_name;
      le.accountName = r.account_name;
      le.accountPath = pathFor(r.account_type, r.group_name, r.account_name);
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
      for (const a of data.accounts) {
        await run(db,
          `INSERT INTO account (id, entity_id, account_group_id, parent_id, code, name, description,
            unit, costing_method, closed_date, partner_id, linked_account_id, is_active, source_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [a.id, a.entityId, a.accountGroupId, a.parentId ?? null, a.code ?? null, a.name,
            a.description ?? null, a.unit, a.costingMethod ?? null, a.closedDate ?? null,
            a.partnerId ?? null, a.linkedAccountId ?? null, a.isActive ? 1 : 0, a.sourceId ?? null,
            a.createdAt, a.updatedAt]);
      }
      for (const t of data.transactions) {
        await run(db,
          'INSERT INTO txn (id, entity_id, date, memo, reference, source_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [t.id, t.entityId, t.date, t.memo ?? null, t.reference ?? null, t.sourceId ?? null, t.createdAt, t.updatedAt]);
      }
      for (const e of data.entries) {
        await run(db,
          'INSERT INTO entry (id, txn_id, account_id, amount, note, tag_id, reconciliation_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [e.id, e.transactionId, e.accountId, e.amount, e.note ?? null, e.tagId ?? null, e.reconciliationId ?? null]);
      }
      await run(db, 'COMMIT');
    } catch (err) {
      try { await run(db, 'ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
  }
}

// Export singleton
export const quereusService = new QuereusDataService();

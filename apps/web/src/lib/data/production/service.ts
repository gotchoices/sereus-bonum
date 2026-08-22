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
  Exchange, ExchangeInput, Valuation,
  BalanceSheetData, AccountBalance, GroupBalance,
  LedgerEntry, SplitEntry, BulkImportData
} from '../types';
import type { Database, SqlValue } from '@quereus/quereus';
import { getQuereusDb, closeQuereusDb, all, get, run, uuid, nowIso, ensureBalanceMV, dropBalanceMV, BALANCE_MV, ensureMonthlyMV, dropMonthlyMV, MONTHLY_MV } from './db';
import { valueReport, assertBalanced } from '$lib/report/convert';
import type { NativeAccountBalance } from '$lib/report/convert';
import { log } from '$lib/logger';

const NOT_IMPLEMENTED = 'Quereus backend: method not yet implemented (Track C2)';

// --- Quereus-workaround revert switches ------------------------------------
// Quereus ≥4.16 + ANALYZE (run after bulkImport) plans an *explicit join* off a selective seek as an
// index-nested-loop, so the ledger read CAN now be natural SQL: a CTE of the account's txn ids JOINed to every
// leg + txn ('sql-join' below). The JOIN form is load-bearing — the SAME set via `WHERE txn_id IN (SELECT ...)`
// (inline OR from the CTE) plans as a semi hash-join that full-scans entry+txn (~20× slower; quereus issue).
// BUT the INL seeks per txn with no batched fallback, so for the busiest account (1176 txns) it runs ~670ms vs
// the targeted path's full-scan fallback ~490ms, and for a typical account it only ties (~49 vs ~43ms). Not a
// net efficiency win, so the workaround stays the default; 'sql-join' is kept switchable (and is now the best
// natural form) to re-adopt if the store batches INL seeks. See docs/quereus-workarounds.md W1.
const LEDGER_STRATEGY: 'sql-join' | 'targeted-workaround' = 'targeted-workaround';
// Balance-sheet forward regime reads the monthly MV for whole months before D. Tested on 4.16: a natural
// `WHERE entity_id = ? AND period < ?` full-scans the MV in production (which carries no (entity_id,period)
// index) at ~138ms — equivalent to, NOT faster than, the explicit full-scan workaround, and less robust
// (adding that index would tempt the planner into a losing range seek). So the workaround stays the default;
// the natural path is kept switchable to re-test when covered/range reads improve. See workarounds W4.
const BALANCE_MV_RANGE: 'sql-range' | 'full-scan-workaround' = 'full-scan-workaround';

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
    maxEntryDate: r.max_entry_date ?? undefined,
    reckoningUnits: r.reckoning_units ? String(r.reckoning_units).split(',').filter(Boolean) : undefined,
    entryPeriods: r.entry_periods ? String(r.entry_periods).split(',').filter(Boolean) : undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toExchange(r: Row): Exchange {
  return {
    id: r.id,
    date: r.date,
    unitA: r.unit_a,
    unitB: r.unit_b,
    rateNumerator: Number(r.rate_numerator),
    rateDenominator: Number(r.rate_denominator),
    source: r.source,
    notes: r.notes ?? undefined,
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
    valueUnit: r.value_unit ?? undefined,
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
    value: r.value === null || r.value === undefined ? undefined : Number(r.value),
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
  // Reference rates
  //
  // Report-time valuation only. Transaction rates are NOT here — they live on the entries as
  // value/amount, so one transaction can carry a different rate per entry.
  // ===========================================================================

  async getExchangeRates(options?: { unitA?: string; unitB?: string; asOf?: string }): Promise<Exchange[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (options?.unitA) { where.push('unit_a = ?'); params.push(options.unitA); }
    if (options?.unitB) { where.push('unit_b = ?'); params.push(options.unitB); }
    // Conversions are as-of the report date, never today — a December balance sheet uses December rates.
    if (options?.asOf) { where.push('date <= ?'); params.push(options.asOf); }
    const sql = `SELECT * FROM exchange${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`
      + ' ORDER BY date DESC';
    const rows = await all<Row>(this.getDb(), sql, params);
    return rows.map(toExchange);
  }

  async createExchangeRate(data: ExchangeInput): Promise<Exchange> {
    const rate: Exchange = { ...data, id: crypto.randomUUID() };
    await run(this.getDb(),
      `INSERT INTO exchange (id, date, unit_a, unit_b, rate_numerator, rate_denominator, source, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [rate.id, rate.date, rate.unitA, rate.unitB, rate.rateNumerator, rate.rateDenominator,
        rate.source, rate.notes ?? null]);
    return rate;
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
    let sql = 'SELECT DISTINCT t.id, t.entity_id, t.date, t.memo, t.reference, t.value_unit, t.created_at, t.updated_at FROM txn t';
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

  /**
   * Keep the entity's read-side denormalizations current. Both are RAISED only:
   * an over-stated max date costs a few empty-month probes, an under-stated one is a wrong balance.
   * PK-scoped, so this is a 1-row write — not the table-wide seek that a `max()` query would be.
   */
  private async noteTransaction(entityId: string, date: string, valueUnit?: string): Promise<void> {
    const e = await this.getEntity(entityId);
    if (!e) return;
    const sets: string[] = [];
    const vals: SqlValue[] = [];
    if (!e.maxEntryDate || date > e.maxEntryDate) { sets.push('max_entry_date = ?'); vals.push(date); }
    const period = date.slice(0, 7);
    if (!(e.entryPeriods ?? []).includes(period)) {
      sets.push('entry_periods = ?');
      vals.push([...(e.entryPeriods ?? []), period].sort().join(','));
    }
    if (valueUnit && !(e.reckoningUnits ?? []).includes(valueUnit)) {
      sets.push('reckoning_units = ?');
      vals.push([...(e.reckoningUnits ?? []), valueUnit].join(','));
    }
    if (sets.length === 0) return;
    vals.push(entityId);
    await run(this.getDb(), `UPDATE entity SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  async createTransaction(data: TransactionInput, entries: EntryInput[]): Promise<Transaction> {
    assertBalanced(entries, data.valueUnit);
    const db = this.getDb();
    const id = uuid();
    const ts = nowIso();
    await run(db, 'INSERT INTO txn (id, entity_id, date, memo, reference, value_unit, source_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.entityId, data.date, data.memo ?? null, data.reference ?? null, data.valueUnit ?? null,
        data.sourceId ?? null, ts, ts]);
    for (const e of entries) {
      await run(db, 'INSERT INTO entry (id, txn_id, account_id, amount, value, entity_id, date, period, note, tag_id, reconciliation_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuid(), id, e.accountId, e.amount, e.value ?? null, data.entityId, data.date, data.date.slice(0, 7), e.note ?? null, e.tagId ?? null, e.reconciliationId ?? null]);
    }
    await this.noteTransaction(data.entityId, data.date, data.valueUnit);
    return (await this.getTransaction(id))!;
  }

  async updateTransaction(id: string, data: Partial<TransactionInput>, entries?: EntryInput[]): Promise<Transaction> {
    if (entries) {
      // The reckoning unit may be changing in this same update, so prefer the incoming value.
      const valueUnit = 'valueUnit' in data ? data.valueUnit : (await this.getTransaction(id))?.valueUnit;
      assertBalanced(entries, valueUnit);
    }
    const cols: Record<string, string> = { date: 'date', memo: 'memo', reference: 'reference', valueUnit: 'value_unit' };
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
        const txnRow = await get<{ entity_id: string; date: string }>(db, 'SELECT entity_id, date FROM txn WHERE id = ?', [id]);
        const ed = txnRow?.entity_id ?? null, dt = txnRow?.date ?? null;
        for (const e of entries) {
          await run(db, 'INSERT INTO entry (id, txn_id, account_id, amount, value, entity_id, date, period, note, tag_id, reconciliation_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [uuid(), id, e.accountId, e.amount, e.value ?? null, ed, dt, dt ? dt.slice(0, 7) : null, e.note ?? null, e.tagId ?? null, e.reconciliationId ?? null]);
        }
      }
      await run(db, 'COMMIT');
    } catch (err) {
      try { await run(db, 'ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
    const updated = (await this.getTransaction(id))!;
    await this.noteTransaction(updated.entityId, updated.date, updated.valueUnit);
    return updated;
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
    // No date bound → a plain single-table sum. The txn join exists ONLY to date-filter, and a
    // store-side JOIN degrades to a per-row nested loop (see tmp/quereus-join-index-perf.md): this
    // path measured ~43s at 2k entries with the join vs a few ms without (found via perf/run.mjs).
    if (!asOf) {
      const row = await get<Row>(this.getDb(), 'SELECT COALESCE(SUM(amount), 0) as balance FROM entry WHERE account_id = ?', [accountId]);
      return row ? Number(row.balance) : 0;
    }
    // Date-bounded → join entry→txn dates in JS over single-table indexed reads (not a store JOIN).
    const acct = await get<{ entity_id: string }>(this.getDb(), 'SELECT entity_id FROM account WHERE id = ?', [accountId]);
    if (!acct) return 0;
    const [entries, txns] = await Promise.all([
      all<{ amount: number; txn_id: string }>(this.getDb(), 'SELECT amount, txn_id FROM entry WHERE account_id = ?', [accountId]),
      all<{ id: string; date: string }>(this.getDb(), 'SELECT id, date FROM txn WHERE entity_id = ?', [acct.entity_id]),
    ]);
    const dateById = new Map(txns.map((t) => [t.id, t.date]));
    let sum = 0;
    for (const e of entries) {
      const d = dateById.get(e.txn_id);
      if (d !== undefined && d <= asOf) sum += Number(e.amount);
    }
    return sum;
  }

  // Aggregation done in JS (avoids Quereus GROUP BY quirks).
  async getBalanceSheet(entityId: string, endDate?: string, startDate?: string, displayUnit?: string,
                        valuation: Valuation = 'COST'): Promise<BalanceSheetData> {
    const end = endDate || new Date().toISOString().split('T')[0];
    const db = this.getDb();
    const accts = await all<Row>(db,
      `SELECT a.id, a.name, a.code, a.unit, g.id as group_id, g.name as group_name,
              g.account_type, g.display_order
       FROM account a JOIN account_group g ON g.id = a.account_group_id
       WHERE a.entity_id = ? AND a.is_active = 1
       ORDER BY g.display_order, a.code`, [entityId]);

    // --- Prefix-balance reader -------------------------------------------------------------------------
    // Every figure is a per-account prefix sum P(D) = Σ amount WHERE date ≤ D. Balance sheet = P(end);
    // income statement I/E = P(end) − P(start−1), A/L/E stay cumulative = P(end). We read P(D) from the
    // nearer of two FREE anchors and walk to D with month-granularity buckets:
    //   • P(∞) = the current-balance MV (SUM GROUP BY account_id, O(accounts), ~2ms) — the "as of now" anchor.
    //   • P(0) = 0 (before history).
    // Dispatch on D:
    //   D ≥ today        → current MV directly.
    //   D within N months → BACKWARD: current MV − Σ(entries dated after D). The tail is a few whole months,
    //                       each read by a selective `period = ?` IndexSeek. O(months-after-D).
    //   D older          → FORWARD:  Σ(monthly-MV months < D) + the partial current month. O(accounts×months).
    // The monthly MV is read by FULL SCAN (filter in JS), never the `entity_id` IndexSeek: on the store an
    // index seek returns rows via per-row cursors (~10× a getAll-batched full scan). Fixing that upstream —
    // plus range seeks so `period < ?` can seek — removes the need for this dispatch entirely; see
    // tmp/quereus-4.11-range-and-indexed-reads.md and docs/materialized-balances-design.md.
    // The backward tail must run to the LAST month that actually holds an entry, not to today's:
    // books legitimately contain future-dated entries (Kyle's investment books carry three dated 2028),
    // and the current-balance MV sums every entry regardless of date. Stopping at today would leave
    // those future entries un-subtracted, so they'd show up in a balance sheet for a past date.
    // One entity read serves three purposes: the display unit, the tail horizon, and the reckoning
    // units behind cost figures. All three are denormalized onto the row precisely so no report has to
    // ask the store a table-wide question.
    const entity = await this.getEntity(entityId);

    // Two measures per account, from the SAME MV rows: `a` = Σ amount (quantity in the account's own
    // unit — the recorded fact) and `c` = Σ coalesce(value, amount) (cost, in the reckoning unit).
    // Carrying both costs nothing: the MV already computes them and the reads are identical.
    type Pair = { a: number; c: number };
    const balByAccount = new Map<string, Pair>();
    const today = new Date().toISOString().slice(0, 10);
    const bump = (m: Map<string, Pair>, k: string, a: number, c: number) => {
      const cur = m.get(k);
      if (cur) { cur.a += a; cur.c += c; } else { m.set(k, { a, c }); }
    };
    // Backward tail costs ~one `period=?` seek per month (~5ms); the forward MV scan is a flat ~150-220ms.
    // Measured crossover is ~40 months, so anything within the last year stays far cheaper via backward.
    const BACKWARD_MAX_MONTHS = 12;

    const monthKey = (d: string) => d.slice(0, 7);
    const monthsBetween = (a: string, b: string) => {
      const [ay, am] = a.split('-').map(Number), [by, bm] = b.split('-').map(Number);
      return (by - ay) * 12 + (bm - am);
    };
    const nextMonth = (m: string) => {
      const [y, mo] = m.split('-').map(Number);
      return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
    };
    const dayBefore = (d: string): string => {
      const dt = new Date(`${d}T00:00:00Z`); dt.setUTCDate(dt.getUTCDate() - 1); return dt.toISOString().slice(0, 10);
    };
    const entriesInPeriod = (period: string) => all<{ account_id: string; amount: number; value: number | null; entity_id: string; date: string }>(
      db, `SELECT account_id, amount, value, entity_id, date FROM entry WHERE period = ?`, [period]);
    const currentBalance = async (): Promise<Map<string, Pair>> => {
      const bal = new Map<string, Pair>();
      for (const r of await all<Row>(db, `SELECT account_id, balance, cost FROM ${BALANCE_MV}`))
        bal.set(r.account_id, { a: Number(r.balance), c: Number(r.cost) });
      return bal;
    };

    // The tail must run to the LAST entry date in the books, not to today: books legitimately carry
    // future-dated entries (Kyle's investment books have three dated 2028), and the current-balance MV
    // sums every entry regardless of date. Stopping at today would leave those un-subtracted, so they
    // would show up in a balance sheet for a past date. `maxEntryDate` rides along on the entity row
    // we already read — asking the store for `max(date)` would cost ~4s of per-row cursors.
    const horizon = entity?.maxEntryDate && entity.maxEntryDate > today ? entity.maxEntryDate : today;

    /**
     * The month buckets the backward tail has to subtract: every period at or after D's own month.
     * Taken from the entity's recorded period set when we have it, so a horizon 18 months out doesn't
     * cost 18 seeks over months that hold nothing. Falls back to a contiguous walk.
     */
    const tailPeriods = (d: string): string[] => {
      const from = monthKey(d), to = monthKey(horizon);
      const known = entity?.entryPeriods;
      if (known && known.length > 0) return known.filter((p) => p >= from && p <= to);
      const out: string[] = [];
      for (let m = from; ; m = nextMonth(m)) { out.push(m); if (m === to) break; }
      return out;
    };

    let regime = '';
    const balanceAsOf = async (d: string): Promise<Map<string, Pair>> => {
      if (d >= horizon) { regime += ' curMV'; return currentBalance(); }
      if (tailPeriods(d).length <= BACKWARD_MAX_MONTHS) {
        // backward: current balance minus every entry dated after D (whole tail months + D's own tail).
        regime += ' backward';
        const bal = await currentBalance();
        for (const m of tailPeriods(d)) {
          for (const r of await entriesInPeriod(m))
            if (r.entity_id === entityId && r.date > d)
              bump(bal, r.account_id, -Number(r.amount), -Number(r.value ?? r.amount));
        }
        return bal;
      }
      // forward: whole months before D from the monthly MV + the partial current month.
      regime += ' forward';
      const bal = new Map<string, Pair>();
      const period = monthKey(d);
      if (BALANCE_MV_RANGE === 'sql-range') {
        for (const r of await all<{ account_id: string; balance: number; cost: number }>(db,
          `SELECT account_id, balance, cost FROM ${MONTHLY_MV} WHERE entity_id = ? AND period < ?`, [entityId, period]))
          bump(bal, r.account_id, Number(r.balance), Number(r.cost));
      } else {
        for (const r of await all<{ account_id: string; period: string; balance: number; cost: number; entity_id: string }>(db,
          `SELECT account_id, period, balance, cost, entity_id FROM ${MONTHLY_MV}`))
          if (r.entity_id === entityId && r.period < period) bump(bal, r.account_id, Number(r.balance), Number(r.cost));
      }
      for (const r of await entriesInPeriod(period))
        if (r.entity_id === entityId && r.date <= d)
          bump(bal, r.account_id, Number(r.amount), Number(r.value ?? r.amount));
      return bal;
    };

    const t0 = performance.now();
    try {
      const balEnd = await balanceAsOf(end);
      if (startDate) {
        const balBefore = await balanceAsOf(dayBefore(startDate));
        const ieIds = new Set(accts.filter((a) => a.account_type === 'INCOME' || a.account_type === 'EXPENSE').map((a) => a.id));
        const zero = { a: 0, c: 0 };
        for (const a of accts) {
          const e = balEnd.get(a.id) ?? zero, b = balBefore.get(a.id) ?? zero;
          balByAccount.set(a.id, ieIds.has(a.id) ? { a: e.a - b.a, c: e.c - b.c } : { a: e.a, c: e.c });
        }
      } else {
        for (const [k, v] of balEnd) balByAccount.set(k, v);
      }
    } catch (e) {
      // Robustness: if an MV is unavailable, fall back to the brute-force grouped join (correct, slower).
      regime = ' brute-force';
      log.data.warn('[BalanceSheet] MV path failed; falling back to brute-force join', e);
      balByAccount.clear();
      if (startDate) {
        const rows = await all<Row>(db,
          `SELECT e.account_id, SUM(e.amount) AS cumulative,
                  SUM(COALESCE(e.value, e.amount)) AS cumulative_cost,
                  SUM(CASE WHEN t.date >= ? THEN e.amount ELSE 0 END) AS period,
                  SUM(CASE WHEN t.date >= ? THEN COALESCE(e.value, e.amount) ELSE 0 END) AS period_cost
           FROM entry e JOIN txn t ON t.id = e.txn_id
           WHERE t.entity_id = ? AND t.date <= ? GROUP BY e.account_id`, [startDate, startDate, entityId, end]);
        const ieIds = new Set(accts.filter((a) => a.account_type === 'INCOME' || a.account_type === 'EXPENSE').map((a) => a.id));
        for (const r of rows) {
          const v = Number(ieIds.has(r.account_id) ? r.period : r.cumulative);
          const c = Number(ieIds.has(r.account_id) ? r.period_cost : r.cumulative_cost);
          balByAccount.set(r.account_id, { a: v, c });
        }
      } else {
        const rows = await all<Row>(db,
          `SELECT e.account_id, SUM(e.amount) AS balance, SUM(COALESCE(e.value, e.amount)) AS cost
           FROM entry e JOIN txn t ON t.id = e.txn_id
           WHERE t.entity_id = ? AND t.date <= ? GROUP BY e.account_id`, [entityId, end]);
        for (const r of rows) balByAccount.set(r.account_id, { a: Number(r.balance), c: Number(r.cost) });
      }
    }
    log.data.info(`[BalanceSheet] ${startDate ? 'income-stmt' : 'balance-sheet'} end=${end} regime=${regime.trim()} ${Math.round(performance.now() - t0)}ms`);

    const display = displayUnit ?? entity?.baseUnit ?? 'USD';

    // Value the native balances in the chosen display unit. For a single-unit entity every account
    // already holds the display unit, so this is an identity pass — no estimates, no gain/loss line.
    // COST reports what was paid — already denominated in the reckoning unit, so no rate is consulted.
    // MARKET reports the quantity, which valueReport then converts at report-date rates.
    // Either way the account's own quantity travels alongside as the recorded fact.
    const costIsInDisplayUnit = (entity?.reckoningUnits ?? []).every((u) => u === display);
    const nativeBalances: NativeAccountBalance[] = accts.map((a) => {
      const pair = balByAccount.get(a.id) ?? { a: 0, c: 0 };
      const costed = valuation === 'COST' && pair.c !== pair.a && costIsInDisplayUnit;
      return {
        accountId: a.id, accountName: a.name, accountCode: a.code ?? undefined,
        groupId: a.group_id, groupName: a.group_name, accountType: a.account_type,
        balance: costed ? pair.c : pair.a,
        unit: costed ? display : a.unit,
        nativeBalance: pair.a, nativeUnit: a.unit,
      };
    });
    const needsRates = nativeBalances.some((b) => b.unit !== display);
    const [units, rates] = needsRates
      ? await Promise.all([this.getUnits(), this.getExchangeRates({ asOf: end })])
      : [[], []];
    const valued = valueReport(nativeBalances, display, rates, units, end);
    const { accountBalances, groupBalances } = valued;
    const { assets: totalAssets, liabilities: totalLiabilities, equity: totalEquity,
      income: totalIncome, expense: totalExpense } = valued.totals;
    // Present credit-normal totals by NEGATING the signed sum (not Math.abs): abs is only correct when
    // a total has its usual sign, but equity/liabilities/income can legitimately be net-debit (e.g. a
    // debit-heavy equity account or an accumulated deficit). Negation keeps the balance-sheet identity
    // Assets = -(Liabilities + Equity + Income + Expense_signed) exact in every case.
    return {
      entityId, endDate: end, startDate: startDate || undefined,
      displayUnit: display,
      valuation,
      // Exact when nothing was estimated: cost basis, every reckoning unit is the display unit, and
      // no account still needed a rate. All three are known without asking the store anything.
      isExact: valuation === 'COST' && costIsInDisplayUnit
        && valued.accountBalances.every((a) => !a.isEstimate) && !valued.totalsArePartial,
      unrecognizedGainLoss: valued.unrecognizedGainLoss,
      unvaluedUnits: valued.unvaluedUnits,
      totalsArePartial: valued.totalsArePartial,
      netWorth: totalAssets + totalLiabilities,
      totalAssets,
      totalLiabilities: -totalLiabilities,
      totalEquity: -totalEquity,
      totalIncome: -totalIncome,
      totalExpense,
      groupBalances,
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

    let txnById: Map<string, Row>;
    let byTxn: Map<string, Row[]>;

    if (LEDGER_STRATEGY === 'sql-join') {
      // Natural SQL (W1 revert). A CTE of this account's distinct txn ids, JOINed to every leg of those txns
      // and to txn for decoration — fetches its own entries plus their sibling legs in one query. Post-ANALYZE
      // (Quereus ≥4.16) the planner runs it as an index-nested-loop: seek entry by account_id → seek entry by
      // txn_id (idx_entry_txn) → seek txn by PK, so it's O(account), not O(table). The JOIN form is essential:
      // the same set via `WHERE txn_id IN (SELECT ...)` plans as a semi hash-join that full-scans entry+txn
      // (~20× slower). Downstream grouping is identical to the targeted path below.
      const rows = await all<Row>(db, `
        WITH ids AS (SELECT DISTINCT txn_id FROM entry WHERE account_id = ?)
        SELECT e.id, e.txn_id, e.account_id, e.amount, e.value, e.note,
               t.date, t.reference, t.memo, t.value_unit, t.created_at
        FROM ids JOIN entry e ON e.txn_id = ids.txn_id JOIN txn t ON t.id = e.txn_id`, [accountId]);
      txnById = new Map<string, Row>();
      byTxn = new Map<string, Row[]>();
      for (const r of rows) {
        const tid = r.txn_id as string;
        if (!txnById.has(tid)) {
          txnById.set(tid, { id: tid, date: r.date, reference: r.reference, memo: r.memo, value_unit: r.value_unit, created_at: r.created_at });
        }
        let arr = byTxn.get(tid);
        if (!arr) { arr = []; byTxn.set(tid, arr); }
        arr.push({ id: r.id, txn_id: tid, account_id: r.account_id, amount: r.amount, value: r.value, note: r.note });
      }
    } else {
      // Targeted ledger read (O(account)) — the hand-rolled index-nested-loop workaround, kept switchable.
      // account_id IndexSeek + a txn_id IN-list multi-seek reads only this account's txns + their sibling legs.
      // An account with more txns than the store's multi-seek window falls back to full-scans (O(table)).
      const LEDGER_TARGETED_MAX_TXNS = 1000; // the store's multi-seek key window (MAX_MULTI_SEEK_KEYS)
      const txnIds = [...new Set(
        (await all<Row>(db, 'SELECT txn_id FROM entry WHERE account_id = ?', [accountId])).map((r) => r.txn_id as string),
      )];
      if (txnIds.length > 0 && txnIds.length <= LEDGER_TARGETED_MAX_TXNS) {
        const ph = txnIds.map(() => '?').join(',');
        const txnRows = await all<Row>(db, `SELECT id, date, reference, memo, value_unit, created_at FROM txn WHERE id IN (${ph})`, txnIds);
        txnById = new Map<string, Row>(txnRows.map((t) => [t.id as string, t]));
        byTxn = new Map<string, Row[]>();
        for (const e of await all<Row>(db, `SELECT id, txn_id, account_id, amount, value, note FROM entry WHERE txn_id IN (${ph})`, txnIds)) {
          let arr = byTxn.get(e.txn_id as string);
          if (!arr) { arr = []; byTxn.set(e.txn_id as string, arr); }
          arr.push(e);
        }
      } else {
        // Fallback: a very large account (or none) — full-scan + JS filter (O(table)), the pre-4.12 path.
        const txnRows = (await all<Row>(db, 'SELECT id, date, reference, memo, value_unit, created_at, entity_id FROM txn'))
          .filter((t) => t.entity_id === entityId);
        txnById = new Map<string, Row>(txnRows.map((t) => [t.id, t]));
        byTxn = await this.entriesByTxn(txnById);
      }
    }

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
        accountId, amount,
        // Carried so opening an existing multi-unit transaction in the editor restores its
        // quantity/price/value instead of silently dropping the value.
        value: e.value === null || e.value === undefined ? undefined : Number(e.value),
        valueUnit: t.value_unit ?? undefined,
        note: e.note ?? undefined, runningBalance: running, isSplit,
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
        le.offsetValue = siblings[0].value === null || siblings[0].value === undefined
          ? undefined : Number(siblings[0].value);
      }
      result.push(le);
    }
    return result;
  }

  // accountId → {name, path, code, entityId} built from two single-table reads (no SQL join).
  private async buildAccountDir(entityId?: string): Promise<Map<string, { name: string; path: string; code?: string; entityId: string; unit?: string }>> {
    const db = this.getDb();
    const accts = entityId
      ? await all<Row>(db, 'SELECT id, name, code, account_group_id, entity_id, unit FROM account WHERE entity_id = ?', [entityId])
      : await all<Row>(db, 'SELECT id, name, code, account_group_id, entity_id, unit FROM account');
    const groups = await all<Row>(db, 'SELECT id, name, account_type FROM account_group');
    const gById = new Map<string, Row>(groups.map((g) => [g.id, g]));
    const dir = new Map<string, { name: string; path: string; code?: string; entityId: string; unit?: string }>();
    for (const a of accts) {
      const g = gById.get(a.account_group_id);
      dir.set(a.id, {
        name: a.name,
        path: g ? pathFor(g.account_type, g.name, a.name) : a.name,
        code: a.code ?? undefined,
        unit: a.unit ?? undefined,
        entityId: a.entity_id,
      });
    }
    return dir;
  }

  // Full single-table entry scan grouped by txn; keeps only txns present in txnById (the target scope).
  private async entriesByTxn(txnById: Map<string, Row>): Promise<Map<string, Row[]>> {
    const rows = await all<Row>(this.getDb(), 'SELECT id, txn_id, account_id, amount, value, note FROM entry');
    const byTxn = new Map<string, Row[]>();
    for (const e of rows) {
      if (!txnById.has(e.txn_id)) continue;
      let arr = byTxn.get(e.txn_id);
      if (!arr) { arr = []; byTxn.set(e.txn_id, arr); }
      arr.push(e);
    }
    return byTxn;
  }

  private toSplit(s: Row, acctDir: Map<string, { name: string; path: string; unit?: string }>): SplitEntry {
    const d = acctDir.get(s.account_id);
    return {
      entryId: s.id, accountId: s.account_id, accountName: d?.name ?? s.account_id,
      accountPath: d?.path ?? '', amount: Number(s.amount),
      // Carried so the editor can restore quantity/price/value when an existing multi-unit
      // transaction is opened — without it, editing a stock trade would silently lose its value.
      value: s.value === null || s.value === undefined ? undefined : Number(s.value),
      unit: d?.unit,
      note: s.note ?? undefined,
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
    const txnRows = await all<Row>(db, 'SELECT id, date, reference, memo, value_unit, created_at FROM txn');
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
        accountId: e.account_id, amount: Number(e.amount),
        value: e.value === null || e.value === undefined ? undefined : Number(e.value),
        valueUnit: t.value_unit ?? undefined,
        note: e.note ?? undefined,
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
    // Drop the balance MV during the bulk load so 17k+ inserts don't each pay incremental maintenance;
    // rebuild it once afterwards (one grouped scan). DDL runs outside the transaction.
    try { await dropBalanceMV(db); } catch { /* ignore */ }
    try { await dropMonthlyMV(db); } catch { /* ignore */ }
    await run(db, 'BEGIN');
    try {
      // Units first: accounts and txn.value_unit both reference them.
      await bulkInsert(db,
        'INSERT INTO unit (code, name, symbol, unit_type, display_divisor)',
        5, data.units ?? [], (u) => [u.code, u.name, u.symbol ?? null, u.unitType, u.displayDivisor]);
      await bulkInsert(db,
        `INSERT INTO account (id, entity_id, account_group_id, parent_id, code, name, description,
          unit, costing_method, closed_date, partner_id, linked_account_id, is_active, source_id, created_at, updated_at)`,
        16, data.accounts, (a) => [a.id, a.entityId, a.accountGroupId, a.parentId ?? null, a.code ?? null,
          a.name, a.description ?? null, a.unit, a.costingMethod ?? null, a.closedDate ?? null,
          a.partnerId ?? null, a.linkedAccountId ?? null, a.isActive ? 1 : 0, a.sourceId ?? null,
          a.createdAt, a.updatedAt]);
      await bulkInsert(db,
        'INSERT INTO txn (id, entity_id, date, memo, reference, value_unit, source_id, created_at, updated_at)',
        9, data.transactions, (t) => [t.id, t.entityId, t.date, t.memo ?? null, t.reference ?? null,
          t.valueUnit ?? null, t.sourceId ?? null, t.createdAt, t.updatedAt]);
      const txnById = new Map(data.transactions.map((t) => [t.id, t]));
      await bulkInsert(db,
        'INSERT INTO entry (id, txn_id, account_id, amount, value, entity_id, date, period, note, tag_id, reconciliation_id)',
        11, data.entries, (e) => {
          const t = txnById.get(e.transactionId);
          return [e.id, e.transactionId, e.accountId, e.amount, e.value ?? null,
            t?.entityId ?? null, t?.date ?? null,
            t?.date ? t.date.slice(0, 7) : null, e.note ?? null, e.tagId ?? null, e.reconciliationId ?? null];
        });
      await bulkInsert(db,
        `INSERT INTO exchange (id, date, unit_a, unit_b, rate_numerator, rate_denominator, source, notes)`,
        8, data.rates ?? [], (r) => [r.id, r.date, r.unitA, r.unitB, r.rateNumerator,
          r.rateDenominator, r.source, r.notes ?? null]);
      // Read-side denormalizations, from the batch we just wrote — no scan needed.
      for (const entityId of new Set(data.transactions.map((t) => t.entityId))) {
        const mine = data.transactions.filter((t) => t.entityId === entityId);
        const maxDate = mine.reduce((m, t) => (t.date > m ? t.date : m), '');
        const units = [...new Set(mine.map((t) => t.valueUnit).filter(Boolean))] as string[];
        const periods = [...new Set(mine.map((t) => t.date.slice(0, 7)))];
        const cur = await get<Row>(db,
          'SELECT max_entry_date, reckoning_units, entry_periods FROM entity WHERE id = ?', [entityId]);
        const prevUnits = cur?.reckoning_units ? String(cur.reckoning_units).split(',').filter(Boolean) : [];
        const prevPeriods = cur?.entry_periods ? String(cur.entry_periods).split(',').filter(Boolean) : [];
        await run(db, 'UPDATE entity SET max_entry_date = ?, reckoning_units = ?, entry_periods = ? WHERE id = ?',
          [cur?.max_entry_date && cur.max_entry_date > maxDate ? cur.max_entry_date : maxDate,
            [...new Set([...prevUnits, ...units])].join(',') || null,
            [...new Set([...prevPeriods, ...periods])].sort().join(',') || null,
            entityId]);
      }
      await run(db, 'COMMIT');
    } catch (err) {
      try { await run(db, 'ROLLBACK'); } catch { /* ignore */ }
      throw err;
    } finally {
      try { await ensureBalanceMV(db); } catch { /* ignore */ } // rebuild once over the loaded data
      try { await ensureMonthlyMV(db); } catch { /* ignore */ }
      // Populate planner statistics over the freshly-loaded data. Without stats the planner falls back to
      // heuristics and, e.g., hash-joins + full-scans the unfiltered side of a selective join (~60× slower);
      // with stats it chooses an index-nested-loop. Stats persist in the store across reopens, so this one
      // pass after bulk load covers every later read — no per-open cost. Incremental writes drift the stats
      // slowly; a periodic re-ANALYZE strategy is TODO (tracked separately). See docs/quereus-workarounds.md.
      try { await run(db, 'ANALYZE'); } catch { /* ignore — stats are an optimization, not correctness */ }
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

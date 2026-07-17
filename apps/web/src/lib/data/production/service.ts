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
  BalanceSheetData,
  LedgerEntry
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
  // Accounts — stubbed (Track C2)
  // ===========================================================================

  async getAccounts(_entityId: string): Promise<Account[]> { throw new Error(NOT_IMPLEMENTED); }
  async getAccount(_id: string): Promise<Account | null> { throw new Error(NOT_IMPLEMENTED); }
  async createAccount(_data: AccountInput): Promise<Account> { throw new Error(NOT_IMPLEMENTED); }
  async updateAccount(_id: string, _data: Partial<AccountInput>): Promise<Account> { throw new Error(NOT_IMPLEMENTED); }
  async deleteAccount(_id: string): Promise<void> { throw new Error(NOT_IMPLEMENTED); }

  // ===========================================================================
  // Transactions & Entries — stubbed (Track C2)
  // ===========================================================================

  async getTransactions(_entityId: string, _options?: {
    accountId?: string; startDate?: string; endDate?: string; limit?: number;
  }): Promise<Transaction[]> { throw new Error(NOT_IMPLEMENTED); }
  async getTransaction(_id: string): Promise<Transaction | null> { throw new Error(NOT_IMPLEMENTED); }
  async createTransaction(_data: TransactionInput, _entries: EntryInput[]): Promise<Transaction> { throw new Error(NOT_IMPLEMENTED); }
  async updateTransaction(_id: string, _data: Partial<TransactionInput>): Promise<Transaction> { throw new Error(NOT_IMPLEMENTED); }
  async deleteTransaction(_id: string): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async getEntries(_transactionId: string): Promise<Entry[]> { throw new Error(NOT_IMPLEMENTED); }
  async getEntriesForAccount(_accountId: string, _options?: {
    startDate?: string; endDate?: string; unreconciled?: boolean;
  }): Promise<Entry[]> { throw new Error(NOT_IMPLEMENTED); }

  // ===========================================================================
  // Balances, ledger, search — stubbed (Track C2)
  // ===========================================================================

  async getAccountBalance(_accountId: string, _asOf?: string): Promise<number> { throw new Error(NOT_IMPLEMENTED); }
  async getBalanceSheet(_entityId: string, _endDate?: string, _startDate?: string): Promise<BalanceSheetData> { throw new Error(NOT_IMPLEMENTED); }
  async getLedgerEntries(_accountId: string, _options?: {
    startDate?: string; endDate?: string; limit?: number; sortOrder?: 'oldest' | 'newest';
  }): Promise<LedgerEntry[]> { throw new Error(NOT_IMPLEMENTED); }
  async searchAccounts(_entityId: string, _query: string): Promise<Array<{
    id: string; name: string; path: string; code?: string;
  }>> { throw new Error(NOT_IMPLEMENTED); }
  async getAllTransactions(): Promise<LedgerEntry[]> { throw new Error(NOT_IMPLEMENTED); }
}

// Export singleton
export const quereusService = new QuereusDataService();

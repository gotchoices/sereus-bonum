// SQLite implementation of DataService
// See: design/specs/web/global/backend.md

import type { 
  DataService, 
  Entity, EntityInput,
  AccountGroup, AccountGroupInput,
  Account, AccountInput,
  Transaction, TransactionInput,
  Entry, EntryInput,
  Unit, UnitInput,
  BalanceSheetData, GroupBalance, AccountBalance,
  LedgerEntry, SplitEntry,
  AccountType
} from '../types';
import { NORMAL_BALANCE } from '../types';
import { getDb, saveDb, closeDb, uuid, now } from './sqlite';
import type { Database } from 'sql.js';

class SqliteDataService implements DataService {
  private db: Database | null = null;
  
  async initialize(): Promise<void> {
    this.db = await getDb();
  }
  
  async close(): Promise<void> {
    closeDb();
    this.db = null;
  }
  
  private getDb(): Database {
    if (!this.db) throw new Error('Database not initialized. Call initialize() first.');
    return this.db;
  }
  
  private save(): void {
    saveDb(this.db!);
  }
  
  // ===========================================================================
  // Entities
  // ===========================================================================
  
  async getEntities(): Promise<Entity[]> {
    const rows = this.getDb().exec(`
      SELECT id, name, description, fiscal_year_end, base_unit, 
             default_costing_method, created_at, updated_at
      FROM entity ORDER BY name
    `);
    if (!rows.length) return [];
    return rows[0].values.map(this.rowToEntity);
  }
  
  async getEntity(id: string): Promise<Entity | null> {
    const rows = this.getDb().exec(`
      SELECT id, name, description, fiscal_year_end, base_unit,
             default_costing_method, created_at, updated_at
      FROM entity WHERE id = ?
    `, [id]);
    if (!rows.length || !rows[0].values.length) return null;
    return this.rowToEntity(rows[0].values[0]);
  }
  
  async createEntity(data: EntityInput): Promise<Entity> {
    const id = uuid();
    const ts = now();
    this.getDb().run(`
      INSERT INTO entity (id, name, description, fiscal_year_end, base_unit,
                          default_costing_method, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, data.name, data.description ?? null, data.fiscalYearEnd ?? null,
        data.baseUnit, data.defaultCostingMethod ?? null, ts, ts]);
    this.save();
    return (await this.getEntity(id))!;
  }
  
  async updateEntity(id: string, data: Partial<EntityInput>): Promise<Entity> {
    const existing = await this.getEntity(id);
    if (!existing) throw new Error(`Entity not found: ${id}`);
    
    const updates: string[] = [];
    const values: (string | null)[] = [];
    
    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description ?? null); }
    if (data.fiscalYearEnd !== undefined) { updates.push('fiscal_year_end = ?'); values.push(data.fiscalYearEnd ?? null); }
    if (data.baseUnit !== undefined) { updates.push('base_unit = ?'); values.push(data.baseUnit); }
    if (data.defaultCostingMethod !== undefined) { updates.push('default_costing_method = ?'); values.push(data.defaultCostingMethod ?? null); }
    
    updates.push('updated_at = ?');
    values.push(now());
    values.push(id);
    
    this.getDb().run(`UPDATE entity SET ${updates.join(', ')} WHERE id = ?`, values);
    this.save();
    return (await this.getEntity(id))!;
  }
  
  async deleteEntity(id: string): Promise<void> {
    this.getDb().run('DELETE FROM entity WHERE id = ?', [id]);
    this.save();
  }
  
  private rowToEntity(row: unknown[]): Entity {
    return {
      id: row[0] as string,
      name: row[1] as string,
      description: row[2] as string | undefined,
      fiscalYearEnd: row[3] as string | undefined,
      baseUnit: row[4] as string,
      defaultCostingMethod: row[5] as Entity['defaultCostingMethod'],
      createdAt: row[6] as string,
      updatedAt: row[7] as string,
    };
  }
  
  // ===========================================================================
  // Account Groups
  // ===========================================================================
  
  async getAccountGroups(): Promise<AccountGroup[]> {
    const rows = this.getDb().exec(`
      SELECT id, name, account_type, parent_id, description, display_order
      FROM account_group ORDER BY display_order, name
    `);
    if (!rows.length) return [];
    return rows[0].values.map(this.rowToAccountGroup);
  }
  
  async getAccountGroup(id: string): Promise<AccountGroup | null> {
    const rows = this.getDb().exec(`
      SELECT id, name, account_type, parent_id, description, display_order
      FROM account_group WHERE id = ?
    `, [id]);
    if (!rows.length || !rows[0].values.length) return null;
    return this.rowToAccountGroup(rows[0].values[0]);
  }
  
  async createAccountGroup(data: AccountGroupInput): Promise<AccountGroup> {
    const id = uuid();
    this.getDb().run(`
      INSERT INTO account_group (id, name, account_type, parent_id, description, display_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, data.name, data.accountType, data.parentId ?? null, data.description ?? null, data.displayOrder ?? null]);
    this.save();
    return (await this.getAccountGroup(id))!;
  }
  
  async updateAccountGroup(id: string, data: Partial<AccountGroupInput>): Promise<AccountGroup> {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    
    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.accountType !== undefined) { updates.push('account_type = ?'); values.push(data.accountType); }
    if (data.parentId !== undefined) { updates.push('parent_id = ?'); values.push(data.parentId ?? null); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description ?? null); }
    if (data.displayOrder !== undefined) { updates.push('display_order = ?'); values.push(data.displayOrder ?? null); }
    
    values.push(id);
    this.getDb().run(`UPDATE account_group SET ${updates.join(', ')} WHERE id = ?`, values);
    this.save();
    return (await this.getAccountGroup(id))!;
  }
  
  async deleteAccountGroup(id: string): Promise<void> {
    this.getDb().run('DELETE FROM account_group WHERE id = ?', [id]);
    this.save();
  }
  
  private rowToAccountGroup(row: unknown[]): AccountGroup {
    return {
      id: row[0] as string,
      name: row[1] as string,
      accountType: row[2] as AccountType,
      parentId: row[3] as string | undefined,
      description: row[4] as string | undefined,
      displayOrder: row[5] as number | undefined,
    };
  }
  
  // ===========================================================================
  // Accounts
  // ===========================================================================
  
  async getAccounts(entityId: string): Promise<Account[]> {
    const rows = this.getDb().exec(`
      SELECT id, entity_id, account_group_id, parent_id, code, name, description,
             unit, costing_method, closed_date, partner_id, linked_account_id,
             is_active, created_at, updated_at
      FROM account WHERE entity_id = ? ORDER BY code, name
    `, [entityId]);
    if (!rows.length) return [];
    return rows[0].values.map(this.rowToAccount);
  }
  
  async getAccount(id: string): Promise<Account | null> {
    const rows = this.getDb().exec(`
      SELECT id, entity_id, account_group_id, parent_id, code, name, description,
             unit, costing_method, closed_date, partner_id, linked_account_id,
             is_active, created_at, updated_at
      FROM account WHERE id = ?
    `, [id]);
    if (!rows.length || !rows[0].values.length) return null;
    return this.rowToAccount(rows[0].values[0]);
  }
  
  async createAccount(data: AccountInput): Promise<Account> {
    const id = uuid();
    const ts = now();
    this.getDb().run(`
      INSERT INTO account (id, entity_id, account_group_id, parent_id, code, name,
                           description, unit, costing_method, closed_date, partner_id,
                           linked_account_id, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, data.entityId, data.accountGroupId, data.parentId ?? null, data.code ?? null,
        data.name, data.description ?? null, data.unit, data.costingMethod ?? null,
        data.closedDate ?? null, data.partnerId ?? null, data.linkedAccountId ?? null,
        data.isActive ? 1 : 0, ts, ts]);
    this.save();
    return (await this.getAccount(id))!;
  }
  
  async updateAccount(id: string, data: Partial<AccountInput>): Promise<Account> {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    
    if (data.accountGroupId !== undefined) { updates.push('account_group_id = ?'); values.push(data.accountGroupId); }
    if (data.parentId !== undefined) { updates.push('parent_id = ?'); values.push(data.parentId ?? null); }
    if (data.code !== undefined) { updates.push('code = ?'); values.push(data.code ?? null); }
    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description ?? null); }
    if (data.unit !== undefined) { updates.push('unit = ?'); values.push(data.unit); }
    if (data.costingMethod !== undefined) { updates.push('costing_method = ?'); values.push(data.costingMethod ?? null); }
    if (data.closedDate !== undefined) { updates.push('closed_date = ?'); values.push(data.closedDate ?? null); }
    if (data.partnerId !== undefined) { updates.push('partner_id = ?'); values.push(data.partnerId ?? null); }
    if (data.linkedAccountId !== undefined) { updates.push('linked_account_id = ?'); values.push(data.linkedAccountId ?? null); }
    if (data.isActive !== undefined) { updates.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }
    
    updates.push('updated_at = ?');
    values.push(now());
    values.push(id);
    
    this.getDb().run(`UPDATE account SET ${updates.join(', ')} WHERE id = ?`, values);
    this.save();
    return (await this.getAccount(id))!;
  }
  
  async deleteAccount(id: string): Promise<void> {
    this.getDb().run('DELETE FROM account WHERE id = ?', [id]);
    this.save();
  }
  
  private rowToAccount(row: unknown[]): Account {
    return {
      id: row[0] as string,
      entityId: row[1] as string,
      accountGroupId: row[2] as string,
      parentId: row[3] as string | undefined,
      code: row[4] as string | undefined,
      name: row[5] as string,
      description: row[6] as string | undefined,
      unit: row[7] as string,
      costingMethod: row[8] as Account['costingMethod'],
      closedDate: row[9] as string | undefined,
      partnerId: row[10] as string | undefined,
      linkedAccountId: row[11] as string | undefined,
      isActive: Boolean(row[12]),
      createdAt: row[13] as string,
      updatedAt: row[14] as string,
    };
  }
  
  // ===========================================================================
  // Transactions
  // ===========================================================================
  
  async getTransactions(entityId: string, options?: {
    accountId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<Transaction[]> {
    let sql = `
      SELECT DISTINCT t.id, t.entity_id, t.date, t.memo, t.reference, t.created_at, t.updated_at
      FROM txn t
    `;
    const params: (string | number)[] = [];
    const conditions: string[] = ['t.entity_id = ?'];
    params.push(entityId);
    
    if (options?.accountId) {
      sql += ' JOIN entry e ON e.txn_id = t.id';
      conditions.push('e.account_id = ?');
      params.push(options.accountId);
    }
    
    if (options?.startDate) {
      conditions.push('t.date >= ?');
      params.push(options.startDate);
    }
    
    if (options?.endDate) {
      conditions.push('t.date <= ?');
      params.push(options.endDate);
    }
    
    sql += ` WHERE ${conditions.join(' AND ')} ORDER BY t.date DESC, t.created_at DESC`;
    
    if (options?.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }
    
    const rows = this.getDb().exec(sql, params);
    if (!rows.length) return [];
    return rows[0].values.map(this.rowToTransaction);
  }
  
  async getTransaction(id: string): Promise<Transaction | null> {
    const rows = this.getDb().exec(`
      SELECT id, entity_id, date, memo, reference, created_at, updated_at
      FROM txn WHERE id = ?
    `, [id]);
    if (!rows.length || !rows[0].values.length) return null;
    return this.rowToTransaction(rows[0].values[0]);
  }
  
  async createTransaction(data: TransactionInput, entries: EntryInput[]): Promise<Transaction> {
    const id = uuid();
    const ts = now();
    
    // Validate entries balance
    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    if (Math.abs(total) > 0.001) {
      throw new Error(`Transaction entries do not balance: ${total}`);
    }
    
    this.getDb().run(`
      INSERT INTO txn (id, entity_id, date, memo, reference, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, data.entityId, data.date, data.memo ?? null, data.reference ?? null, ts, ts]);
    
    // Insert entries
    for (const entry of entries) {
      const entryId = uuid();
      this.getDb().run(`
        INSERT INTO entry (id, txn_id, account_id, amount, note, tag_id, reconciliation_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [entryId, id, entry.accountId, entry.amount, entry.note ?? null,
          entry.tagId ?? null, entry.reconciliationId ?? null]);
    }
    
    this.save();
    return (await this.getTransaction(id))!;
  }
  
  async updateTransaction(id: string, data: Partial<TransactionInput>): Promise<Transaction> {
    const updates: string[] = [];
    const values: (string | null)[] = [];
    
    if (data.date !== undefined) { updates.push('date = ?'); values.push(data.date); }
    if (data.memo !== undefined) { updates.push('memo = ?'); values.push(data.memo ?? null); }
    if (data.reference !== undefined) { updates.push('reference = ?'); values.push(data.reference ?? null); }
    
    updates.push('updated_at = ?');
    values.push(now());
    values.push(id);
    
    this.getDb().run(`UPDATE txn SET ${updates.join(', ')} WHERE id = ?`, values);
    this.save();
    return (await this.getTransaction(id))!;
  }
  
  async deleteTransaction(id: string): Promise<void> {
    this.getDb().run('DELETE FROM txn WHERE id = ?', [id]); // Cascade deletes entries
    this.save();
  }
  
  private rowToTransaction(row: unknown[]): Transaction {
    return {
      id: row[0] as string,
      entityId: row[1] as string,
      date: row[2] as string,
      memo: row[3] as string | undefined,
      reference: row[4] as string | undefined,
      createdAt: row[5] as string,
      updatedAt: row[6] as string,
    };
  }
  
  // ===========================================================================
  // Entries
  // ===========================================================================
  
  async getEntries(transactionId: string): Promise<Entry[]> {
    const rows = this.getDb().exec(`
      SELECT id, txn_id, account_id, amount, note, tag_id, reconciliation_id
      FROM entry WHERE txn_id = ?
    `, [transactionId]);
    if (!rows.length) return [];
    return rows[0].values.map(this.rowToEntry);
  }
  
  async getEntriesForAccount(accountId: string, options?: {
    startDate?: string;
    endDate?: string;
    unreconciled?: boolean;
  }): Promise<Entry[]> {
    let sql = `
      SELECT e.id, e.txn_id, e.account_id, e.amount, e.note, e.tag_id, e.reconciliation_id
      FROM entry e
      JOIN txn t ON t.id = e.txn_id
      WHERE e.account_id = ?
    `;
    const params: (string | number)[] = [accountId];
    
    if (options?.startDate) {
      sql += ' AND t.date >= ?';
      params.push(options.startDate);
    }
    
    if (options?.endDate) {
      sql += ' AND t.date <= ?';
      params.push(options.endDate);
    }
    
    if (options?.unreconciled) {
      sql += ' AND e.reconciliation_id IS NULL';
    }
    
    sql += ' ORDER BY t.date';
    
    const rows = this.getDb().exec(sql, params);
    if (!rows.length) return [];
    return rows[0].values.map(this.rowToEntry);
  }
  
  private rowToEntry(row: unknown[]): Entry {
    return {
      id: row[0] as string,
      transactionId: row[1] as string,
      accountId: row[2] as string,
      amount: row[3] as number,
      note: row[4] as string | undefined,
      tagId: row[5] as string | undefined,
      reconciliationId: row[6] as string | undefined,
    };
  }
  
  // ===========================================================================
  // Units
  // ===========================================================================
  
  async getUnits(): Promise<Unit[]> {
    const rows = this.getDb().exec(`
      SELECT code, name, symbol, unit_type, display_divisor
      FROM unit ORDER BY code
    `);
    if (!rows.length) return [];
    return rows[0].values.map(this.rowToUnit);
  }
  
  async getUnit(code: string): Promise<Unit | null> {
    const rows = this.getDb().exec(`
      SELECT code, name, symbol, unit_type, display_divisor
      FROM unit WHERE code = ?
    `, [code]);
    if (!rows.length || !rows[0].values.length) return null;
    return this.rowToUnit(rows[0].values[0]);
  }
  
  async createUnit(data: UnitInput): Promise<Unit> {
    this.getDb().run(`
      INSERT INTO unit (code, name, symbol, unit_type, display_divisor)
      VALUES (?, ?, ?, ?, ?)
    `, [data.code, data.name, data.symbol ?? null, data.unitType, data.displayDivisor]);
    this.save();
    return (await this.getUnit(data.code))!;
  }
  
  async updateUnit(code: string, data: Partial<UnitInput>): Promise<Unit> {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    
    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.symbol !== undefined) { updates.push('symbol = ?'); values.push(data.symbol ?? null); }
    if (data.unitType !== undefined) { updates.push('unit_type = ?'); values.push(data.unitType); }
    if (data.displayDivisor !== undefined) { updates.push('display_divisor = ?'); values.push(data.displayDivisor); }
    
    values.push(code);
    this.getDb().run(`UPDATE unit SET ${updates.join(', ')} WHERE code = ?`, values);
    this.save();
    return (await this.getUnit(code))!;
  }
  
  private rowToUnit(row: unknown[]): Unit {
    return {
      code: row[0] as string,
      name: row[1] as string,
      symbol: row[2] as string | undefined,
      unitType: row[3] as Unit['unitType'],
      displayDivisor: row[4] as number,
    };
  }
  
  // ===========================================================================
  // Balance Calculations
  // ===========================================================================
  
  async getAccountBalance(accountId: string, asOf?: string): Promise<number> {
    let sql = `
      SELECT COALESCE(SUM(e.amount), 0) as balance
      FROM entry e
      JOIN txn t ON t.id = e.txn_id
      WHERE e.account_id = ?
    `;
    const params: string[] = [accountId];
    
    if (asOf) {
      sql += ' AND t.date <= ?';
      params.push(asOf);
    }
    
    const rows = this.getDb().exec(sql, params);
    if (!rows.length || !rows[0].values.length) return 0;
    return rows[0].values[0][0] as number;
  }
  
  async getBalanceSheet(entityId: string, asOf?: string): Promise<BalanceSheetData> {
    const dateFilter = asOf || new Date().toISOString().split('T')[0];
    
    // Get all account balances with group info
    const sql = `
      SELECT 
        a.id as account_id,
        a.name as account_name,
        a.code as account_code,
        g.id as group_id,
        g.name as group_name,
        g.account_type,
        COALESCE(SUM(e.amount), 0) as balance
      FROM account a
      JOIN account_group g ON g.id = a.account_group_id
      LEFT JOIN entry e ON e.account_id = a.id
      LEFT JOIN txn t ON t.id = e.txn_id AND t.date <= ?
      WHERE a.entity_id = ? AND a.is_active = 1
      GROUP BY a.id, a.name, a.code, g.id, g.name, g.account_type
      ORDER BY g.display_order, a.code
    `;
    
    const rows = this.getDb().exec(sql, [dateFilter, entityId]);
    
    const accountBalances: AccountBalance[] = [];
    const groupTotals = new Map<string, GroupBalance>();
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    
    if (rows.length && rows[0].values.length) {
      for (const row of rows[0].values) {
        const accountType = row[5] as AccountType;
        const balance = row[6] as number;
        const groupId = row[3] as string;
        
        accountBalances.push({
          accountId: row[0] as string,
          accountName: row[1] as string,
          accountCode: row[2] as string | undefined,
          groupId,
          groupName: row[4] as string,
          accountType,
          balance,
          unit: 'USD', // TODO: Get from account
        });
        
        // Aggregate by group
        if (!groupTotals.has(groupId)) {
          groupTotals.set(groupId, {
            groupId,
            groupName: row[4] as string,
            accountType,
            balance: 0,
          });
        }
        groupTotals.get(groupId)!.balance += balance;
        
        // Aggregate by type
        switch (accountType) {
          case 'ASSET':
            totalAssets += balance;
            break;
          case 'LIABILITY':
            totalLiabilities += balance;
            break;
          case 'EQUITY':
            totalEquity += balance;
            break;
          case 'INCOME':
            totalIncome += balance;
            break;
          case 'EXPENSE':
            totalExpense += balance;
            break;
        }
      }
    }
    
    // Net income flows to equity
    const netIncome = -totalIncome - totalExpense; // Income is credit (negative), expense is debit (positive)
    const adjustedEquity = -totalLiabilities + totalEquity + netIncome; // Liabilities are credit (negative)
    
    // Net worth = Assets - Liabilities (in debit/credit terms, assets are positive, liabilities negative)
    const netWorth = totalAssets + totalLiabilities; // Liabilities already negative
    
    return {
      entityId,
      asOf: dateFilter,
      netWorth,
      totalAssets,
      totalLiabilities: Math.abs(totalLiabilities),  // Display as positive
      totalEquity: Math.abs(adjustedEquity),
      groupBalances: Array.from(groupTotals.values()),
      accountBalances,
    };
  }
  
  // ===========================================================================
  // Ledger View
  // ===========================================================================
  
  async getLedgerEntries(accountId: string, options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<LedgerEntry[]> {
    // Get all entries for this account with transaction data
    let sql = `
      SELECT 
        e.id as entry_id,
        t.id as txn_id,
        t.date,
        t.reference,
        t.memo,
        e.amount,
        e.note,
        (SELECT COUNT(*) FROM entry WHERE txn_id = t.id) as entry_count
      FROM entry e
      JOIN txn t ON t.id = e.txn_id
      WHERE e.account_id = ?
    `;
    const params: (string | number)[] = [accountId];
    
    if (options?.startDate) {
      sql += ' AND t.date >= ?';
      params.push(options.startDate);
    }
    if (options?.endDate) {
      sql += ' AND t.date <= ?';
      params.push(options.endDate);
    }
    
    sql += ' ORDER BY t.date ASC, t.created_at ASC';
    
    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    
    const rows = this.getDb().exec(sql, params);
    if (!rows.length) return [];
    
    const entries: LedgerEntry[] = [];
    let runningBalance = 0;
    
    for (const row of rows[0].values) {
      const entryId = row[0] as string;
      const txnId = row[1] as string;
      const amount = row[5] as number;
      const entryCount = row[7] as number;
      const isSplit = entryCount > 2;
      
      runningBalance += amount;
      
      // Get offset account (for simple transactions)
      let offsetAccountId: string | undefined;
      let offsetAccountName: string | undefined;
      let splitEntries: SplitEntry[] | undefined;
      
      if (isSplit) {
        // Get all other entries for splits
        const splitRows = this.getDb().exec(`
          SELECT e.id, e.account_id, a.name, e.amount, e.note
          FROM entry e
          JOIN account a ON a.id = e.account_id
          WHERE e.txn_id = ? AND e.id != ?
          ORDER BY e.amount DESC
        `, [txnId, entryId]);
        
        if (splitRows.length && splitRows[0].values.length) {
          splitEntries = splitRows[0].values.map(r => ({
            entryId: r[0] as string,
            accountId: r[1] as string,
            accountName: r[2] as string,
            accountPath: r[2] as string, // TODO: Build full path
            amount: r[3] as number,
            note: r[4] as string | undefined,
          }));
        }
      } else {
        // Get the single offset account
        const offsetRows = this.getDb().exec(`
          SELECT e.account_id, a.name
          FROM entry e
          JOIN account a ON a.id = e.account_id
          WHERE e.txn_id = ? AND e.id != ?
          LIMIT 1
        `, [txnId, entryId]);
        
        if (offsetRows.length && offsetRows[0].values.length) {
          offsetAccountId = offsetRows[0].values[0][0] as string;
          offsetAccountName = offsetRows[0].values[0][1] as string;
        }
      }
      
      entries.push({
        entryId,
        transactionId: txnId,
        date: row[2] as string,
        reference: row[3] as string | undefined,
        memo: row[4] as string | undefined,
        accountId,
        amount,
        note: row[6] as string | undefined,
        runningBalance,
        offsetAccountId,
        offsetAccountName,
        isSplit,
        splitEntries,
      });
    }
    
    return entries;
  }
  
  async searchAccounts(entityId: string, query: string): Promise<Array<{
    id: string;
    name: string;
    path: string;
    code?: string;
  }>> {
    const lowerQuery = query.toLowerCase();
    
    // Get all accounts for this entity with group info
    const rows = this.getDb().exec(`
      SELECT a.id, a.name, a.code, g.name as group_name, g.account_type
      FROM account a
      JOIN account_group g ON g.id = a.account_group_id
      WHERE a.entity_id = ? AND a.is_active = 1
      ORDER BY g.display_order, a.code, a.name
    `, [entityId]);
    
    if (!rows.length) return [];
    
    const results: Array<{
      id: string;
      name: string;
      path: string;
      code?: string;
    }> = [];
    
    for (const row of rows[0].values) {
      const id = row[0] as string;
      const name = row[1] as string;
      const code = row[2] as string | undefined;
      const groupName = row[3] as string;
      const accountType = row[4] as string;
      
      // Build path: Type : Group : Account
      const typeName = {
        'ASSET': 'Assets',
        'LIABILITY': 'Liabilities',
        'EQUITY': 'Equity',
        'INCOME': 'Income',
        'EXPENSE': 'Expenses',
      }[accountType] || accountType;
      
      const path = `${typeName} : ${groupName} : ${name}`;
      
      // Check if query matches any part
      if (
        name.toLowerCase().includes(lowerQuery) ||
        groupName.toLowerCase().includes(lowerQuery) ||
        path.toLowerCase().includes(lowerQuery) ||
        (code && code.toLowerCase().includes(lowerQuery))
      ) {
        results.push({ id, name, path, code });
      }
    }
    
    return results;
  }
}

// Export singleton
export const sqliteService = new SqliteDataService();


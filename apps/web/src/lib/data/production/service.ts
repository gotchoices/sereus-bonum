// Quereus/Sereus implementation of DataService (STUBS)
// Production backend - to be implemented when Quereus is ready
// See: design/specs/web/global/backend.md

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

const NOT_IMPLEMENTED = 'Quereus backend not yet implemented';

class QuereusDataService implements DataService {
  async initialize(): Promise<void> {
    console.warn('[Quereus] Initialize stub called');
    // TODO: Connect to Sereus/Quereus network
  }
  
  async close(): Promise<void> {
    console.warn('[Quereus] Close stub called');
    // TODO: Disconnect from network
  }
  
  // ===========================================================================
  // Entities
  // ===========================================================================
  
  async getEntities(): Promise<Entity[]> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async getEntity(_id: string): Promise<Entity | null> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async createEntity(_data: EntityInput): Promise<Entity> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async updateEntity(_id: string, _data: Partial<EntityInput>): Promise<Entity> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async deleteEntity(_id: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  // ===========================================================================
  // Account Groups
  // ===========================================================================
  
  async getAccountGroups(): Promise<AccountGroup[]> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async getAccountGroup(_id: string): Promise<AccountGroup | null> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async createAccountGroup(_data: AccountGroupInput): Promise<AccountGroup> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async updateAccountGroup(_id: string, _data: Partial<AccountGroupInput>): Promise<AccountGroup> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async deleteAccountGroup(_id: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  // ===========================================================================
  // Accounts
  // ===========================================================================
  
  async getAccounts(_entityId: string): Promise<Account[]> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async getAccount(_id: string): Promise<Account | null> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async createAccount(_data: AccountInput): Promise<Account> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async updateAccount(_id: string, _data: Partial<AccountInput>): Promise<Account> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async deleteAccount(_id: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  // ===========================================================================
  // Transactions
  // ===========================================================================
  
  async getTransactions(_entityId: string, _options?: {
    accountId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<Transaction[]> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async getTransaction(_id: string): Promise<Transaction | null> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async createTransaction(_data: TransactionInput, _entries: EntryInput[]): Promise<Transaction> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async updateTransaction(_id: string, _data: Partial<TransactionInput>): Promise<Transaction> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async deleteTransaction(_id: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  // ===========================================================================
  // Entries
  // ===========================================================================
  
  async getEntries(_transactionId: string): Promise<Entry[]> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async getEntriesForAccount(_accountId: string, _options?: {
    startDate?: string;
    endDate?: string;
    unreconciled?: boolean;
  }): Promise<Entry[]> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  // ===========================================================================
  // Units
  // ===========================================================================
  
  async getUnits(): Promise<Unit[]> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async getUnit(_code: string): Promise<Unit | null> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async createUnit(_data: UnitInput): Promise<Unit> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async updateUnit(_code: string, _data: Partial<UnitInput>): Promise<Unit> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  // ===========================================================================
  // Balance Calculations
  // ===========================================================================
  
  async getAccountBalance(_accountId: string, _asOf?: string): Promise<number> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async getBalanceSheet(_entityId: string, _endDate?: string, _startDate?: string): Promise<BalanceSheetData> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  // ===========================================================================
  // Ledger View
  // ===========================================================================
  
  async getLedgerEntries(_accountId: string, _options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<LedgerEntry[]> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  async searchAccounts(_entityId: string, _query: string): Promise<Array<{
    id: string;
    name: string;
    path: string;
    code?: string;
  }>> {
    throw new Error(NOT_IMPLEMENTED);
  }
  
  // ===========================================================================
  // Transaction Search
  // ===========================================================================
  
  async getAllTransactions(): Promise<LedgerEntry[]> {
    throw new Error(NOT_IMPLEMENTED);
  }
}

// Export singleton
export const quereusService = new QuereusDataService();


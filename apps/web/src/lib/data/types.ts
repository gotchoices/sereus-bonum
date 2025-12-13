// Data layer types
// See: docs/Schema.md, design/specs/web/global/backend.md

// =============================================================================
// Enums
// =============================================================================

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type UnitType = 'FIAT' | 'CRYPTO' | 'COMMODITY' | 'SECURITY' | 'INVENTORY' | 'OTHER';
export type PartnerType = 'VENDOR' | 'CUSTOMER' | 'BOTH';
export type CostingMethod = 'FIFO' | 'LIFO' | 'AVERAGE';

// Normal balance direction for account types
export const NORMAL_BALANCE: Record<AccountType, 'debit' | 'credit'> = {
  ASSET: 'debit',
  LIABILITY: 'credit',
  EQUITY: 'credit',
  INCOME: 'credit',
  EXPENSE: 'debit',
};

// =============================================================================
// Core Entities
// =============================================================================

export interface Entity {
  id: string;
  name: string;
  description?: string;
  fiscalYearEnd?: string;      // e.g., "12-31"
  baseUnit: string;            // FK → Unit.code
  defaultCostingMethod?: CostingMethod;
  createdAt: string;
  updatedAt: string;
}

export interface AccountGroup {
  id: string;
  name: string;
  accountType: AccountType;
  parentId?: string;           // FK → AccountGroup (for hierarchy)
  description?: string;
  displayOrder?: number;
}

export interface Account {
  id: string;
  entityId: string;
  accountGroupId: string;
  parentId?: string;
  code?: string;
  name: string;
  description?: string;
  unit: string;                // FK → Unit.code
  costingMethod?: CostingMethod;
  closedDate?: string;
  partnerId?: string;
  linkedAccountId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  entityId: string;
  date: string;
  memo?: string;
  reference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Entry {
  id: string;
  transactionId: string;
  accountId: string;
  amount: number;              // Positive = debit, negative = credit
  note?: string;
  tagId?: string;
  reconciliationId?: string;
}

export interface Unit {
  code: string;                // Primary key
  name: string;
  symbol?: string;
  unitType: UnitType;
  displayDivisor: number;      // Stored amount / divisor = display amount
}

export interface Tag {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
}

export interface Reconciliation {
  id: string;
  accountId: string;
  statementDate: string;
  endingBalance: number;
  reconciledAt?: string;
  notes?: string;
}

export interface Partner {
  id: string;
  name: string;
  type?: PartnerType;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Input types (for create/update operations)
// =============================================================================

export type EntityInput = Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>;
export type AccountGroupInput = Omit<AccountGroup, 'id'>;
export type AccountInput = Omit<Account, 'id' | 'createdAt' | 'updatedAt'>;
export type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;
export type EntryInput = Omit<Entry, 'id'>;
export type UnitInput = Unit;
export type TagInput = Omit<Tag, 'id'>;
export type PartnerInput = Omit<Partner, 'id' | 'createdAt' | 'updatedAt'>;

// =============================================================================
// Aggregated data types (for VBS and reports)
// =============================================================================

export interface AccountBalance {
  accountId: string;
  accountName: string;
  accountCode?: string;
  groupId: string;
  groupName: string;
  accountType: AccountType;
  balance: number;             // In smallest unit
  unit: string;
}

export interface BalanceSheetData {
  entityId: string;
  endDate: string;            // End date (renamed from asOf for clarity)
  startDate?: string;         // Optional start date for period-based reports
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;        // Equity accounts only (not including net income)
  totalIncome: number;        // For calculating retained earnings
  totalExpense: number;       // For calculating retained earnings
  groupBalances: GroupBalance[];
  accountBalances: AccountBalance[];
}

export interface GroupBalance {
  groupId: string;
  groupName: string;
  accountType: AccountType;
  balance: number;
}

// =============================================================================
// Ledger view types
// =============================================================================

/** Entry with transaction data joined, for ledger display */
export interface LedgerEntry {
  entryId: string;
  transactionId: string;
  date: string;
  reference?: string;
  memo?: string;
  accountId: string;
  amount: number;           // Positive = debit, negative = credit
  note?: string;
  runningBalance: number;   // Calculated running balance
  // Offset account info (for simple transactions)
  offsetAccountId?: string;
  offsetAccountName?: string;      // Just the account name (e.g., "Checking")
  offsetAccountPath?: string;      // Full path for tooltip (e.g., "Assets : Current : Checking")
  // Split info
  isSplit: boolean;
  splitEntries?: SplitEntry[];
}

export interface SplitEntry {
  entryId: string;
  accountId: string;
  accountName: string;
  accountPath: string;      // Full path for display: "Expenses : Utilities"
  amount: number;
  note?: string;
}

// =============================================================================
// DataService interface
// =============================================================================

export interface DataService {
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
  
  // Entities
  getEntities(): Promise<Entity[]>;
  getEntity(id: string): Promise<Entity | null>;
  createEntity(data: EntityInput): Promise<Entity>;
  updateEntity(id: string, data: Partial<EntityInput>): Promise<Entity>;
  deleteEntity(id: string): Promise<void>;
  
  // Account Groups (shared across all entities)
  getAccountGroups(): Promise<AccountGroup[]>;
  getAccountGroup(id: string): Promise<AccountGroup | null>;
  createAccountGroup(data: AccountGroupInput): Promise<AccountGroup>;
  updateAccountGroup(id: string, data: Partial<AccountGroupInput>): Promise<AccountGroup>;
  deleteAccountGroup(id: string): Promise<void>;
  
  // Accounts
  getAccounts(entityId: string): Promise<Account[]>;
  getAccount(id: string): Promise<Account | null>;
  createAccount(data: AccountInput): Promise<Account>;
  updateAccount(id: string, data: Partial<AccountInput>): Promise<Account>;
  deleteAccount(id: string): Promise<void>;
  
  // Transactions
  getTransactions(entityId: string, options?: { 
    accountId?: string;
    startDate?: string; 
    endDate?: string;
    limit?: number;
  }): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | null>;
  createTransaction(data: TransactionInput, entries: EntryInput[]): Promise<Transaction>;
  updateTransaction(id: string, data: Partial<TransactionInput>): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  
  // Entries (usually accessed via transaction)
  getEntries(transactionId: string): Promise<Entry[]>;
  getEntriesForAccount(accountId: string, options?: {
    startDate?: string;
    endDate?: string;
    unreconciled?: boolean;
  }): Promise<Entry[]>;
  
  // Units
  getUnits(): Promise<Unit[]>;
  getUnit(code: string): Promise<Unit | null>;
  createUnit(data: UnitInput): Promise<Unit>;
  updateUnit(code: string, data: Partial<UnitInput>): Promise<Unit>;
  
  // Balance calculations
  getAccountBalance(accountId: string, asOf?: string): Promise<number>;
  getBalanceSheet(
    entityId: string, 
    endDate?: string,      // End date (formerly 'asOf')
    startDate?: string     // Optional start date for period-based filtering
  ): Promise<BalanceSheetData>;
  
  // Ledger view
  getLedgerEntries(accountId: string, options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    sortOrder?: 'oldest' | 'newest';
  }): Promise<LedgerEntry[]>;
  
  // Account search (for autocomplete)
  searchAccounts(entityId: string, query: string): Promise<Array<{
    id: string;
    name: string;
    path: string;       // "Assets : Current : Checking"
    code?: string;
  }>>;
  
  // Transaction search (cross-entity)
  getAllTransactions(): Promise<LedgerEntry[]>;
}


// Data layer types
// See: design/specs/domain/schema.md, design/specs/web/global/data-backend.md

// =============================================================================
// Enums
// =============================================================================

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type UnitType = 'FIAT' | 'CRYPTO' | 'COMMODITY' | 'SECURITY' | 'INVENTORY' | 'OTHER';
export type PartnerType = 'VENDOR' | 'CUSTOMER' | 'BOTH';
export type CostingMethod = 'FIFO' | 'LIFO' | 'AVERAGE';
/** Where a reference rate came from. Transaction rates aren't rates rows — they're on the entries. */
export type RateSource = 'MARKET' | 'MANUAL';

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
  sourceId?: string;           // Source-system identity (GnuCash account GUID) for import mapping reuse
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  entityId: string;
  date: string;
  memo?: string;
  reference?: string;
  /**
   * Reckoning unit — the unit `Entry.value` is expressed in. Undefined when every entry's account
   * shares one unit (the ordinary single-unit transaction). May be ANY unit, not just a currency:
   * a stock-for-stock barter is reckoned in one of the stocks. See design/specs/domain/units.md.
   */
  valueUnit?: string;          // FK → Unit.code
  sourceId?: string;           // Source-system identity (GnuCash GUID / OFX FITID) for import merge
  createdAt: string;
  updatedAt: string;
}

export interface Entry {
  id: string;
  transactionId: string;
  accountId: string;
  /** Quantity in the ACCOUNT's unit, smallest increment. Positive = debit, negative = credit. */
  amount: number;
  /**
   * The same entry restated in the transaction's `valueUnit`. Undefined means "same as `amount`" —
   * the account's unit already IS the reckoning unit. The entry's exchange rate is `value / amount`,
   * so one transaction can carry a different rate per entry (a multi-fill trade).
   */
  value?: number;
  note?: string;
  tagId?: string;
  reconciliationId?: string;
}

export interface Unit {
  /** Primary key. Bare for currencies ("USD"); namespaced otherwise ("NYSE:VPER", "INV:widget") —
   *  tickers collide across markets, so the namespace is required, not cosmetic. */
  code: string;
  name: string;
  symbol?: string;             // Short display form ("$", "€", "VPER")
  unitType: UnitType;
  displayDivisor: number;      // Stored amount / divisor = display amount
}

/**
 * An observed rate between two units — a reference quote for valuing holdings at report time.
 * Transaction-time rates are NOT here; they live on entries as `value / amount`.
 * Interpretation: 1 unitA = (rateNumerator / rateDenominator) unitB, exact rational.
 */
export interface Exchange {
  id: string;
  date: string;
  unitA: string;               // FK → Unit.code
  unitB: string;               // FK → Unit.code
  rateNumerator: number;
  rateDenominator: number;
  source: RateSource;
  notes?: string;
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
export type EntryInput = Omit<Entry, 'id' | 'transactionId'>;
export type UnitInput = Unit;
export type ExchangeInput = Omit<Exchange, 'id'>;
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
  /**
   * Move an account to a new group and/or parent, carrying its whole descendant subtree into the new
   * group (the single-path invariant: a nested account shares its parent's group). Handles the FK-order
   * problem internally. `newParentId` null → the account sits directly in `newGroupId`.
   */
  moveAccountSubtree(rootId: string, newGroupId: string, newParentId: string | null): Promise<void>;
  
  // Transactions
  getTransactions(entityId: string, options?: { 
    accountId?: string;
    startDate?: string; 
    endDate?: string;
    limit?: number;
  }): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | null>;
  createTransaction(data: TransactionInput, entries: EntryInput[]): Promise<Transaction>;
  // When `entries` is provided, the transaction's entries are fully replaced (must balance); when
  // omitted, only the transaction header fields are updated.
  updateTransaction(id: string, data: Partial<TransactionInput>, entries?: EntryInput[]): Promise<Transaction>;
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

  // Reference rates (report-time valuation only — see design/specs/domain/units.md)
  getExchangeRates(options?: { unitA?: string; unitB?: string; asOf?: string }): Promise<Exchange[]>;
  createExchangeRate(data: ExchangeInput): Promise<Exchange>;
  
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

  // Bulk import — write pre-formed accounts, transactions, and entries in ONE atomic
  // db transaction (used by the merge importer; rows carry caller-assigned ids).
  bulkImport(data: BulkImportData): Promise<void>;
}

export interface BulkImportData {
  units?: Unit[];              // created first — accounts and txn.valueUnit reference them
  accounts: Account[];
  transactions: Transaction[];
  entries: Entry[];
  rates?: Exchange[];          // imported price history (reference rates)
}


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
/**
 * How a report values holdings that aren't already in the display unit.
 *
 * - `COST`  — what was actually paid: the sum of the entries' recorded values. EXACT, consults no
 *   rates, and the statement balances with no gain/loss line. Default, because it is a fact.
 * - `MARKET` — native quantity x the report-date reference rate. An estimate, and it needs the
 *   derived Unrecognized Gain/Loss line to balance.
 */
export type Valuation = 'COST' | 'MARKET';

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
  /**
   * Read-side denormalizations, maintained on write and never queried for.
   *
   * The store charges per-row cursor cost for any predicate other than `col = ?` on a selective
   * index, so a table-wide question like "what is the latest entry date?" costs seconds even though
   * it returns one value. These ride along on the entity row instead.
   */
  maxEntryDate?: string;       // latest entry date; RAISED only (an over-estimate is harmless)
  reckoningUnits?: string[];   // every txn.value_unit ever used in these books
  entryPeriods?: string[];     // 'YYYY-MM' buckets holding entries; over-listing is harmless
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

export type EntityInput = Omit<Entity, 'id' | 'createdAt' | 'updatedAt' | 'maxEntryDate' | 'reckoningUnits' | 'entryPeriods'>;
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
  /**
   * The figure being reported, in `unit`. Under COST valuation this is the sum of the entries'
   * recorded values (already in the reckoning unit); under MARKET it is the raw quantity.
   */
  balance: number;
  unit: string;
  /** THE FACT: quantity in the account's OWN unit, whatever the valuation. Never converted. */
  nativeBalance?: number;
  nativeUnit?: string;
  /**
   * THE ESTIMATE: `balance` expressed in the report's display unit, smallest increment.
   * `null` means no rate path existed — show it as unvalued and exclude it from totals.
   * Never coerce this to 0; that silently understates the books.
   */
  convertedBalance?: number | null;
  /** True when `convertedBalance` came from a rate. False when the account already holds the display unit. */
  isEstimate?: boolean;
  /** Date of the stalest quote behind the estimate, and the units traversed — for the UI to expose. */
  rateAsOf?: string;
  ratePath?: string[];
}

export interface BalanceSheetData {
  entityId: string;
  endDate: string;            // End date (renamed from asOf for clarity)
  startDate?: string;         // Optional start date for period-based reports
  /** Unit every total below is expressed in. Defaults to the entity's baseUnit. */
  displayUnit: string;
  /** How non-display-unit holdings were valued. */
  valuation: Valuation;
  /**
   * True when the figures are exact — COST valuation with every transaction reckoned in the display
   * unit, so nothing was estimated. Reports drop all estimate markers when this is set.
   */
  isExact: boolean;
  /**
   * Derived equity plug that makes a converted statement balance, credit-normal like `totalEquity`.
   * Computed at render, NEVER posted. Zero for single-unit books.
   */
  unrecognizedGainLoss: number;
  /** Units held that couldn't reach `displayUnit` — flagged for the user, excluded from totals. */
  unvaluedUnits: string[];
  /** True when some account was excluded from the totals for want of a rate. */
  totalsArePartial: boolean;
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
  /** In the display unit, excluding any descendant with no rate path. */
  balance: number;
  /** At least one descendant was converted, so this subtotal is an estimate. */
  hasEstimate?: boolean;
  /** At least one descendant had no rate path and is missing from this subtotal. */
  hasUnvalued?: boolean;
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
  amount: number;           // Positive = debit, negative = credit, in the account's own unit
  /** The entry restated in the transaction's reckoning unit; undefined when the units match. */
  value?: number;
  /** The transaction's reckoning unit; undefined for an ordinary single-unit transaction. */
  valueUnit?: string;
  note?: string;
  runningBalance: number;   // Calculated running balance
  // Offset account info (for simple transactions)
  offsetAccountId?: string;
  offsetAccountName?: string;      // Just the account name (e.g., "Checking")
  offsetAccountPath?: string;      // Full path for tooltip (e.g., "Assets : Current : Checking")
  offsetValue?: number;            // The offset entry's value, when the two legs span units
  // Split info
  isSplit: boolean;
  splitEntries?: SplitEntry[];
}

export interface SplitEntry {
  entryId: string;
  accountId: string;
  accountName: string;
  accountPath: string;      // Full path for display: "Expenses : Utilities"
  /** Quantity in the split account's own unit. */
  amount: number;
  /** The split restated in the transaction's reckoning unit; undefined when the units match. */
  value?: number;
  /** The split account's unit, so the editor can show the right precision without a second lookup. */
  unit?: string;
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
    startDate?: string,    // Optional start date for period-based filtering
    displayUnit?: string,  // Unit to render in; defaults to the entity's baseUnit
    valuation?: Valuation  // How non-display-unit holdings are valued; defaults to COST
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


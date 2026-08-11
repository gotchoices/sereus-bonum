// Import module types

export interface ParsedAccount {
  guid: string;
  name: string;
  type: string;
  code?: string;
  description?: string;
  parentGuid?: string;
  unitCode?: string;     // Bonum unit code of the account's commodity (e.g. "USD", "NYSE:VPER")
  placeholder?: boolean; // Explicit placeholder flag from source
  transactionCount?: number; // Number of transactions directly in this account
}

export interface ParsedTransaction {
  guid: string;
  date: string;
  description: string;
  reference?: string;
  valueUnit?: string;    // Source transaction currency as a Bonum unit code (the reckoning unit)
  entries: ParsedEntry[];
}

/**
 * A source split. `amount` is the quantity in the ACCOUNT's unit; `value` is the same split in the
 * transaction's reckoning unit. Both are already scaled to their unit's displayDivisor. They differ
 * only when the split's account holds a different unit than the transaction reckons in.
 */
export interface ParsedEntry {
  guid: string;
  accountGuid: string;
  amount: number;        // Quantity in the account's unit, smallest increment; + debit / - credit
  value: number;         // Same split in the transaction's reckoning unit, smallest increment
  memo?: string;
}

export interface ParsedBooks {
  accounts: ParsedAccount[];
  transactions: ParsedTransaction[];
  commodities: ParsedCommodity[];
  rates: ParsedRate[];
}

export interface ParsedCommodity {
  id: string;            // Bonum unit code: bare "USD" for currencies, "NYSE:VPER" otherwise
  name: string;
  symbol: string;        // Short display form ("VPER")
  unitType: 'FIAT' | 'CRYPTO' | 'COMMODITY' | 'SECURITY' | 'INVENTORY' | 'OTHER';
  displayDivisor: number;
  isCurrency: boolean;
}

/** A quote from the source price database → a Bonum reference rate. */
export interface ParsedRate {
  date: string;
  unitA: string;         // the commodity being quoted
  unitB: string;         // the unit it's quoted in
  numerator: number;     // 1 unitA = (num/denom) unitB — exact rational, never a decimal
  denominator: number;
  source: string;
}

export interface ImportResult {
  entityId: string;
  accountsCreated: number;
  accountsMatched: number;
  accountsSkipped: number;
  transactionsImported: number;
  transactionsDuplicate: number;
  transactionsReview: ParsedTransaction[];
  errors: string[];
}

// --- Merge model (see design/specs/domain/import.md) ---

/** How a source account resolves to a Bonum account. */
// 'skip' = a source node that maps to a catalog group (or is an unused container), so no Bonum
// account is created for it; its descendants attach to the group or to intermediate accounts.
export type AccountDisposition = 'existing' | 'create' | 'unresolved' | 'skip';

export interface ResolvedAccount {
  sourceGuid: string;
  sourceName: string;
  sourcePath: string;               // full source hierarchy path
  disposition: AccountDisposition;
  existingAccountId?: string;       // when 'existing' (matched by stored sourceId or path)
  targetGroupId?: string;           // when 'create' — the Bonum account group to create under
  targetGroupPath?: string;         // human-readable group path
  targetAccountName?: string;       // account name to create
  parentSourceGuid?: string;        // when 'create' — source guid of the Bonum PARENT account
                                    // (an intermediate node below the group boundary); undefined = top of subtree
  unitCode?: string;                // the account's unit (a stock account holds shares, not dollars)
  usedInTransactions: boolean;      // referenced by at least one transaction entry
}

/** Disposition of a source transaction against the target entity's current books. */
export type TxnDisposition = 'exists' | 'new' | 'incomplete';

export interface PreviewEntry {
  accountGuid: string;
  accountId?: string;               // resolved Bonum account id (undefined → unresolved)
  amount: number;                   // quantity in the ACCOUNT's unit, smallest increment; +debit / -credit
  value: number;                    // the same entry in the txn's reckoning unit — what must sum to zero
  note?: string;
}

export interface PreviewTransaction {
  sourceGuid: string;
  date: string;
  description: string;
  reference?: string;
  valueUnit?: string;               // reckoning unit; set only when the txn actually spans units
  disposition: TxnDisposition;
  reason?: string;                  // why 'incomplete'
  entries: PreviewEntry[];
  excluded?: boolean;               // user chose to skip this 'new' transaction
}

export interface MergePlan {
  entityId: string;
  units: ParsedCommodity[];         // source commodities → units (created before anything referencing them)
  rates: ParsedRate[];              // source price history → reference rates
  resolved: ResolvedAccount[];      // by source account
  transactions: PreviewTransaction[];
  counts: { exists: number; new: number; incomplete: number };
}

export interface ImportOptions {
  entityId?: string; // If provided, merge into existing entity
  entityName?: string; // If no entityId, create new entity with this name
  skipDuplicates?: boolean;
  createMissingAccounts?: boolean;
}

// Account mapping types for import UI

export interface AccountMapping {
  sourceAccount: ParsedAccount;
  fullSourcePath: string; // Full hierarchical path (e.g., "Assets:Banking:Checking")
  targetGroup: string | null; // Account group path (e.g., "Cash & Bank")
  targetAccount: string | null; // Account path (e.g., "Banking:Checking")
  isSettled: boolean; // User has reviewed/approved this mapping
  isResolved: boolean; // Has a valid target assignment
  confidence: 'high' | 'medium' | 'low'; // Auto-mapping confidence
  depth: number; // Hierarchy level for indentation (0 = root)
  hasChildren: boolean; // Has child accounts
}

export interface AccountMappingState {
  mappings: AccountMapping[];
  allResolved: boolean;
}

// Validation helpers
export function isValidAccountPath(path: string): boolean {
  if (!path || path.trim().length === 0) return false;
  // Valid path: non-empty segments separated by colons
  // e.g., "Checking", "Banking:Checking", "Assets:Banking:Checking"
  const segments = path.split(':').map(s => s.trim());
  return segments.every(s => s.length > 0);
}

export function isCompleteAccountPath(path: string): boolean {
  if (!isValidAccountPath(path)) return false;
  // Complete path: at least one segment, no trailing/leading colons
  return !path.startsWith(':') && !path.endsWith(':');
}

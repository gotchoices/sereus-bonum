// Import module types

export interface ParsedAccount {
  guid: string;
  name: string;
  type: string;
  code?: string;
  description?: string;
  parentGuid?: string;
  placeholder?: boolean; // Explicit placeholder flag from source
}

export interface ParsedTransaction {
  guid: string;
  date: string;
  description: string;
  reference?: string;
  entries: ParsedEntry[];
}

export interface ParsedEntry {
  guid: string;
  accountGuid: string;
  amount: number; // Already in cents, positive = debit, negative = credit
  memo?: string;
}

export interface ParsedBooks {
  accounts: ParsedAccount[];
  transactions: ParsedTransaction[];
  commodities: ParsedCommodity[];
}

export interface ParsedCommodity {
  id: string;
  name: string;
  symbol: string;
}

export interface ImportResult {
  accountsCreated: number;
  accountsMatched: number;
  accountsSkipped: number;
  transactionsImported: number;
  transactionsDuplicate: number;
  transactionsReview: ParsedTransaction[];
  errors: string[];
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
  targetGroup: string | null; // Account group name (e.g., "Cash & Bank")
  targetAccount: string | null; // Specific account name (optional for placeholder accounts)
  isSettled: boolean; // User has reviewed/approved this mapping
  isResolved: boolean; // Has a valid target assignment
  confidence: 'high' | 'medium' | 'low'; // Auto-mapping confidence
  depth: number; // Hierarchy level for indentation (0 = root)
  isImplicitPlaceholder: boolean; // Has children but not marked as placeholder
}

export interface AccountMappingState {
  mappings: AccountMapping[];
  allResolved: boolean;
}

// Import module types

export interface ParsedAccount {
  guid: string;
  name: string;
  type: string;
  code?: string;
  description?: string;
  parentGuid?: string;
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


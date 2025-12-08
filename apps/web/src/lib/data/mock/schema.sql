-- Bonum SQLite Schema (Mock Backend)
-- See: docs/Schema.md

-- Units (currencies, commodities, etc.)
CREATE TABLE IF NOT EXISTS unit (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('FIAT', 'CRYPTO', 'COMMODITY', 'SECURITY', 'INVENTORY', 'OTHER')),
  display_divisor INTEGER NOT NULL DEFAULT 100
);

-- Account Groups (shared classification)
CREATE TABLE IF NOT EXISTS account_group (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')),
  description TEXT,
  display_order INTEGER
);

-- Entities (business units)
CREATE TABLE IF NOT EXISTS entity (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  fiscal_year_end TEXT,
  base_unit TEXT NOT NULL REFERENCES unit(code),
  default_costing_method TEXT CHECK (default_costing_method IN ('FIFO', 'LIFO', 'AVERAGE')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Partners (vendors, customers)
CREATE TABLE IF NOT EXISTS partner (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('VENDOR', 'CUSTOMER', 'BOTH')),
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Accounts
CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  account_group_id TEXT NOT NULL REFERENCES account_group(id),
  parent_id TEXT REFERENCES account(id),
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL REFERENCES unit(code),
  costing_method TEXT CHECK (costing_method IN ('FIFO', 'LIFO', 'AVERAGE')),
  closed_date TEXT,
  partner_id TEXT REFERENCES partner(id),
  linked_account_id TEXT REFERENCES account(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_id, code)
);

-- Tags (orthogonal classification)
CREATE TABLE IF NOT EXISTS tag (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_id TEXT REFERENCES tag(id)
);

-- Transactions
CREATE TABLE IF NOT EXISTS txn (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  memo TEXT,
  reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Entries (transaction lines)
CREATE TABLE IF NOT EXISTS entry (
  id TEXT PRIMARY KEY,
  txn_id TEXT NOT NULL REFERENCES txn(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES account(id),
  amount INTEGER NOT NULL,  -- Positive = debit, negative = credit
  note TEXT,
  tag_id TEXT REFERENCES tag(id),
  reconciliation_id TEXT REFERENCES reconciliation(id)
);

-- Reconciliations
CREATE TABLE IF NOT EXISTS reconciliation (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES account(id),
  statement_date TEXT NOT NULL,
  ending_balance INTEGER NOT NULL,
  reconciled_at TEXT,
  notes TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_account_entity ON account(entity_id);
CREATE INDEX IF NOT EXISTS idx_account_group ON account(account_group_id);
CREATE INDEX IF NOT EXISTS idx_txn_entity ON txn(entity_id);
CREATE INDEX IF NOT EXISTS idx_txn_date ON txn(date);
CREATE INDEX IF NOT EXISTS idx_entry_txn ON entry(txn_id);
CREATE INDEX IF NOT EXISTS idx_entry_account ON entry(account_id);


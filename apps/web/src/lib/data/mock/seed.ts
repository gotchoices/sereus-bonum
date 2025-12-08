// Demo data seeding
// Templates have structure but no transactions
// Debug mode adds sample transactions for testing VBS

import type { Database } from 'sql.js';

const NOW = new Date().toISOString();

// =============================================================================
// Standard Units
// =============================================================================

const UNITS = [
  { code: 'USD', name: 'US Dollar', symbol: '$', unitType: 'FIAT', displayDivisor: 100 },
  { code: 'EUR', name: 'Euro', symbol: '€', unitType: 'FIAT', displayDivisor: 100 },
];

// =============================================================================
// Standard Account Groups
// =============================================================================

const ACCOUNT_GROUPS = [
  // Assets
  { id: 'grp-cash', name: 'Cash & Bank', accountType: 'ASSET', displayOrder: 100 },
  { id: 'grp-receivables', name: 'Receivables', accountType: 'ASSET', displayOrder: 110 },
  { id: 'grp-investments', name: 'Investments', accountType: 'ASSET', displayOrder: 120 },
  { id: 'grp-property', name: 'Property & Equipment', accountType: 'ASSET', displayOrder: 130 },
  { id: 'grp-other-assets', name: 'Other Assets', accountType: 'ASSET', displayOrder: 190 },
  
  // Liabilities
  { id: 'grp-credit', name: 'Credit Cards', accountType: 'LIABILITY', displayOrder: 200 },
  { id: 'grp-payables', name: 'Payables', accountType: 'LIABILITY', displayOrder: 210 },
  { id: 'grp-loans', name: 'Loans & Mortgages', accountType: 'LIABILITY', displayOrder: 220 },
  { id: 'grp-other-liab', name: 'Other Liabilities', accountType: 'LIABILITY', displayOrder: 290 },
  
  // Equity
  { id: 'grp-capital', name: 'Owner Capital', accountType: 'EQUITY', displayOrder: 300 },
  { id: 'grp-retained', name: 'Retained Earnings', accountType: 'EQUITY', displayOrder: 310 },
  
  // Income
  { id: 'grp-income', name: 'Income', accountType: 'INCOME', displayOrder: 400 },
  { id: 'grp-other-income', name: 'Other Income', accountType: 'INCOME', displayOrder: 410 },
  
  // Expenses
  { id: 'grp-living', name: 'Living Expenses', accountType: 'EXPENSE', displayOrder: 500 },
  { id: 'grp-operating', name: 'Operating Expenses', accountType: 'EXPENSE', displayOrder: 510 },
  { id: 'grp-cogs', name: 'Cost of Goods Sold', accountType: 'EXPENSE', displayOrder: 520 },
  { id: 'grp-taxes', name: 'Taxes', accountType: 'EXPENSE', displayOrder: 590 },
];

// =============================================================================
// Home Finance Template
// =============================================================================

const HOME_ENTITY = {
  id: 'entity-home',
  name: 'Home Finance',
  description: 'Personal and household finances',
  baseUnit: 'USD',
  fiscalYearEnd: '12-31',
};

const HOME_ACCOUNTS = [
  // Assets
  { id: 'acc-home-checking', groupId: 'grp-cash', code: '1010', name: 'Checking Account' },
  { id: 'acc-home-savings', groupId: 'grp-cash', code: '1020', name: 'Savings Account' },
  { id: 'acc-home-brokerage', groupId: 'grp-investments', code: '1210', name: 'Brokerage' },
  { id: 'acc-home-retirement', groupId: 'grp-investments', code: '1220', name: '401(k)' },
  { id: 'acc-home-house', groupId: 'grp-property', code: '1310', name: 'House' },
  { id: 'acc-home-vehicle', groupId: 'grp-property', code: '1320', name: 'Vehicle' },
  
  // Liabilities
  { id: 'acc-home-visa', groupId: 'grp-credit', code: '2010', name: 'Visa' },
  { id: 'acc-home-mastercard', groupId: 'grp-credit', code: '2020', name: 'Mastercard' },
  { id: 'acc-home-mortgage', groupId: 'grp-loans', code: '2210', name: 'Mortgage' },
  { id: 'acc-home-autoloan', groupId: 'grp-loans', code: '2220', name: 'Auto Loan' },
  
  // Equity
  { id: 'acc-home-opening', groupId: 'grp-capital', code: '3010', name: 'Opening Balance' },
  
  // Income
  { id: 'acc-home-salary', groupId: 'grp-income', code: '4010', name: 'Salary' },
  { id: 'acc-home-dividends', groupId: 'grp-other-income', code: '4110', name: 'Dividends' },
  
  // Expenses
  { id: 'acc-home-groceries', groupId: 'grp-living', code: '5010', name: 'Groceries' },
  { id: 'acc-home-utilities', groupId: 'grp-living', code: '5020', name: 'Utilities' },
  { id: 'acc-home-dining', groupId: 'grp-living', code: '5030', name: 'Dining Out' },
  { id: 'acc-home-gas', groupId: 'grp-living', code: '5040', name: 'Gas & Fuel' },
];

// =============================================================================
// Small Business Template
// =============================================================================

const BIZ_ENTITY = {
  id: 'entity-biz',
  name: 'Small Business',
  description: 'Small business accounting',
  baseUnit: 'USD',
  fiscalYearEnd: '12-31',
};

const BIZ_ACCOUNTS = [
  // Assets
  { id: 'acc-biz-checking', groupId: 'grp-cash', code: '1010', name: 'Business Checking' },
  { id: 'acc-biz-savings', groupId: 'grp-cash', code: '1020', name: 'Business Savings' },
  { id: 'acc-biz-ar', groupId: 'grp-receivables', code: '1110', name: 'Accounts Receivable' },
  { id: 'acc-biz-equipment', groupId: 'grp-property', code: '1310', name: 'Equipment' },
  
  // Liabilities
  { id: 'acc-biz-cc', groupId: 'grp-credit', code: '2010', name: 'Business Credit Card' },
  { id: 'acc-biz-ap', groupId: 'grp-payables', code: '2110', name: 'Accounts Payable' },
  { id: 'acc-biz-loan', groupId: 'grp-loans', code: '2210', name: 'Business Loan' },
  
  // Equity
  { id: 'acc-biz-capital', groupId: 'grp-capital', code: '3010', name: 'Owner Investment' },
  { id: 'acc-biz-draw', groupId: 'grp-retained', code: '3110', name: 'Owner Draw' },
  
  // Income
  { id: 'acc-biz-sales', groupId: 'grp-income', code: '4010', name: 'Sales Revenue' },
  { id: 'acc-biz-services', groupId: 'grp-income', code: '4020', name: 'Service Revenue' },
  
  // Expenses
  { id: 'acc-biz-rent', groupId: 'grp-operating', code: '5010', name: 'Rent' },
  { id: 'acc-biz-payroll', groupId: 'grp-operating', code: '5020', name: 'Payroll' },
  { id: 'acc-biz-supplies', groupId: 'grp-operating', code: '5030', name: 'Office Supplies' },
  { id: 'acc-biz-cogs', groupId: 'grp-cogs', code: '5110', name: 'Cost of Goods Sold' },
];

// =============================================================================
// Debug Transactions (for VBS testing)
// =============================================================================

interface DebugTxn {
  id: string;
  entityId: string;
  date: string;
  memo: string;
  entries: { accountId: string; amount: number }[];
}

const DEBUG_TRANSACTIONS: DebugTxn[] = [
  // Home entity: Opening balances
  {
    id: 'txn-home-001',
    entityId: 'entity-home',
    date: '2024-01-01',
    memo: 'Opening balances',
    entries: [
      { accountId: 'acc-home-checking', amount: 500000 },    // $5,000 debit
      { accountId: 'acc-home-savings', amount: 1500000 },    // $15,000 debit
      { accountId: 'acc-home-brokerage', amount: 5000000 },  // $50,000 debit
      { accountId: 'acc-home-retirement', amount: 7500000 }, // $75,000 debit
      { accountId: 'acc-home-house', amount: 35000000 },     // $350,000 debit
      { accountId: 'acc-home-vehicle', amount: 2500000 },    // $25,000 debit
      { accountId: 'acc-home-mortgage', amount: -28000000 }, // $280,000 credit
      { accountId: 'acc-home-autoloan', amount: -1500000 },  // $15,000 credit
      { accountId: 'acc-home-visa', amount: -250000 },       // $2,500 credit
      { accountId: 'acc-home-opening', amount: -22250000 },  // Equity balancing
    ]
  },
  // Home entity: Monthly salary
  {
    id: 'txn-home-002',
    entityId: 'entity-home',
    date: '2024-01-15',
    memo: 'January salary',
    entries: [
      { accountId: 'acc-home-checking', amount: 450000 },  // $4,500 net
      { accountId: 'acc-home-salary', amount: -450000 },   // Income
    ]
  },
  // Home entity: Expenses
  {
    id: 'txn-home-003',
    entityId: 'entity-home',
    date: '2024-01-20',
    memo: 'Groceries',
    entries: [
      { accountId: 'acc-home-groceries', amount: 15000 },  // $150
      { accountId: 'acc-home-visa', amount: -15000 },
    ]
  },
  {
    id: 'txn-home-004',
    entityId: 'entity-home',
    date: '2024-01-25',
    memo: 'Electric bill',
    entries: [
      { accountId: 'acc-home-utilities', amount: 12500 },  // $125
      { accountId: 'acc-home-checking', amount: -12500 },
    ]
  },
  
  // Business entity: Opening balances  
  {
    id: 'txn-biz-001',
    entityId: 'entity-biz',
    date: '2024-01-01',
    memo: 'Opening balances',
    entries: [
      { accountId: 'acc-biz-checking', amount: 2500000 },  // $25,000
      { accountId: 'acc-biz-savings', amount: 1000000 },   // $10,000
      { accountId: 'acc-biz-equipment', amount: 1500000 }, // $15,000
      { accountId: 'acc-biz-loan', amount: -2000000 },     // $20,000 loan
      { accountId: 'acc-biz-capital', amount: -3000000 },  // Owner investment
    ]
  },
  // Business entity: Sales
  {
    id: 'txn-biz-002',
    entityId: 'entity-biz',
    date: '2024-01-10',
    memo: 'Invoice #1001 - Customer A',
    entries: [
      { accountId: 'acc-biz-ar', amount: 500000 },     // $5,000 receivable
      { accountId: 'acc-biz-sales', amount: -500000 }, // Revenue
    ]
  },
  {
    id: 'txn-biz-003',
    entityId: 'entity-biz',
    date: '2024-01-15',
    memo: 'Received payment - Invoice #1001',
    entries: [
      { accountId: 'acc-biz-checking', amount: 500000 }, // Cash in
      { accountId: 'acc-biz-ar', amount: -500000 },      // Clear receivable
    ]
  },
  // Business entity: Expenses
  {
    id: 'txn-biz-004',
    entityId: 'entity-biz',
    date: '2024-01-20',
    memo: 'January rent',
    entries: [
      { accountId: 'acc-biz-rent', amount: 200000 },     // $2,000
      { accountId: 'acc-biz-checking', amount: -200000 },
    ]
  },
  {
    id: 'txn-biz-005',
    entityId: 'entity-biz',
    date: '2024-01-25',
    memo: 'Office supplies',
    entries: [
      { accountId: 'acc-biz-supplies', amount: 15000 }, // $150
      { accountId: 'acc-biz-cc', amount: -15000 },
    ]
  },
];

// =============================================================================
// Seed functions
// =============================================================================

export function seedDemoData(db: Database): void {
  // Insert units
  for (const u of UNITS) {
    db.run(
      `INSERT OR IGNORE INTO unit (code, name, symbol, unit_type, display_divisor)
       VALUES (?, ?, ?, ?, ?)`,
      [u.code, u.name, u.symbol, u.unitType, u.displayDivisor]
    );
  }
  
  // Insert account groups
  for (const g of ACCOUNT_GROUPS) {
    db.run(
      `INSERT OR IGNORE INTO account_group (id, name, account_type, display_order)
       VALUES (?, ?, ?, ?)`,
      [g.id, g.name, g.accountType, g.displayOrder]
    );
  }
  
  // Insert Home entity
  db.run(
    `INSERT OR IGNORE INTO entity (id, name, description, base_unit, fiscal_year_end, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [HOME_ENTITY.id, HOME_ENTITY.name, HOME_ENTITY.description, HOME_ENTITY.baseUnit, HOME_ENTITY.fiscalYearEnd, NOW, NOW]
  );
  
  // Insert Home accounts
  for (const a of HOME_ACCOUNTS) {
    db.run(
      `INSERT OR IGNORE INTO account (id, entity_id, account_group_id, code, name, unit, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [a.id, HOME_ENTITY.id, a.groupId, a.code, a.name, 'USD', NOW, NOW]
    );
  }
  
  // Insert Business entity
  db.run(
    `INSERT OR IGNORE INTO entity (id, name, description, base_unit, fiscal_year_end, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [BIZ_ENTITY.id, BIZ_ENTITY.name, BIZ_ENTITY.description, BIZ_ENTITY.baseUnit, BIZ_ENTITY.fiscalYearEnd, NOW, NOW]
  );
  
  // Insert Business accounts
  for (const a of BIZ_ACCOUNTS) {
    db.run(
      `INSERT OR IGNORE INTO account (id, entity_id, account_group_id, code, name, unit, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [a.id, BIZ_ENTITY.id, a.groupId, a.code, a.name, 'USD', NOW, NOW]
    );
  }
}

export function seedDebugTransactions(db: Database): void {
  for (const txn of DEBUG_TRANSACTIONS) {
    // Insert transaction
    db.run(
      `INSERT OR IGNORE INTO txn (id, entity_id, date, memo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [txn.id, txn.entityId, txn.date, txn.memo, NOW, NOW]
    );
    
    // Insert entries
    for (let i = 0; i < txn.entries.length; i++) {
      const e = txn.entries[i];
      db.run(
        `INSERT OR IGNORE INTO entry (id, txn_id, account_id, amount)
         VALUES (?, ?, ?, ?)`,
        [`${txn.id}-${i}`, txn.id, e.accountId, e.amount]
      );
    }
  }
}


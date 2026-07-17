// Demo data seeding
// Templates have structure but no transactions
// Debug mode adds sample transactions for testing VBS

import type { Database } from 'sql.js';

const NOW = new Date().toISOString();

// =============================================================================
// Standard Units
// =============================================================================

export const UNITS = [
  { code: 'USD', name: 'US Dollar', symbol: '$', unitType: 'FIAT', displayDivisor: 100 },
  { code: 'EUR', name: 'Euro', symbol: '€', unitType: 'FIAT', displayDivisor: 100 },
];

// =============================================================================
// Standard Account Groups (matches specs/web/global/account-groups.md)
// =============================================================================

// Hierarchical account groups
// parentId creates nesting: parent groups contain child groups
// Structure matches specs/web/global/account-groups.md
export const ACCOUNT_GROUPS = [
  // =========== ASSETS (top-level + children) ===========
  { id: 'grp-assets', name: 'Assets', accountType: 'ASSET', parentId: null, displayOrder: 1 },
  
  { id: 'grp-current-assets', name: 'Current Assets', accountType: 'ASSET', parentId: 'grp-assets', displayOrder: 100 },
  { id: 'grp-cash', name: 'Cash', accountType: 'ASSET', parentId: 'grp-current-assets', displayOrder: 101 },
  { id: 'grp-bank', name: 'Bank', accountType: 'ASSET', parentId: 'grp-current-assets', displayOrder: 102 },
  { id: 'grp-private-credit', name: 'Private Credit', accountType: 'ASSET', parentId: 'grp-current-assets', displayOrder: 103 },
  { id: 'grp-reimbursements-asset', name: 'Reimbursements', accountType: 'ASSET', parentId: 'grp-current-assets', displayOrder: 104 },
  { id: 'grp-receivables', name: 'Receivables', accountType: 'ASSET', parentId: 'grp-current-assets', displayOrder: 105 },
  
  { id: 'grp-fixed-assets', name: 'Fixed Assets', accountType: 'ASSET', parentId: 'grp-assets', displayOrder: 110 },
  { id: 'grp-real-property', name: 'Real Property', accountType: 'ASSET', parentId: 'grp-fixed-assets', displayOrder: 111 },
  { id: 'grp-equipment', name: 'Equipment', accountType: 'ASSET', parentId: 'grp-fixed-assets', displayOrder: 112 },
  { id: 'grp-vehicles', name: 'Vehicles', accountType: 'ASSET', parentId: 'grp-fixed-assets', displayOrder: 113 },
  
  { id: 'grp-product', name: 'Product', accountType: 'ASSET', parentId: 'grp-assets', displayOrder: 120 },
  { id: 'grp-inventory', name: 'Inventory', accountType: 'ASSET', parentId: 'grp-product', displayOrder: 121 },
  { id: 'grp-jobs-in-process', name: 'Jobs in Process', accountType: 'ASSET', parentId: 'grp-product', displayOrder: 122 },
  { id: 'grp-work-in-process', name: 'Work in Process', accountType: 'ASSET', parentId: 'grp-product', displayOrder: 123 },
  
  { id: 'grp-other-assets', name: 'Other Assets', accountType: 'ASSET', parentId: 'grp-assets', displayOrder: 190 },
  
  // =========== LIABILITIES (top-level + children) ===========
  { id: 'grp-liabilities', name: 'Liabilities', accountType: 'LIABILITY', parentId: null, displayOrder: 2 },
  
  { id: 'grp-current-liab', name: 'Current Liabilities', accountType: 'LIABILITY', parentId: 'grp-liabilities', displayOrder: 200 },
  { id: 'grp-credit-cards', name: 'Credit Cards', accountType: 'LIABILITY', parentId: 'grp-current-liab', displayOrder: 201 },
  { id: 'grp-accounts-payable', name: 'Accounts Payable', accountType: 'LIABILITY', parentId: 'grp-current-liab', displayOrder: 202 },
  { id: 'grp-payroll-payable', name: 'Payroll Payable', accountType: 'LIABILITY', parentId: 'grp-current-liab', displayOrder: 203 },
  
  { id: 'grp-deposits', name: 'Deposits', accountType: 'LIABILITY', parentId: 'grp-liabilities', displayOrder: 210 },
  
  { id: 'grp-longterm-debt', name: 'Long-term Debt', accountType: 'LIABILITY', parentId: 'grp-liabilities', displayOrder: 220 },
  { id: 'grp-loans', name: 'Loans', accountType: 'LIABILITY', parentId: 'grp-longterm-debt', displayOrder: 221 },
  { id: 'grp-mortgages', name: 'Mortgages', accountType: 'LIABILITY', parentId: 'grp-longterm-debt', displayOrder: 222 },
  
  { id: 'grp-other-liab', name: 'Other Liabilities', accountType: 'LIABILITY', parentId: 'grp-liabilities', displayOrder: 290 },
  
  // =========== EQUITY (top-level + children) ===========
  { id: 'grp-equity', name: 'Equity', accountType: 'EQUITY', parentId: null, displayOrder: 3 },
  
  { id: 'grp-adjustments', name: 'Adjustments', accountType: 'EQUITY', parentId: 'grp-equity', displayOrder: 300 },
  { id: 'grp-member-capital', name: 'Member Capital', accountType: 'EQUITY', parentId: 'grp-equity', displayOrder: 310 },
  { id: 'grp-net-income-alloc', name: 'Net Income Allocations', accountType: 'EQUITY', parentId: 'grp-equity', displayOrder: 320 },
  
  // =========== INCOME (top-level + children) ===========
  { id: 'grp-income', name: 'Income', accountType: 'INCOME', parentId: null, displayOrder: 4 },
  
  { id: 'grp-sales', name: 'Sales', accountType: 'INCOME', parentId: 'grp-income', displayOrder: 400 },
  { id: 'grp-employment', name: 'Employment', accountType: 'INCOME', parentId: 'grp-income', displayOrder: 410 },
  { id: 'grp-reimbursements-income', name: 'Reimbursements', accountType: 'INCOME', parentId: 'grp-income', displayOrder: 420 },
  { id: 'grp-adjustments-income', name: 'Adjustments', accountType: 'INCOME', parentId: 'grp-income', displayOrder: 430 },
  
  // =========== EXPENSES (top-level + children) ===========
  { id: 'grp-expenses', name: 'Expenses', accountType: 'EXPENSE', parentId: null, displayOrder: 5 },
  
  { id: 'grp-fixed-expense', name: 'Fixed', accountType: 'EXPENSE', parentId: 'grp-expenses', displayOrder: 500 },
  { id: 'grp-variable-expense', name: 'Variable', accountType: 'EXPENSE', parentId: 'grp-expenses', displayOrder: 510 },
  { id: 'grp-interest', name: 'Interest', accountType: 'EXPENSE', parentId: 'grp-expenses', displayOrder: 520 },
  { id: 'grp-tax', name: 'Tax', accountType: 'EXPENSE', parentId: 'grp-expenses', displayOrder: 530 },
];

// =============================================================================
// Home Finance Template
// =============================================================================

export const HOME_ENTITY = {
  id: 'entity-home',
  name: 'Home Finance',
  description: 'Personal and household finances',
  baseUnit: 'USD',
  fiscalYearEnd: '12-31',
};

export const HOME_ACCOUNTS = [
  // Assets
  { id: 'acc-home-checking', groupId: 'grp-bank', code: '1010', name: 'Checking Account' },
  { id: 'acc-home-savings', groupId: 'grp-bank', code: '1020', name: 'Savings Account' },
  { id: 'acc-home-brokerage', groupId: 'grp-other-assets', code: '1210', name: 'Brokerage' },
  { id: 'acc-home-retirement', groupId: 'grp-other-assets', code: '1220', name: '401(k)' },
  { id: 'acc-home-house', groupId: 'grp-real-property', code: '1310', name: 'House' },
  { id: 'acc-home-vehicle', groupId: 'grp-vehicles', code: '1320', name: 'Vehicle' },
  
  // Liabilities
  { id: 'acc-home-visa', groupId: 'grp-credit-cards', code: '2010', name: 'Visa' },
  { id: 'acc-home-mastercard', groupId: 'grp-credit-cards', code: '2020', name: 'Mastercard' },
  { id: 'acc-home-mortgage', groupId: 'grp-mortgages', code: '2210', name: 'Mortgage' },
  { id: 'acc-home-autoloan', groupId: 'grp-loans', code: '2220', name: 'Auto Loan' },
  
  // Equity
  { id: 'acc-home-opening', groupId: 'grp-member-capital', code: '3010', name: 'Opening Balance' },
  
  // Income
  { id: 'acc-home-salary', groupId: 'grp-employment', code: '4010', name: 'Salary' },
  { id: 'acc-home-dividends', groupId: 'grp-adjustments-income', code: '4110', name: 'Dividends' },
  
  // Expenses
  { id: 'acc-home-groceries', groupId: 'grp-variable-expense', code: '5010', name: 'Groceries' },
  { id: 'acc-home-utilities', groupId: 'grp-fixed-expense', code: '5020', name: 'Utilities' },
  { id: 'acc-home-dining', groupId: 'grp-variable-expense', code: '5030', name: 'Dining Out' },
  { id: 'acc-home-gas', groupId: 'grp-variable-expense', code: '5040', name: 'Gas & Fuel' },
];

// =============================================================================
// Small Business Template
// =============================================================================

export const BIZ_ENTITY = {
  id: 'entity-biz',
  name: 'Small Business',
  description: 'Small business accounting',
  baseUnit: 'USD',
  fiscalYearEnd: '12-31',
};

export const BIZ_ACCOUNTS = [
  // Assets
  { id: 'acc-biz-checking', groupId: 'grp-bank', code: '1010', name: 'Business Checking' },
  { id: 'acc-biz-savings', groupId: 'grp-bank', code: '1020', name: 'Business Savings' },
  { id: 'acc-biz-ar', groupId: 'grp-receivables', code: '1110', name: 'Accounts Receivable' },
  { id: 'acc-biz-equipment', groupId: 'grp-equipment', code: '1310', name: 'Equipment' },
  
  // Liabilities
  { id: 'acc-biz-cc', groupId: 'grp-credit-cards', code: '2010', name: 'Business Credit Card' },
  { id: 'acc-biz-ap', groupId: 'grp-accounts-payable', code: '2110', name: 'Accounts Payable' },
  { id: 'acc-biz-loan', groupId: 'grp-loans', code: '2210', name: 'Business Loan' },
  
  // Equity
  { id: 'acc-biz-capital', groupId: 'grp-member-capital', code: '3010', name: 'Owner Investment' },
  { id: 'acc-biz-draw', groupId: 'grp-net-income-alloc', code: '3110', name: 'Owner Draw' },
  
  // Income
  { id: 'acc-biz-sales', groupId: 'grp-sales', code: '4010', name: 'Sales Revenue' },
  { id: 'acc-biz-services', groupId: 'grp-sales', code: '4020', name: 'Service Revenue' },
  
  // Expenses
  { id: 'acc-biz-rent', groupId: 'grp-fixed-expense', code: '5010', name: 'Rent' },
  { id: 'acc-biz-payroll', groupId: 'grp-fixed-expense', code: '5020', name: 'Payroll' },
  { id: 'acc-biz-supplies', groupId: 'grp-variable-expense', code: '5030', name: 'Office Supplies' },
  { id: 'acc-biz-cogs', groupId: 'grp-variable-expense', code: '5110', name: 'Cost of Goods Sold' },
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

export const DEBUG_TRANSACTIONS: DebugTxn[] = [
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
  
  // Insert account groups (parent groups first due to FK constraint)
  for (const g of ACCOUNT_GROUPS) {
    db.run(
      `INSERT OR IGNORE INTO account_group (id, name, account_type, parent_id, display_order)
       VALUES (?, ?, ?, ?, ?)`,
      [g.id, g.name, g.accountType, g.parentId, g.displayOrder]
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


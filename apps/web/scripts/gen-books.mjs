#!/usr/bin/env node
// Generate bonum-books native dump files with N transactions, for scale testing.
// Usage:
//   node scripts/gen-books.mjs 1000 [outfile.json]   # one file with 1000 txns
//   node scripts/gen-books.mjs                        # graduated set (100/1k/5k/10k/20k) into ../../tmp
//
// Output conforms to design/specs/domain/import.md "Native Books (dump / restore)".
// Restore it via the import screen (.json) — non-interactive, creates a fresh entity.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP = resolve(__dirname, '../../..', 'tmp'); // repo-root/tmp

// Deterministic PRNG (mulberry32) so generated files are reproducible.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Accounts reference the shared seed catalog groups (see mock/seed.ts). USD only.
const ACCOUNTS = [
  { ref: 'a-checking', code: '1010', name: 'Checking Account', accountGroupId: 'grp-bank' },
  { ref: 'a-savings', code: '1020', name: 'Savings Account', accountGroupId: 'grp-bank' },
  { ref: 'a-visa', code: '2010', name: 'Visa', accountGroupId: 'grp-credit-cards' },
  { ref: 'a-opening', code: '3010', name: 'Opening Balance', accountGroupId: 'grp-member-capital' },
  { ref: 'a-salary', code: '4010', name: 'Salary', accountGroupId: 'grp-employment' },
  { ref: 'a-groceries', code: '5010', name: 'Groceries', accountGroupId: 'grp-variable-expense' },
  { ref: 'a-utilities', code: '5020', name: 'Utilities', accountGroupId: 'grp-fixed-expense' },
  { ref: 'a-dining', code: '5030', name: 'Dining Out', accountGroupId: 'grp-variable-expense' },
  { ref: 'a-gas', code: '5040', name: 'Gas & Fuel', accountGroupId: 'grp-variable-expense' },
];

// Expense purchase templates: debit an expense, credit a funding account.
const EXPENSES = [
  { acct: 'a-groceries', memo: 'Groceries', min: 2000, max: 25000 },
  { acct: 'a-utilities', memo: 'Utility bill', min: 5000, max: 30000 },
  { acct: 'a-dining', memo: 'Dining out', min: 1500, max: 12000 },
  { acct: 'a-gas', memo: 'Fuel', min: 3000, max: 9000 },
];
const FUNDING = ['a-checking', 'a-visa'];

function isoDate(dayOffset) {
  // Walk forward from 2020-01-01 without Date arithmetic edge cases: use epoch ms.
  const base = Date.UTC(2020, 0, 1);
  return new Date(base + dayOffset * 86400000).toISOString().slice(0, 10);
}

function generate(count) {
  const rand = rng(0x9e3779b1 ^ count);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const amt = (min, max) => Math.floor(min + rand() * (max - min));

  const transactions = [];

  // Opening balances (one balanced transaction).
  transactions.push({
    date: isoDate(0),
    memo: 'Opening balances',
    entries: [
      { accountRef: 'a-checking', amount: 500000 },
      { accountRef: 'a-savings', amount: 2500000 },
      { accountRef: 'a-opening', amount: -3000000 },
    ],
  });

  let day = 1;
  for (let i = 1; i < count; i++) {
    // Every ~15th txn is a salary deposit; the rest are expense purchases.
    if (i % 15 === 0) {
      const net = amt(300000, 600000);
      transactions.push({
        date: isoDate(day),
        memo: 'Payroll deposit',
        reference: `PR-${i}`,
        entries: [
          { accountRef: 'a-checking', amount: net },
          { accountRef: 'a-salary', amount: -net },
        ],
      });
    } else {
      const e = pick(EXPENSES);
      const a = amt(e.min, e.max);
      transactions.push({
        date: isoDate(day),
        memo: e.memo,
        reference: `TX-${i}`,
        entries: [
          { accountRef: e.acct, amount: a, note: e.memo },
          { accountRef: pick(FUNDING), amount: -a },
        ],
      });
    }
    if (rand() < 0.4) day++; // ~2-3 txns per day
  }

  return {
    format: 'bonum-books',
    version: 1,
    exportedAt: new Date(Date.UTC(2020, 0, 1)).toISOString(),
    entity: {
      name: `Scale Test ${count}`,
      description: `Generated books — ${count} transactions`,
      baseUnit: 'USD',
      fiscalYearEnd: '12-31',
      defaultCostingMethod: 'FIFO',
    },
    units: [{ code: 'USD', name: 'US Dollar', symbol: '$', unitType: 'FIAT', displayDivisor: 100 }],
    accounts: ACCOUNTS.map((a) => ({ ...a, unit: 'USD' })),
    transactions,
  };
}

// --- Wide chart of accounts (long history) --------------------------------------------------------------
// The graduated set above uses 9 accounts, so its monthly MV (accounts × months) stays small — the regime
// where the seek is fine and the MV full-scan workaround (quereus-workarounds.md W4) isn't even justified.
// This preset spreads ≈100 accounts across the seed leaf groups over a ~20-year span, so the MV grows to
// tens of thousands of rows and the MV-scale tripwires actually fire. Groups reference the shared seed
// catalog (mock/seed.ts); types drive funding-vs-target selection so every txn balances.
const WIDE_LEAF = {
  ASSET: ['grp-bank', 'grp-cash', 'grp-receivables', 'grp-real-property', 'grp-equipment', 'grp-vehicles', 'grp-inventory', 'grp-other-assets', 'grp-private-credit'],
  LIABILITY: ['grp-credit-cards', 'grp-accounts-payable', 'grp-loans', 'grp-mortgages', 'grp-deposits', 'grp-other-liab'],
  EQUITY: ['grp-member-capital', 'grp-adjustments'],
  INCOME: ['grp-sales', 'grp-employment', 'grp-reimbursements-income', 'grp-adjustments-income'],
  EXPENSE: ['grp-fixed-expense', 'grp-variable-expense', 'grp-interest', 'grp-tax'],
};
const WIDE_COUNTS = { ASSET: 22, LIABILITY: 14, EQUITY: 4, INCOME: 16, EXPENSE: 44 }; // ≈100 accounts

function generateWide(count) {
  const rand = rng(0x00c0ffee ^ count);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const amt = (min, max) => Math.floor(min + rand() * (max - min));
  const base = Date.UTC(2005, 0, 1); // long span → many month buckets
  const date = (day) => new Date(base + day * 86400000).toISOString().slice(0, 10);

  const accounts = [];
  const byType = { ASSET: [], LIABILITY: [], EQUITY: [], INCOME: [], EXPENSE: [] };
  let code = 1000;
  for (const [type, groups] of Object.entries(WIDE_LEAF)) {
    for (let i = 0; i < WIDE_COUNTS[type]; i++) {
      const ref = `w-${type.toLowerCase()}-${i}`;
      accounts.push({ ref, code: String(code++), name: `${type} ${i}`, accountGroupId: pick(groups), unit: 'USD' });
      byType[type].push(ref);
    }
  }
  const funding = [...byType.ASSET.slice(0, 6), ...byType.LIABILITY.slice(0, 4)];

  const transactions = [];
  const open = { date: date(0), memo: 'Opening balances', entries: [] };
  let openTotal = 0;
  for (const ref of byType.ASSET.slice(0, 10)) { const v = amt(100000, 5000000); open.entries.push({ accountRef: ref, amount: v }); openTotal += v; }
  open.entries.push({ accountRef: byType.EQUITY[0], amount: -openTotal });
  transactions.push(open);

  let day = 1;
  for (let i = 1; i < count; i++) {
    if (rand() < 0.12) {
      const v = amt(200000, 800000);
      transactions.push({ date: date(day), memo: 'Income', reference: `IN-${i}`, entries: [
        { accountRef: pick(byType.ASSET.slice(0, 6)), amount: v },
        { accountRef: pick(byType.INCOME), amount: -v },
      ] });
    } else {
      const v = amt(1500, 60000);
      const target = rand() < 0.85 ? pick(byType.EXPENSE) : pick(byType.ASSET);
      transactions.push({ date: date(day), memo: 'Purchase', reference: `TX-${i}`, entries: [
        { accountRef: target, amount: v },
        { accountRef: pick(funding), amount: -v },
      ] });
    }
    if (rand() < 0.42) day++;
  }

  return {
    format: 'bonum-books', version: 1, exportedAt: new Date(base).toISOString(),
    entity: { name: `Wide Chart ${count}`, description: `Wide-account long-history fixture — ${count} txns`, baseUnit: 'USD', fiscalYearEnd: '12-31', defaultCostingMethod: 'FIFO' },
    units: [{ code: 'USD', name: 'US Dollar', symbol: '$', unitType: 'FIAT', displayDivisor: 100 }],
    accounts, transactions,
  };
}

function writeBooks(books, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(books));
  const bytes = JSON.stringify(books).length;
  const months = new Set(books.transactions.map((t) => t.date.slice(0, 7))).size;
  console.log(`  ${outPath}  (${books.transactions.length} txns, ${books.accounts.length} accts, ${months} months, ${(bytes / 1024 / 1024).toFixed(2)} MB)`);
}

function writeFile(count, outPath) {
  writeBooks(generate(count), outPath);
}

const arg = process.argv[2];
if (arg === 'wide') {
  const count = process.argv[3] ? parseInt(process.argv[3], 10) : 10000;
  const out = process.argv[4] ? resolve(process.argv[4]) : join(TMP, 'books-wide.json');
  console.log('Generating wide fixture:');
  writeBooks(generateWide(count), out);
} else if (arg) {
  const count = parseInt(arg, 10);
  if (!Number.isFinite(count) || count < 1) {
    console.error('Usage: node scripts/gen-books.mjs <count|wide> [count-for-wide] [outfile.json]');
    process.exit(1);
  }
  const out = process.argv[3] ? resolve(process.argv[3]) : join(TMP, `books-${count}.json`);
  console.log('Generating:');
  writeFile(count, out);
} else {
  console.log('Generating graduated set:');
  for (const count of [100, 1000, 5000, 10000, 20000]) {
    writeFile(count, join(TMP, `books-${count}.json`));
  }
}

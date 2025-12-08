/**
 * GnuCash XML Parser Test
 * 
 * Reads a GnuCash file, parses all structures, and reports summary results.
 * Use this to validate parsing logic and identify unhandled elements.
 * 
 * Usage: yarn gnucash <path-to-gnucash-file>
 */

import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { XMLParser } from 'fast-xml-parser';

// ============================================================================
// Types
// ============================================================================

interface GnuCashCommodity {
  space: string;      // e.g., "CURRENCY", "template"
  id: string;         // e.g., "USD"
  name?: string;
  fraction?: number;
}

interface GnuCashAccount {
  id: string;         // GUID
  name: string;
  type: string;       // ROOT, ASSET, LIABILITY, EQUITY, INCOME, EXPENSE, BANK, CREDIT, PAYABLE, etc.
  description?: string;
  parentId?: string;  // GUID of parent account
  commodity?: {
    space: string;
    id: string;
  };
  commodityScu?: number;  // smallest currency unit (e.g., 100 for cents)
}

interface GnuCashSplit {
  id: string;         // GUID
  accountId: string;  // GUID
  value: string;      // e.g., "384616/100" (rational number)
  quantity: string;   // usually same as value unless multi-currency
  memo?: string;
  reconciledState: string;  // 'n' = not reconciled, 'y' = reconciled, 'c' = cleared
  reconcileDate?: string;
}

interface GnuCashTransaction {
  id: string;         // GUID
  currency: {
    space: string;
    id: string;
  };
  datePosted: string;
  dateEntered: string;
  description: string;
  num?: string;       // check number, reference
  splits: GnuCashSplit[];
}

interface ParseResult {
  commodities: GnuCashCommodity[];
  accounts: GnuCashAccount[];
  transactions: GnuCashTransaction[];
  warnings: string[];
  errors: string[];
}

// ============================================================================
// Parsing Helpers
// ============================================================================

function parseRational(rational: string): number {
  if (!rational) return 0;
  const parts = rational.split('/');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) / parseInt(parts[1], 10);
  }
  return parseFloat(rational);
}

function getNestedValue(obj: any, ...keys: string[]): any {
  let current = obj;
  for (const key of keys) {
    if (current === undefined || current === null) return undefined;
    current = current[key];
  }
  return current;
}

function extractText(value: any): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && '#text' in value) return value['#text'];
  return '';
}

// ============================================================================
// Parsers
// ============================================================================

function parseCommodity(raw: any): GnuCashCommodity | null {
  if (!raw) return null;
  
  return {
    space: extractText(raw['cmdty:space']),
    id: extractText(raw['cmdty:id']),
    name: extractText(raw['cmdty:name']) || undefined,
    fraction: raw['cmdty:fraction'] ? parseInt(extractText(raw['cmdty:fraction']), 10) : undefined,
  };
}

function parseAccount(raw: any, warnings: string[]): GnuCashAccount | null {
  if (!raw) return null;
  
  const id = extractText(getNestedValue(raw, 'act:id', '#text') || raw['act:id']);
  const name = extractText(raw['act:name']);
  const type = extractText(raw['act:type']);
  
  if (!id || !name || !type) {
    warnings.push(`Account missing required fields: id=${id}, name=${name}, type=${type}`);
    return null;
  }
  
  const parentRaw = raw['act:parent'];
  const parentId = parentRaw ? extractText(parentRaw['#text'] || parentRaw) : undefined;
  
  const commodityRaw = raw['act:commodity'];
  const commodity = commodityRaw ? {
    space: extractText(commodityRaw['cmdty:space']),
    id: extractText(commodityRaw['cmdty:id']),
  } : undefined;
  
  return {
    id,
    name,
    type,
    description: extractText(raw['act:description']) || undefined,
    parentId,
    commodity,
    commodityScu: raw['act:commodity-scu'] ? parseInt(extractText(raw['act:commodity-scu']), 10) : undefined,
  };
}

function parseSplit(raw: any, warnings: string[]): GnuCashSplit | null {
  if (!raw) return null;
  
  const id = extractText(getNestedValue(raw, 'split:id', '#text') || raw['split:id']);
  const accountRaw = raw['split:account'];
  const accountId = extractText(accountRaw?.['#text'] || accountRaw);
  
  if (!id || !accountId) {
    warnings.push(`Split missing required fields: id=${id}, accountId=${accountId}`);
    return null;
  }
  
  const reconcileDateRaw = raw['split:reconcile-date'];
  const reconcileDate = reconcileDateRaw 
    ? extractText(reconcileDateRaw['ts:date']) 
    : undefined;
  
  return {
    id,
    accountId,
    value: extractText(raw['split:value']),
    quantity: extractText(raw['split:quantity']),
    memo: extractText(raw['split:memo']) || undefined,
    reconciledState: extractText(raw['split:reconciled-state']) || 'n',
    reconcileDate,
  };
}

function parseTransaction(raw: any, warnings: string[]): GnuCashTransaction | null {
  if (!raw) return null;
  
  const id = extractText(getNestedValue(raw, 'trn:id', '#text') || raw['trn:id']);
  
  const currencyRaw = raw['trn:currency'];
  const currency = currencyRaw ? {
    space: extractText(currencyRaw['cmdty:space']),
    id: extractText(currencyRaw['cmdty:id']),
  } : { space: 'CURRENCY', id: 'USD' };
  
  const datePostedRaw = raw['trn:date-posted'];
  const datePosted = datePostedRaw ? extractText(datePostedRaw['ts:date']) : '';
  
  const dateEnteredRaw = raw['trn:date-entered'];
  const dateEntered = dateEnteredRaw ? extractText(dateEnteredRaw['ts:date']) : '';
  
  const description = extractText(raw['trn:description']);
  
  // Parse splits
  const splitsRaw = raw['trn:splits'];
  const splitArray = splitsRaw?.['trn:split'];
  const splits: GnuCashSplit[] = [];
  
  if (Array.isArray(splitArray)) {
    for (const s of splitArray) {
      const split = parseSplit(s, warnings);
      if (split) splits.push(split);
    }
  } else if (splitArray) {
    const split = parseSplit(splitArray, warnings);
    if (split) splits.push(split);
  }
  
  if (!id) {
    warnings.push(`Transaction missing id`);
    return null;
  }
  
  return {
    id,
    currency,
    datePosted,
    dateEntered,
    description,
    num: extractText(raw['trn:num']) || undefined,
    splits,
  };
}

// ============================================================================
// Main Parser
// ============================================================================

async function parseGnuCashFile(filePath: string): Promise<ParseResult> {
  const result: ParseResult = {
    commodities: [],
    accounts: [],
    transactions: [],
    warnings: [],
    errors: [],
  };
  
  // Read and decompress file
  const chunks: Buffer[] = [];
  
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath)
      .pipe(createGunzip())
      .on('data', (chunk: Buffer) => chunks.push(chunk))
      .on('end', resolve)
      .on('error', reject);
  });
  
  const xmlContent = Buffer.concat(chunks).toString('utf-8');
  console.log(`Read ${xmlContent.length.toLocaleString()} bytes of XML`);
  
  // Parse XML
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    preserveOrder: false,
    removeNSPrefix: false,
  });
  
  let parsed: any;
  try {
    parsed = parser.parse(xmlContent);
  } catch (err) {
    result.errors.push(`XML parse error: ${err}`);
    return result;
  }
  
  // Navigate to book
  const book = parsed?.['gnc-v2']?.['gnc:book'];
  if (!book) {
    result.errors.push('Could not find gnc:book element');
    return result;
  }
  
  // Parse commodities
  const commoditiesRaw = book['gnc:commodity'];
  if (Array.isArray(commoditiesRaw)) {
    for (const c of commoditiesRaw) {
      const commodity = parseCommodity(c);
      if (commodity) result.commodities.push(commodity);
    }
  } else if (commoditiesRaw) {
    const commodity = parseCommodity(commoditiesRaw);
    if (commodity) result.commodities.push(commodity);
  }
  
  // Parse accounts
  const accountsRaw = book['gnc:account'];
  if (Array.isArray(accountsRaw)) {
    for (const a of accountsRaw) {
      const account = parseAccount(a, result.warnings);
      if (account) result.accounts.push(account);
    }
  } else if (accountsRaw) {
    const account = parseAccount(accountsRaw, result.warnings);
    if (account) result.accounts.push(account);
  }
  
  // Parse transactions
  const transactionsRaw = book['gnc:transaction'];
  if (Array.isArray(transactionsRaw)) {
    for (const t of transactionsRaw) {
      const transaction = parseTransaction(t, result.warnings);
      if (transaction) result.transactions.push(transaction);
    }
  } else if (transactionsRaw) {
    const transaction = parseTransaction(transactionsRaw, result.warnings);
    if (transaction) result.transactions.push(transaction);
  }
  
  return result;
}

// ============================================================================
// Report Generation
// ============================================================================

function generateReport(result: ParseResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('GNUCASH PARSE RESULTS');
  console.log('='.repeat(60));
  
  // Commodities
  console.log(`\n📦 COMMODITIES: ${result.commodities.length}`);
  for (const c of result.commodities) {
    console.log(`   ${c.space}:${c.id}${c.name ? ` (${c.name})` : ''}`);
  }
  
  // Accounts summary
  console.log(`\n📁 ACCOUNTS: ${result.accounts.length}`);
  const typeCount: Record<string, number> = {};
  for (const a of result.accounts) {
    typeCount[a.type] = (typeCount[a.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(typeCount).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${type}: ${count}`);
  }
  
  // Account hierarchy sample
  console.log('\n   Sample accounts:');
  const rootAccounts = result.accounts.filter(a => a.type === 'ROOT');
  const topLevel = result.accounts.filter(a => 
    rootAccounts.some(r => r.id === a.parentId)
  );
  for (const a of topLevel.slice(0, 10)) {
    const children = result.accounts.filter(c => c.parentId === a.id);
    console.log(`   - ${a.name} (${a.type}) [${children.length} children]`);
  }
  
  // Transactions summary
  console.log(`\n💳 TRANSACTIONS: ${result.transactions.length}`);
  
  // Date range
  const dates = result.transactions
    .map(t => t.datePosted)
    .filter(Boolean)
    .sort();
  if (dates.length > 0) {
    console.log(`   Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
  }
  
  // Split count distribution
  const splitCounts: Record<number, number> = {};
  let totalSplits = 0;
  for (const t of result.transactions) {
    const count = t.splits.length;
    splitCounts[count] = (splitCounts[count] || 0) + 1;
    totalSplits += count;
  }
  console.log(`   Total splits: ${totalSplits.toLocaleString()}`);
  console.log('   Splits per transaction:');
  for (const [count, freq] of Object.entries(splitCounts).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
    console.log(`     ${count} splits: ${freq} transactions`);
  }
  
  // Sample transactions
  console.log('\n   Sample transactions:');
  for (const t of result.transactions.slice(0, 3)) {
    console.log(`   - ${t.datePosted?.split(' ')[0]} "${t.description}" (${t.splits.length} splits)`);
    for (const s of t.splits) {
      const account = result.accounts.find(a => a.id === s.accountId);
      const amount = parseRational(s.value);
      console.log(`       ${account?.name || s.accountId}: ${amount >= 0 ? '+' : ''}${amount.toFixed(2)}`);
    }
  }
  
  // Warnings and errors
  if (result.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS: ${result.warnings.length}`);
    for (const w of result.warnings.slice(0, 10)) {
      console.log(`   ${w}`);
    }
    if (result.warnings.length > 10) {
      console.log(`   ... and ${result.warnings.length - 10} more`);
    }
  }
  
  if (result.errors.length > 0) {
    console.log(`\n❌ ERRORS: ${result.errors.length}`);
    for (const e of result.errors) {
      console.log(`   ${e}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const filePath = process.argv[2];
  
  if (!filePath) {
    console.log('Usage: yarn gnucash <path-to-gnucash-file>');
    console.log('\nExample:');
    console.log('  yarn gnucash ../../tmp/Kyle.gnucash');
    process.exit(1);
  }
  
  console.log(`Parsing: ${filePath}`);
  
  try {
    const result = await parseGnuCashFile(filePath);
    generateReport(result);
    
    // Exit with error if there were errors
    if (result.errors.length > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();


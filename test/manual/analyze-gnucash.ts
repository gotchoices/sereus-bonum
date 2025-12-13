#!/usr/bin/env tsx
/**
 * Analyze GnuCash files and output full account hierarchy with details
 * 
 * Usage: tsx analyze-gnucash.ts <file1.gnucash> [file2.gnucash] > output.txt
 */

import * as fs from 'fs';
import * as zlib from 'zlib';
import { XMLParser } from 'fast-xml-parser';

interface GnuCashAccount {
  guid: string;
  name: string;
  type: string;
  code?: string;
  description?: string;
  parentGuid?: string;
  isPlaceholder: boolean;
  transactionCount: number;
}

interface GnuCashTransaction {
  guid: string;
  date: string;
  description: string;
  splits: Array<{ accountGuid: string; value: string }>;
}

function parseGnuCashFile(filePath: string): { accounts: GnuCashAccount[]; transactions: GnuCashTransaction[] } {
  console.error(`\n📂 Parsing: ${filePath}`);
  
  let xmlContent: string;
  
  // Read and decompress if needed
  const buffer = fs.readFileSync(filePath);
  const isGzipped = buffer[0] === 0x1f && buffer[1] === 0x8b;
  
  if (isGzipped) {
    console.error('  🗜️  Decompressing gzip...');
    xmlContent = zlib.gunzipSync(buffer).toString('utf-8');
  } else {
    xmlContent = buffer.toString('utf-8');
  }
  
  console.error('  📊 Parsing XML...');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    ignoreDeclaration: true,
    removeNSPrefix: true, // Remove namespace prefixes
  });
  
  const parsed = parser.parse(xmlContent);
  const gnucash = parsed['gnc-v2'] || parsed['gnucash'] || parsed;
  const book = gnucash.book || {};
  
  // Debug: show top-level keys
  console.error('  🔍 Book keys:', Object.keys(book).slice(0, 10).join(', '));
  
  // Extract accounts - they're children of book
  const accounts: GnuCashAccount[] = [];
  const accountNodes = Array.isArray(book.account) ? book.account : [book.account].filter(Boolean);
  
  console.error(`  🔍 Account nodes:`, Array.isArray(book.account) ? `array[${book.account.length}]` : typeof book.account);
  
  for (const acc of accountNodes) {
    if (!acc) continue;
    
    const guid = acc.id?.['#text'] || acc.id;
    const name = acc.name?.['#text'] || acc.name;
    const type = acc.type?.['#text'] || acc.type;
    const code = acc.code?.['#text'] || acc.code;
    const description = acc.description?.['#text'] || acc.description;
    const parentGuid = acc.parent?.['#text'] || acc.parent;
    const slots = acc.slots?.slot;
    
    let isPlaceholder = false;
    if (slots) {
      const slotArray = Array.isArray(slots) ? slots : [slots];
      const placeholderSlot = slotArray.find((s: any) => 
        (s.key?.['#text'] || s.key) === 'placeholder'
      );
      if (placeholderSlot) {
        const value = placeholderSlot.value?.['#text'] || placeholderSlot.value;
        isPlaceholder = value === 'true' || value === true;
      }
    }
    
    accounts.push({
      guid: guid || '',
      name: name || '',
      type: type || '',
      code,
      description,
      parentGuid,
      isPlaceholder,
      transactionCount: 0
    });
  }
  
  // Extract transactions and count per account - also children of book
  const transactions: GnuCashTransaction[] = [];
  const txnNodes = Array.isArray(book.transaction) ? book.transaction : [book.transaction].filter(Boolean);
  
  for (const txn of txnNodes) {
    if (!txn) continue;
    
    const guid = txn.id?.['#text'] || txn.id;
    const datePosted = txn['date-posted']?.date?.['#text'] || '';
    const description = txn.description?.['#text'] || txn.description || '';
    
    const splits: Array<{ accountGuid: string; value: string }> = [];
    const splitNodes = txn.splits?.split;
    if (splitNodes) {
      const splitArray = Array.isArray(splitNodes) ? splitNodes : [splitNodes];
      for (const split of splitArray) {
        const accountGuid = split.account?.['#text'] || split.account;
        const value = split.value?.['#text'] || split.value || '0/1';
        splits.push({ accountGuid, value });
        
        // Count transaction for this account
        const account = accounts.find(a => a.guid === accountGuid);
        if (account) {
          account.transactionCount++;
        }
      }
    }
    
    transactions.push({
      guid: guid || '',
      date: datePosted.split(' ')[0] || '',
      description,
      splits
    });
  }
  
  console.error(`  ✅ Found ${accounts.length} accounts, ${transactions.length} transactions`);
  
  return { accounts, transactions };
}

function buildAccountPath(account: GnuCashAccount, allAccounts: GnuCashAccount[]): string {
  const path = [account.name];
  let current = account;
  
  while (current.parentGuid) {
    const parent = allAccounts.find(a => a.guid === current.parentGuid);
    if (!parent) break;
    path.unshift(parent.name);
    current = parent;
  }
  
  return path.join(' : ');
}

function analyzeFile(filePath: string) {
  const { accounts, transactions } = parseGnuCashFile(filePath);
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`FILE: ${filePath}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Accounts: ${accounts.length}`);
  console.log(`Transactions: ${transactions.length}`);
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`ACCOUNT HIERARCHY`);
  console.log(`${'─'.repeat(80)}\n`);
  
  // Sort accounts by path for hierarchical display
  const accountsWithPath = accounts.map(acc => ({
    ...acc,
    path: buildAccountPath(acc, accounts)
  })).sort((a, b) => a.path.localeCompare(b.path));
  
  for (const acc of accountsWithPath) {
    const indent = (acc.path.split(' : ').length - 1) * 2;
    const placeholder = acc.isPlaceholder ? ' [PLACEHOLDER]' : '';
    const code = acc.code ? ` (${acc.code})` : '';
    const txnCount = acc.transactionCount > 0 ? ` - ${acc.transactionCount} txns` : '';
    
    console.log(
      ' '.repeat(indent) +
      `${acc.name}${code} {${acc.type}}${placeholder}${txnCount}`
    );
  }
  
  // Summary statistics
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`STATISTICS`);
  console.log(`${'─'.repeat(80)}\n`);
  
  // Detect implicit placeholders (parent accounts with 0 transactions)
  const explicitPlaceholders = accounts.filter(a => a.isPlaceholder);
  const implicitPlaceholders = accounts.filter(a => 
    !a.isPlaceholder && 
    a.transactionCount === 0 && 
    accounts.some(child => child.parentGuid === a.guid)
  );
  const placeholderAccounts = [...explicitPlaceholders, ...implicitPlaceholders];
  const transactionalAccounts = accounts.filter(a => a.transactionCount > 0);
  const unusedAccounts = accounts.filter(a => 
    a.transactionCount === 0 && 
    !accounts.some(child => child.parentGuid === a.guid)
  );
  
  console.log(`Total accounts: ${accounts.length}`);
  console.log(`  - Placeholder (parent-only): ${placeholderAccounts.length}`);
  console.log(`    • Explicit (marked in GnuCash): ${explicitPlaceholders.length}`);
  console.log(`    • Implicit (parent with 0 txns): ${implicitPlaceholders.length}`);
  console.log(`  - Transactional (with txns): ${transactionalAccounts.length}`);
  console.log(`  - Unused leaf accounts: ${unusedAccounts.length}`);
  
  const typeGroups = accounts.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log(`\nAccount types:`);
  Object.entries(typeGroups).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}`);
  });
  
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`PLACEHOLDER ACCOUNTS (Candidates for AccountGroups)`);
  console.log(`${'─'.repeat(80)}\n`);
  
  // Sort placeholders by path
  const sortedPlaceholders = placeholderAccounts
    .map(acc => ({ ...acc, path: buildAccountPath(acc, accounts) }))
    .sort((a, b) => a.path.localeCompare(b.path));
  
  for (const acc of sortedPlaceholders) {
    const marker = acc.isPlaceholder ? '[EXPLICIT]' : '[IMPLICIT]';
    console.log(`${acc.path} {${acc.type}} ${marker}`);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: tsx analyze-gnucash.ts <file1.gnucash> [file2.gnucash] > output.txt');
  process.exit(1);
}

for (const filePath of args) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    continue;
  }
  
  try {
    analyzeFile(filePath);
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
  }
}

console.log(`\n${'='.repeat(80)}\n`);


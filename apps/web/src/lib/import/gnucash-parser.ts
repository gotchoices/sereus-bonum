import type { ParsedBooks, ParsedAccount, ParsedTransaction, ParsedEntry, ParsedCommodity } from './types';
import { log } from '$lib/logger';

/**
 * Parse GnuCash XML file
 * Based on test/manual/gnucash-parser.ts
 */
export async function parseGnuCashXML(fileContent: string): Promise<ParsedBooks> {
  log.data.info('[GnuCash] Starting parse');
  
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(fileContent, 'text/xml');
  
  // Check for parse errors
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML: ' + parseError.textContent);
  }
  
  const commodities = parseCommodities(xmlDoc);
  const accounts = parseAccounts(xmlDoc);
  const transactions = parseTransactions(xmlDoc);
  
  log.data.info('[GnuCash] Parse complete:', {
    accounts: accounts.length,
    transactions: transactions.length,
    commodities: commodities.length
  });
  
  return { accounts, transactions, commodities };
}

function parseCommodities(xmlDoc: Document): ParsedCommodity[] {
  const commodities: ParsedCommodity[] = [];
  const commodityNodes = xmlDoc.querySelectorAll('gnc\\:commodity, commodity');
  
  commodityNodes.forEach(node => {
    const id = getTextContent(node, 'cmdty\\:id, id') || '';
    const name = getTextContent(node, 'cmdty\\:name, name') || id;
    const space = getTextContent(node, 'cmdty\\:space, space') || '';
    
    commodities.push({
      id: `${space}:${id}`,
      name,
      symbol: id
    });
  });
  
  return commodities;
}

function parseAccounts(xmlDoc: Document): ParsedAccount[] {
  const accounts: ParsedAccount[] = [];
  const accountNodes = xmlDoc.querySelectorAll('gnc\\:account, account');
  
  accountNodes.forEach(node => {
    const guid = getTextContent(node, 'act\\:id, id') || '';
    const name = getTextContent(node, 'act\\:name, name') || '';
    const type = getTextContent(node, 'act\\:type, type') || '';
    const code = getTextContent(node, 'act\\:code, code');
    const description = getTextContent(node, 'act\\:description, description');
    const parentGuid = getTextContent(node, 'act\\:parent, parent');
    
    if (guid && name) {
      accounts.push({
        guid,
        name,
        type,
        code,
        description,
        parentGuid
      });
    }
  });
  
  return accounts;
}

function parseTransactions(xmlDoc: Document): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const txnNodes = xmlDoc.querySelectorAll('gnc\\:transaction, transaction');
  
  txnNodes.forEach(node => {
    const guid = getTextContent(node, 'trn\\:id, id') || '';
    const datePosted = getTextContent(node, 'trn\\:date-posted date, date-posted date') || '';
    const description = getTextContent(node, 'trn\\:description, description') || '';
    const reference = getTextContent(node, 'trn\\:num, num');
    
    // Parse date from GnuCash format (YYYY-MM-DD HH:MM:SS +0000)
    const date = datePosted.split(' ')[0];
    
    // Parse splits (entries)
    const entries = parseSplits(node);
    
    if (guid && date && entries.length > 0) {
      transactions.push({
        guid,
        date,
        description,
        reference,
        entries
      });
    }
  });
  
  return transactions;
}

function parseSplits(txnNode: Element): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const splitNodes = txnNode.querySelectorAll('trn\\:splits split, splits split');
  
  splitNodes.forEach(node => {
    const guid = getTextContent(node, 'split\\:id, id') || '';
    const accountGuid = getTextContent(node, 'split\\:account, account') || '';
    const valueStr = getTextContent(node, 'split\\:value, value') || '0/1';
    const memo = getTextContent(node, 'split\\:memo, memo');
    
    // Parse GnuCash rational number (e.g., "12345/100")
    const amount = parseGnuCashAmount(valueStr);
    
    if (guid && accountGuid) {
      entries.push({
        guid,
        accountGuid,
        amount,
        memo
      });
    }
  });
  
  return entries;
}

/**
 * Parse GnuCash rational number to cents
 * Format: "numerator/denominator"
 * Example: "12345/100" = 123.45 = 12345 cents
 */
function parseGnuCashAmount(rational: string): number {
  const parts = rational.split('/');
  if (parts.length !== 2) return 0;
  
  const numerator = parseInt(parts[0], 10);
  const denominator = parseInt(parts[1], 10);
  
  if (isNaN(numerator) || isNaN(denominator) || denominator === 0) return 0;
  
  // Convert to cents (assuming denominator is 100)
  // If denominator is different, adjust accordingly
  if (denominator === 100) {
    return numerator; // Already in cents
  } else {
    return Math.round((numerator / denominator) * 100);
  }
}

/**
 * Get text content from element, trying multiple selectors
 */
function getTextContent(parent: Element, selectors: string): string | undefined {
  const selectorList = selectors.split(',').map(s => s.trim());
  
  for (const selector of selectorList) {
    const element = parent.querySelector(selector);
    if (element?.textContent) {
      return element.textContent.trim();
    }
  }
  
  return undefined;
}


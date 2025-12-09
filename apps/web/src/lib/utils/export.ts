// Export utilities for CSV and Excel

import type { LedgerEntry } from '$lib/data/types';
import * as XLSX from 'xlsx';

interface TransactionGroup {
  transactionId: string;
  date: string;
  entityId: string;
  entityName: string;
  memo?: string;
  reference?: string;
  entries: Array<{
    entryId: string;
    accountId: string;
    accountName: string;
    accountPath: string;
    amount: number;
    note?: string;
  }>;
}

/**
 * Group entries by transaction
 */
function groupEntriesByTransaction(entries: LedgerEntry[]): TransactionGroup[] {
  const groups = new Map<string, TransactionGroup>();
  
  for (const entry of entries) {
    const txnId = entry.transactionId;
    
    if (!groups.has(txnId)) {
      groups.set(txnId, {
        transactionId: txnId,
        date: entry.date,
        entityId: (entry as any).entityId || '',
        entityName: (entry as any).entityName || '',
        memo: entry.memo,
        reference: entry.reference,
        entries: [],
      });
    }
    
    const group = groups.get(txnId)!;
    group.entries.push({
      entryId: entry.entryId,
      accountId: entry.accountId,
      accountName: (entry as any).accountName || '',
      accountPath: (entry as any).accountPath || '',
      amount: entry.amount,
      note: entry.note,
    });
  }
  
  return Array.from(groups.values());
}

/**
 * Format amount as currency string for export
 */
function formatAmountForExport(amount: number): string {
  return (amount / 100).toFixed(2);
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCsvField(field: string | undefined): string {
  if (!field) return '';
  
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  
  return field;
}

/**
 * Export transaction data to CSV
 */
export function exportToCSV(entries: LedgerEntry[], filename: string = 'transactions.csv'): void {
  const groups = groupEntriesByTransaction(entries);
  
  // CSV Header
  const headers = ['Date', 'Entity', 'Memo', 'Reference', 'Account', 'Debit', 'Credit', 'Note'];
  const rows: string[] = [headers.join(',')];
  
  // Calculate totals
  let totalDebits = 0;
  let totalCredits = 0;
  
  // Add transaction groups
  for (const group of groups) {
    // Transaction header row
    rows.push([
      group.date,
      escapeCsvField(group.entityName),
      escapeCsvField(group.memo),
      escapeCsvField(group.reference),
      '',
      '',
      '',
      '',
    ].join(','));
    
    // Split rows
    for (const entry of group.entries) {
      const debit = entry.amount > 0 ? formatAmountForExport(entry.amount) : '';
      const credit = entry.amount < 0 ? formatAmountForExport(Math.abs(entry.amount)) : '';
      
      if (entry.amount > 0) totalDebits += entry.amount;
      if (entry.amount < 0) totalCredits += Math.abs(entry.amount);
      
      rows.push([
        '',
        '',
        '',
        '',
        escapeCsvField(entry.accountName),
        debit,
        credit,
        escapeCsvField(entry.note),
      ].join(','));
    }
  }
  
  // Add totals row
  rows.push([
    '',
    '',
    '',
    '',
    'Totals:',
    formatAmountForExport(totalDebits),
    formatAmountForExport(totalCredits),
    '',
  ].join(','));
  
  // Add verification row
  const imbalance = Math.abs(totalDebits - totalCredits);
  const isBalanced = imbalance < 0.01;
  const verification = isBalanced ? 'Balanced' : `Imbalance: ${formatAmountForExport(imbalance)}`;
  rows.push([
    '',
    '',
    '',
    '',
    verification,
    '',
    '',
    '',
  ].join(','));
  
  // Create blob and download
  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export transaction data to Excel (XLSX)
 * Requires xlsx library: yarn add xlsx
 */
export function exportToExcel(entries: LedgerEntry[], filename: string = 'transactions.xlsx'): void {
  try {
    const groups = groupEntriesByTransaction(entries);
    
    // Prepare worksheet data
    const wsData: any[][] = [];
    
    // Header row
    wsData.push(['Date', 'Entity', 'Memo', 'Reference', 'Account', 'Debit', 'Credit', 'Note']);
    
    // Calculate totals
    let totalDebits = 0;
    let totalCredits = 0;
    
    // Add transaction groups
    for (const group of groups) {
      // Transaction header row
      wsData.push([
        group.date,
        group.entityName,
        group.memo || '',
        group.reference || '',
        '',
        '',
        '',
        '',
      ]);
      
      // Split rows
      for (const entry of group.entries) {
        const debit = entry.amount > 0 ? formatAmountForExport(entry.amount) : '';
        const credit = entry.amount < 0 ? formatAmountForExport(Math.abs(entry.amount)) : '';
        
        if (entry.amount > 0) totalDebits += entry.amount;
        if (entry.amount < 0) totalCredits += Math.abs(entry.amount);
        
        wsData.push([
          '',
          '',
          '',
          '',
          entry.accountName,
          debit,
          credit,
          entry.note || '',
        ]);
      }
    }
    
    // Add totals row
    wsData.push([
      '',
      '',
      '',
      '',
      'Totals:',
      formatAmountForExport(totalDebits),
      formatAmountForExport(totalCredits),
      '',
    ]);
    
    // Add verification row
    const imbalance = Math.abs(totalDebits - totalCredits);
    const isBalanced = imbalance < 0.01;
    const verification = isBalanced ? 'Balanced' : `Imbalance: ${(imbalance / 100).toFixed(2)}`;
    wsData.push([
      '',
      '',
      '',
      '',
      verification,
      '',
      '',
      '',
    ]);
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 12 },  // Date
      { wch: 20 },  // Entity
      { wch: 30 },  // Memo
      { wch: 12 },  // Reference
      { wch: 30 },  // Account
      { wch: 12 },  // Debit
      { wch: 12 },  // Credit
      { wch: 30 },  // Note
    ];
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    
    // Write file
    XLSX.writeFile(wb, filename);
  } catch (error) {
    console.error('Excel export failed:', error);
    throw new Error('Excel export requires the xlsx package. Falling back to CSV.');
  }
}


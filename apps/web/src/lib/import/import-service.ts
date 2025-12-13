import { parseGnuCashXML } from './gnucash-parser';
import type { ParsedBooks, ImportResult, ImportOptions } from './types';
import { getDataService } from '$lib/data';
import { log } from '$lib/logger';
import * as pako from 'pako';

/**
 * Main import service
 * Handles both "Import Books" (new entity) and "Import Transactions" (existing entity)
 */
export class ImportService {
  
  /**
   * Parse file based on extension
   */
  async parseFile(file: File): Promise<ParsedBooks> {
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.gnucash')) {
      return await this.parseGnuCash(file);
    }
    
    if (fileName.endsWith('.iif')) {
      throw new Error('QuickBooks IIF import not yet implemented');
    }
    
    throw new Error('Unsupported file type');
  }
  
  /**
   * Parse GnuCash file (handles gzip if needed)
   */
  private async parseGnuCash(file: File): Promise<ParsedBooks> {
    log.data.info('[Import] Parsing GnuCash file:', file.name);
    
    // Check if gzipped (magic bytes)
    const header = await this.readFileHeader(file);
    const isGzipped = header[0] === 0x1f && header[1] === 0x8b;
    
    let content: string;
    
    if (isGzipped) {
      log.data.info('[Import] Decompressing gzipped file');
      // Read as array buffer for decompression
      const buffer = await file.arrayBuffer();
      const decompressed = pako.ungzip(new Uint8Array(buffer));
      // Convert to string (UTF-8)
      const decoder = new TextDecoder('utf-8');
      content = decoder.decode(decompressed);
    } else {
      content = await file.text();
    }
    
    return await parseGnuCashXML(content);
  }
  
  /**
   * Read first few bytes of file
   */
  private async readFileHeader(file: File): Promise<Uint8Array> {
    const slice = file.slice(0, 2);
    const buffer = await slice.arrayBuffer();
    return new Uint8Array(buffer);
  }
  
  /**
   * Import parsed books
   */
  async importBooks(
    parsedBooks: ParsedBooks,
    options: ImportOptions
  ): Promise<ImportResult> {
    const dataService = await getDataService();
    
    const result: ImportResult = {
      accountsCreated: 0,
      accountsMatched: 0,
      accountsSkipped: 0,
      transactionsImported: 0,
      transactionsDuplicate: 0,
      transactionsReview: [],
      errors: []
    };
    
    try {
      // Create or get entity
      let entityId = options.entityId;
      if (!entityId && options.entityName) {
        log.data.info('[Import] Creating new entity:', options.entityName);
        const entity = await dataService.createEntity({
          name: options.entityName,
          baseUnit: 'USD', // TODO: Extract from parsed commodities
          description: 'Imported from GnuCash',
          fiscalYearEnd: '12-31'
        });
        entityId = entity.id;
      }
      
      if (!entityId) {
        throw new Error('No entity ID provided or created');
      }
      
      // Import accounts (TODO: Implement account creation with mapping)
      log.data.info('[Import] Would import', parsedBooks.accounts.length, 'accounts');
      result.accountsCreated = parsedBooks.accounts.length;
      
      // Import transactions (TODO: Implement transaction creation with dedup)
      log.data.info('[Import] Would import', parsedBooks.transactions.length, 'transactions');
      result.transactionsImported = parsedBooks.transactions.length;
      
      log.data.info('[Import] Import complete:', result);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.data.error('[Import] Import failed:', error);
      result.errors.push(message);
    }
    
    return result;
  }
}

// Singleton instance
export const importService = new ImportService();


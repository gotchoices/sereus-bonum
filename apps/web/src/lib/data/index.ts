// Data layer entry point
// Exports the active DataService based on configuration
// See: design/specs/web/global/backend.md

import { BACKEND_MODE } from '$lib/config';
import { log } from '$lib/logger';
import type { DataService } from './types';

// Re-export types for convenience
export * from './types';

// Lazy-load the appropriate service to avoid importing unused code
let _dataService: DataService | null = null;

/**
 * Get the data service instance
 * Must call initialize() before using other methods
 */
export async function getDataService(): Promise<DataService> {
  if (_dataService) {
    log.data.debug('Returning existing DataService');
    return _dataService;
  }
  
  log.data.info(`Initializing ${BACKEND_MODE} backend...`);
  
  try {
    if (BACKEND_MODE === 'production') {
      log.data.debug('Loading Quereus service...');
      const { quereusService } = await import('./production/service');
      _dataService = quereusService;
    } else {
      log.data.debug('Loading SQLite service...');
      const { sqliteService } = await import('./mock/service');
      _dataService = sqliteService;
    }
    
    log.data.debug('Calling service.initialize()...');
    await _dataService.initialize();
    log.data.info(`${BACKEND_MODE} backend initialized`);
    
    return _dataService;
  } catch (e) {
    log.data.error('Failed to initialize DataService', e);
    throw e;
  }
}

/**
 * Check if data service is initialized
 */
export function isDataServiceReady(): boolean {
  return _dataService !== null;
}

/**
 * Reset the data service (for testing)
 */
export async function resetDataService(): Promise<void> {
  if (_dataService) {
    await _dataService.close();
    _dataService = null;
    log.data.info('DataService reset');
  }
}

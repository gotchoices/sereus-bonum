// Data layer entry point
// Exports the active DataService based on configuration
// See: design/specs/web/global/data-backend.md

import { BACKEND, USE_QUEREUS } from '$lib/config';
import { log } from '$lib/logger';
import type { DataService } from './types';

// Re-export types for convenience
export * from './types';

// Lazy-load the appropriate service to avoid importing unused code
let _dataService: DataService | null = null;
let _initPromise: Promise<DataService> | null = null;

/**
 * Get the data service instance
 * Must call initialize() before using other methods
 */
export async function getDataService(): Promise<DataService> {
  if (_dataService) return _dataService;
  // Concurrent callers (app boot + probe + a screen's first query) must await the SAME init — and the
  // singleton must only be published AFTER initialize() resolves, or an early caller gets a half-ready
  // service ("... not initialized"). Guard with a shared in-flight promise.
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    log.data.info(`Initializing ${BACKEND} backend...`);
    const service: DataService = USE_QUEREUS
      ? (await import('./production/service')).quereusService
      : (await import('./mock/service')).sqliteService;
    await service.initialize();
    _dataService = service; // publish only once fully initialized
    log.data.info(`${BACKEND} backend initialized`);
    return service;
  })();

  try {
    return await _initPromise;
  } catch (e) {
    _initPromise = null; // allow a retry after a failed init
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
    _initPromise = null;
    log.data.info('DataService reset');
  }
}

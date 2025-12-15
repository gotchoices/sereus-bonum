// Application configuration
// See: design/specs/web/global/backend.md

export type BackendMode = 'mock' | 'production';

/**
 * Backend mode: 'mock' uses SQLite (sql.js), 'production' uses Quereus
 * Set via VITE_BACKEND_MODE environment variable
 */
export const BACKEND_MODE: BackendMode = 
  (import.meta.env.VITE_BACKEND_MODE as BackendMode) || 'mock';

/**
 * Debug mode: when true, populates demo entities with sample transactions
 * Set via VITE_DEBUG_DATA environment variable
 * Only applies in mock mode
 */
export const DEBUG_DATA: boolean = 
  import.meta.env.VITE_DEBUG_DATA === 'true' || 
  import.meta.env.VITE_DEBUG_DATA === '1';

/**
 * Check if we're in development mode
 */
export const IS_DEV = import.meta.env.DEV;

/**
 * Enable test data generator in ledger (DEV mode only)
 * When enabled, also DISABLES localStorage persistence for better performance
 * Set via VITE_ENABLE_TEST_DATA environment variable
 */
export const ENABLE_TEST_DATA: boolean = 
  IS_DEV && import.meta.env.VITE_ENABLE_TEST_DATA === 'true';


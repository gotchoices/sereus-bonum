// Application configuration
// See: design/specs/web/global/data-backend.md (three modes)
//      design/specs/domain/interfaces.md (platform-agnostic storage/sync model)

/**
 * Backend selection — three modes:
 *   'mock'          — in-browser SQLite (sql.js), persisted to localStorage. Default.
 *   'quereus-local' — Quereus with the browser IndexedDB store (@quereus/plugin-indexeddb).
 *                     Real Quereus SQL, single-device, no networking.
 *   'quereus-p2p'   — Quereus + Optimystic distributed storage over the Sereus cadre.
 *
 * Set via the VITE_BACKEND environment variable. Higher-level code should only ask
 * `USE_QUEREUS` (mock vs real DB); the local-vs-p2p distinction is handled inside
 * the production data service.
 */
export type Backend = 'mock' | 'quereus-local' | 'quereus-p2p';

export const BACKEND: Backend =
  (import.meta.env.VITE_BACKEND as Backend) || 'mock';

/** True for any real Quereus backend (local or p2p) — the only flag screens/data code should need. */
export const USE_QUEREUS: boolean = BACKEND !== 'mock';

/** True only for the distributed Optimystic path; consumed inside the production service. */
export const USE_OPTIMYSTIC: boolean = BACKEND === 'quereus-p2p';

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


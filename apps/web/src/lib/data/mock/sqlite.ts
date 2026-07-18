// SQLite initialization using sql.js
// See: design/specs/web/global/data-backend.md

import initSqlJs, { type Database } from 'sql.js';
import SCHEMA_SQL from './schema.sql?raw';
import { DEBUG_DATA, ENABLE_TEST_DATA } from '$lib/config';
import { seedDemoData, seedDebugTransactions } from './seed';
import { log } from '$lib/logger';

const STORAGE_KEY = 'bonum-db';
// Bump whenever schema.sql changes. A restored DB stamped with a different version is
// discarded and rebuilt from the authoritative schema (no in-place migration) — export
// first (native books dump) if you need to keep the data.
const SCHEMA_VERSION = 2;
let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

/**
 * Get or initialize the SQLite database
 */
export async function getDb(): Promise<Database> {
  if (db) {
    log.sqlite.debug('Returning existing db instance');
    return db;
  }
  
  // Prevent multiple simultaneous initializations
  if (initPromise) {
    log.sqlite.debug('Waiting for existing init promise');
    return initPromise;
  }
  
  log.sqlite.info('Starting database initialization');
  initPromise = initializeDb();
  
  try {
    db = await initPromise;
    log.sqlite.info('Database ready');
    return db;
  } catch (e) {
    log.sqlite.error('Database initialization failed', e);
    throw e;
  } finally {
    initPromise = null;
  }
}

async function initializeDb(): Promise<Database> {
  log.sqlite.debug('Loading sql.js WASM from /sql-wasm.wasm...');
  
  const SQL = await initSqlJs({
    // Load WASM from static folder (bundled with app)
    locateFile: () => '/sql-wasm.wasm'
  });
  log.sqlite.debug('sql.js WASM loaded');
  
  // Try to restore from localStorage (unless test data mode is enabled)
  let database: Database;
  let needsSeed = false;
  
  if (ENABLE_TEST_DATA) {
    log.sqlite.info('Test data mode enabled - persistence disabled, creating fresh database');
    database = new SQL.Database();
    needsSeed = true;
  } else {
    log.sqlite.debug('Checking localStorage for saved database...');
    const saved = localStorage.getItem(STORAGE_KEY);
    
    if (saved) {
      try {
        log.sqlite.debug('Restoring database from localStorage');
        const data = new Uint8Array(JSON.parse(saved));
        database = new SQL.Database(data);
        // Discard (and rebuild) a DB whose schema version differs from the current authoritative one.
        const ver = readUserVersion(database);
        if (ver !== SCHEMA_VERSION) {
          log.sqlite.warn(`Persisted DB schema v${ver} != current v${SCHEMA_VERSION}; rebuilding from authoritative schema (existing data discarded — export first to keep it).`);
          database.close();
          database = new SQL.Database();
          needsSeed = true;
        } else {
          log.sqlite.info('Restored database from localStorage');
        }
      } catch (e) {
        log.sqlite.warn('Failed to restore, creating fresh database', e);
        database = new SQL.Database();
        needsSeed = true;
      }
    } else {
      log.sqlite.debug('No saved database, creating fresh');
      database = new SQL.Database();
      needsSeed = true;
    }
  }

  // Always run schema (IF NOT EXISTS is safe)
  log.sqlite.debug('Running schema...');
  database.run(SCHEMA_SQL);
  database.run(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  log.sqlite.debug('Schema applied');
  
  // Seed demo data if fresh database
  if (needsSeed) {
    log.sqlite.info('Seeding demo data...');
    seedDemoData(database);
    
    if (DEBUG_DATA) {
      log.sqlite.info('DEBUG_DATA enabled, seeding sample transactions...');
      seedDebugTransactions(database);
    }
    
    saveDb(database);
    log.sqlite.info('Demo data seeded and saved');
  }
  
  return database;
}

function readUserVersion(database: Database): number {
  const res = database.exec('PRAGMA user_version');
  return res.length && res[0].values.length ? Number(res[0].values[0][0]) : 0;
}

/**
 * Save database to localStorage
 * Skipped when ENABLE_TEST_DATA is true for better performance
 */
export function saveDb(database?: Database): void {
  if (ENABLE_TEST_DATA) {
    log.sqlite.debug('Save skipped (test data mode - persistence disabled)');
    return;
  }
  
  const d = database || db;
  if (!d) return;
  
  try {
    const data = d.export();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(data)));
    log.sqlite.debug('Saved to localStorage');
  } catch (e) {
    log.sqlite.error('Failed to save to localStorage', e);
    // A quota failure is silent data loss (the in-memory DB has the data but it isn't persisted, so a
    // reload shows a half-empty state). Surface only this case so callers can report it; other save
    // errors keep the prior log-and-continue behavior.
    const quota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
    if (quota) {
      throw new Error(
        'Browser storage limit reached — this dataset is too large for the mock backend and was not saved. '
        + 'Switch to the quereus-local backend (IndexedDB) for large imports.',
      );
    }
  }
}

/**
 * Close and clear the database
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    log.sqlite.debug('Database closed');
  }
}

/**
 * Reset the database (for testing)
 */
export async function resetDb(): Promise<void> {
  closeDb();
  localStorage.removeItem(STORAGE_KEY);
  log.sqlite.info('Database reset, localStorage cleared');
  await getDb();
}

/**
 * Generate a UUID
 */
export function uuid(): string {
  return crypto.randomUUID();
}

/**
 * Get current ISO timestamp
 */
export function now(): string {
  return new Date().toISOString();
}

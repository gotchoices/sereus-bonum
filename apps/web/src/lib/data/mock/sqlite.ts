// SQLite initialization using sql.js
// See: design/specs/web/global/backend.md

import initSqlJs, { type Database } from 'sql.js';
import SCHEMA_SQL from './schema.sql?raw';
import { DEBUG_DATA, ENABLE_TEST_DATA } from '$lib/config';
import { seedDemoData, seedDebugTransactions } from './seed';
import { log } from '$lib/logger';

const STORAGE_KEY = 'bonum-db';
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
        log.sqlite.info('Restored database from localStorage');
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

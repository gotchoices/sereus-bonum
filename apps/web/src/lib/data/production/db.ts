// Quereus connection for the production backend (web).
// See: design/specs/web/global/data-backend.md, design/specs/domain/interfaces.md
//
// Branches on USE_OPTIMYSTIC (from $lib/config):
//   false → quereus-local: standalone Quereus Database backed by browser IndexedDB
//           (@quereus/plugin-indexeddb). Single device, no networking.
//   true  → quereus-p2p:   Optimystic-backed strand database over the Sereus cadre.
//           Not yet implemented (needs @serfab/cadre-core + libp2p peer deps).
//
// Higher-level code uses getQuereusDb() and the all()/get()/run() helpers and does
// not know which backend is active.

import type { Database, SqlValue } from '@quereus/quereus';
import { USE_OPTIMYSTIC } from '$lib/config';
import { log } from '$lib/logger';
import SCHEMA_QSQL from './schema.qsql?raw';

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

export async function getQuereusDb(): Promise<Database> {
  if (db) return db;
  if (initPromise) return initPromise;
  initPromise = USE_OPTIMYSTIC ? initOptimystic() : initLocal();
  try {
    db = await initPromise;
    return db;
  } finally {
    initPromise = null;
  }
}

async function initLocal(): Promise<Database> {
  log.data.info('[Quereus] Initializing local (IndexedDB) backend...');
  const { Database: DatabaseCtor, registerPlugin } = await import('@quereus/quereus');
  const { default: indexeddbPlugin } = await import('@quereus/plugin-indexeddb/plugin');

  const database: Database = new DatabaseCtor();
  await registerPlugin(database, indexeddbPlugin, {
    databaseName: 'bonum',
    moduleName: 'store',
  });

  // Tables bind to the registered store module.
  await database.exec("pragma default_vtab_module = 'store'");
  if (!(await schemaExists(database))) {
    log.data.info('[Quereus] Applying schema...');
    for (const stmt of splitStatements(SCHEMA_QSQL)) {
      await database.exec(stmt);
    }
    const { seedQuereus } = await import('./seed');
    await seedQuereus(database);
    log.data.info('[Quereus] Seeded base units + account groups');
  }

  log.data.info('[Quereus] Local backend ready');
  return database;
}

async function initOptimystic(): Promise<Database> {
  // quereus-p2p: boot @serfab/cadre-core (CadreNode over libp2p), open the strand's
  // Quereus Database. Single-node only for now (see cadre.ts). StrandDatabase applies
  // the sApp schema itself, so we only set the schema path and seed an empty strand.
  //
  // Runs in the browser on the LATEST Sereus stack (optimystic 0.16.2 / quereus 4.3.2) given the
  // host bundler fixes in vite.config.ts (browser conditions + multiformats + chai alias) and the
  // local @optimystic/db-p2p .unref() guard patch. See docs/STATUS.md and tmp/optimystic-review.md.
  log.data.info('[Quereus] Initializing p2p (optimystic) backend...');
  const { webCadreService } = await import('./cadre');
  await webCadreService.ensureStarted();
  const database = webCadreService.getDatabase();
  await database.exec("pragma schema_path = 'app,main'");

  const row = await get<{ c: number }>(database, 'SELECT count(*) as c FROM entity');
  if (!row || Number(row.c) === 0) {
    log.data.info('[Quereus] Seeding optimystic strand...');
    const { seedQuereus } = await import('./seed');
    await seedQuereus(database);
  }

  log.data.info('[Quereus] p2p backend ready');
  return database;
}

// Split a .qsql file into individual statements: strip `--` comment lines, split on `;`.
// (Our DDL contains no semicolons inside literals, so this is safe.)
function splitStatements(sql: string): string[] {
  return sql
    .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    .split(';').map((s) => s.trim()).filter((s) => s.length > 0);
}

async function schemaExists(database: Database): Promise<boolean> {
  try {
    const row = await database.get(
      "SELECT name FROM schema() WHERE type = 'table' AND name = 'entity'",
    );
    return row != null;
  } catch {
    return false;
  }
}

export async function closeQuereusDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
  initPromise = null;
}

// --- Query helpers --------------------------------------------------------
// eval() yields rows (async iterable); exec() runs statements. Both accept a
// positional params array bound to `?` placeholders.

export async function all<T = Record<string, unknown>>(
  database: Database,
  sql: string,
  params: SqlValue[] = [],
): Promise<T[]> {
  const rows: T[] = [];
  for await (const row of database.eval(sql, params)) rows.push(row as T);
  return rows;
}

export async function get<T = Record<string, unknown>>(
  database: Database,
  sql: string,
  params: SqlValue[] = [],
): Promise<T | null> {
  for await (const row of database.eval(sql, params)) return row as T;
  return null;
}

export async function run(
  database: Database,
  sql: string,
  params: SqlValue[] = [],
): Promise<void> {
  await database.exec(sql, params);
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

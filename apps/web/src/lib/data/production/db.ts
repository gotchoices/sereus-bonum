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
  const { Database: DatabaseCtor } = await import('@quereus/quereus');
  const { default: indexeddbPlugin } = await import('@quereus/plugin-indexeddb/plugin');

  const database: Database = new DatabaseCtor();
  // Register the store vtab module directly (rather than registerPlugin, which returns nothing) so we can
  // capture the module handle and rehydrate the persisted catalog below.
  const registrations = await (indexeddbPlugin as unknown as (db: Database, cfg: unknown) => Promise<{
    vtables: { name: string; module: unknown; auxData?: unknown }[];
  }>)(database, { databaseName: 'bonum', moduleName: 'store' });
  const storeVtab = registrations.vtables[0];
  (database as unknown as { registerModule: (n: string, m: unknown, a?: unknown) => void })
    .registerModule(storeVtab.name, storeVtab.module, storeVtab.auxData);
  // Tables bind to the registered store module.
  await database.exec("pragma default_vtab_module = 'store'");

  // Rehydrate the persisted schema from the store's __catalog__ (tables + indexes ADOPTED, not rebuilt) —
  // the recommended reopen pattern (quereus docs/store.md § Schema Discovery). Without this we re-ran the
  // full DDL on every open, which rebuilt every secondary index over the persisted rows (~4-5s each →
  // 20-30s at real scale). On a fresh DB the catalog is empty and the DDL is applied once below.
  // rehydrateCatalog lives on the plain StoreModule; the plugin wraps it in an IsolationModule, so it may
  // be on `.underlying`.
  type Rehydratable = { rehydrateCatalog?: (db: Database) => Promise<unknown>; underlying?: Rehydratable };
  const sm = storeVtab.module as Rehydratable;
  const rehydrator: Rehydratable | undefined =
    typeof sm.rehydrateCatalog === 'function' ? sm
      : typeof sm.underlying?.rehydrateCatalog === 'function' ? sm.underlying : undefined;
  try {
    if (rehydrator) { await rehydrator.rehydrateCatalog!(database); log.data.info('[Quereus] Rehydrated persisted catalog'); }
    else log.data.warn('[Quereus] rehydrateCatalog not found on store module — will re-apply schema');
  } catch (e) {
    log.data.warn('[Quereus] rehydrateCatalog failed; falling back to re-applying schema', e);
  }

  const exists = await schemaExists(database);
  const version = exists ? await readSchemaVersion(database) : 0;
  if (exists && version !== SCHEMA_VERSION) {
    // Rebuild from the authoritative schema rather than migrate in place — the live schema is
    // always exactly the DDL. Discards data (export first to keep it); backends aren't kept in sync.
    log.data.warn(`[Quereus] Persisted schema v${version} != current v${SCHEMA_VERSION}; rebuilding (existing data discarded).`);
    await dropAllTables(database);
  }
  if (!exists || version !== SCHEMA_VERSION) {
    log.data.info('[Quereus] Applying schema...');
    for (const stmt of splitStatements(SCHEMA_QSQL)) {
      await database.exec(stmt);
    }
    await stampSchemaVersion(database);
    const { seedQuereus } = await import('./seed');
    await seedQuereus(database);
    log.data.info('[Quereus] Seeded base units + account groups');
  }

  // Prototype: current-balance materialized view (idempotent; always ensured). See getBalanceSheet fast path.
  await ensureBalanceMV(database);
  try { await ensureMonthlyMV(database); } catch (e) { log.data.warn('[Quereus] ensureMonthlyMV failed (experiment)', e); }

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

// Bump when schema.qsql changes. A persisted store stamped with a different version is dropped and
// rebuilt from the authoritative DDL (no in-place migration). Kept as its own infra table.
const SCHEMA_VERSION = 6;

async function readSchemaVersion(database: Database): Promise<number> {
  try {
    const row = await get<{ version: number }>(database, 'SELECT version FROM schema_meta LIMIT 1');
    return row ? Number(row.version) : 0;
  } catch {
    return 0; // schema_meta absent → treat as pre-versioning
  }
}

async function stampSchemaVersion(database: Database): Promise<void> {
  await database.exec('create table if not exists schema_meta (version integer)');
  await database.exec('DELETE FROM schema_meta');
  await database.exec('INSERT INTO schema_meta (version) VALUES (?)', [SCHEMA_VERSION]);
}

// Dependents before the tables they reference, so FK constraints don't block DELETE/DROP. Any table
// not in this known order is handled first (assumed to be a leaf/dependent).
const DROP_ORDER = [
  'entry', 'exchange', 'reconciliation', 'txn', 'account', 'tag', 'account_group', 'partner', 'entity',
  'unit', 'schema_meta',
];

// Fully clear the persisted store. IMPORTANT: on the IndexedDB store, `DROP TABLE` removes only the
// Quereus schema registration — it does NOT purge the underlying rows, so a re-created table still
// holds its old data (and the re-seed hits a duplicate PK). So DELETE the rows first, then drop.
async function dropAllTables(database: Database): Promise<void> {
  const present = new Set(
    (await all<{ name: string }>(database, "SELECT name FROM schema() WHERE type = 'table'")).map((r) => r.name),
  );
  const order = [...[...present].filter((n) => !DROP_ORDER.includes(n)), ...DROP_ORDER].filter((n) => present.has(n));
  for (const name of order) {
    try { await database.exec(`DELETE FROM ${name}`); }
    catch (e) { log.data.warn(`[Quereus] clear ${name} failed`, e); }
  }
  for (const name of order) {
    try { await database.exec(`DROP TABLE ${name}`); }
    catch (e) { log.data.warn(`[Quereus] drop ${name} failed`, e); }
  }
}

async function schemaExists(database: Database): Promise<boolean> {
  // After rehydrateCatalog() the persisted tables are back in the in-memory catalog, so schema() sees them.
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

// --- Balance materialized view (prototype) -------------------------------------------------------------
// A single-source, incrementally-maintained MV of current per-account balances, persisted to the store
// (IndexedDB). Makes the *current* balance sheet read O(#accounts) instead of scanning every entry — see
// docs/materialized-balances-design.md. Single-source (`SUM … GROUP BY` over `entry`) qualifies for
// Quereus's O(1)-per-write delta-aggregate maintenance. `account_id` uniquely determines its entity, so no
// denormalized `entity_id` is needed; the balance-sheet reader filters to the entity's own accounts.
export const BALANCE_MV = 'account_balance';

export async function ensureBalanceMV(database: Database): Promise<void> {
  await database.exec(
    `CREATE MATERIALIZED VIEW IF NOT EXISTS ${BALANCE_MV} USING store AS
       SELECT account_id, SUM(amount) AS balance FROM entry GROUP BY account_id`,
  );
}

export async function dropBalanceMV(database: Database): Promise<void> {
  await database.exec(`DROP MATERIALIZED VIEW IF EXISTS ${BALANCE_MV}`);
}

// --- Monthly balance materialized view (EXPERIMENT) ----------------------------------------------------
// Per-(entity, account, month) balances. Single-source over `entry` (needs the denormalized entity_id /
// period columns) so it qualifies for incremental delta-aggregate maintenance. Enables uniform-performance
// reads for ANY date range: sum whole months from here (`period < D`) + one partial-month base query.
// Indexed on (entity_id, period) so the range read is an IndexSeek. See docs/materialized-balances-design.md.
export const MONTHLY_MV = 'account_balance_monthly';

export async function ensureMonthlyMV(database: Database): Promise<void> {
  await database.exec(
    `CREATE MATERIALIZED VIEW IF NOT EXISTS ${MONTHLY_MV} USING store AS
       SELECT entity_id, account_id, period, SUM(amount) AS balance
       FROM entry GROUP BY entity_id, account_id, period`,
  );
  await database.exec(`CREATE INDEX IF NOT EXISTS idx_${MONTHLY_MV}_ent_period ON ${MONTHLY_MV}(entity_id, period)`);
}

export async function dropMonthlyMV(database: Database): Promise<void> {
  await database.exec(`DROP MATERIALIZED VIEW IF EXISTS ${MONTHLY_MV}`);
}

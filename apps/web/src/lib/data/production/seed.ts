// Fresh-DB seed for the Quereus backend.
// Seeds base units, the shared account-group catalog, and the two demo entities
// (Home Finance, Small Business) with their accounts — matching the mock backend.
// Demo transactions are seeded only when DEBUG_DATA is enabled (as in mock mode).
// Reuses the same data arrays as the mock backend to avoid drift.

import type { Database } from '@quereus/quereus';
import { run, nowIso } from './db';
import { DEBUG_DATA } from '$lib/config';
import {
  UNITS, ACCOUNT_GROUPS,
  HOME_ENTITY, HOME_ACCOUNTS, BIZ_ENTITY, BIZ_ACCOUNTS,
  DEBUG_TRANSACTIONS,
} from '../mock/seed';

export async function seedQuereus(db: Database): Promise<void> {
  const ts = nowIso();

  for (const u of UNITS) {
    await run(db, 'INSERT INTO unit (code, name, symbol, unit_type, display_divisor) VALUES (?, ?, ?, ?, ?)',
      [u.code, u.name, u.symbol, u.unitType, u.displayDivisor]);
  }

  // Account groups are ordered parent-first, satisfying the parent FK.
  for (const g of ACCOUNT_GROUPS) {
    await run(db, 'INSERT INTO account_group (id, name, account_type, parent_id, display_order) VALUES (?, ?, ?, ?, ?)',
      [g.id, g.name, g.accountType, g.parentId, g.displayOrder]);
  }

  for (const ent of [HOME_ENTITY, BIZ_ENTITY]) {
    await run(db, 'INSERT INTO entity (id, name, description, base_unit, fiscal_year_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [ent.id, ent.name, ent.description, ent.baseUnit, ent.fiscalYearEnd, ts, ts]);
  }

  for (const [entityId, accounts] of [[HOME_ENTITY.id, HOME_ACCOUNTS], [BIZ_ENTITY.id, BIZ_ACCOUNTS]] as const) {
    for (const a of accounts) {
      await run(db, 'INSERT INTO account (id, entity_id, account_group_id, code, name, unit, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
        [a.id, entityId, a.groupId, a.code, a.name, 'USD', ts, ts]);
    }
  }

  if (DEBUG_DATA) {
    for (const txn of DEBUG_TRANSACTIONS) {
      await run(db, 'INSERT INTO txn (id, entity_id, date, memo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [txn.id, txn.entityId, txn.date, txn.memo, ts, ts]);
      for (let i = 0; i < txn.entries.length; i++) {
        const e = txn.entries[i];
        await run(db, 'INSERT INTO entry (id, txn_id, account_id, amount) VALUES (?, ?, ?, ?)',
          [`${txn.id}-${i}`, txn.id, e.accountId, e.amount]);
      }
    }
  }
}

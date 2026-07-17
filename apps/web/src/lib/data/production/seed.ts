// Fresh-DB seed for the Quereus backend.
// Seeds base units + the shared account-group catalog (matches domain/account-groups.md).
// Reuses the same data arrays as the mock backend to avoid drift.
// Demo entities/accounts/transactions are seeded in Track C2 (alongside their write methods).

import type { Database } from '@quereus/quereus';
import { run } from './db';
import { UNITS, ACCOUNT_GROUPS } from '../mock/seed';

export async function seedQuereus(db: Database): Promise<void> {
  for (const u of UNITS) {
    await run(db, 'INSERT INTO unit (code, name, symbol, unit_type, display_divisor) VALUES (?, ?, ?, ?, ?)',
      [u.code, u.name, u.symbol, u.unitType, u.displayDivisor]);
  }
  // Account groups are ordered parent-first, satisfying the parent FK.
  for (const g of ACCOUNT_GROUPS) {
    await run(db, 'INSERT INTO account_group (id, name, account_type, parent_id, display_order) VALUES (?, ?, ?, ?, ?)',
      [g.id, g.name, g.accountType, g.parentId, g.displayOrder]);
  }
}

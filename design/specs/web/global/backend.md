# Backend Spec

## Overview

The app uses an abstracted data layer that can switch between mock and production backends without code changes.

## Backends

| Mode | Backend | Use Case |
|------|---------|----------|
| `mock` | SQLite (sql.js) | Development, testing, demos |
| `production` | Sereus/Quereus | Production deployment |

## Configuration

Single environment variable or config setting:

```typescript
// src/lib/config.ts
export const BACKEND_MODE: 'mock' | 'production' = 
  import.meta.env.VITE_BACKEND_MODE || 'mock';
```

## Data Layer Abstraction

App code interacts with a `DataService` interface, not specific backends:

```typescript
// src/lib/data/types.ts
interface DataService {
  // Entities
  getEntities(): Promise<Entity[]>;
  getEntity(id: string): Promise<Entity | null>;
  createEntity(data: EntityInput): Promise<Entity>;
  updateEntity(id: string, data: Partial<EntityInput>): Promise<Entity>;
  deleteEntity(id: string): Promise<void>;
  
  // Accounts, Transactions, etc. — same pattern
}
```

Implementations:

```
src/lib/data/
├── types.ts           # Interface definitions
├── index.ts           # Exports active backend based on config
├── mock/
│   ├── sqlite.ts      # sql.js initialization
│   ├── service.ts     # DataService implementation
│   └── schema.sql     # SQLite schema
└── production/
    └── service.ts     # Sereus/Quereus implementation
```

## Schema Synchronization

SQLite and Quereus have different SQL dialects. Strategy:

1. **Source of truth:** `docs/Schema.md` (entity definitions)
2. **SQLite schema:** `src/lib/data/mock/schema.sql` — standard SQL, manually maintained
3. **Quereus schema:** TBD — will differ significantly (CRDT semantics, etc.)

When schema changes:
1. Update `docs/Schema.md`
2. Update `mock/schema.sql` for SQLite
3. Update Quereus schema (when implemented)

No automated sync — schemas are simple enough to maintain manually. SQLite schema is disposable (development only).

## SQLite Implementation Notes

Using [sql.js](https://sql.js.org/) — SQLite compiled to WebAssembly.

```typescript
// src/lib/data/mock/sqlite.ts
import initSqlJs, { Database } from 'sql.js';

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;
  
  const SQL = await initSqlJs({
    locateFile: file => `/sql.js/${file}`
  });
  
  // Load from localStorage or create fresh
  const saved = localStorage.getItem('bonum-db');
  if (saved) {
    db = new SQL.Database(new Uint8Array(JSON.parse(saved)));
  } else {
    db = new SQL.Database();
    db.run(SCHEMA_SQL);
  }
  
  return db;
}

export function saveDb(): void {
  if (!db) return;
  const data = db.export();
  localStorage.setItem('bonum-db', JSON.stringify(Array.from(data)));
}
```

Persistence: Database serialized to localStorage on changes. Survives browser refresh.

## Switching Backends

```bash
# Development (default)
VITE_BACKEND_MODE=mock yarn dev

# Production
VITE_BACKEND_MODE=production yarn build
```

App code remains unchanged.


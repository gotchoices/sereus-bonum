# Spec: Backend Data Storage

## Purpose

The app needs to store and retrieve data (entities, accounts, transactions). During development, we use a mock database that runs in the browser. In production, we'll use Sereus/Quereus for distributed, peer-to-peer data storage.

## Two Backends

**Mock Backend (Development):**
- Uses SQLite running in the browser (via WebAssembly)
- Data persists in browser local storage
- Survives page refreshes
- Can be cleared by clearing browser data
- Used for development, testing, and demos

**Production Backend (Future):**
- Uses Sereus/Quereus distributed network
- Real peer-to-peer data synchronization
- Data persists across devices
- Offline-first with sync when connected

## Switching Backends

The app automatically uses the correct backend based on a configuration setting. Developers can switch between mock and production by changing an environment variable:

- `BACKEND_MODE=mock` → Uses browser SQLite (default for development)
- `BACKEND_MODE=production` → Uses Sereus/Quereus (for production deployment)

Application code doesn't need to know which backend is active - the data layer handles this transparently.

## Data Persistence (Mock Backend)

**Where data lives:**
- In-browser SQLite database
- Saved to browser's local storage after each change
- Survives browser refresh
- Lost if browser data is cleared

**Initial data:**
- Fresh install: Empty database with sample demo data (configurable)
- Returning user: Restores previous data from local storage

## Schema Management

**Source of Truth:** `docs/Schema.md` defines what data we store (entities, accounts, transactions, etc.)

**Implementation:** Each backend translates this schema into its own format:
- SQLite uses standard SQL tables
- Quereus will use different structures (CRDT-based)

**When schema changes:**
1. Update `docs/Schema.md` first (human-readable definition)
2. Update SQLite schema manually
3. Update Quereus schema manually (when implemented)

No automatic synchronization - schemas are simple enough to maintain by hand.

## Debug Data

The mock backend can optionally seed sample data for testing:

- `DEBUG_DATA=true` → Includes sample entities, accounts, and transactions
- `DEBUG_DATA=false` → Clean database (production-like)

This lets developers test features with realistic data without manual setup.

## Clearing Data

**Mock backend:**
- Clear browser local storage
- Refresh page → starts with empty database

**Production backend:**
- Data lives on distributed network
- Can't be "cleared" - requires deleting specific records through the UI

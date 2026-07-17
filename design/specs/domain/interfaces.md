# Interfaces — Storage & Sync

How Bonum's data is stored, persisted, and synchronized. This applies to every target; the UI
reads and writes through a stable data layer and never needs to know which backend is active.
Concrete adapter code, config flags, and env vars belong in generated consolidations, not here.

## Two Backends

The app runs against one of two interchangeable backends, selected by configuration:

**Mock (development):**
- In-browser SQLite (WebAssembly), persisted to browser local storage.
- Survives page refresh; cleared by clearing browser data.
- Used for development, testing, and demos. May optionally seed sample data.

**Production (Sereus/Quereus):**
- Distributed, peer-to-peer storage across the user's cadre of devices.
- Offline-first; changes sync in the background when connected.
- Persists across devices; no central cloud server.

The two are behind one data-layer boundary. Application/screen code calls stable operations (e.g.
"list transactions", "create transaction") and is unaffected by which backend answers.

## Persistence & Recovery

- **Mock:** state is saved after each change; a returning user restores their previous data.
- **Production:** data lives on the distributed network; redundancy comes from additional cadre
  nodes. Records are removed through the UI, not by "clearing" storage.
- Sync must be non-blocking and progress-aware, and must degrade gracefully on conflict (see
  [rules.md](./rules.md) for the invariants that must survive a sync).

## Schema Alignment

The [schema contract](./schema.md) is the single source of truth for what data exists. Each backend
maps that contract into its own representation (SQL tables for mock; CRDT-based structures for
Quereus). When the schema changes, both backends are updated to match before regenerating code.

## Selective Sharing

Production storage supports sharing an entity's books with trusted parties (accountant, partner,
advisor) via Sereus permissions — read or read/write, at the granularity the owner chooses. Sharing
never copies data to a central server; it grants access within the fabric.

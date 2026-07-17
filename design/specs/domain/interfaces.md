# Interfaces — Storage & Sync

How Bonum's data is stored, persisted, and synchronized. Applies to every target: screens read and
write through a stable data layer and never depend on which backend is active. Concrete adapters and
config belong in generated consolidations.

## Two Backends

The app runs against one of two interchangeable backends, chosen by configuration:

- **Development:** a local on-device store, optionally seeded with sample data. Persists across
  restarts; used for development, testing, and demos.
- **Production (Sereus/Quereus):** distributed, peer-to-peer storage replicated across the user's
  cadre of devices. Offline-first; changes sync in the background when connected. No central server.

Both sit behind one data-layer boundary. Screen code calls stable operations (e.g. "list
transactions", "create transaction") and is unaffected by which backend answers.

## Persistence & Recovery

- A returning user always restores their previous data.
- In production, redundancy comes from additional cadre nodes; records are removed through the UI,
  not by wiping storage.
- Sync is non-blocking and progress-aware, and degrades gracefully on conflict — the
  [invariants](./rules.md) must hold after any merge.

## Schema Alignment

The [schema contract](./schema.md) is the single source of truth for what data exists. Each backend
maps it to its own representation. When the schema changes, every backend is updated to match before
regenerating code.

## Selective Sharing

Production storage lets an owner share an entity's books with trusted parties (accountant, partner,
advisor) via Sereus permissions — read or read/write, at a chosen granularity. Sharing grants access
within the fabric; it never copies data to a central server.

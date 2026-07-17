# Web Data Backend — Modes & Configuration

Web-specific wiring for the data layer. The platform-agnostic model (what the two backends are, the
sync/sharing behavior) lives in [domain/interfaces.md](../../domain/interfaces.md); this file records
the concrete web toggle and package choices. All modes execute the same
[schema](../../domain/schema.md) and honor the same [rules](../../domain/rules.md).

## Three Modes

Selected by the `VITE_BACKEND` environment variable (default `mock`):

| `VITE_BACKEND` | What it uses | Networking | Purpose |
|----------------|--------------|-----------|---------|
| `mock` | In-browser SQLite (`sql.js`), persisted to `localStorage` | none | Development, testing, demos (default) |
| `quereus-local` | Quereus with the browser IndexedDB store | none | Real Quereus SQL, single device |
| `quereus-p2p` | Quereus + Optimystic over the Sereus cadre | libp2p | Distributed, multi-device, sharing |

Higher-level code (screens, stores, data adapters) checks only `USE_QUEREUS` (mock vs. real DB). The
local-vs-p2p distinction is derived as `USE_OPTIMYSTIC` and handled entirely inside the production
data service. See `apps/web/src/lib/config.ts`.

## Packages (all from npmjs.org)

Bonum consumes the Sereus stack from npm — **no local clones**. Versions track the published line
(quereus `^4.3`, optimystic `^0.16`, `@serfab/cadre-core` `^0.8`, `p2p-fret` `^0.6`).

- **Quereus core** (both real modes): `@quereus/quereus`, `@quereus/store`, `@quereus/isolation`.
- **`quereus-local`**: `@quereus/plugin-indexeddb` (the browser analog of health's leveldb plugin).
- **`quereus-p2p`**: `@optimystic/db-core`, `@optimystic/db-p2p`, `@optimystic/db-p2p-storage-web`,
  `@optimystic/quereus-plugin-optimystic`, `@optimystic/quereus-plugin-crypto`,
  `@serfab/cadre-core`, `p2p-fret`.
  - Also requires libp2p peer deps (`@libp2p/interface`, `@libp2p/peer-id`, `libp2p`,
    `@libp2p/crypto`, `@noble/hashes`) pinned to versions compatible with the installed `@optimystic`
    line — added when this path is implemented.

## Status

- `mock` is implemented and is the default.
- `quereus-local` and `quereus-p2p` share one service at `apps/web/src/lib/data/production/service.ts`,
  currently **stubbed** (every method throws "not yet implemented"). Implementing it against Quereus
  SQL is a regeneration task.

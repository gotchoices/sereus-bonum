# Web Data Backend — Modes & Configuration

Web-specific wiring for the data layer. The platform-agnostic model (what the two backends are, the
sync/sharing behavior) lives in [domain/interfaces.md](../../domain/interfaces.md); this file records
the concrete web toggle and package choices. All modes execute the same
[schema](../../domain/schema.md) and honor the same [rules](../../domain/rules.md).

## Three Modes

Selected by the `VITE_BACKEND` environment variable (default `quereus-local`):

| `VITE_BACKEND` | What it uses | Networking | Purpose |
|----------------|--------------|-----------|---------|
| `quereus-local` | Quereus with the browser IndexedDB store | none | Real Quereus SQL, single device — **default** (`npm run dev`) |
| `quereus-p2p` | Quereus + Optimystic over the Sereus cadre | libp2p | Distributed, multi-device, sharing (`npm run dev:p2p`) |
| `mock` | In-browser SQLite (`sql.js`), persisted to `localStorage` | none | Demo/dev only, opt-in (`npm run dev:mock`); can't hold large datasets (localStorage quota) |

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

- `quereus-local` is the **default** (`VITE_BACKEND` unset / `npm run dev`); `mock` is opt-in.
- `quereus-local` is **fully implemented and runtime-verified** — real Quereus SQL over browser
  IndexedDB, seeded, all screens working.
- `quereus-p2p` is **wired but not runnable in a browser yet**: cadre-core / p2p-fret / libp2p require
  Node/React-Native APIs (`crypto.createHash`, timer `.unref()`, `fs/promises`, `node:http2`) the
  browser lacks. It runs on React Native today (health/chat); a browser-compatible build is needed.
  Selecting it throws a clear error. The p2p deps are pinned to health's tested set
  (`@quereus/* 4.3.1`, `@optimystic/* 0.14.1`) via `resolutions`.

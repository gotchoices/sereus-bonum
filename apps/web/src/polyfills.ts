/**
 * Browser polyfills for the libp2p / Optimystic (quereus-p2p) stack.
 *
 * This is the Sereus-prescribed method (ported from
 * `@serfab/reference-app-web/src/polyfills.ts`; see that package's README §"Vite
 * config notes"). It handles the two residual gaps modern browsers don't cover:
 *
 *   - `globalThis.Buffer`      — wired to the npm `buffer` package.
 *   - timer `.ref()`/`.unref()` — `setTimeout`/`setInterval` return Node `Timeout`
 *     objects (with `.ref()`/`.unref()`) in Node and plain numbers in browsers.
 *     Libraries authored for both runtimes (db-p2p's ClusterMember, undici, libp2p
 *     internals) call `.unref()`; in a browser that is conceptually a no-op.
 *
 * Doing it here (once, globally) replaces the old per-call `?.unref?.()` patch of
 * `@optimystic/db-p2p`. Import this FIRST, before any Optimystic/libp2p module is
 * evaluated (bonum imports it from `hooks.client.ts`; the p2p stack is lazy-loaded
 * only for the quereus-p2p backend, well after boot).
 *
 * Do NOT add a `crypto` / `node:crypto` shim here: anything reaching for those in a
 * browser bundle is a real bug to surface, not paper over.
 */
import { Buffer } from 'buffer';

// ── globalThis.Buffer ───────────────────────────────────────────────────────
{
  const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
  if (typeof g.Buffer === 'undefined') {
    g.Buffer = Buffer;
  }
}

// ── Timer .ref() / .unref() ─────────────────────────────────────────────────
const _setTimeout = globalThis.setTimeout;
const _setInterval = globalThis.setInterval;
const _clearTimeout = globalThis.clearTimeout;
const _clearInterval = globalThis.clearInterval;

interface TimerHandle {
  _id: number;
  ref(): TimerHandle;
  unref(): TimerHandle;
  [Symbol.toPrimitive](): number;
}

function wrapTimer(id: number | TimerHandle): TimerHandle {
  if (typeof id === 'object' && id !== null) return id;
  const handle: TimerHandle = {
    _id: id as number,
    ref() {
      return this;
    },
    unref() {
      return this;
    },
    [Symbol.toPrimitive]() {
      return this._id;
    },
  };
  return handle;
}

function unwrapTimer(handle: unknown): number | undefined {
  if (handle && typeof handle === 'object' && '_id' in (handle as TimerHandle)) {
    return (handle as TimerHandle)._id;
  }
  return handle as number | undefined;
}

// Detect existing .unref support; if present (e.g. some bundlers polyfill), skip.
const probe = _setTimeout(() => undefined, 0);
const needsWrap = !(probe && typeof probe === 'object' && typeof (probe as { unref?: unknown }).unref === 'function');
_clearTimeout(probe as Parameters<typeof clearTimeout>[0]);

if (needsWrap) {
  globalThis.setTimeout = ((...args: Parameters<typeof setTimeout>) =>
    wrapTimer(_setTimeout(...args) as unknown as number)) as unknown as typeof setTimeout;
  globalThis.setInterval = ((...args: Parameters<typeof setInterval>) =>
    wrapTimer(_setInterval(...args) as unknown as number)) as unknown as typeof setInterval;
  globalThis.clearTimeout = ((handle: unknown) =>
    _clearTimeout(unwrapTimer(handle) as Parameters<typeof clearTimeout>[0])) as typeof clearTimeout;
  globalThis.clearInterval = ((handle: unknown) =>
    _clearInterval(unwrapTimer(handle) as Parameters<typeof clearInterval>[0])) as typeof clearInterval;
}

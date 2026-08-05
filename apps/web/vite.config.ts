import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Empty stub for Node built-ins pulled in (transitively) by the Sereus p2p stack but never used on the
// browser path (also the target for a stray chai test-import in @optimystic/db-p2p).
const emptyModule = fileURLToPath(new URL('./src/lib/empty-module.js', import.meta.url));

// Browser bring-up for the quereus-p2p (Sereus/Optimystic/libp2p) backend, per the Sereus prescribed
// method — see @serfab/reference-app-web README §"Vite config notes" and src/polyfills.ts.
export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    // Force the BROWSER export condition so multiformats' hashes use crypto.subtle (not node:crypto).
    // See tmp/optimystic-review.md.
    conditions: ['browser', 'module', 'import', 'default'],
    alias: {
      // Node built-ins reached for by transitive libp2p deps. node:crypto / crypto are deliberately
      // NOT aliased — anything reaching for them in a browser bundle is a real bug to surface.
      'node:os': emptyModule,
      'node:net': emptyModule,
      'node:tls': emptyModule,
      os: emptyModule,
      net: emptyModule,
      tls: emptyModule,
      'node:stream': 'readable-stream',
      stream: 'readable-stream',
      'node:buffer': 'buffer',
      buffer: 'buffer',
      // stray test-only import in @optimystic/db-p2p (raw-storage-conformance → chai)
      chai: emptyModule,
    },
    // NOTE: the reference app also sets `dedupe: ['@multiformats/multiaddr']` (a gossipsub v12/v13
    // compat fix for multi-node *dialability*). It breaks bonum's build here ("Missing ./convert
    // specifier") because our transitive multiaddr layout differs, and single-node quereus-p2p doesn't
    // dial peers — so it's deferred until multi-node p2p is tackled (needs the multiaddr version pinned).
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['multiformats/hashes/sha2', 'buffer'],
  },
});

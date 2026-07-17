import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Empty stub for node/test-only imports pulled in (transitively) by the Sereus p2p stack
// but never used on the browser path.
const emptyModule = fileURLToPath(new URL('./src/lib/empty-module.js', import.meta.url));

// The quereus-p2p (Sereus/optimystic) backend needs the BROWSER build of multiformats'
// hashes (crypto.subtle, not node:crypto). Force the `browser` export condition so bundlers
// pick browser-safe implementations. See tmp/optimystic-review.md.
export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    conditions: ['browser', 'module', 'import', 'default'],
    alias: {
      // stray test-only import in @optimystic/db-p2p (raw-storage-conformance → chai)
      chai: emptyModule,
    },
  },
  optimizeDeps: {
    include: ['multiformats/hashes/sha2'],
  },
});

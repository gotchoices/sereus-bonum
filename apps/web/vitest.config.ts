import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Isolated unit-test config for PURE `.ts` modules (Tier 1 in design/specs/web/global/testing.md).
// Deliberately does NOT load the SvelteKit plugin or the p2p/optimystic stack — unit tests exercise
// backend-independent logic only. `$lib` is aliased manually so modules resolve the same as in the app.
export default defineConfig({
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});

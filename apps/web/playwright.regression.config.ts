import { defineConfig, devices } from '@playwright/test';

// Part-C regression suite (design/specs/web/global/testing.md). Runs the app on the REAL quereus-local
// (IndexedDB) backend — the one whose read costs Bonum is shaped around — via an auto-started `vite dev` on
// its own port. Each test gets a fresh browser context (empty IndexedDB → deterministic), seeds its own data
// through window.__bonum, and asserts correctness + query economy on the production data path.
//
// Separate config (not a project in playwright.config.ts) because the backend differs: one config = one
// webServer = one VITE_BACKEND. Runs on demand — `yarn test:regression` — not as part of the fast `yarn test`.
const PORT = 5179;

export default defineConfig({
  testDir: './test/regression',
  globalSetup: './test/support/ensure-fixtures.ts', // generate missing tmp/ fixtures (gitignored) on demand
  workers: 1,
  reporter: [['list']],
  // quereus-local init + a wide-fixture bulk import + repeated heavy measurements (the tripwire test) can run
  // well past a minute, and absolute times drift with machine load — so give generous headroom. Tripwires
  // assert same-run *ratios*, which are drift-immune; the timeout just must not clip the slow seed+measure.
  timeout: 240_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node_modules/.bin/vite dev --port ${PORT} --strictPort`,
    env: { VITE_BACKEND: 'quereus-local' },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

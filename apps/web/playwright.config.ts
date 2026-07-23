import { defineConfig, devices } from '@playwright/test';

// Tier-2 E2E (design/specs/web/global/testing.md). Runs the app on the MOCK backend (fast, deterministic,
// no IndexedDB persistence) via an auto-started `vite dev`. Each test gets a fresh browser context
// (isolated storage) and seeds its own data through the window.__bonum probe.
const PORT = 5178;

export default defineConfig({
  testDir: './e2e',
  workers: 1, // shared dev server; keep runs deterministic (data lives per-context, so safe to raise later)
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node_modules/.bin/vite dev --port ${PORT} --strictPort`,
    env: { VITE_BACKEND: 'mock' },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

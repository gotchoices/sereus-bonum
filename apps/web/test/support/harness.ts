// Shared browser-test helpers for the Tier-2 e2e suite and the Part-C quereus-local regression suite
// (design/specs/web/global/testing.md). Fixture loading + the window.__bonum probe bootstrap that drives the
// real DataService without walking the UI.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Page } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
// here = apps/web/test/support → repo root is four levels up.
const repoRoot = resolve(here, '../../../..');

/** Load a native books fixture (from repo `tmp/`) as a parsed object. */
export function fixture(name = 'books-100.json'): unknown {
  return JSON.parse(readFileSync(resolve(repoRoot, `tmp/${name}`), 'utf8'));
}

/**
 * Navigate to the app and wait until the dev probe + a ready DataService are available. quereus-local init
 * (schema apply + MV ensure) is async and slower than the mock backend, so we poll a trivial read.
 */
export async function waitForProbe(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForFunction(() => !!(window as unknown as { __bonum?: unknown }).__bonum, { timeout: 15_000 });
  await page.waitForFunction(async () => {
    try {
      const api = (window as unknown as { __bonum: { getDataService: () => Promise<{ getUnits: () => Promise<unknown> }> } }).__bonum;
      const ds = await api.getDataService();
      await ds.getUnits();
      return true;
    } catch { return false; }
  }, { timeout: 30_000 });
}

/** Seed a fresh entity from a native books fixture via the probe; returns the new entity id. */
export async function seedBooks(page: Page, name = 'books-100.json'): Promise<string> {
  const books = fixture(name);
  return page.evaluate(
    async (b) => (window as unknown as { __bonum: { importNativeBooks: (f: unknown) => Promise<string> } }).__bonum.importNativeBooks(b),
    books,
  );
}

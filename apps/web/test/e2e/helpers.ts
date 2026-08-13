import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Page } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
// here = apps/web/test/e2e → repo root is four levels up.
const repoRoot = resolve(here, '../../../..');

/** Load a native books fixture (from repo `tmp/`) as a parsed object. */
export function fixture(name = 'books-100.json'): unknown {
  return JSON.parse(readFileSync(resolve(repoRoot, `tmp/${name}`), 'utf8'));
}

/**
 * Seed a fresh entity from a native books fixture via the dev-only window.__bonum probe; returns the new
 * entity id. Deterministic, and far faster than driving the import UI. Requires `vite dev` (probe present).
 */
export async function seedEntity(page: Page, name = 'books-100.json'): Promise<string> {
  const books = fixture(name);
  await gotoReady(page, '/');
  return page.evaluate(async (b) => {
    const api = (window as unknown as { __bonum: { importNativeBooks: (f: unknown) => Promise<string> } }).__bonum;
    return api.importNativeBooks(b);
  }, books);
}

/** Wait until the current screen has finished its initial "Loading…" state. */
export async function waitLoaded(page: Page, timeout = 20_000): Promise<void> {
  await page.waitForFunction(() => !/Loading\.\.\./.test(document.body.innerText), undefined, { timeout, polling: 200 });
}

/**
 * Navigate and wait for the SPA to hydrate before interacting. `page.goto` resolves on document load,
 * BEFORE Svelte attaches event handlers — clicking too early is a silent no-op. The dev probe is
 * installed on layout mount, so `window.__bonum` is a reliable "app is interactive" signal.
 */
export async function gotoReady(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as { __bonum?: unknown }).__bonum, undefined, { timeout: 20_000 });
}

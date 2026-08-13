// Playwright globalSetup: ensure the fixtures the browser tiers need exist in `tmp/` (which is gitignored,
// so they're absent on a fresh checkout). Generated on demand via scripts/gen-books.mjs. Runs once before the
// suite; a no-op when the fixtures are already present. Wired into both playwright configs — yarn (berry)
// doesn't run npm `pre*` hooks, so config-level setup is the reliable place for this.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '../..'); // apps/web
const repoRoot = resolve(webRoot, '../..'); // repo root
const genScript = resolve(webRoot, 'scripts/gen-books.mjs');
const tmp = resolve(repoRoot, 'tmp');

// fixture file → the gen-books.mjs argument that produces it.
const REQUIRED: Array<[string, string]> = [
  ['books-100.json', '100'], // Tier-2 e2e + Part-C correctness
  ['books-1000.json', '1000'], // Part-C query-economy (size-invariance)
  ['books-wide.json', 'wide'], // Part-C tripwires (wide chart → large MV)
];

export default function ensureFixtures(): void {
  for (const [name, arg] of REQUIRED) {
    if (existsSync(resolve(tmp, name))) continue;
    console.log(`[fixtures] ${name} missing — generating via gen-books.mjs ${arg}`);
    execFileSync('node', [genScript, arg], { stdio: 'inherit' });
  }
}

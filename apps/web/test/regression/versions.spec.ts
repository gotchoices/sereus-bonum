// Part-C: stamp the engine versions into the run output, and ASSERT the installed @quereus/* matches what
// package.json declares. Guards the trap we hit upgrading 4.11→4.12: a bumped `dependencies` that a
// `resolutions` pin quietly held back, so `test:regression` "passed on 4.12" while node_modules had 4.11.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..'); // apps/web

function installedVersion(pkg: string): string | null {
  try { return JSON.parse(readFileSync(resolve(webRoot, `node_modules/${pkg}/package.json`), 'utf8')).version; }
  catch { return null; }
}

test.describe('engine version stamp', () => {
  test('installed @quereus/* matches package.json (no stale/resolutions-pinned install)', () => {
    const pkg = JSON.parse(readFileSync(resolve(webRoot, 'package.json'), 'utf8'));
    const declared: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
    const resolutions: Record<string, string> = pkg.resolutions ?? {};

    const STAMP = ['@quereus/quereus', '@quereus/store', '@quereus/plugin-indexeddb', '@quereus/isolation',
      '@optimystic/db-p2p', '@serfab/cadre-core'];
    const short = (n: string) => n.replace('@quereus/', 'q:').replace('@optimystic/', 'o:').replace('@serfab/', '');
    console.log(`  engines: ${STAMP.map((n) => `${short(n)}@${installedVersion(n) ?? '(absent)'}`).join('  ')}`);

    const QUEREUS = ['@quereus/quereus', '@quereus/store', '@quereus/plugin-indexeddb', '@quereus/isolation'];
    for (const name of QUEREUS) {
      const installed = installedVersion(name);
      expect(installed, `${name} is not installed`).not.toBeNull();

      const dep = declared[name];
      if (dep && !/^[\^~]/.test(dep)) {
        // The repo pins @quereus/* to exact versions in `dependencies` → node_modules must match exactly.
        expect(installed,
          `${name}: package.json declares "${dep}" but node_modules has "${installed}". A resolutions pin ` +
          `(resolutions["${name}"] = "${resolutions[name] ?? '—'}") or a stale install held it back — bump the ` +
          `resolutions entry too and run "yarn install".`,
        ).toBe(dep);
      }

      // Belt-and-suspenders: if a resolutions pin exists, it must agree with the dependency (the exact cause
      // of the 4.11/4.12 trap), so the two can't silently diverge again.
      if (resolutions[name] && dep) {
        expect(resolutions[name].replace(/^[\^~]/, ''), `resolutions["${name}"] disagrees with dependencies`).
          toBe(dep.replace(/^[\^~]/, ''));
      }
    }
  });
});

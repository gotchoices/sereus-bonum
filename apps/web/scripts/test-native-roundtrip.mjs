// End-to-end native restore test: upload a bonum-books .json via the import screen,
// confirm it restores into a fresh entity and the entity view renders.
// Usage: node scripts/test-native-roundtrip.mjs <file.json> [baseUrl]
import { chromium } from 'playwright';

const file = process.argv[2];
const base = process.argv[3] || 'http://localhost:5090';
if (!file) { console.error('need a .json file path'); process.exit(1); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const t0 = Date.now();
try {
  await page.goto(`${base}/import`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.setInputFiles('input[type=file]', file);
  await page.waitForTimeout(500);
  // The primary button reads "Restore" for a native file.
  await page.click('button.btn-primary');

  // Restore navigates to /entities/<id>?view=trial-balance on success.
  await page.waitForURL('**/entities/**', { timeout: 120000 });
  const restoreMs = Date.now() - t0;
  const url = page.url();
  console.log(`RESTORE OK in ${restoreMs}ms → ${url}`);
  // Wait for the entity view to stop showing "Loading..." (the balance-sheet query to resolve).
  const tView = Date.now();
  try {
    await page.waitForFunction(
      () => !/Loading\.\.\./.test(document.body.innerText),
      { timeout: 90000, polling: 500 },
    );
    console.log(`VIEW RENDERED in ${Date.now() - tView}ms after restore`);
  } catch {
    console.log(`VIEW STILL LOADING after ${Date.now() - tView}ms`);
  }
  await page.screenshot({ path: 'roundtrip.png', fullPage: true });
} catch (e) {
  console.log(`FAILED: ${e.message}`);
  await page.screenshot({ path: 'roundtrip-fail.png', fullPage: true });
}
await browser.close();
console.log('\n--- console ---\n' + (logs.slice(-40).join('\n') || '(none)'));

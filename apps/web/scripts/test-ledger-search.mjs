// Scale test for the ledger (busy account) and cross-entity search after a native restore.
// Usage: node scripts/test-ledger-search.mjs <file.json> [baseUrl]
import { chromium } from 'playwright';

const file = process.argv[2];
const base = process.argv[3] || 'http://localhost:5090';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const logs = [];
let ledgerLoadedResolve;
const ledgerLoaded = new Promise((r) => { ledgerLoadedResolve = r; });
page.on('console', (m) => {
  const t = m.text();
  if (/Ledger|transactions|BalanceSheet/i.test(t)) logs.push(t);
  if (/\[Ledger\] Loaded \d/.test(t)) ledgerLoadedResolve(t);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

async function waitLoaded(ms = 90000) {
  await page.waitForFunction(() => !/Loading\.\.\./.test(document.body.innerText), { timeout: ms, polling: 300 });
}

try {
  // 1. Restore.
  await page.goto(`${base}/import`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.setInputFiles('input[type=file]', file);
  await page.waitForTimeout(500);
  await page.click('button.btn-primary');
  await page.waitForURL('**/entities/**', { timeout: 180000 });
  await waitLoaded();

  // 2. Cross-entity search (loads all) — tests getAllTransactions at scale. SPA-navigate (no reload,
  // which would re-init the DB) via the sidebar link.
  await page.click('a[href="/search"]');
  await page.waitForSelector('button.btn-primary', { timeout: 10000 });
  const tS = Date.now();
  await page.click('button.btn-primary');
  await page.waitForFunction(() => document.querySelectorAll('a[href^="/ledger/"]').length > 0, { timeout: 120000, polling: 300 });
  console.log(`SEARCH loaded in ${Date.now() - tS}ms`);

  // 3. Ledger for the busiest account (Checking — funding side of most txns), harvested from search.
  const checking = page.locator('a[href^="/ledger/"]:has-text("Checking Account")').first();
  const link = (await checking.count()) ? checking : page.locator('a[href^="/ledger/"]').first();
  const href = await link.getAttribute('href');
  const tL = Date.now();
  await link.click();
  const loadedMsg = await Promise.race([
    ledgerLoaded,
    new Promise((r) => setTimeout(() => r('(timeout)'), 120000)),
  ]);
  console.log(`LEDGER loaded in ${Date.now() - tL}ms (${href}) — ${loadedMsg}`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'ledger.png' });
} catch (e) {
  console.log(`FAILED: ${e.message}`);
  await page.screenshot({ path: 'ledger-search-fail.png', fullPage: true });
}
await browser.close();
console.log('\n--- console ---\n' + logs.slice(-15).join('\n'));

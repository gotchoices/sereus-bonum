// Restore a file, then use the Export button to dump it back out, and verify counts survive.
import { chromium } from 'playwright';
const file = process.argv[2];
const base = 'http://localhost:5090';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));

// 1. Restore the input file.
await page.goto(`${base}/import`, { waitUntil: 'networkidle', timeout: 30000 });
await page.setInputFiles('input[type=file]', file);
await page.waitForTimeout(500);
await page.click('button.btn-primary');
await page.waitForURL('**/entities/**', { timeout: 120000 });
await page.waitForFunction(() => !/Loading\.\.\./.test(document.body.innerText), { timeout: 60000, polling: 500 });

// 2. Click Export and capture the download.
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 60000 }),
  page.click('button:has-text("Export")'),
]);
const path = await download.path();
const fs = await import('node:fs');
const dumped = JSON.parse(fs.readFileSync(path, 'utf8'));
const orig = JSON.parse(fs.readFileSync(file, 'utf8'));
console.log(`filename: ${download.suggestedFilename()}`);
console.log(`orig:   accounts=${orig.accounts.length} txns=${orig.transactions.length}`);
console.log(`dumped: accounts=${dumped.accounts.length} txns=${dumped.transactions.length} format=${dumped.format}`);
const origEntries = orig.transactions.reduce((s,t)=>s+t.entries.length,0);
const dumpEntries = dumped.transactions.reduce((s,t)=>s+t.entries.length,0);
console.log(`entries: orig=${origEntries} dumped=${dumpEntries}`);
console.log(`MATCH: ${orig.accounts.length===dumped.accounts.length && orig.transactions.length===dumped.transactions.length && origEntries===dumpEntries}`);
await browser.close();

// Headless screenshot + console capture for the running dev server.
// Usage: node scripts/shot.mjs <url> <outfile.png>
// Prints all console/page-error output to stdout so failures are visible.
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5090/';
const out = process.argv[3] || 'shot.png';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
} catch (e) {
  logs.push(`[goto-error] ${e.message}`);
}
// allow async DB init + Svelte hydration to settle
await page.waitForTimeout(3000);
await page.screenshot({ path: out, fullPage: true });
await browser.close();

console.log(logs.join('\n') || '(no console output)');
console.log(`\n--> screenshot: ${out}`);

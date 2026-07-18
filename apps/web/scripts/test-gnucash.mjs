// Drive the GnuCash import flow to reproduce mapping + import issues.
// Usage: node scripts/test-gnucash.mjs <file.gnucash> [baseUrl] [--stale]
import { chromium } from 'playwright';

const file = process.argv[2] || '../../tmp/Kyle.gnucash';
const base = process.argv[3] || 'http://localhost:5090';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const logs = [];
page.on('console', (m) => { const t = m.text(); if (/Import|Failed|error|source_id/i.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

try {
  await page.goto(`${base}/import`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#entity-name', 'Kyle Import Test');
  await page.setInputFiles('input[type=file]', file);
  await page.waitForTimeout(300);
  await page.click('button.btn-primary'); // Next → processFile → mapping
  // Wait for mapping screen.
  await page.waitForSelector('.mapping-row', { timeout: 60000 });
  await page.waitForTimeout(500);

  // Capture mapping stats + sample rows (source path vs target group).
  const stats = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.mapping-row')];
    const resolvedCount = document.querySelector('.stat-value.resolved, .summary-stats')?.textContent || '';
    const sample = rows.slice(0, 25).map((r) => ({
      source: r.querySelector('.col-source')?.getAttribute('title')?.split('\n')[0] || r.querySelector('.account-name')?.textContent?.trim(),
      targetGroup: r.querySelector('.col-target-group')?.textContent?.trim(),
      targetAccount: r.querySelector('.col-target-account')?.textContent?.trim(),
      status: r.querySelector('.resolution-icon')?.textContent?.trim(),
    }));
    return { total: rows.length, resolvedText: resolvedCount.replace(/\s+/g, ' ').trim(), sample };
  });
  console.log(`MAPPINGS total=${stats.total}  ${stats.resolvedText}`);
  console.log('SAMPLE (source path → target group : target account [status]):');
  for (const s of stats.sample) console.log(`  ${s.source}  →  ${s.targetGroup} : ${s.targetAccount}  [${s.status}]`);

  // Try to import.
  const importBtn = page.locator('.dialog-footer button.btn-primary');
  const disabled = await importBtn.isDisabled();
  console.log(`\nIMPORT button disabled=${disabled}`);
  if (!disabled) {
    await importBtn.click();
    // Import of 17k txns can take a while; poll for error or navigation.
    let outcome = '(pending)';
    for (let i = 0; i < 150; i++) {
      await page.waitForTimeout(2000);
      const state = await page.evaluate(() => ({
        err: document.querySelector('.error-message')?.textContent?.trim() || null,
        path: window.location.pathname,
      }));
      if (state.err) { outcome = 'ERROR: ' + state.err; break; }
      if (!state.path.startsWith('/import')) { outcome = 'SUCCESS → navigated to ' + state.path; break; }
    }
    console.log(`IMPORT result: ${outcome}`);
  }
  await page.screenshot({ path: 'gnucash.png', fullPage: false });
} catch (e) {
  console.log(`FAILED: ${e.message}`);
  await page.screenshot({ path: 'gnucash-fail.png', fullPage: false });
}
await browser.close();
console.log('\n--- console ---\n' + logs.slice(-25).join('\n'));

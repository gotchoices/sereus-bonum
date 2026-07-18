import { chromium } from 'playwright';
const base = 'http://localhost:5090';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
page.on('pageerror', (e) => console.log('[ERR]', e.message));
// Import synth.gnucash
await page.goto(`${base}/import`, { waitUntil: 'networkidle', timeout: 30000 });
await page.fill('#entity-name', 'Synth');
await page.setInputFiles('input[type=file]', '../../tmp/synth.gnucash');
await page.waitForTimeout(300);
await page.click('button.btn-primary');
await page.waitForSelector('.mapping-row', { timeout: 30000 });
await page.locator('.dialog-footer button.btn-primary').click();
await page.waitForURL('**/entities/**', { timeout: 30000 });
await page.waitForFunction(() => !/Loading\.\.\./.test(document.body.innerText), { timeout: 30000, polling: 300 }).catch(()=>{});
// Export native JSON
const [dl] = await Promise.all([ page.waitForEvent('download', { timeout: 30000 }), page.click('button:has-text("Export")') ]);
const fs = await import('node:fs');
const books = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
await browser.close();

const byRef = new Map(books.accounts.map(a => [a.ref, a]));
const byName = new Map(books.accounts.map(a => [a.name, a]));
console.log('accounts created:', books.accounts.map(a => a.name).sort().join(', '));
const chk = (label, cond) => console.log(`${cond ? 'PASS' : 'FAIL'}: ${label}`);
const jeppson = byName.get('Jeppson'), aof = byName.get('AOF Loan'), checking = byName.get('Checking'), salary = byName.get('Salary');
chk('Jeppson created', !!jeppson);
chk('AOF Loan created', !!aof);
chk('No "Assets"/"Fixed Assets"/"Current Assets"/"Income" accounts (they are groups)',
    !byName.has('Assets') && !byName.has('Fixed Assets') && !byName.has('Current Assets') && !byName.has('Income'));
chk('AOF Loan.parentRef === Jeppson', aof && jeppson && aof.parentRef === jeppson.ref);
chk('Jeppson has no parent (top under group)', jeppson && !jeppson.parentRef);
chk('Jeppson group = grp-fixed-assets', jeppson && jeppson.accountGroupId === 'grp-fixed-assets');
chk('AOF Loan group = grp-fixed-assets', aof && aof.accountGroupId === 'grp-fixed-assets');
chk('Checking group = grp-current-assets, no parent', checking && checking.accountGroupId === 'grp-current-assets' && !checking.parentRef);
chk('Salary group = grp-income, no parent', salary && salary.accountGroupId === 'grp-income' && !salary.parentRef);
console.log('txns exported:', books.transactions.length, '(expect 2)');

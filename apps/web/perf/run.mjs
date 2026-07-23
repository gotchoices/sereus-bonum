// Bonum DB performance harness. Drives the real DataService (and raw in-engine SQL) against a chosen
// backend at graduated data sizes, timing the exact query shapes Bonum ships — so each new
// Quereus/Optimystic release can be judged FOR OUR WORKLOAD. See design/specs/web/global/testing.md § B.
//
// Usage (from apps/web):
//   node perf/run.mjs [--backend quereus-local|mock|quereus-p2p] [--sizes 100,1000,5000]
//                     [--n 3] [--port 5199] [--update-baseline]
//   yarn perf                         # quereus-local, sizes 100,1000,5000
//   yarn perf --backend mock          # reference baseline on sql.js
//   yarn perf --update-baseline       # record current medians as the ratio baseline
//
// Each (backend,size) runs in a FRESH browser context (isolated IndexedDB) so sizes don't accumulate.
// Results append to perf/perf-results.jsonl (version-stamped) and print a table + baseline delta.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dir, '..');
const repoRoot = resolve(webRoot, '../..');

// ---- args ----------------------------------------------------------------
function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) {
      const key = k.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { a[key] = true; }
      else { a[key] = next; i++; }
    }
  }
  return a;
}
const args = parseArgs(process.argv.slice(2));
const backend = args.backend || 'quereus-local';
const sizes = String(args.sizes || '100,1000,5000').split(',').map(Number);
const N = Number(args.n || 3);
const PORT = Number(args.port || 5199);
const updateBaseline = !!args['update-baseline'];
const base = `http://localhost:${PORT}`;
const useQuereus = backend !== 'mock';
// Naive in-engine JOINs are pathologically slow on the store (that's the point — ~49s for a 4-way
// join at 2k entries), so they run single-shot and only up to --naive-max (default 100). Raise it
// (e.g. --naive-max 1000) to measure the gap at scale; --no-naive skips them entirely.
const naiveMax = Number(args['naive-max'] || 100);
const noNaive = !!args['no-naive'];

// ---- version stamp -------------------------------------------------------
function pkgVersion(name) {
  try { return JSON.parse(readFileSync(`${webRoot}/node_modules/${name}/package.json`, 'utf8')).version; }
  catch { return null; }
}
const versions = {
  '@quereus/quereus': pkgVersion('@quereus/quereus'),
  '@quereus/plugin-indexeddb': pkgVersion('@quereus/plugin-indexeddb'),
  '@optimystic/db-p2p': pkgVersion('@optimystic/db-p2p'),
  '@serfab/cadre-core': pkgVersion('@serfab/cadre-core'),
};

// ---- naive in-engine JOIN SQL (the JS-join alternative we replaced; quereus only) ----------------
const NAIVE_SQL = {
  bs: `select ag.account_type as type, sum(e.amount) as total
       from entry e
       join txn t on t.id = e.txn_id
       join account a on a.id = e.account_id
       join account_group ag on ag.id = a.account_group_id
       where a.entity_id = ? and t.date <= ?
       group by ag.account_type`,
  ledger: `select t.date, e.amount, e.txn_id
           from entry e join txn t on t.id = e.txn_id
           where e.account_id = ? order by t.date`,
};
const END_DATE = '2035-12-31';
const START_DATE = '2000-01-01';

// ---- in-page benchmark (runs in the browser; only serializable args) -----------------------------
async function benchInPage({ fixture, N, useQuereus, runNaive, endDate, startDate, sql }) {
  const api = window.__bonum;
  if (!api) throw new Error('window.__bonum missing — probe not installed (needs `vite dev`).');
  const now = () => performance.now();
  const timeit = async (fn) => {
    await fn(); // warmup (not counted)
    const ts = [];
    let last;
    for (let i = 0; i < N; i++) { const s = now(); last = await fn(); ts.push(now() - s); }
    ts.sort((a, b) => a - b);
    const q = (p) => ts[Math.min(ts.length - 1, Math.floor(ts.length * p))];
    return { p50: q(0.5), p95: q(0.95), min: ts[0], _last: last };
  };
  // Single-shot (no warmup/repeat) — the naive store JOINs are far too slow to run N+1 times.
  const timeOnce = async (fn) => { const s = now(); const last = await fn(); const d = now() - s; return { p50: d, p95: d, min: d, once: true, _last: last }; };

  const w0 = now();
  const entityId = await api.importNativeBooks(fixture); // seed == write benchmark
  const write = now() - w0;

  const ds = await api.getDataService();
  const accounts = await ds.getAccounts(entityId);
  let busiestId = accounts[0] && accounts[0].id;
  if (useQuereus) {
    const r = await api.rawQuery('select account_id, count(*) c from entry group by account_id order by c desc limit 1');
    if (r && r[0]) busiestId = r[0].account_id;
  }

  const ops = {};
  ops.balanceSheet = await timeit(() => ds.getBalanceSheet(entityId, endDate));
  ops.incomeStatement = await timeit(() => ds.getBalanceSheet(entityId, endDate, startDate));
  ops.ledger = await timeit(() => ds.getLedgerEntries(busiestId));
  ops.allTransactions = await timeit(() => ds.getAllTransactions());
  ops.searchAccounts = await timeit(() => ds.searchAccounts(entityId, 'a'));
  ops.accountBalance = await timeit(() => ds.getAccountBalance(busiestId));

  const bs = ops.balanceSheet._last;
  const identity = bs.totalAssets - (bs.totalLiabilities + bs.totalEquity + bs.totalIncome - bs.totalExpense);
  // Correctness (not just timing): an account's unbounded balance must equal the sum of its ledger entries.
  const ledgerSum = (ops.ledger._last || []).reduce((s, e) => s + Number(e.amount), 0);
  const balanceMatchesLedger = Math.abs(Number(ops.accountBalance._last) - ledgerSum) < 1;
  const rows = {
    accounts: accounts.length,
    ledgerEntries: (ops.ledger._last || []).length,
    allEntries: (ops.allTransactions._last || []).length,
    searchHits: (ops.searchAccounts._last || []).length,
  };

  const naive = {};
  if (runNaive) {
    naive.balanceSheet = await timeOnce(() => api.rawQuery(sql.bs, [entityId, endDate]));
    naive.ledger = await timeOnce(() => api.rawQuery(sql.ledger, [busiestId]));
  }

  const strip = (o) => { const { _last, ...rest } = o; return rest; };
  const out = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, strip(v)]));
  return { entityId, write, ops: out(ops), naive: out(naive), rows, asserts: { balanced: Math.abs(identity) < 1, identity, balanceMatchesLedger } };
}

// ---- server lifecycle ----------------------------------------------------
function startServer() {
  const bin = resolve(webRoot, 'node_modules/.bin/vite');
  const child = spawn(bin, ['dev', '--port', String(PORT), '--strictPort'], {
    cwd: webRoot,
    env: { ...process.env, VITE_BACKEND: backend },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((res, rej) => {
    let buf = '';
    const onData = (d) => { buf += d.toString(); if (/Local:\s+http/.test(buf)) res(child); };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (c) => rej(new Error(`vite exited (${c})\n${buf}`)));
    setTimeout(() => rej(new Error(`vite start timeout\n${buf}`)), 60000);
  });
}
function stopServer(child) {
  try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
}

// ---- baseline ------------------------------------------------------------
const baselinePath = resolve(__dir, 'baseline.json');
const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {};
function delta(cur, base) {
  if (base == null) return '     —';
  const r = cur / base;
  const tag = r > 1.3 ? ' ⚠REG' : r < 0.77 ? ' ⬇IMP' : '';
  return `${r.toFixed(2)}×${tag}`;
}

// ---- run -----------------------------------------------------------------
const fmt = (ms) => (ms == null ? '   —' : ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(0)}ms`);
const resultsPath = resolve(__dir, 'perf-results.jsonl');

console.log(`\n▶ perf: backend=${backend} sizes=[${sizes}] N=${N}`);
console.log(`  engines: ${Object.entries(versions).map(([k, v]) => `${k.split('/').pop()}@${v}`).join('  ')}\n`);

let server;
try {
  server = await startServer();
  const browser = await chromium.launch();
  const newBaseline = updateBaseline ? { ...baseline } : null;

  for (const size of sizes) {
    const fixturePath = resolve(repoRoot, `tmp/books-${size}.json`);
    if (!existsSync(fixturePath)) { console.log(`  ! skip ${size}: fixture missing (${fixturePath}) — run scripts/gen-books.mjs`); continue; }
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => !!window.__bonum, { timeout: 15000 });

    let r;
    try {
      const runNaive = useQuereus && !noNaive && size <= naiveMax;
      r = await page.evaluate(benchInPage, { fixture, N, useQuereus, runNaive, endDate: END_DATE, startDate: START_DATE, sql: NAIVE_SQL });
    } catch (e) {
      console.log(`  ✗ size ${size} FAILED: ${e.message}`);
      await ctx.close();
      continue;
    }
    await ctx.close();

    const key = `${backend}:${size}`;
    const record = { ts: new Date().toISOString(), backend, size, N, versions, ...r };
    appendFileSync(resultsPath, JSON.stringify(record) + '\n');

    // ---- table ----
    const assertStr = `${r.asserts.balanced ? '✓ balanced' : `✗ IMBALANCE ${r.asserts.identity}`}${r.asserts.balanceMatchesLedger ? '' : ' ✗ balance≠ledger'}`;
    console.log(`── size ${size}  (${r.rows.accounts} accts, ${r.rows.allEntries} entries)  ${assertStr}${errs.length ? `  ⚠ ${errs.length} page errors` : ''}`);
    console.log(`   write (restore): ${fmt(r.write)}   ${delta(r.write, baseline[key]?.write)}`);
    const bl = baseline[key]?.ops || {};
    for (const [name, m] of Object.entries(r.ops)) {
      const nv = r.naive[name];
      const naiveStr = nv ? `   naive-JOIN ${fmt(nv.p50)} (${(nv.p50 / m.p50).toFixed(1)}× shipped)` : '';
      console.log(`   ${name.padEnd(16)} p50 ${fmt(m.p50).padStart(7)}  p95 ${fmt(m.p95).padStart(7)}   ${delta(m.p50, bl[name])}${naiveStr}`);
    }
    console.log('');

    if (newBaseline) {
      newBaseline[key] = { write: r.write, ops: Object.fromEntries(Object.entries(r.ops).map(([k, v]) => [k, v.p50])), naive: Object.fromEntries(Object.entries(r.naive).map(([k, v]) => [k, v.p50])) };
    }
  }

  await browser.close();
  if (newBaseline) { writeFileSync(baselinePath, JSON.stringify(newBaseline, null, 2) + '\n'); console.log(`✓ baseline updated → ${baselinePath}`); }
  console.log(`✓ results appended → ${resultsPath}`);
} catch (e) {
  console.error(`✗ perf run failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  if (server) stopServer(server);
}

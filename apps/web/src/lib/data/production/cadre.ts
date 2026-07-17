// Web CadreService — single-node Optimystic boot for the quereus-p2p backend.
//
// Mirrors health's CadreService (sereus/apps/mobile) but uses the browser
// IndexedDB storage backend (@optimystic/db-p2p-storage-web) instead of RN leveldb.
//
// SCOPE: single node only. Building a multi-node cadre is experimental and on hold
// (sereus cadre functionality is still in progress). The strand runs in 'bootstrap'
// mode — schema apply + DML route through the local transactor, so a solo node comes
// up without waiting on consensus round-trips. Adding remote nodes is future work.

import { CadreNode, type CadreNodeConfig, type StrandInstance } from '@serfab/cadre-core';
import { webSockets } from '@libp2p/websockets';
import {
  IndexedDBRawStorage,
  openOptimysticWebDb,
  loadOrCreateBrowserPeerKey,
  type OptimysticWebDBHandle,
} from '@optimystic/db-p2p-storage-web';
import type { Database } from '@quereus/quereus';
import { log } from '$lib/logger';
import SCHEMA_QSQL from './schema.qsql?raw';

const SAPP_ID = 'org.sereus.bonum';
const SAPP_VERSION = '1.0';
const PARTY_ID_KEY = 'bonum-party-id';
const STRAND_ID_KEY = 'bonum-strand-id';
const DB_PREFIX = 'optimystic-';

// StrandDatabase re-wraps the sApp schema in `declare schema App { ... }; apply schema App;`.
// Our schema.qsql is `create table …;` — convert to `table …;` declarations for the wrapper.
function innerDDL(sql: string): string {
  return sql
    .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    .replace(/\bcreate\s+table\b/gi, 'table')
    .trim();
}
const BONUM_SCHEMA_DDL = innerDDL(SCHEMA_QSQL);

function getOrCreate(key: string): string {
  let v = localStorage.getItem(key);
  if (!v) { v = crypto.randomUUID(); localStorage.setItem(key, v); }
  return v;
}

class WebCadreService {
  private node: CadreNode | null = null;
  private strand: StrandInstance | null = null;
  private startPromise: Promise<void> | null = null;
  private readonly handles = new Map<string, OptimysticWebDBHandle>();

  async ensureStarted(): Promise<void> {
    if (this.strand) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.doStart();
    try { await this.startPromise; } catch (e) { this.startPromise = null; throw e; }
  }

  private async openHandle(strandId: string): Promise<OptimysticWebDBHandle> {
    let h = this.handles.get(strandId);
    if (!h) { h = await openOptimysticWebDb(DB_PREFIX + strandId); this.handles.set(strandId, h); }
    return h;
  }

  private mustHandle(strandId: string): OptimysticWebDBHandle {
    const h = this.handles.get(strandId);
    if (!h) throw new Error(`Optimystic storage not pre-opened for strand ${strandId}`);
    return h;
  }

  private async doStart(): Promise<void> {
    const partyId = getOrCreate(PARTY_ID_KEY);
    const strandId = getOrCreate(STRAND_ID_KEY);
    log.data.info(`[Cadre] party=${partyId} strand=${strandId}`);

    // Pre-open control + strand handles — the storage provider callback is sync.
    const controlHandle = await this.openHandle('control');
    await this.openHandle(strandId);
    const privateKey = await loadOrCreateBrowserPeerKey(controlHandle);

    const config: CadreNodeConfig = {
      privateKey,
      controlNetwork: { partyId, bootstrapNodes: [] },
      profile: 'transaction',
      requireSignedSchemas: false,
      strandFilter: { mode: 'sAppId', sAppId: SAPP_ID },
      storage: { provider: (sid: string) => new IndexedDBRawStorage(this.mustHandle(sid)) },
      network: { transports: [webSockets()], listenAddrs: [] },
    };

    log.data.info('[Cadre] starting CadreNode...');
    this.node = new CadreNode(config);
    await this.node.start();
    log.data.info(`[Cadre] node started, peer=${this.node.peerId?.toString()}`);

    this.strand = await this.node.addStrand({
      mode: 'bootstrap',
      strandRow: { Id: strandId, MemberPrivateKey: null, Type: 'o' },
      sAppConfig: { id: SAPP_ID, version: SAPP_VERSION, schema: BONUM_SCHEMA_DDL, signature: '' },
    });
    log.data.info(`[Cadre] strand ready, database=${!!this.strand?.database}`);
  }

  getDatabase(): Database {
    if (!this.strand?.database) throw new Error('Strand not initialized. Call ensureStarted() first.');
    return this.strand.database.getDatabase();
  }

  async stop(): Promise<void> {
    this.strand = null;
    if (this.node) { await this.node.stop(); this.node = null; }
    for (const h of this.handles.values()) { try { h.close(); } catch { /* ignore */ } }
    this.handles.clear();
    this.startPromise = null;
  }
}

export const webCadreService = new WebCadreService();

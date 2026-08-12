// Unit store — the units of account known to the app (currencies, securities, CHIPs, inventory).
// Units are global (not per entity), small in number, and needed by every screen that renders an
// amount, because `displayDivisor` decides what a stored integer means. See domain/units.md.

import { writable, derived } from 'svelte/store';
import { getDataService, type Unit } from '$lib/data';
import { log } from '$lib/logger';

export const units = writable<Unit[]>([]);
export const unitsLoading = writable(false);

export type { Unit };

/** Lookup by code, for the formatters in $lib/report/format. */
export const unitByCode = derived(units, ($units) => new Map($units.map((u) => [u.code, u])));

let loaded = false;

/** Load once per session; `force` re-reads after an import creates new units. */
export async function loadUnits(force = false): Promise<void> {
  if (loaded && !force) return;
  unitsLoading.set(true);
  try {
    const ds = await getDataService();
    units.set(await ds.getUnits());
    loaded = true;
  } catch (e) {
    log.data.error('[Units] Failed to load:', e);
    units.set([]);
  } finally {
    unitsLoading.set(false);
  }
}

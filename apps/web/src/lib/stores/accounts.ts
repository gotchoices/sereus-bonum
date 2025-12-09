// Account and AccountGroup stores
// Manages account data for the selected entity

import { writable, derived } from 'svelte/store';
import { getDataService, type Account, type AccountGroup, type AccountType } from '$lib/data';
import { log } from '$lib/logger';
import { selectedEntityId } from './entities';

// Account groups (shared across all entities)
export const accountGroups = writable<AccountGroup[]>([]);
export const accountGroupsLoading = writable(false);

// Accounts for current entity
export const accounts = writable<Account[]>([]);
export const accountsLoading = writable(false);

// Re-export types
export type { Account, AccountGroup, AccountType };

// Derived: accounts grouped by account group
export const accountsByGroup = derived(
  [accounts, accountGroups],
  ([$accounts, $accountGroups]) => {
    const map = new Map<string, Account[]>();
    for (const group of $accountGroups) {
      map.set(group.id, []);
    }
    for (const account of $accounts) {
      const list = map.get(account.accountGroupId);
      if (list) {
        list.push(account);
      }
    }
    return map;
  }
);

// Derived: top-level groups organized by account type (parentId is null)
export const topLevelGroupsByType = derived(
  accountGroups,
  ($accountGroups) => {
    const types: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
    const map = new Map<AccountType, AccountGroup[]>();
    for (const type of types) {
      map.set(type, $accountGroups.filter(g => g.accountType === type && !g.parentId));
    }
    return map;
  }
);

// Derived: child groups by parent ID
export const childGroupsByParent = derived(
  accountGroups,
  ($accountGroups) => {
    const map = new Map<string, AccountGroup[]>();
    for (const group of $accountGroups) {
      if (group.parentId) {
        const children = map.get(group.parentId) || [];
        children.push(group);
        map.set(group.parentId, children);
      }
    }
    return map;
  }
);

// Helper: check if a group has children
export function hasChildren(groupId: string, childMap: Map<string, AccountGroup[]>): boolean {
  return (childMap.get(groupId)?.length ?? 0) > 0;
}

/**
 * Load account groups (call once on app init)
 */
export async function loadAccountGroups(): Promise<void> {
  accountGroupsLoading.set(true);
  try {
    const ds = await getDataService();
    const groups = await ds.getAccountGroups();
    accountGroups.set(groups);
    log.data.info(`Loaded ${groups.length} account groups`);
  } catch (e) {
    log.data.error('Failed to load account groups:', e);
  } finally {
    accountGroupsLoading.set(false);
  }
}

/**
 * Create a new account group
 */
export async function createAccountGroup(data: {
  name: string;
  accountType: AccountType;
  parentId?: string;
  description?: string;
}): Promise<AccountGroup | null> {
  try {
    const ds = await getDataService();
    const group = await ds.createAccountGroup(data);
    accountGroups.update(list => [...list, group]);
    log.data.info('Created account group:', group.name);
    return group;
  } catch (e) {
    log.data.error('Failed to create account group:', e);
    return null;
  }
}

/**
 * Update an account group
 */
export async function updateAccountGroup(
  id: string, 
  data: Partial<{ name: string; description: string }>
): Promise<AccountGroup | null> {
  try {
    const ds = await getDataService();
    const updated = await ds.updateAccountGroup(id, data);
    accountGroups.update(list => list.map(g => g.id === id ? updated : g));
    log.data.info('Updated account group:', updated.name);
    return updated;
  } catch (e) {
    log.data.error('Failed to update account group:', e);
    return null;
  }
}

/**
 * Delete an account group
 */
export async function deleteAccountGroup(id: string): Promise<boolean> {
  try {
    const ds = await getDataService();
    await ds.deleteAccountGroup(id);
    accountGroups.update(list => list.filter(g => g.id !== id));
    log.data.info('Deleted account group:', id);
    return true;
  } catch (e) {
    log.data.error('Failed to delete account group:', e);
    return false;
  }
}

/**
 * Load accounts for an entity
 */
export async function loadAccounts(entityId: string): Promise<void> {
  accountsLoading.set(true);
  try {
    const ds = await getDataService();
    const list = await ds.getAccounts(entityId);
    accounts.set(list);
    log.data.info(`Loaded ${list.length} accounts for entity ${entityId}`);
  } catch (e) {
    log.data.error('Failed to load accounts:', e);
    accounts.set([]);
  } finally {
    accountsLoading.set(false);
  }
}

/**
 * Clear accounts (when no entity selected)
 */
export function clearAccounts(): void {
  accounts.set([]);
}

// Auto-load accounts when selected entity changes
let currentEntityId: string | null = null;
selectedEntityId.subscribe((id) => {
  if (id !== currentEntityId) {
    currentEntityId = id;
    if (id) {
      loadAccounts(id);
    } else {
      clearAccounts();
    }
  }
});


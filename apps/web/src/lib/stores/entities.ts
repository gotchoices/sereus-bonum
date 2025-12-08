// Entity store for Bonum
// Manages the list of entities and selection state
// Now backed by DataService

import { writable, derived } from 'svelte/store';
import { getDataService, type Entity, type EntityInput } from '$lib/data';
import { log } from '$lib/logger';

// Entity list store
export const entities = writable<Entity[]>([]);

// Loading state
export const entitiesLoading = writable(true);

// Error state
export const entitiesError = writable<string | null>(null);

// Currently selected entity ID
export const selectedEntityId = writable<string | null>(null);

// Derived: currently selected entity
export const selectedEntity = derived(
  [entities, selectedEntityId],
  ([$entities, $selectedEntityId]) => 
    $entities.find(e => e.id === $selectedEntityId) ?? null
);

// Re-export Entity type for convenience
export type { Entity };

/**
 * Initialize the store by loading from DataService
 */
export async function initializeEntities(): Promise<void> {
  log.entities.info('Initializing entities store...');
  entitiesLoading.set(true);
  entitiesError.set(null);
  
  try {
    log.entities.debug('Getting DataService...');
    const ds = await getDataService();
    
    log.entities.debug('Fetching entities...');
    const list = await ds.getEntities();
    
    log.entities.info(`Loaded ${list.length} entities`);
    entities.set(list);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load entities';
    entitiesError.set(msg);
    log.entities.error('Load error:', e);
  } finally {
    entitiesLoading.set(false);
    log.entities.debug('Loading complete');
  }
}

/**
 * Select an entity
 */
export function selectEntity(id: string | null): void {
  log.entities.debug('Selecting entity:', id);
  selectedEntityId.set(id);
}

/**
 * Add a new entity
 */
export async function addEntity(data: Omit<EntityInput, 'baseUnit'> & { baseUnit?: string }): Promise<Entity | null> {
  log.entities.info('Creating entity:', data.name);
  try {
    const ds = await getDataService();
    const entity = await ds.createEntity({
      ...data,
      baseUnit: data.baseUnit || 'USD',
    });
    entities.update(list => [...list, entity]);
    log.entities.info('Entity created:', entity.id);
    return entity;
  } catch (e) {
    log.entities.error('Create error:', e);
    return null;
  }
}

/**
 * Update an entity
 */
export async function updateEntity(id: string, data: Partial<EntityInput>): Promise<Entity | null> {
  log.entities.info('Updating entity:', id);
  try {
    const ds = await getDataService();
    const updated = await ds.updateEntity(id, data);
    entities.update(list => list.map(e => e.id === id ? updated : e));
    log.entities.info('Entity updated');
    return updated;
  } catch (e) {
    log.entities.error('Update error:', e);
    return null;
  }
}

/**
 * Delete an entity
 */
export async function deleteEntity(id: string): Promise<boolean> {
  log.entities.info('Deleting entity:', id);
  try {
    const ds = await getDataService();
    await ds.deleteEntity(id);
    entities.update(list => list.filter(e => e.id !== id));
    selectedEntityId.update(selected => selected === id ? null : selected);
    log.entities.info('Entity deleted');
    return true;
  } catch (e) {
    log.entities.error('Delete error:', e);
    return false;
  }
}

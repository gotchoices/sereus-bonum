// Entity store for Bonum
// Manages the list of entities and selection state

import { writable, derived } from 'svelte/store';

export interface Entity {
  id: string;
  name: string;
  description?: string;
  baseUnit: string;
  fiscalYearEnd?: string;
  createdAt: string;
  updatedAt: string;
}

// Demo entities - will be replaced by DataService
const demoEntities: Entity[] = [
  {
    id: 'template-home',
    name: 'Home Finance Template',
    description: 'Template for personal/household finances',
    baseUnit: 'USD',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'template-business',
    name: 'Small Business Template',
    description: 'Template for small business accounting',
    baseUnit: 'USD',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

// Entity list store
export const entities = writable<Entity[]>(demoEntities);

// Currently selected entity ID
export const selectedEntityId = writable<string | null>(null);

// Derived: currently selected entity
export const selectedEntity = derived(
  [entities, selectedEntityId],
  ([$entities, $selectedEntityId]) => 
    $entities.find(e => e.id === $selectedEntityId) ?? null
);

// Actions
export function selectEntity(id: string | null) {
  selectedEntityId.set(id);
}

export function addEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString();
  const newEntity: Entity = {
    ...entity,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  entities.update(list => [...list, newEntity]);
  return newEntity;
}

export function deleteEntity(id: string) {
  entities.update(list => list.filter(e => e.id !== id));
  selectedEntityId.update(selected => selected === id ? null : selected);
}


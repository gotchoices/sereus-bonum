// View state persistence
// See: design/specs/web/global/view-state.md

import { browser } from '$app/environment';

const STORAGE_PREFIX = 'bonum-';

/**
 * Save view state to localStorage
 */
export function saveViewState<T>(key: string, state: T): void {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state));
  } catch (e) {
    console.warn('[ViewState] Failed to save:', key, e);
  }
}

/**
 * Load view state from localStorage
 */
export function loadViewState<T>(key: string, defaultValue: T): T {
  if (!browser) return defaultValue;
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + key);
    if (!stored) return defaultValue;
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Clear a specific view state
 */
export function clearViewState(key: string): void {
  if (!browser) return;
  localStorage.removeItem(STORAGE_PREFIX + key);
}

/**
 * Clear all view states matching a prefix
 */
export function clearViewStatesForEntity(entityId: string): void {
  if (!browser) return;
  const prefix = STORAGE_PREFIX;
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix) && key.includes(entityId)) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(k => localStorage.removeItem(k));
}


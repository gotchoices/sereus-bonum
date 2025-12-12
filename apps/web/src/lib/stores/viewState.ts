// View state persistence
// See: design/specs/web/global/view-state.md

import { browser } from '$app/environment';
import { writable, type Writable } from 'svelte/store';

const STORAGE_PREFIX = 'bonum-';

/**
 * Create a reactive store that persists to localStorage
 * 
 * @param key - Storage key (will be prefixed with 'bonum-')
 * @param defaultValue - Default value if nothing stored
 * @returns Writable store that auto-saves to localStorage
 */
export function createViewStateStore<T>(key: string, defaultValue: T): Writable<T> {
  const storageKey = `${STORAGE_PREFIX}viewState:${key}`;
  
  // Load initial value
  let initialValue = defaultValue;
  if (browser) {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        initialValue = JSON.parse(stored) as T;
      }
    } catch (e) {
      console.warn('[ViewState] Failed to load:', key, e);
    }
  }
  
  // Create writable store
  const store = writable<T>(initialValue);
  
  // Subscribe to changes and save to localStorage
  if (browser) {
    store.subscribe(value => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(value));
      } catch (e) {
        console.warn('[ViewState] Failed to save:', key, e);
      }
    });
  }
  
  return store;
}

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


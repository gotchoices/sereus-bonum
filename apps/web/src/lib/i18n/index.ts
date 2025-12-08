// Internationalization (i18n) store
// See: design/specs/i18n.md, design/specs/web/global/i18n.md

import { writable, derived, get } from 'svelte/store';
import en from './locales/en';

type Locale = 'en';
type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = { en };

export const locale = writable<Locale>('en');

/**
 * Translation function as a Svelte store
 * Usage in components: {$t('key.path')} or {$t('key.path', { param: 'value' })}
 */
export const t = derived(locale, ($locale) => {
  const dict = dictionaries[$locale];
  
  return (key: string, params?: Record<string, string | number>): string => {
    // Navigate nested keys: "catalog.title" -> dict.catalog.title
    const keys = key.split('.');
    let value: unknown = dict;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        // Key not found - return key itself as fallback
        console.warn(`[i18n] Missing key: ${key}`);
        return key;
      }
    }
    
    if (typeof value !== 'string') {
      console.warn(`[i18n] Key is not a string: ${key}`);
      return key;
    }
    
    // Interpolate params: "Hello {{name}}" + {name: "World"} -> "Hello World"
    if (params) {
      return value.replace(/\{\{(\w+)\}\}/g, (_, paramKey) => 
        String(params[paramKey] ?? `{{${paramKey}}}`)
      );
    }
    
    return value;
  };
});

/**
 * Imperative translation (for non-reactive contexts)
 */
export function translate(key: string, params?: Record<string, string | number>): string {
  return get(t)(key, params);
}

/**
 * Set the current locale
 */
export function setLocale(newLocale: Locale): void {
  locale.set(newLocale);
}


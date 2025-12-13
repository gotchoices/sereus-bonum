/**
 * Settings Store
 * 
 * Global application settings and user preferences
 */

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';
export type DateFormat = 'US' | 'EU' | 'ISO';
export type AccountDisplay = 'code' | 'name' | 'path' | 'code-name';
export type TransactionSortOrder = 'oldest' | 'newest';

export interface SignReversal {
  equity: boolean;
  income: boolean;
  liability: boolean;
}

export interface AppSettings {
  theme: Theme;
  language: string;
  dateFormat: DateFormat;
  accountDisplay: AccountDisplay;
  transactionSortOrder: TransactionSortOrder;
  signReversal: SignReversal;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'en',
  dateFormat: 'US',
  accountDisplay: 'name',
  transactionSortOrder: 'oldest',
  signReversal: {
    equity: false,
    income: false,
    liability: false,
  },
};

function createSettingsStore() {
  const { subscribe, set, update } = writable<AppSettings>(DEFAULT_SETTINGS);

  return {
    subscribe,
    set,
    update,
    
    /**
     * Load settings from localStorage
     */
    load: () => {
      if (!browser) return;
      
      const theme = (localStorage.getItem('bonum-theme') as Theme) || DEFAULT_SETTINGS.theme;
      const language = localStorage.getItem('bonum-language') || DEFAULT_SETTINGS.language;
      const dateFormat = (localStorage.getItem('bonum-date-format') as DateFormat) || DEFAULT_SETTINGS.dateFormat;
      const accountDisplay = (localStorage.getItem('bonum-account-display') as AccountDisplay) || DEFAULT_SETTINGS.accountDisplay;
      const transactionSortOrder = (localStorage.getItem('bonum-transaction-sort') as TransactionSortOrder) || DEFAULT_SETTINGS.transactionSortOrder;
      
      let signReversal = DEFAULT_SETTINGS.signReversal;
      try {
        const saved = localStorage.getItem('bonum-sign-reversal');
        if (saved) {
          signReversal = JSON.parse(saved);
        }
      } catch (e) {
        console.error('Failed to parse sign reversal settings:', e);
      }
      
      set({
        theme,
        language,
        dateFormat,
        accountDisplay,
        transactionSortOrder,
        signReversal,
      });
      
      // Apply theme immediately
      applyTheme(theme);
    },
    
    /**
     * Set theme and apply it
     */
    setTheme: (theme: Theme) => {
      update(s => ({ ...s, theme }));
      if (browser) {
        localStorage.setItem('bonum-theme', theme);
        applyTheme(theme);
      }
    },
    
    /**
     * Set language (requires page reload)
     */
    setLanguage: (language: string) => {
      update(s => ({ ...s, language }));
      if (browser) {
        localStorage.setItem('bonum-language', language);
      }
    },
    
    /**
     * Set date format
     */
    setDateFormat: (format: DateFormat) => {
      update(s => ({ ...s, dateFormat: format }));
      if (browser) {
        localStorage.setItem('bonum-date-format', format);
      }
    },
    
    /**
     * Set account display format
     */
    setAccountDisplay: (display: AccountDisplay) => {
      update(s => ({ ...s, accountDisplay: display }));
      if (browser) {
        localStorage.setItem('bonum-account-display', display);
      }
    },
    
    /**
     * Set transaction sort order
     */
    setTransactionSortOrder: (order: TransactionSortOrder) => {
      update(s => ({ ...s, transactionSortOrder: order }));
      if (browser) {
        localStorage.setItem('bonum-transaction-sort', order);
      }
    },
    
    /**
     * Set sign reversal preferences
     */
    setSignReversal: (reversal: SignReversal) => {
      update(s => ({ ...s, signReversal: reversal }));
      if (browser) {
        localStorage.setItem('bonum-sign-reversal', JSON.stringify(reversal));
      }
    },
  };
}

export const settings = createSettingsStore();

/**
 * Apply theme to document
 */
function applyTheme(theme: Theme) {
  if (!browser) return;
  
  let effectiveTheme: 'light' | 'dark';
  
  if (theme === 'system') {
    // Detect OS preference
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    effectiveTheme = isDark ? 'dark' : 'light';
  } else {
    effectiveTheme = theme;
  }
  
  document.documentElement.setAttribute('data-theme', effectiveTheme);
}

/**
 * Derived store for effective theme (resolves 'system' to actual theme)
 */
export const effectiveTheme = derived(settings, $settings => {
  if (!browser) return 'dark';
  
  if ($settings.theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  return $settings.theme;
});


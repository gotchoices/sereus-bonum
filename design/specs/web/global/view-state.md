# Spec: View State Persistence

**Scope:** App-wide pattern

## Principle

When a user customizes how a view appears (expanded groups, column widths, scroll position, etc.), that customization should persist. The next time they visit the same view, it should look like it did when they left.

---

## What to Persist

| View State | Storage Key Pattern | Example |
|------------|---------------------|---------|
| Expand/collapse state | `bonum-{view}-expand-{contextId}` | `bonum-accounts-expand-entity-123` |
| Column widths | `bonum-{view}-columns-{contextId}` | `bonum-ledger-columns-account-456` |
| Sort order | `bonum-{view}-sort-{contextId}` | `bonum-catalog-sort` |
| Scroll position | `bonum-{view}-scroll-{contextId}` | `bonum-accounts-scroll-entity-123` |
| Selected tab/mode | `bonum-{view}-mode-{contextId}` | `bonum-accounts-mode-entity-123` |
| Date range | `bonum-{view}-dates-{contextId}` | `bonum-accounts-dates-entity-123` |

---

## Storage Strategy

**For MVP:** Use `localStorage`
- Simple key-value pairs
- JSON-serialized objects for complex state
- Per-browser, not synced

**Future consideration:** Sync via Sereus
- User preferences could sync across devices
- Would require schema for UserPreference entity

---

## Implementation Pattern

```typescript
// src/lib/stores/viewState.ts

const STORAGE_PREFIX = 'bonum-';

export function saveViewState<T>(key: string, state: T): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state));
}

export function loadViewState<T>(key: string, defaultValue: T): T {
  if (typeof localStorage === 'undefined') return defaultValue;
  const stored = localStorage.getItem(STORAGE_PREFIX + key);
  if (!stored) return defaultValue;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}

export function clearViewState(key: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_PREFIX + key);
}
```

---

## Usage Example: Accounts View

```typescript
// In accounts view component
import { loadViewState, saveViewState } from '$lib/stores/viewState';

// Load on mount
const expandState = loadViewState(`accounts-expand-${entityId}`, {});

// Save when user toggles
function toggleGroup(groupId: string) {
  expandState[groupId] = !expandState[groupId];
  saveViewState(`accounts-expand-${entityId}`, expandState);
}
```

---

## Cleanup

Consider periodic cleanup of orphaned keys:
- When entity is deleted, remove its view state
- Add a "Clear saved preferences" option in Settings

---

## Scope by Context

State should be scoped appropriately:
- **Entity-scoped:** Accounts View expand state (different per entity)
- **Global:** Catalog expand state (same across all usage)
- **Account-scoped:** Ledger column widths (different per account)

Use the `contextId` suffix to differentiate.


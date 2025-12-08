# Navigation (Consolidation)

Derived from stories. Multi-window desktop paradigm.

## Primary Navigation

Global menu (always visible):
- **Home** — Entity list + dashboard
- **Account Catalog** — Global account groups
- **Import Books** — Create entity from file
- **Settings** — Preferences

## Window Model

This is a multi-window application. Users can have multiple panes/windows open simultaneously.

### Link Behaviors

| Action | Modifier | Result |
|--------|----------|--------|
| Click | None | Navigate in current pane |
| Click | Ctrl/Cmd | Open in new window |
| Click | Shift | Open in linked window (reactive) |

### Linked Windows

Some windows can be "linked" so changes in one reflect in the other:

| Source | Target | Reactivity |
|--------|--------|------------|
| AccountsView | Ledger | Ledger updates as entries change |
| Ledger | Ledger (offset) | Jump to offset account |
| Reconciliation | Ledger | New entries appear in reconciliation list |

### Implementation

```typescript
// Window management
interface WindowLink {
  sourceId: string;
  targetId: string;
  type: 'reactive' | 'reference';
}

// Opening a linked window
function openLinkedWindow(route: string, sourceWindowId: string) {
  const newWindow = createWindow(route);
  registerLink({ 
    sourceId: sourceWindowId, 
    targetId: newWindow.id, 
    type: 'reactive' 
  });
}
```

## Route Structure

```
/                                    Home
├── /catalog                         Account Catalog
├── /settings                        Settings
├── /import                          Import Books
└── /entities/[entityId]             Entity context
    ├── /                            Accounts View (default)
    ├── /ledger/[accountId]          Ledger
    └── /reconcile/[accountId]       Reconciliation
```

## State Persistence

App state persists to localStorage:
- Open windows and positions
- Selected entity
- View preferences (mode, date ranges)
- Dismissible messages state

On reload, app restores to previous state.

---

*Generated from stories. Last updated: auto*


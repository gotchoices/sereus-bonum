# Visual Balance Sheet Spec

A shared visualization component for both web and mobile.

## Overview

The Visual Balance Sheet is a radial chart that displays an entity's financial position as concentric rings. It provides an intuitive "at a glance" view of net worth, assets vs liabilities, and account composition.

## Visual Structure

```
       ┌─────────────────────────────────────┐
      │  (Ring 3: Individual Accounts)       │  ← Optional
      │   ┌─────────────────────────────┐    │
      │  │      Ring 2: Account Groups   │   │
      │  │    (Current Assets, Fixed)    │   │
      │  │  ┌───────────────────────┐    │   │
      │  │ │  Ring 1: Asset/Liab/Eq  │   │   │
      │  │ │                         │   │   │
      │  │ │   ┌───────────────┐     │   │   │
      │  │ │  │  Ring 0: Net   │     │   │   │
      │  │ │  │    Worth       │     │   │   │
      │  │ │   └───────────────┘     │   │   │
      │  │ │                         │   │   │
      │  │  └───────────────────────┘    │   │
      │   └─────────────────────────────┘    │
       └─────────────────────────────────────┘
```

### Ring Definitions

| Ring | Content | Slices | Sizing | Status |
|------|---------|--------|--------|--------|
| 0 | Net Worth | 1 | Fixed (center circle) | MVP |
| 1 | Asset / Liability / Equity | 3 | Proportional to totals | MVP |
| 2 | Account Groups | Variable | Proportional to group totals | MVP |
| 3 | Individual Accounts | Variable | Proportional to balances | Optional |

**Ring 3 consideration:** An outer ring showing individual accounts within each group. May be too busy for entities with many accounts. Could be:
- Enabled via user preference
- Shown only when zoomed in
- Limited to top N accounts per group
- Shown on tap/drill-down instead of as permanent ring

### Color Scheme

| Category | Color Range | Notes |
|----------|-------------|-------|
| Net Worth (positive) | Blue gradient | Intensity = magnitude |
| Net Worth (negative) | Red gradient | Intensity = magnitude |
| Assets | Blues (hsl 200-235) | |
| Liabilities | Reds (hsl 340-360) | |
| Equity | Purples (hsl 270-290) | |
| Account Groups | Shades within parent | Darker = larger balance |

### Labels

- Each slice displays: Group/Category name + formatted balance
- Small slices (< threshold angle) hide labels to avoid clutter
- Hover/tap reveals tooltip with full details

## Usage in Bonum

### Home Screen
When an entity is selected, the Visual Balance Sheet appears in the dashboard area (replacing the welcome message after first use).

### Accounts View
A compact version may appear as a header/summary above the account list.

### Reports
Can be included in printed/PDF reports as a visual summary.

## Interactions

| Action | Result |
|--------|--------|
| Tap/click slice | Expand to show child accounts (or navigate to that group) |
| Long-press/hover | Show tooltip with full balance details |
| Pinch/scroll | Zoom in/out (optional, may not be needed) |

## Data Requirements

Input structure:

```typescript
interface VisualBSData {
  netWorth: number;
  categories: {
    type: 'asset' | 'liability' | 'equity';
    total: number;
    groups: {
      name: string;
      balance: number;
      // Optional: child accounts for drill-down
      accounts?: { name: string; balance: number }[];
    }[];
  }[];
}
```

## Scope

### MVP
- Single entity visualization
- Three rings (Net Worth, A/L/E, Account Groups)
- Static display with basic interactions

### Post-MVP
- Multiple entities with consolidation view
- Inter-entity relationships visualization
- Animated transitions when data changes

## Reference Implementation

Based on the Visual Balance Sheet from MyCHIPs:
- Repository: https://github.com/gotchoices/mychips
- Test file: `test/visbs/index.html`
- Library: `src/visbs.js`

Key differences from MyCHIPs implementation:
- No partner bubbles or connection arrows (Bonum shows entity only, not trading partners)
- Equity ring added (MyCHIPs is Assets/Liabilities only)
- Account Groups instead of holding types

## Implementation

### Technology Choice: Svelte + SVG

**Rationale:**
- Svelte runs on both platforms (SvelteKit web, NativeScript-Svelte mobile)
- SVG is declarative and fits Svelte's reactive model
- No heavy dependencies — D3 is overkill for a static pie chart
- The math is simple: arc paths are just trigonometry

**Why not D3?**
The MyCHIPs implementation uses D3 mainly for features we don't need:
- `d3.arc()` — easy to replicate (see below)
- `d3.pie()` — trivial angle calculation
- Force simulation — only needed for partner bubbles (we don't have these)

### Component Structure

```
packages/shared/src/components/
└── VisualBalanceSheet.svelte
```

Shared component, imported by both web and mobile apps.

### Core Implementation

```svelte
<!-- VisualBalanceSheet.svelte -->
<script lang="ts">
  export let data: VisualBSData;
  export let size: number = 200;
  
  const RING_RADII = [
    { inner: 0, outer: 20 },    // Ring 0: Net Worth
    { inner: 22, outer: 45 },   // Ring 1: A/L/E
    { inner: 47, outer: 80 },   // Ring 2: Account Groups
    // { inner: 82, outer: 98 }, // Ring 3: Accounts (optional)
  ];
  
  // Calculate arc angles from values
  function calculateArcs(items: { value: number; color: string }[]): Arc[] {
    const total = items.reduce((sum, item) => sum + Math.abs(item.value), 0);
    if (total === 0) return [];
    
    let currentAngle = -Math.PI / 2; // Start at top
    return items.map(item => {
      const sweep = (Math.abs(item.value) / total) * Math.PI * 2;
      const arc = {
        startAngle: currentAngle,
        endAngle: currentAngle + sweep,
        ...item
      };
      currentAngle += sweep;
      return arc;
    });
  }
  
  // Generate SVG arc path string
  function arcPath(innerR: number, outerR: number, startAngle: number, endAngle: number): string {
    const startOuter = polarToCartesian(outerR, startAngle);
    const endOuter = polarToCartesian(outerR, endAngle);
    const startInner = polarToCartesian(innerR, endAngle);
    const endInner = polarToCartesian(innerR, startAngle);
    
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    
    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${startInner.x} ${startInner.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
      'Z'
    ].join(' ');
  }
  
  function polarToCartesian(r: number, angle: number) {
    return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
  }
  
  // Color interpolation for net worth
  function netWorthColor(value: number, maxValue: number): string {
    const ratio = Math.min(1, Math.abs(value) / maxValue);
    const hue = value >= 0 ? 220 : 350; // Blue positive, red negative
    const lightness = 70 - ratio * 30;  // Darker = larger
    return `hsl(${hue}, 70%, ${lightness}%)`;
  }
  
  // Reactive: recalculate when data changes
  $: ring1Arcs = calculateArcs([
    { value: data.assets, color: 'hsl(220, 80%, 50%)' },
    { value: data.liabilities, color: 'hsl(350, 80%, 50%)' },
    { value: data.equity, color: 'hsl(280, 60%, 50%)' },
  ]);
  
  $: ring2Arcs = calculateArcs(data.groups.map(g => ({
    value: g.balance,
    color: groupColor(g)
  })));
</script>

<svg viewBox="-100 -100 200 200" width={size} height={size}>
  <!-- Ring 0: Net Worth (center circle) -->
  <circle 
    r={RING_RADII[0].outer} 
    fill={netWorthColor(data.netWorth, data.assets)} 
  />
  <text y="4" text-anchor="middle" font-size="8" fill="white">
    {formatCurrency(data.netWorth)}
  </text>
  
  <!-- Ring 1: Assets / Liabilities / Equity -->
  {#each ring1Arcs as arc}
    <path 
      d={arcPath(RING_RADII[1].inner, RING_RADII[1].outer, arc.startAngle, arc.endAngle)} 
      fill={arc.color}
    />
  {/each}
  
  <!-- Ring 2: Account Groups -->
  {#each ring2Arcs as arc}
    <path 
      d={arcPath(RING_RADII[2].inner, RING_RADII[2].outer, arc.startAngle, arc.endAngle)} 
      fill={arc.color}
    />
  {/each}
</svg>

<style>
  svg {
    font-family: system-ui, sans-serif;
  }
  path {
    stroke: white;
    stroke-width: 0.5;
  }
</style>
```

### Mobile Fallback

If NativeScript-Svelte's SVG support is insufficient:
1. Use `@aspect/nativescript-svg` plugin
2. Or render to Canvas via `@aspect/nativescript-canvas`
3. Or embed in WebView (last resort)

### Data Adapter

```typescript
// Convert schema data to VisualBSData
function toVisualBSData(accounts: Account[], groups: AccountGroup[]): VisualBSData {
  const totals = { assets: 0, liabilities: 0, equity: 0 };
  
  // Sum by account type...
  
  return {
    netWorth: totals.assets + totals.liabilities + totals.equity,
    assets: totals.assets,
    liabilities: Math.abs(totals.liabilities),
    equity: totals.equity,
    groups: groups.map(g => ({
      name: g.name,
      type: g.accountType,
      balance: sumAccountsInGroup(accounts, g.id)
    }))
  };
}
```


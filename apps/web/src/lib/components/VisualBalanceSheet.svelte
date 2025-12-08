<!-- VisualBalanceSheet.svelte -->
<!-- Radial visualization of an entity's financial position -->
<!-- See: design/specs/visual-balance-sheet.md -->

<script lang="ts">
  export let entityId: string;
  export let size: number = 300;
  
  // Ring radii (relative to 100-unit viewBox)
  const RING_RADII = [
    { inner: 0, outer: 20 },    // Ring 0: Net Worth
    { inner: 22, outer: 45 },   // Ring 1: A/L/E
    { inner: 47, outer: 80 },   // Ring 2: Account Groups
  ];
  
  // Demo data - will be replaced by DataService
  const demoData = {
    netWorth: 45000,
    assets: 120000,
    liabilities: 65000,
    equity: -10000, // Negative equity is normal (owner's draw > contributions)
    groups: [
      { name: 'Cash', type: 'asset', balance: 15000 },
      { name: 'Investments', type: 'asset', balance: 50000 },
      { name: 'Property', type: 'asset', balance: 45000 },
      { name: 'Receivables', type: 'asset', balance: 10000 },
      { name: 'Credit Cards', type: 'liability', balance: 5000 },
      { name: 'Mortgage', type: 'liability', balance: 40000 },
      { name: 'Loans', type: 'liability', balance: 20000 },
      { name: 'Capital', type: 'equity', balance: 30000 },
      { name: 'Retained', type: 'equity', balance: -40000 },
    ]
  };
  
  interface Arc {
    startAngle: number;
    endAngle: number;
    value: number;
    color: string;
    label?: string;
  }
  
  // Convert polar to cartesian
  function polarToCartesian(r: number, angle: number) {
    return { 
      x: r * Math.cos(angle), 
      y: r * Math.sin(angle) 
    };
  }
  
  // Generate SVG arc path
  function arcPath(innerR: number, outerR: number, startAngle: number, endAngle: number): string {
    // Handle full circle case
    if (endAngle - startAngle >= Math.PI * 2 - 0.001) {
      const mid = (startAngle + endAngle) / 2;
      return arcPath(innerR, outerR, startAngle, mid) + ' ' + arcPath(innerR, outerR, mid, endAngle);
    }
    
    const startOuter = polarToCartesian(outerR, startAngle);
    const endOuter = polarToCartesian(outerR, endAngle);
    const startInner = polarToCartesian(innerR, endAngle);
    const endInner = polarToCartesian(innerR, startAngle);
    
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    
    if (innerR === 0) {
      // Pie slice (no inner radius)
      return [
        `M 0 0`,
        `L ${startOuter.x} ${startOuter.y}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
        'Z'
      ].join(' ');
    }
    
    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${startInner.x} ${startInner.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
      'Z'
    ].join(' ');
  }
  
  // Calculate arcs from values
  function calculateArcs(items: { value: number; color: string; label?: string }[]): Arc[] {
    const total = items.reduce((sum, item) => sum + Math.abs(item.value), 0);
    if (total === 0) return [];
    
    const gap = 0.02; // Small gap between slices
    let currentAngle = -Math.PI / 2; // Start at top
    
    return items.map(item => {
      const sweep = (Math.abs(item.value) / total) * (Math.PI * 2 - gap * items.length);
      const arc: Arc = {
        startAngle: currentAngle,
        endAngle: currentAngle + sweep,
        value: item.value,
        color: item.color,
        label: item.label
      };
      currentAngle += sweep + gap;
      return arc;
    });
  }
  
  // Color for net worth (gradient based on magnitude)
  function netWorthColor(value: number, maxValue: number): string {
    const ratio = Math.min(1, Math.abs(value) / maxValue);
    const hue = value >= 0 ? 220 : 350;
    const lightness = 60 - ratio * 20;
    return `hsl(${hue}, 75%, ${lightness}%)`;
  }
  
  // Group color based on type and position
  function groupColor(type: string, index: number, total: number): string {
    const baseHue = type === 'asset' ? 220 : type === 'liability' ? 350 : 280;
    const lightness = 45 + (index / total) * 25;
    return `hsl(${baseHue}, 70%, ${lightness}%)`;
  }
  
  // Calculate arc label position
  function labelPosition(arc: Arc, radius: number): { x: number; y: number } {
    const midAngle = (arc.startAngle + arc.endAngle) / 2;
    return polarToCartesian(radius, midAngle);
  }
  
  // Format currency
  function formatCurrency(value: number): string {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (absValue >= 1000) {
      return (value / 1000).toFixed(0) + 'K';
    }
    return value.toFixed(0);
  }
  
  // Reactive calculations
  $: ring1Items = [
    { value: demoData.assets, color: 'var(--asset-color)', label: 'Assets' },
    { value: demoData.liabilities, color: 'var(--liability-color)', label: 'Liabilities' },
    { value: Math.abs(demoData.equity), color: 'var(--equity-color)', label: 'Equity' },
  ].filter(item => item.value > 0);
  
  $: ring2Items = demoData.groups.map((g, i, arr) => {
    const typeGroups = arr.filter(x => x.type === g.type);
    const typeIndex = typeGroups.indexOf(g);
    return {
      value: Math.abs(g.balance),
      color: groupColor(g.type, typeIndex, typeGroups.length),
      label: g.name
    };
  }).filter(item => item.value > 0);
  
  $: ring1Arcs = calculateArcs(ring1Items);
  $: ring2Arcs = calculateArcs(ring2Items);
  $: nwColor = netWorthColor(demoData.netWorth, demoData.assets);
</script>

<svg 
  viewBox="-100 -100 200 200" 
  width={size} 
  height={size}
  class="visual-balance-sheet"
>
  <!-- Background circle -->
  <circle r="82" fill="var(--bg-secondary)" opacity="0.5" />
  
  <!-- Ring 2: Account Groups -->
  {#each ring2Arcs as arc, i}
    <path 
      d={arcPath(RING_RADII[2].inner, RING_RADII[2].outer, arc.startAngle, arc.endAngle)} 
      fill={arc.color}
      class="ring-segment"
    >
      <title>{arc.label}: ${formatCurrency(arc.value)}</title>
    </path>
  {/each}
  
  <!-- Ring 1: Assets / Liabilities / Equity -->
  {#each ring1Arcs as arc}
    <path 
      d={arcPath(RING_RADII[1].inner, RING_RADII[1].outer, arc.startAngle, arc.endAngle)} 
      fill={arc.color}
      class="ring-segment"
    >
      <title>{arc.label}: ${formatCurrency(arc.value)}</title>
    </path>
  {/each}
  
  <!-- Ring 0: Net Worth (center circle) -->
  <circle 
    r={RING_RADII[0].outer} 
    fill={nwColor}
    class="net-worth-circle"
  >
    <title>Net Worth: ${formatCurrency(demoData.netWorth)}</title>
  </circle>
  
  <!-- Center label -->
  <text class="center-label" y="-3">Net Worth</text>
  <text class="center-value" y="8">${formatCurrency(demoData.netWorth)}</text>
  
  <!-- Ring 1 labels -->
  {#each ring1Arcs as arc}
    {#if arc.endAngle - arc.startAngle > 0.5}
      {@const pos = labelPosition(arc, (RING_RADII[1].inner + RING_RADII[1].outer) / 2)}
      <text 
        x={pos.x} 
        y={pos.y} 
        class="ring-label"
        dominant-baseline="middle"
        text-anchor="middle"
      >
        {formatCurrency(arc.value)}
      </text>
    {/if}
  {/each}
</svg>

<style>
  .visual-balance-sheet {
    font-family: var(--font-sans);
  }
  
  .ring-segment {
    stroke: var(--bg-primary);
    stroke-width: 1;
    transition: opacity 0.15s ease;
  }
  
  .ring-segment:hover {
    opacity: 0.85;
  }
  
  .net-worth-circle {
    stroke: var(--bg-primary);
    stroke-width: 2;
  }
  
  .center-label {
    font-size: 5px;
    fill: white;
    text-anchor: middle;
    font-weight: 500;
    opacity: 0.9;
  }
  
  .center-value {
    font-size: 7px;
    fill: white;
    text-anchor: middle;
    font-weight: 700;
  }
  
  .ring-label {
    font-size: 5px;
    fill: white;
    font-weight: 600;
    pointer-events: none;
  }
</style>


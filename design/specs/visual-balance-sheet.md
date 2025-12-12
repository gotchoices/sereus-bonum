# Spec: Visual Balance Sheet

**Scope:** Shared visualization for web and mobile

## Overview

The Visual Balance Sheet is a radial (circular) chart that shows an entity's financial position at a glance. It uses concentric rings to display net worth, assets vs liabilities vs equity, and account group composition.

## Purpose

Provide an intuitive, visual "health check" of finances:
- See net worth immediately (center)
- Understand asset/liability/equity proportions
- Identify which account groups are largest
- Spot imbalances or unusual distributions

## Visual Structure

The chart consists of concentric rings radiating outward from the center:

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

| Ring | Content | How It's Divided | Size | Status |
|------|---------|------------------|------|--------|
| 0 | Net Worth | Single circle | Fixed (center) | MVP |
| 1 | Assets / Liabilities / Equity | 3 slices | Proportional to totals | MVP |
| 2 | Account Groups | Multiple slices | Proportional to group balances | MVP |
| 3 | Individual Accounts | Multiple slices | Proportional to account balances | Optional |

**Ring 0 (Center Circle):**
- Displays net worth as a single value
- Color indicates positive (blue/green) or negative (red)
- Intensity indicates magnitude

**Ring 1 (Inner Ring):**
- Three slices: Assets, Liabilities, Equity
- Slice size proportional to total of each type
- Example: If Assets = $100k, Liabilities = $30k, Equity = $70k, then Assets takes 50% of ring, Liabilities 15%, Equity 35%

**Ring 2 (Middle Ring):**
- One slice per account group (Current Assets, Fixed Assets, Credit Cards, etc.)
- Each slice sized proportionally to group's balance
- Grouped by parent type (Asset groups in Asset section, Liability groups in Liability section)

**Ring 3 (Outer Ring - Optional):**
- May be too busy for entities with many accounts
- Possible future implementations:
  - User preference toggle
  - Show only on zoom/drill-down
  - Limit to top N accounts per group

### Color Scheme

| Category | Color | Notes |
|----------|-------|-------|
| Net Worth (positive) | Blue/Green gradient | Darker = larger magnitude |
| Net Worth (negative) | Red gradient | Darker = larger magnitude |
| Assets | Blues (sky to ocean) | |
| Liabilities | Reds (pink to crimson) | |
| Equity | Purples (lavender to deep purple) | |
| Account Groups | Shades within parent | Darker = larger balance |

### Labels

- Each slice shows: Name + formatted balance
- Small slices (< certain angle) hide labels to avoid clutter
- Hover or tap reveals full details in tooltip

## Usage in Bonum

### Home Screen Dashboard
- When user selects an entity, the Visual Balance Sheet appears
- Replaces welcome message after first use
- Updates when entity selection changes
- Shows "as of" date (defaults to today)

### Accounts View (Future)
- Compact version may appear as header/summary above account list
- Helps user stay oriented while drilling into details

### Reports (Future)
- Included in printed/PDF reports as visual summary
- Black & white version for printing

## User Interactions

| Action | Result |
|--------|--------|
| Click/tap slice | Navigate to that account group or category (future) |
| Hover/long-press | Tooltip shows full balance details and percentage |
| Resize window | Chart scales proportionally |

**Example Tooltip:**
```
Current Assets
Balance: $45,000
32% of total assets
```

## Empty States

**No data:**
- Show empty chart structure (rings visible but grey)
- Message: "No account data to display"

**Zero balance:**
- Ring appears but very thin (minimum visible width)
- Still clickable and shows tooltip

## Scope

### MVP (Phase 1)
- Single entity visualization
- Three rings: Net Worth, A/L/E types, Account Groups
- Static display (no animations)
- Basic hover tooltips
- Responsive sizing

### Post-MVP (Future Phases)
- **Ring 3:** Individual accounts (optional, user toggle)
- **Multiple entities:** Consolidated view showing multiple entities side-by-side or stacked
- **Inter-entity relationships:** Visual connections for transfers between entities
- **Animated transitions:** Smooth updates when data changes or dates change
- **Click-through:** Click slice to navigate to relevant account view
- **Date picker:** Show VBS for different dates (historical snapshots)

## Reference

Based on Visual Balance Sheet from MyCHIPs project:
- Repository: https://github.com/gotchoices/mychips
- Test file: `test/visbs/index.html`
- Library: `src/visbs.js`

**Key differences for Bonum:**
- **No partner bubbles:** Bonum shows single entity only, not trading partners
- **Equity ring added:** MyCHIPs shows Assets/Liabilities only
- **Account Groups:** Bonum uses account groups instead of holding types
- **Simpler rendering:** No need for force simulation or complex interactions

## Accessibility

**Color Blind Support:**
- Don't rely on color alone
- Use patterns or textures (future)
- Ensure text contrast meets WCAG AA

**Screen Readers:**
- Provide text alternative with same information
- Announce data in logical order: Net Worth, then types, then groups

**Keyboard Navigation:**
- Tab through slices
- Enter/Space to activate slice
- Escape to close tooltip

## Performance Considerations

**Large Number of Groups:**
- If entity has 50+ account groups, Ring 2 becomes crowded
- Solution: Only show groups above certain threshold (e.g., > 1% of total)
- Small groups combined into "Other" slice

**Data Loading:**
- Show loading spinner in center while fetching data
- Pre-load when selecting entity to avoid delay

**Updates:**
- Chart can update without full reload (data changes only)
- Smooth transitions make changes easier to perceive (future)

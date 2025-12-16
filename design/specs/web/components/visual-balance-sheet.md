# Spec: Visual Balance Sheet

**Type:** Reusable Component  
**Scope:** Shared (web + mobile)  
**Status:** Draft

---

## Purpose

Radial chart showing entity's financial position at a glance.

---

## What User Sees

**Structure:**
- Circular chart with concentric rings radiating from center
- Center circle: Net worth (single value, color indicates positive/negative)
- Inner ring: Assets / Liabilities / Equity (3 slices, sized proportionally)
- Middle ring: Account groups (multiple slices, sized by balance)

**Visual Feedback:**
- Color-coded by category (Assets = blue, Liabilities = red, Equity = purple)
- Darker shades indicate larger amounts
- Labels show name + balance (hide on small slices to avoid clutter)

**Interactions:**
- Hover/tap slice → tooltip with balance + percentage
- Click slice → navigate to that account group (future)
- Responsive: scales with window size

**Empty States:**
- No data: Grey rings with "No account data" message
- Zero balance: Very thin slice but still visible/clickable

---

## Where It Appears

- Home screen dashboard (when entity selected)
- Replaces welcome message after first use
- Updates when entity changes

---

## Future Enhancements

- Outer ring for individual accounts (optional toggle)
- Date picker for historical snapshots
- Multiple entities side-by-side
- Animated transitions when data changes

---

## Reference

Based on Visual Balance Sheet from MyCHIPs project (see `mychips/src/visbs.js`)

---


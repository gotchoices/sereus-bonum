# Spec: Global Navigation Menu

**Type:** Global Layout Element  
**Status:** Draft

---

## Purpose

Application-wide navigation and branding.

---

## Layout & Structure

- When exposed, the menu occupies the left side of the visible screen
- No part of the menu pane should be off the screen even if the page itself is longer than the screen
- When exposed, the menu shows a hide icon (<< or similar)
- When hidden, a floating expose icon is visible (hamburger or >> or similar)
- The very top of the menu contains the program logo and title Sereus Bonum
- Under that is a section for the common global launch features
- When global menu is hidden, other screen components enlarge to occupy the available space
---

## Behavior

- Upon launch, the menu is exposed
- It can be toggled between exposed and hidden
- This state is persistent
- The motion between states is animated as a tray sliding in and out from the left

---

## Technical Notes

- Implementation: `apps/web/src/routes/+layout.svelte`
- Width: 220px (fixed)

---


# Spec: View State Persistence

## Principle

When a user customizes how a view appears (expanded groups, selected report mode, date ranges, etc.), that customization should persist. The next time they visit the same view, it should look exactly like it did when they left.

This allows users to:
- Set up their preferred view once and have it remembered
- Switch between entities without losing their customizations
- Close and reopen the app without losing their settings
- Work efficiently without repetitive setup

## What Gets Saved

The app remembers these customizations:

**Expand/Collapse State:**
- Which account groups are expanded or collapsed
- Applies per entity (different entities can have different states)

**Report Modes:**
- Which report mode is selected (Balance Sheet, Trial Balance, Income Statement)
- Applies per entity

**Date Ranges:**
- Selected start and end dates for period-based reports
- Applies per entity

**Sort Order:**
- How lists are sorted (by name, by date, by amount, etc.)
- May be global or per-context depending on the view

**Column Widths:**
- Custom column widths if user resizes them
- Applies per view type (not yet implemented)

**Scroll Position:**
- Where the user scrolled to in a long list
- May or may not persist depending on UX considerations

## Storage Location

**For MVP:**
- Saved in browser local storage
- Persists across browser sessions (survives page refresh)
- Separate per browser (not synced across devices)
- Lost if browser data is cleared

**Future Enhancement:**
- Could sync across devices via Sereus
- Would allow same preferences on desktop and mobile
- Requires UserPreference entity in schema

## Scoping

Different views need different scoping:

**Entity-Scoped:**
- Accounts View expand state: Different per entity
- Report mode selection: Different per entity
- Date ranges: Different per entity

**Global:**
- Catalog expand state: Same across all usage
- Settings preferences: Same everywhere

**Account-Scoped:**
- Ledger column widths: Different per account (future)

## Cleanup

**When Entity Deleted:**
- Remove that entity's saved view state
- Prevents orphaned preferences from cluttering storage

**User Control:**
- Settings screen includes "Clear saved preferences" option
- Lets user reset to defaults if things get confusing
- Clears all stored view state

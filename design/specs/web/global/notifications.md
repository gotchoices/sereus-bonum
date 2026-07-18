# Spec: Notifications & Error Handling

**Scope:** Global (all web screens)
**Status:** Draft

---

## Purpose

One consistent, visible channel for user feedback — errors, successes, and info — so no failure is
silent. Replaces ad-hoc per-screen error text/toasts.

## Presentation

- **Toasts** stack in the top-right corner, above all content.
- **Colour by kind:** error (danger), success (positive), info (accent) — each with a matching icon and
  a coloured left edge.
- **Dismiss:** every toast has a close control.
- **Lifetime:**
  - **Errors persist** until the user dismisses them (an error the user misses is the whole problem).
  - **Success / info auto-dismiss** after a few seconds.
- **Stacking:** multiple notifications stack, newest at the bottom of the stack; each is independently
  dismissible.

## When to use which

- **Operational / async failures** (import failed, load failed, save failed, unexpected errors) → an
  **error notification**. Never leave these to the console only.
- **Completed actions worth confirming** (import succeeded, books restored, report saved) → a **success
  notification**.
- **Inline form validation** (empty required field, bad account-path syntax) stays **inline** next to the
  field/step — it is immediate, local feedback, not an operational failure.

## Safety net

Any error or promise rejection that a screen does not handle explicitly is still surfaced as an error
notification (a global handler of last resort), rather than failing silently in the console.

## Accessibility

- Error toasts use an assertive role (`alert`); success/info use a polite `status` role.
- The toast region is an `aria-live` region so screen readers announce new notifications.

## Out of scope / future

- A notification history / center (persisted log of past notifications).
- Action buttons inside a notification (e.g. "Retry", "Undo").
- Per-notification progress (long-running task status).

## References

- Import surfaces its failures/successes here: [import screen](../screens/import.md).
- Implementation: `apps/web/src/lib/stores/notifications.ts` (store) +
  `apps/web/src/lib/components/Notifications.svelte` (rendered once in the layout).

<script lang="ts">
  // App-wide toast stack. Rendered once in the layout; fed by $lib/stores/notifications.
  // Errors persist until dismissed; success/info auto-dismiss (handled in the store).
  import { notifications, dismiss, type NotificationKind } from '$lib/stores/notifications';

  const icon: Record<NotificationKind, string> = { error: '⚠', success: '✓', info: 'ℹ' };
</script>

<div class="toasts" aria-live="polite" aria-atomic="false">
  {#each $notifications as n (n.id)}
    <div class="toast {n.kind}" role={n.kind === 'error' ? 'alert' : 'status'}>
      <span class="icon">{icon[n.kind]}</span>
      <span class="msg">{n.message}</span>
      <button class="close" aria-label="Dismiss" onclick={() => dismiss(n.id)}>×</button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: min(30rem, calc(100vw - 2rem));
  }
  .toast {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: start;
    gap: 0.6rem;
    padding: 0.7rem 0.9rem;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
    background: var(--bg-card);
    color: var(--text-primary);
    font-size: 0.9rem;
    animation: slide-in 0.18s ease;
  }
  .toast.error { border-left: 4px solid var(--danger); }
  .toast.success { border-left: 4px solid var(--success); }
  .toast.info { border-left: 4px solid var(--accent-color); }
  .icon { font-weight: 700; line-height: 1.4; }
  .toast.error .icon { color: var(--danger); }
  .toast.success .icon { color: var(--success); }
  .toast.info .icon { color: var(--accent-color); }
  .msg { line-height: 1.4; overflow-wrap: anywhere; }
  .close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.2rem;
    line-height: 1;
    cursor: pointer;
    padding: 0 0.15rem;
  }
  .close:hover { color: var(--text-primary); }
  @keyframes slide-in {
    from { opacity: 0; transform: translateX(1rem); }
    to { opacity: 1; transform: translateX(0); }
  }
</style>

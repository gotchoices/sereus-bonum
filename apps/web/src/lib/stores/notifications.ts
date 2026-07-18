// App-wide notifications (errors, successes, info) — the single place UI feedback is surfaced.
// Screens call notifyError/notifySuccess/notifyInfo instead of holding ad-hoc local error state, and
// the layout renders them (see components/Notifications.svelte). A global handler also routes
// unhandled rejections/errors here so nothing fails silently.

import { writable } from 'svelte/store';
import { log } from '$lib/logger';

export type NotificationKind = 'error' | 'success' | 'info';

export interface Notification {
  id: number;
  kind: NotificationKind;
  message: string;
}

export const notifications = writable<Notification[]>([]);

let nextId = 1;

function push(kind: NotificationKind, message: string, ttlMs: number): number {
  const id = nextId++;
  notifications.update((list) => [...list, { id, kind, message }]);
  if (ttlMs > 0 && typeof setTimeout !== 'undefined') setTimeout(() => dismiss(id), ttlMs);
  return id;
}

export function dismiss(id: number): void {
  notifications.update((list) => list.filter((n) => n.id !== id));
}

export function clearNotifications(): void {
  notifications.set([]);
}

function toText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try { return JSON.stringify(err); } catch { return String(err); }
}

/** Surface an error (persists until dismissed). `context` prefixes a human label, e.g. "Import". */
export function notifyError(err: unknown, context?: string): number {
  const message = context ? `${context}: ${toText(err)}` : toText(err);
  log.ui.error('[Notify]', message, err);
  return push('error', message, 0);
}

export function notifySuccess(message: string): number {
  return push('success', message, 3500);
}

export function notifyInfo(message: string): number {
  return push('info', message, 4500);
}

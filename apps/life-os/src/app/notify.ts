// In-app notification scheduler. Real system notifications are shown through the
// service worker (required on Android) while LIFE OS is open or in the background.
import { collectDue, nextDueTime, type DueNotification } from '../core/due';
import { getMeta, markNotified, pruneNotified, setMeta, wasNotified } from '../core/db';
import { actions, getData, useApp } from '../store/store';
import { toast } from '../store/ui';
import { navigate } from './router';

export type PermissionState = NotificationPermission | 'unsupported';

export function notificationSupport(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (notificationSupport() === 'unsupported') return 'unsupported';
  try {
    const res = await Notification.requestPermission();
    if (res === 'granted') void registerPeriodicCheck();
    return res;
  } catch {
    return Notification.permission;
  }
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
    return reg ?? null;
  } catch {
    return null;
  }
}

export async function showSystemNotification(n: Pick<DueNotification, 'title' | 'body' | 'url' | 'kind' | 'refId' | 'key'>) {
  const options: NotificationOptions & { actions?: { action: string; title: string }[]; renotify?: boolean } = {
    body: n.body,
    tag: n.key,
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-96.png',
    data: { url: n.url, kind: n.kind, refId: n.refId },
  };
  if (n.kind === 'reminder') options.actions = [
    { action: 'done', title: 'Concluir' },
    { action: 'snooze', title: 'Adiar 10 min' },
  ];
  const reg = await registration();
  if (reg) {
    await reg.showNotification(n.title, options);
    return true;
  }
  if (notificationSupport() === 'granted') {
    const notif = new Notification(n.title, options);
    notif.onclick = () => {
      window.focus();
      navigate(n.url.replace('#', ''));
    };
    return true;
  }
  return false;
}

export async function sendTestNotification(): Promise<boolean> {
  return showSystemNotification({
    key: 'test-' + Date.now(),
    title: 'LIFE OS',
    body: 'Notificações funcionando. Você será avisado dos seus lembretes e prazos.',
    url: '#/',
    kind: 'reminder',
    refId: '',
  });
}

const CATCH_UP_MS = 2 * 3600 * 1000; // never notify about things older than 2h
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;

async function check() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    actions.catchUpReminders(now);
    const last = (await getMeta<number>('lastNotifyCheck')) ?? now.getTime() - 15 * 60 * 1000;
    const from = new Date(Math.max(last, now.getTime() - CATCH_UP_MS));
    const due = collectDue(getData(), from, now);
    if (due.length) {
      const already = await wasNotified(due.map((d) => d.key));
      const fresh = due.filter((d) => !already.has(d.key));
      if (fresh.length) {
        await markNotified(fresh.map((d) => d.key));
        const granted = notificationSupport() === 'granted';
        const visible = document.visibilityState === 'visible';
        const focused = visible && document.hasFocus();
        for (const n of fresh) {
          // In-app banner whenever the app is on screen; system notification when the user may be elsewhere.
          if (visible || !granted) inAppAlert(n);
          if (granted && !focused) await showSystemNotification(n).catch(() => undefined);
        }
      }
    }
    await setMeta('lastNotifyCheck', now.getTime());
  } finally {
    running = false;
    scheduleNext();
  }
}

function inAppAlert(n: DueNotification) {
  if (n.kind === 'reminder') {
    toast(`${n.title}`, {
      icon: 'BellRing',
      tone: 'info',
      duration: 12000,
      action: { label: 'Concluir', onClick: () => actions.completeReminder(n.refId) },
      secondary: { label: 'Adiar 10 min', onClick: () => actions.snoozeReminderMinutes(n.refId, 10) },
    });
  } else {
    toast(`${n.title} — ${n.body}`, { icon: 'Bell', tone: 'info', duration: 9000, action: { label: 'Abrir', onClick: () => navigate(n.url.replace('#', '')) } });
  }
  try {
    navigator.vibrate?.([80, 60, 80]);
  } catch {
    /* ignore */
  }
}

function scheduleNext() {
  if (timer) clearTimeout(timer);
  const next = nextDueTime(getData(), new Date());
  // Wake up exactly at the next due time (capped) plus a regular heartbeat.
  const delay = next ? Math.min(Math.max(next.getTime() - Date.now() + 500, 1000), 60000) : 60000;
  timer = setTimeout(check, delay);
}

export function startNotificationLoop() {
  void pruneNotified();
  void check();
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void check());
  // Re-plan whenever data changes (new reminder, edited time...).
  useApp.subscribe((s, p) => {
    if (s.data !== p.data) scheduleNext();
  });
  navigator.serviceWorker?.addEventListener('message', (ev) => {
    const m = ev.data;
    if (m?.type === 'notification-action') handleNotificationAction(m.action, m.kind, m.refId, m.url);
  });
}

export function handleNotificationAction(action: string, kind: string, refId: string, url?: string) {
  if (kind === 'reminder' && refId) {
    if (action === 'done') {
      actions.completeReminder(refId);
      toast('Lembrete concluído', { tone: 'success' });
    } else if (action === 'snooze') {
      actions.snoozeReminderMinutes(refId, 10);
      toast('Lembrete adiado por 10 minutos');
    }
  }
  if (url) navigate(url.replace(/^#/, ''));
}

/** Chromium installed PWAs can wake the SW periodically to check reminders (best effort). */
export async function registerPeriodicCheck(): Promise<'registered' | 'unsupported' | 'denied'> {
  try {
    const reg = await registration();
    const ps = (reg as ServiceWorkerRegistration & { periodicSync?: { register: (tag: string, o: { minInterval: number }) => Promise<void> } })?.periodicSync;
    if (!reg || !ps) return 'unsupported';
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName });
    if (status.state !== 'granted') return 'denied';
    await ps.register('lifeos-check', { minInterval: 15 * 60 * 1000 });
    return 'registered';
  } catch {
    return 'unsupported';
  }
}

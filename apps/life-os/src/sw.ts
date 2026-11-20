/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { collectDue } from './core/due';
import { normalizeData } from './core/defaults';
import { getMeta, loadData, markNotified, setMeta, wasNotified } from './core/db';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ----- Background reminder check (Chromium, installed PWA; interval chosen by the browser) -----

async function backgroundCheck() {
  const raw = await loadData();
  if (!raw) return;
  let data;
  try {
    data = normalizeData(raw);
  } catch {
    return;
  }
  const now = new Date();
  const last = (await getMeta<number>('lastNotifyCheck')) ?? now.getTime() - 15 * 60 * 1000;
  const from = new Date(Math.max(last, now.getTime() - 2 * 3600 * 1000));
  const due = collectDue(data, from, now);
  const already = await wasNotified(due.map((d) => d.key));
  const fresh = due.filter((d) => !already.has(d.key));
  await markNotified(fresh.map((d) => d.key));
  for (const n of fresh) {
    await self.registration.showNotification(n.title, {
      body: n.body,
      tag: n.key,
      icon: 'icons/icon-192.png',
      badge: 'icons/badge-96.png',
      data: { url: n.url, kind: n.kind, refId: n.refId },
      ...(n.kind === 'reminder'
        ? {
            actions: [
              { action: 'done', title: 'Concluir' },
              { action: 'snooze', title: 'Adiar 10 min' },
            ],
          }
        : {}),
    } as NotificationOptions);
  }
  await setMeta('lastNotifyCheck', now.getTime());
}

self.addEventListener('periodicsync', ((event: Event & { tag: string; waitUntil: (p: Promise<unknown>) => void }) => {
  if (event.tag === 'lifeos-check') event.waitUntil(backgroundCheck());
}) as EventListener);

// ----- Notification clicks -----

self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  const info = (n.data ?? {}) as { url?: string; kind?: string; refId?: string };
  const action = event.action || 'open';
  n.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = all[0] as WindowClient | undefined;
      if (client) {
        client.postMessage({ type: 'notification-action', action, kind: info.kind, refId: info.refId, url: action === 'open' ? info.url : undefined });
        await client.focus().catch(() => undefined);
        return;
      }
      const base = self.registration.scope;
      const qs = action !== 'open' && info.refId ? `?na=${encodeURIComponent(action)}&k=${encodeURIComponent(info.kind ?? '')}&id=${encodeURIComponent(info.refId)}` : '';
      await self.clients.openWindow(`${base}${qs}${info.url ?? '#/'}`);
    })(),
  );
});

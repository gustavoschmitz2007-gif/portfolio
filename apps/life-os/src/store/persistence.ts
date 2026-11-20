import { emptyData, InvalidDataError, normalizeData } from '../core/defaults';
import { clearPendingCopy, hasSnapshot, loadData, readPendingCopy, REV_FIELD, saveData, saveSnapshot, setMeta, writePendingCopy } from '../core/db';
import { startOfWeek, todayKey } from '../core/date';
import type { AppData } from '../core/types';
import { actions, useApp } from './store';
import { onDayChange } from './clock';

const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lifeos') : null;
const tabId = Math.random().toString(36).slice(2);

let applyingRemote = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pending: AppData | null = null;
let lastSaved: AppData | null = null;
let inFlight: { data: AppData; rev: number } | null = null;
export let saveError: string | null = null;

async function flush() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const data = pending;
  pending = null;
  if (!data || data === lastSaved) return;
  const rev = Date.now();
  inFlight = { data, rev };
  try {
    await saveData(data, rev);
    lastSaved = data;
    saveError = null;
    channel?.postMessage({ type: 'saved', from: tabId });
  } catch (e) {
    saveError = e instanceof Error ? e.message : String(e);
  } finally {
    if (inFlight?.rev === rev) inFlight = null;
  }
}

function schedule(data: AppData) {
  pending = data;
  if (saveTimer) clearTimeout(saveTimer);
  // Short coalescing window: saves are effectively immediate.
  saveTimer = setTimeout(flush, 40);
}

/** Page is closing: an async IndexedDB write may not finish, so keep a synchronous copy too. */
function onLeave() {
  const unsaved = pending ?? inFlight?.data ?? null;
  if (unsaved && unsaved !== lastSaved) writePendingCopy(unsaved, Date.now());
  void flush();
}

/** Loads stored data, runs migrations and starts autosave. */
export async function hydrate(): Promise<void> {
  let raw: unknown = null;
  try {
    raw = await loadData();
  } catch {
    raw = null;
  }
  // Prefer the emergency copy when it is newer than what reached IndexedDB.
  const emergency = readPendingCopy();
  let recovered = false;
  if (emergency?.data) {
    const storedRev = raw && typeof raw === 'object' ? Number((raw as Record<string, unknown>)[REV_FIELD] ?? 0) : 0;
    if (emergency.rev > storedRev) {
      raw = emergency.data;
      recovered = true;
    } else clearPendingCopy();
  }
  let data: AppData;
  if (raw) {
    try {
      data = normalizeData(raw);
    } catch (e) {
      // Never overwrite data we couldn't read: park it and start fresh.
      await setMeta('unreadable-backup', raw);
      data = emptyData();
      console.error('Ritmora: stored data could not be read', e instanceof InvalidDataError ? e.message : e);
    }
  } else data = emptyData();

  lastSaved = raw ? null : data;
  useApp.setState({ data, hydrated: true });
  if (recovered) {
    await saveData(data);
    clearPendingCopy();
  }
  runDailyMaintenance();

  useApp.subscribe((s, prev) => {
    if (s.data !== prev.data && !applyingRemote) schedule(s.data);
  });
  // Save right away when leaving/hiding the app.
  window.addEventListener('pagehide', onLeave);
  window.addEventListener('beforeunload', onLeave);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && onLeave());

  // Another tab saved: reload from storage so tabs never overwrite each other.
  channel?.addEventListener('message', async (ev) => {
    if (ev.data?.type !== 'saved' || ev.data.from === tabId) return;
    const fresh = await loadData();
    if (!fresh) return;
    try {
      applyingRemote = true;
      useApp.setState({ data: normalizeData(fresh) });
    } finally {
      applyingRemote = false;
    }
  });

  onDayChange(() => runDailyMaintenance());
  void dailySnapshot();
}

function runDailyMaintenance() {
  const d = useApp.getState().data;
  actions.catchUpReminders();
  if (d.settings.onboarded && Object.keys(d.habits).length) actions.ensureWeekPlan(startOfWeek(todayKey(), d.settings.weekStartsOn));
}

/** One automatic local backup per day (kept: last 10). */
async function dailySnapshot() {
  const d = useApp.getState().data;
  if (!d.settings.onboarded) return;
  const key = todayKey();
  if (await hasSnapshot(key)) return;
  await saveSnapshot(key, d);
}

export async function snapshotNow(label = todayKey()) {
  await saveSnapshot(label, useApp.getState().data);
}

export function flushSave() {
  return flush();
}

/** Ask the browser not to evict our storage (best effort). */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

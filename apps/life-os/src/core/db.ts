// IndexedDB storage. Works in the page and in the service worker.
// Stores:
//   kv         – the app data document (key "data") and small metadata
//   snapshots  – automatic daily backups (key = YYYY-MM-DD)
//   notified   – keys of notifications already delivered (dedupe between app and SW)

import type { AppData } from './types';

const DB_NAME = 'lifeos';
const DB_VERSION = 1;
const LS_KEY = 'lifeos:data';

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIDB(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!hasIDB()) return reject(new Error('IndexedDB indisponível'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots');
      if (!db.objectStoreNames.contains('notified')) db.createObjectStore('notified');
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB bloqueado'));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDB().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let result: T | undefined;
        const req = fn(s);
        if (req) req.onsuccess = () => (result = req.result);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

// ---------- Data document ----------

export type StorageBackend = 'indexeddb' | 'localstorage' | 'memory';
let backend: StorageBackend = 'indexeddb';
export const getBackend = () => backend;

export async function loadData(): Promise<unknown | null> {
  try {
    const v = await tx<unknown>('kv', 'readonly', (s) => s.get('data'));
    backend = 'indexeddb';
    if (v) return v;
    // Migrate from a previous localStorage fallback if present.
    const ls = readLS();
    return ls ?? null;
  } catch {
    const ls = readLS();
    backend = canUseLS() ? 'localstorage' : 'memory';
    return ls;
  }
}

/** Revision stored next to the data, used to pick the newest copy on load. */
export const REV_FIELD = '__rev';

export async function saveData(data: AppData, rev = Date.now()): Promise<void> {
  if (backend === 'indexeddb') {
    try {
      await tx('kv', 'readwrite', (s) => s.put({ ...data, [REV_FIELD]: rev }, 'data'));
      return;
    } catch {
      backend = canUseLS() ? 'localstorage' : 'memory';
    }
  }
  if (backend === 'localstorage') {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ ...data, [REV_FIELD]: rev }));
    } catch {
      backend = 'memory';
    }
  }
}

function canUseLS(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function readLS(): unknown | null {
  try {
    if (!canUseLS()) return null;
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------- Emergency copy (synchronous, written when the page is closing) ----------

const PENDING_KEY = 'lifeos:pending';

export function writePendingCopy(data: AppData, rev: number) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ rev, data }));
  } catch {
    /* quota or disabled storage */
  }
}

export function readPendingCopy(): { rev: number; data: unknown } | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingCopy() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  try {
    return await tx<T>('kv', 'readonly', (s) => s.get('meta:' + key) as IDBRequest<T>);
  } catch {
    return undefined;
  }
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  try {
    await tx('kv', 'readwrite', (s) => s.put(value, 'meta:' + key));
  } catch {
    /* ignore */
  }
}

// ---------- Snapshots (automatic local backups) ----------

export interface SnapshotInfo {
  key: string;
  savedAt: string;
  counts: { habits: number; logs: number; tasks: number; academic: number; reminders: number; events: number };
}

interface SnapshotRecord {
  savedAt: string;
  data: AppData;
}

export function countsOf(data: AppData): SnapshotInfo['counts'] {
  return {
    habits: Object.keys(data.habits).length,
    logs: Object.keys(data.logs).length,
    tasks: Object.keys(data.tasks).length,
    academic: Object.keys(data.academic).length,
    reminders: Object.keys(data.reminders).length,
    events: Object.keys(data.events).length,
  };
}

export async function saveSnapshot(key: string, data: AppData, keep = 10): Promise<void> {
  try {
    await tx('snapshots', 'readwrite', (s) => s.put({ savedAt: new Date().toISOString(), data } satisfies SnapshotRecord, key));
    const keys = ((await tx<IDBValidKey[]>('snapshots', 'readonly', (s) => s.getAllKeys())) ?? []).map(String).sort();
    const excess = keys.slice(0, Math.max(0, keys.length - keep));
    if (excess.length) await tx('snapshots', 'readwrite', (s) => void excess.forEach((k) => s.delete(k)));
  } catch {
    /* snapshots are best-effort */
  }
}

export async function hasSnapshot(key: string): Promise<boolean> {
  try {
    const k = await tx<IDBValidKey | undefined>('snapshots', 'readonly', (s) => s.getKey(key));
    return k !== undefined;
  } catch {
    return true; // don't keep retrying when unavailable
  }
}

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const t = db.transaction('snapshots', 'readonly');
      const s = t.objectStore('snapshots');
      const out: SnapshotInfo[] = [];
      const req = s.openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        const v = c.value as SnapshotRecord;
        out.push({ key: String(c.key), savedAt: v.savedAt, counts: countsOf(v.data) });
        c.continue();
      };
      t.oncomplete = () => resolve(out.sort((a, b) => b.key.localeCompare(a.key)));
      t.onerror = () => reject(t.error);
    });
  } catch {
    return [];
  }
}

export async function readSnapshot(key: string): Promise<AppData | null> {
  try {
    const v = await tx<SnapshotRecord>('snapshots', 'readonly', (s) => s.get(key));
    return v?.data ?? null;
  } catch {
    return null;
  }
}

// ---------- Delivered notifications ----------

export async function wasNotified(keys: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (!keys.length) return found;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction('notified', 'readonly');
      const s = t.objectStore('notified');
      for (const k of keys) {
        const r = s.getKey(k);
        r.onsuccess = () => r.result !== undefined && found.add(k);
      }
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  } catch {
    /* ignore */
  }
  return found;
}

export async function markNotified(keys: string[]): Promise<void> {
  if (!keys.length) return;
  try {
    const now = Date.now();
    await tx('notified', 'readwrite', (s) => void keys.forEach((k) => s.put(now, k)));
  } catch {
    /* ignore */
  }
}

export async function pruneNotified(maxAgeDays = 45): Promise<void> {
  try {
    const db = await openDB();
    const cutoff = Date.now() - maxAgeDays * 86400000;
    await new Promise<void>((resolve) => {
      const t = db.transaction('notified', 'readwrite');
      const req = t.objectStore('notified').openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        if (typeof c.value === 'number' && c.value < cutoff) c.delete();
        c.continue();
      };
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}

export async function clearAll(): Promise<void> {
  try {
    await tx('kv', 'readwrite', (s) => s.clear());
    await tx('notified', 'readwrite', (s) => s.clear());
  } catch {
    /* ignore */
  }
  try {
    if (canUseLS()) localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

import { create } from 'zustand';
import type { DateKey } from '../core/date';

export type SheetSpec =
  | { kind: 'quick' }
  | { kind: 'habit'; id?: string; defaults?: Record<string, unknown> }
  | { kind: 'habitDetail'; id: string }
  | { kind: 'task'; id?: string; date?: DateKey | null; time?: string | null }
  | { kind: 'reminder'; id?: string; date?: DateKey; time?: string }
  | { kind: 'snooze'; id: string }
  | { kind: 'academic'; id?: string; date?: DateKey; type?: string }
  | { kind: 'academicDetail'; id: string }
  | { kind: 'event'; id?: string; date?: DateKey; time?: string }
  | { kind: 'subject'; id?: string; onCreated?: (id: string) => void }
  | { kind: 'area'; id?: string; onCreated?: (id: string) => void }
  | { kind: 'addForDay'; date: DateKey }
  | { kind: 'habitCount'; id: string; date: DateKey };

export interface Toast {
  id: number;
  message: string;
  tone?: 'default' | 'success' | 'danger' | 'info';
  action?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
  duration?: number;
  icon?: string;
}

export interface ConfirmSpec {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

interface UIState {
  sheets: Array<SheetSpec & { key: number }>;
  toasts: Toast[];
  confirm: ConfirmSpec | null;
  installPrompt: BeforeInstallPromptEvent | null;
  updateReady: (() => void) | null;
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const useUI = create<UIState>()(() => ({ sheets: [], toasts: [], confirm: null, installPrompt: null, updateReady: null }));

let seq = 1;

export function openSheet(spec: SheetSpec) {
  useUI.setState((s) => ({ sheets: [...s.sheets, { ...spec, key: seq++ }] }));
}

export function closeSheet(key?: number) {
  useUI.setState((s) => ({ sheets: key === undefined ? s.sheets.slice(0, -1) : s.sheets.filter((x) => x.key !== key) }));
}

export function replaceSheet(key: number, spec: SheetSpec) {
  useUI.setState((s) => ({ sheets: s.sheets.map((x) => (x.key === key ? { ...spec, key: seq++ } : x)) }));
}

export function closeAllSheets() {
  useUI.setState({ sheets: [] });
}

export function toast(message: string, opts: Omit<Toast, 'id' | 'message'> = {}) {
  const id = seq++;
  useUI.setState((s) => ({ toasts: [...s.toasts.filter((t) => t.message !== message).slice(-1), { id, message, ...opts }] }));
  const duration = opts.duration ?? (opts.action ? 5500 : 3200);
  if (duration > 0) setTimeout(() => dismissToast(id), duration);
  return id;
}

export function dismissToast(id: number) {
  useUI.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

export function confirmDialog(spec: Omit<ConfirmSpec, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    useUI.setState({
      confirm: {
        ...spec,
        resolve: (ok) => {
          useUI.setState({ confirm: null });
          resolve(ok);
        },
      },
    });
  });
}

/** Shows a toast with an "Desfazer" button. */
export function toastUndo(message: string, undo: () => void, tone: Toast['tone'] = 'default') {
  const id = toast(message, {
    tone,
    action: {
      label: 'Desfazer',
      onClick: () => {
        undo();
        dismissToast(id);
      },
    },
  });
}

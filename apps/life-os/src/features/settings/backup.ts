import { buildIcs, type IcsOptions } from '../../core/ics';
import { normalizeData } from '../../core/defaults';
import { todayKey } from '../../core/date';
import type { AppData } from '../../core/types';
import { toast } from '../../store/ui';

export const BACKUP_APP = 'lifeos';

export interface BackupFile {
  app: typeof BACKUP_APP;
  kind: 'backup';
  exportedAt: string;
  schemaVersion: number;
  data: AppData;
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'arquivo';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function backupFile(data: AppData): { blob: Blob; name: string } {
  const payload: BackupFile = { app: BACKUP_APP, kind: 'backup', exportedAt: new Date().toISOString(), schemaVersion: data.schemaVersion, data };
  return { blob: new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), name: `ritmora-backup-${todayKey()}.json` };
}

export function downloadBackup(data: AppData) {
  const { blob, name } = backupFile(data);
  saveBlob(blob, name);
}

/** Uses the native share sheet when available (save to Drive/Files on mobile). */
export async function shareBackup(data: AppData): Promise<boolean> {
  const { blob, name } = backupFile(data);
  const file = new File([blob], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup Ritmora' });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return true;
    }
  }
  saveBlob(blob, name);
  return false;
}

export const canShareFiles = () => {
  try {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    return !!nav.canShare?.({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] });
  } catch {
    return false;
  }
};

/** Parses a backup (or a raw data export) and validates it. */
export async function parseBackup(file: File): Promise<AppData> {
  const text = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  const obj = json as Partial<BackupFile> & Record<string, unknown>;
  const raw = obj && obj.app === BACKUP_APP && obj.data ? obj.data : obj;
  if (!raw || typeof raw !== 'object' || !('settings' in raw || 'habits' in raw)) throw new Error('Este arquivo não parece ser um backup do Ritmora.');
  return normalizeData(raw);
}

export function downloadIcs(data: AppData, name: string, only?: { kind: 'reminder' | 'academic' | 'event'; id: string }, opts?: IcsOptions) {
  const ics = buildIcs(data, opts ?? { reminders: true, academic: true, events: true }, only);
  const count = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
  if (!count) {
    toast('Nada para exportar');
    return;
  }
  saveBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), `${slug(name)}.ics`);
  toast(only ? 'Arquivo de calendário gerado — abra-o para adicionar ao seu calendário' : `${count} itens exportados para o calendário`);
}

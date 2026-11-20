import { isDateKey, isTime, nowLocal, toLocalDateTime } from './date';
import {
  ACCENT_KEYS,
  COLOR_KEYS,
  SCHEMA_VERSION,
  type AcademicItem,
  type AppData,
  type Area,
  type CalendarEvent,
  type ColorKey,
  type Habit,
  type HabitLog,
  type Reminder,
  type Repeat,
  type Settings,
  type Subject,
  type Task,
  type WeekPlan,
} from './types';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const nowISO = () => new Date().toISOString();

export function defaultSettings(): Settings {
  return {
    name: '',
    theme: 'dark',
    accent: 'lime',
    weekStartsOn: 1,
    notifications: {
      reminders: true,
      habits: true,
      academic: true,
      events: true,
      tasks: true,
      academicTime: '09:00',
    },
    onboarded: false,
    createdAt: nowISO(),
  };
}

export const DEFAULT_AREAS: Array<Pick<Area, 'name' | 'color' | 'icon'>> = [
  { name: 'Saúde', color: 'green', icon: 'HeartPulse' },
  { name: 'Estudos', color: 'blue', icon: 'GraduationCap' },
  { name: 'Pessoal', color: 'yellow', icon: 'Sparkles' },
];

export function makeArea(input: Pick<Area, 'name' | 'color' | 'icon'>, order: number): Area {
  const t = nowISO();
  return { id: uid(), createdAt: t, updatedAt: t, order, ...input };
}

export function emptyData(): AppData {
  const areas: Record<string, Area> = {};
  DEFAULT_AREAS.forEach((a, i) => {
    const area = makeArea(a, i);
    areas[area.id] = area;
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: defaultSettings(),
    areas,
    habits: {},
    logs: {},
    weekPlans: {},
    tasks: {},
    subjects: {},
    academic: {},
    reminders: {},
    events: {},
    tombstones: {},
  };
}

export interface HabitTemplate {
  name: string;
  area: string; // area name
  icon: string;
  color: ColorKey;
  frequency: Habit['frequency'];
  days: number[];
  weeklyTarget: number;
  dailyTarget?: number;
  unit: string;
}

const ALL = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

/** Suggestions offered on first run (only those the user picks are created). */
export const HABIT_TEMPLATES: HabitTemplate[] = [
  { name: 'Seguir a dieta', area: 'Saúde', icon: 'Salad', color: 'green', frequency: 'daily', days: ALL, weeklyTarget: 7, unit: 'dias' },
  { name: 'Beber água', area: 'Saúde', icon: 'GlassWater', color: 'blue', frequency: 'daily', days: ALL, weeklyTarget: 7, dailyTarget: 8, unit: 'copos' },
  { name: 'Academia', area: 'Saúde', icon: 'Dumbbell', color: 'orange', frequency: 'weekly', days: [], weeklyTarget: 3, unit: 'treinos' },
  { name: 'Cardio', area: 'Saúde', icon: 'HeartPulse', color: 'red', frequency: 'weekly', days: [], weeklyTarget: 3, unit: 'sessões' },
  { name: 'Futebol', area: 'Saúde', icon: 'Trophy', color: 'aqua', frequency: 'weekly', days: [], weeklyTarget: 2, unit: 'jogos' },
  { name: 'Caminhada', area: 'Saúde', icon: 'Footprints', color: 'aqua', frequency: 'weekly', days: [], weeklyTarget: 3, unit: 'caminhadas' },
  { name: 'Natação', area: 'Saúde', icon: 'Waves', color: 'blue', frequency: 'weekly', days: [], weeklyTarget: 2, unit: 'treinos' },
  { name: 'Dormir no horário', area: 'Saúde', icon: 'Moon', color: 'violet', frequency: 'daily', days: ALL, weeklyTarget: 7, unit: 'noites' },
  { name: 'Estudar a faculdade', area: 'Estudos', icon: 'GraduationCap', color: 'violet', frequency: 'daily', days: WEEKDAYS, weeklyTarget: 5, unit: 'dias' },
  { name: 'Revisar conteúdo', area: 'Estudos', icon: 'BookCheck', color: 'blue', frequency: 'weekly', days: [], weeklyTarget: 3, unit: 'revisões' },
  { name: 'Fazer exercícios', area: 'Estudos', icon: 'PenLine', color: 'magenta', frequency: 'weekly', days: [], weeklyTarget: 3, unit: 'listas' },
  { name: 'Ler', area: 'Pessoal', icon: 'BookOpen', color: 'yellow', frequency: 'daily', days: ALL, weeklyTarget: 5, unit: 'dias' },
  { name: 'Organizar o quarto', area: 'Pessoal', icon: 'House', color: 'slate', frequency: 'weekly', days: [], weeklyTarget: 2, unit: 'vezes' },
  { name: 'Resolver pendências', area: 'Pessoal', icon: 'ClipboardCheck', color: 'orange', frequency: 'weekly', days: [], weeklyTarget: 2, unit: 'vezes' },
];

export function makeHabit(input: Partial<Habit> & Pick<Habit, 'name'>, order: number): Habit {
  const t = nowISO();
  return normalizeHabit({ ...input, id: input.id ?? uid(), createdAt: t, updatedAt: t, order });
}

export function defaultRepeat(): Repeat {
  return { type: 'none', days: [] };
}

// ---------- Normalization (migrations + import validation) ----------

type AnyObj = Record<string, unknown>;
const isObj = (v: unknown): v is AnyObj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const num = (v: unknown, d: number, min = -Infinity, max = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const color = (v: unknown, d: ColorKey = 'blue'): ColorKey => (COLOR_KEYS as readonly string[]).includes(v as string) ? (v as ColorKey) : d;
const timeOrNull = (v: unknown) => (isTime(v) ? (v as string) : null);
const idOrNull = (v: unknown) => (typeof v === 'string' && v ? v : null);
const iso = (v: unknown, d = nowISO()) => (typeof v === 'string' && v ? v : d);
const days = (v: unknown): number[] =>
  Array.isArray(v) ? [...new Set(v.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6) as number[])].sort() : [];
const prio = (v: unknown): Task['priority'] => (v === 'low' || v === 'high' || v === 'medium' ? v : 'medium');

function normalizeRepeat(v: unknown): Repeat {
  if (!isObj(v)) return defaultRepeat();
  const types = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'custom'];
  const type = types.includes(v.type as string) ? (v.type as Repeat['type']) : 'none';
  return { type, days: days(v.days) };
}

function meta(o: AnyObj) {
  const created = iso(o.createdAt);
  return { id: str(o.id) || uid(), createdAt: created, updatedAt: iso(o.updatedAt, created) };
}

export function normalizeHabit(o: AnyObj): Habit {
  const frequency = o.frequency === 'weekly' ? 'weekly' : 'daily';
  let d = days(o.days);
  if (frequency === 'daily' && d.length === 0) d = [...ALL];
  return {
    ...meta(o),
    name: str(o.name, 'Hábito').slice(0, 80),
    areaId: idOrNull(o.areaId),
    icon: str(o.icon, 'Target'),
    color: color(o.color),
    frequency,
    days: d,
    weeklyTarget: Math.round(num(o.weeklyTarget, frequency === 'daily' ? d.length : 3, 1, 21)),
    dailyTarget: Math.round(num(o.dailyTarget, 1, 1, 50)),
    unit: str(o.unit, 'vezes').slice(0, 24),
    time: timeOrNull(o.time),
    remind: bool(o.remind, false),
    archived: bool(o.archived, false),
    archivedAt: typeof o.archivedAt === 'string' ? o.archivedAt : null,
    order: num(o.order, 0),
    notes: str(o.notes),
  };
}

function normalizeArea(o: AnyObj, i: number): Area {
  return { ...meta(o), name: str(o.name, 'Área').slice(0, 40), color: color(o.color, 'slate'), icon: str(o.icon, 'Tag'), order: num(o.order, i) };
}

function normalizeTask(o: AnyObj): Task {
  return {
    ...meta(o),
    title: str(o.title, 'Tarefa').slice(0, 200),
    date: isDateKey(o.date) ? (o.date as string) : null,
    time: timeOrNull(o.time),
    priority: prio(o.priority),
    areaId: idOrNull(o.areaId),
    done: bool(o.done, false),
    doneAt: typeof o.doneAt === 'string' ? o.doneAt : null,
    notes: str(o.notes),
    remind: bool(o.remind, true),
  };
}

function normalizeSubject(o: AnyObj): Subject {
  return { ...meta(o), name: str(o.name, 'Disciplina').slice(0, 80), color: color(o.color, 'violet'), professor: str(o.professor), archived: bool(o.archived, false) };
}

function normalizeAcademic(o: AnyObj): AcademicItem {
  const types = ['trabalho', 'prova', 'apresentacao', 'atividade', 'relatorio', 'outro'];
  const statuses = ['pendente', 'andamento', 'concluido'];
  const alerts = Array.isArray(o.alerts) ? [...new Set((o.alerts as unknown[]).filter((x) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 30) as number[])] : [1, 0];
  return {
    ...meta(o),
    title: str(o.title, 'Atividade').slice(0, 200),
    subjectId: idOrNull(o.subjectId),
    type: types.includes(o.type as string) ? (o.type as AcademicItem['type']) : 'trabalho',
    date: isDateKey(o.date) ? (o.date as string) : nowLocal().slice(0, 10),
    time: timeOrNull(o.time),
    priority: prio(o.priority),
    description: str(o.description),
    notes: str(o.notes),
    status: statuses.includes(o.status as string) ? (o.status as AcademicItem['status']) : 'pendente',
    completedAt: typeof o.completedAt === 'string' ? o.completedAt : null,
    alerts: alerts.sort((a, b) => b - a),
  };
}

function normalizeReminder(o: AnyObj): Reminder {
  const date = isDateKey(o.date) ? (o.date as string) : nowLocal().slice(0, 10);
  const time = isTime(o.time) ? (o.time as string) : '09:00';
  const occ = typeof o.occurrence === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(o.occurrence) ? o.occurrence : toLocalDateTime(date, time);
  const snooze = typeof o.snoozedUntil === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(o.snoozedUntil) ? o.snoozedUntil : null;
  return {
    ...meta(o),
    title: str(o.title, 'Lembrete').slice(0, 200),
    description: str(o.description),
    date,
    time,
    repeat: normalizeRepeat(o.repeat),
    areaId: idOrNull(o.areaId),
    occurrence: occ,
    snoozedUntil: snooze,
    done: bool(o.done, false),
    doneAt: typeof o.doneAt === 'string' ? o.doneAt : null,
    completedCount: Math.round(num(o.completedCount, 0, 0)),
  };
}

function normalizeEvent(o: AnyObj): CalendarEvent {
  const time = timeOrNull(o.time);
  return {
    ...meta(o),
    title: str(o.title, 'Evento').slice(0, 200),
    date: isDateKey(o.date) ? (o.date as string) : nowLocal().slice(0, 10),
    allDay: bool(o.allDay, !time),
    time,
    endTime: timeOrNull(o.endTime),
    areaId: idOrNull(o.areaId),
    location: str(o.location),
    notes: str(o.notes),
    repeat: normalizeRepeat(o.repeat),
    alertMinutes: o.alertMinutes === null ? null : typeof o.alertMinutes === 'number' ? num(o.alertMinutes, 15, 0, 10080) : time ? 15 : null,
  };
}

function normalizeSettings(o: unknown): Settings {
  const d = defaultSettings();
  if (!isObj(o)) return d;
  const n = isObj(o.notifications) ? o.notifications : {};
  return {
    name: str(o.name).slice(0, 40),
    theme: o.theme === 'light' || o.theme === 'system' || o.theme === 'dark' ? o.theme : 'dark',
    accent: (ACCENT_KEYS as readonly string[]).includes(o.accent as string) ? (o.accent as Settings['accent']) : 'lime',
    weekStartsOn: o.weekStartsOn === 0 ? 0 : 1,
    notifications: {
      reminders: bool(n.reminders, true),
      habits: bool(n.habits, true),
      academic: bool(n.academic, true),
      events: bool(n.events, true),
      tasks: bool(n.tasks, true),
      academicTime: isTime(n.academicTime) ? (n.academicTime as string) : '09:00',
    },
    onboarded: bool(o.onboarded, false),
    createdAt: iso(o.createdAt, d.createdAt),
  };
}

function normalizeCollection<T extends { id: string }>(v: unknown, fn: (o: AnyObj, i: number) => T): Record<string, T> {
  const out: Record<string, T> = {};
  const list: unknown[] = Array.isArray(v) ? v : isObj(v) ? Object.values(v) : [];
  list.forEach((item, i) => {
    if (!isObj(item)) return;
    const rec = fn(item, i);
    out[rec.id] = rec;
  });
  return out;
}

export class InvalidDataError extends Error {}

/**
 * Turns any stored/imported object into a valid AppData, filling defaults.
 * Acts as the migration entry point: add `if (version < N)` steps here.
 */
export function normalizeData(raw: unknown): AppData {
  if (!isObj(raw)) throw new InvalidDataError('Formato de dados inválido.');
  const version = num(raw.schemaVersion, 1);
  if (version > SCHEMA_VERSION) throw new InvalidDataError('Este backup foi criado por uma versão mais nova do Ritmora.');

  const habits = normalizeCollection(raw.habits, (o) => normalizeHabit(o));
  const logs: Record<string, HabitLog> = {};
  const rawLogs: unknown[] = Array.isArray(raw.logs) ? raw.logs : isObj(raw.logs) ? Object.values(raw.logs) : [];
  for (const l of rawLogs) {
    if (!isObj(l)) continue;
    const habitId = str(l.habitId);
    const date = l.date;
    const count = Math.round(num(l.count, 0, 0, 999));
    if (!habitId || !habits[habitId] || !isDateKey(date) || count <= 0) continue;
    logs[`${habitId}|${date}`] = { habitId, date, count, updatedAt: iso(l.updatedAt) };
  }
  const weekPlans: Record<string, WeekPlan> = {};
  if (isObj(raw.weekPlans)) {
    for (const p of Object.values(raw.weekPlans)) {
      if (!isObj(p) || !isDateKey(p.weekStart) || !isObj(p.targets)) continue;
      const targets: Record<string, number> = {};
      for (const [hid, t] of Object.entries(p.targets)) if (habits[hid] && typeof t === 'number') targets[hid] = Math.round(num(t, 0, 0, 21));
      weekPlans[p.weekStart] = { weekStart: p.weekStart, targets, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt) };
    }
  }
  const tombstones: Record<string, string> = {};
  if (isObj(raw.tombstones)) for (const [k, v] of Object.entries(raw.tombstones)) if (typeof v === 'string') tombstones[k] = v;

  const areas = normalizeCollection(raw.areas, normalizeArea);
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: normalizeSettings(raw.settings),
    areas,
    habits,
    logs,
    weekPlans,
    tasks: normalizeCollection(raw.tasks, normalizeTask),
    subjects: normalizeCollection(raw.subjects, normalizeSubject),
    academic: normalizeCollection(raw.academic, normalizeAcademic),
    reminders: normalizeCollection(raw.reminders, normalizeReminder),
    events: normalizeCollection(raw.events, normalizeEvent),
    tombstones,
  };
}

export { normalizeTask, normalizeAcademic, normalizeReminder, normalizeEvent, normalizeSubject, normalizeArea };

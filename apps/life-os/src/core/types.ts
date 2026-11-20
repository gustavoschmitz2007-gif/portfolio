import type { DateKey, LocalDateTime, TimeStr } from './date';

export type ID = string;
export type ISO = string; // ISO timestamp (UTC) for audit fields

export const COLOR_KEYS = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red', 'slate'] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

export const ACCENT_KEYS = ['lime', 'violet', 'blue', 'aqua', 'orange'] as const;
export type AccentKey = (typeof ACCENT_KEYS)[number];

export type Priority = 'low' | 'medium' | 'high';

/** Fields every record carries (ready for future sync). */
export interface Meta {
  id: ID;
  createdAt: ISO;
  updatedAt: ISO;
}

/** Área da vida / categoria (Saúde, Estudos, Pessoal...). */
export interface Area extends Meta {
  name: string;
  color: ColorKey;
  icon: string;
  order: number;
}

export type HabitFrequency = 'daily' | 'weekly';

export interface Habit extends Meta {
  name: string;
  areaId: ID | null;
  icon: string;
  color: ColorKey;
  /** daily: expected on `days`; weekly: N times per week on any day. */
  frequency: HabitFrequency;
  /** Weekdays (0 = domingo … 6 = sábado). Daily: scheduled days. Weekly: preferred days (optional). */
  days: number[];
  /** Default weekly goal (snapshotted per week in WeekPlan). */
  weeklyTarget: number;
  /** How many check-ins in a day make the day count (e.g. 8 copos de água). */
  dailyTarget: number;
  /** Unit label for totals ("treinos", "sessões", "dias"). */
  unit: string;
  time: TimeStr | null;
  remind: boolean;
  archived: boolean;
  archivedAt: ISO | null;
  order: number;
  notes: string;
}

export interface HabitLog {
  habitId: ID;
  date: DateKey;
  count: number;
  updatedAt: ISO;
}

/** Snapshot of the goals for one week (keeps history stable when defaults change). */
export interface WeekPlan {
  weekStart: DateKey;
  targets: Record<ID, number>;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface Task extends Meta {
  title: string;
  date: DateKey | null;
  time: TimeStr | null;
  priority: Priority;
  areaId: ID | null;
  done: boolean;
  doneAt: ISO | null;
  notes: string;
  remind: boolean;
}

export type AcademicType = 'trabalho' | 'prova' | 'apresentacao' | 'atividade' | 'relatorio' | 'outro';
export type AcademicStatus = 'pendente' | 'andamento' | 'concluido';

export interface Subject extends Meta {
  name: string;
  color: ColorKey;
  professor: string;
  archived: boolean;
}

export interface AcademicItem extends Meta {
  title: string;
  subjectId: ID | null;
  type: AcademicType;
  date: DateKey;
  time: TimeStr | null;
  priority: Priority;
  description: string;
  notes: string;
  status: AcademicStatus;
  completedAt: ISO | null;
  /** Days before the date to send an alert (0 = no dia). */
  alerts: number[];
}

export type RepeatType = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom';

export interface Repeat {
  type: RepeatType;
  /** For "custom": weekdays (0-6). */
  days: number[];
}

export interface Reminder extends Meta {
  title: string;
  description: string;
  /** First occurrence. */
  date: DateKey;
  time: TimeStr;
  repeat: Repeat;
  areaId: ID | null;
  /** Current pending occurrence (local date-time). */
  occurrence: LocalDateTime;
  snoozedUntil: LocalDateTime | null;
  done: boolean;
  doneAt: ISO | null;
  completedCount: number;
}

export interface CalendarEvent extends Meta {
  title: string;
  date: DateKey;
  allDay: boolean;
  time: TimeStr | null;
  endTime: TimeStr | null;
  areaId: ID | null;
  location: string;
  notes: string;
  repeat: Repeat;
  /** Minutes before start to notify (null = sem aviso). */
  alertMinutes: number | null;
}

export type ThemePref = 'dark' | 'light' | 'system';

export interface NotificationPrefs {
  reminders: boolean;
  habits: boolean;
  academic: boolean;
  events: boolean;
  tasks: boolean;
  /** Time of day to send academic deadline alerts. */
  academicTime: TimeStr;
}

export interface Settings {
  name: string;
  theme: ThemePref;
  accent: AccentKey;
  weekStartsOn: 0 | 1;
  notifications: NotificationPrefs;
  onboarded: boolean;
  createdAt: ISO;
}

export interface AppData {
  schemaVersion: number;
  settings: Settings;
  areas: Record<ID, Area>;
  habits: Record<ID, Habit>;
  /** key = `${habitId}|${date}` */
  logs: Record<string, HabitLog>;
  weekPlans: Record<DateKey, WeekPlan>;
  tasks: Record<ID, Task>;
  subjects: Record<ID, Subject>;
  academic: Record<ID, AcademicItem>;
  reminders: Record<ID, Reminder>;
  events: Record<ID, CalendarEvent>;
  /** Deleted record ids → deletion time (for future sync/merge). */
  tombstones: Record<ID, ISO>;
}

export type CollectionName = 'areas' | 'habits' | 'tasks' | 'subjects' | 'academic' | 'reminders' | 'events';

export const SCHEMA_VERSION = 1;

export const logKey = (habitId: ID, date: DateKey) => `${habitId}|${date}`;

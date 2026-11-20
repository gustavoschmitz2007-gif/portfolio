import { create } from 'zustand';
import { produce } from 'immer';
import { emptyData, makeArea, makeHabit, normalizeAcademic, normalizeEvent, normalizeReminder, normalizeSubject, normalizeTask, nowISO, uid } from '../core/defaults';
import { addMinutesLocal, endOfWeek, nowLocal, startOfWeek, toKey, toLocalDateTime, todayKey, type DateKey, type LocalDateTime } from '../core/date';
import { catchUpReminder, nextReminderOccurrence } from '../core/recurrence';
import { initialWeekTarget } from '../core/habits';
import {
  logKey,
  type AcademicItem,
  type AcademicStatus,
  type AppData,
  type Area,
  type CalendarEvent,
  type Habit,
  type HabitLog,
  type NotificationPrefs,
  type Reminder,
  type Settings,
  type Subject,
  type Task,
  type WeekPlan,
} from '../core/types';

interface AppState {
  data: AppData;
  hydrated: boolean;
}

export const useApp = create<AppState>()(() => ({ data: emptyData(), hydrated: false }));

/** The whole data document (stable reference until something changes). */
export const useData = () => useApp((s) => s.data);
export const useSettings = () => useApp((s) => s.data.settings);
export const getData = () => useApp.getState().data;

export function mutate(fn: (d: AppData) => void) {
  useApp.setState((s) => ({ data: produce(s.data, fn) }));
}

const stamp = <T extends { updatedAt: string }>(r: T) => {
  r.updatedAt = nowISO();
  return r;
};

const currentWeekStart = (d: AppData) => startOfWeek(todayKey(), d.settings.weekStartsOn);

function planFor(d: AppData, weekStart: DateKey): WeekPlan {
  let plan = d.weekPlans[weekStart];
  if (!plan) {
    const t = nowISO();
    const end = endOfWeek(weekStart);
    const targets: Record<string, number> = {};
    const isPastOrCurrent = weekStart <= currentWeekStart(d);
    for (const h of Object.values(d.habits)) {
      if (h.archived && (!h.archivedAt || toKey(new Date(h.archivedAt)) <= end)) continue;
      if (isPastOrCurrent && toKey(new Date(h.createdAt)) > end) continue;
      targets[h.id] = initialWeekTarget(h, weekStart);
    }
    plan = { weekStart, targets, createdAt: t, updatedAt: t };
    d.weekPlans[weekStart] = plan;
  }
  return plan;
}

const tomb = (d: AppData, id: string) => {
  d.tombstones[id] = nowISO();
};

// ---------------------------------------------------------------------------

export const actions = {
  // ----- settings -----
  updateSettings(patch: Partial<Settings>) {
    mutate((d) => {
      Object.assign(d.settings, patch);
    });
  },
  updateNotificationPrefs(patch: Partial<NotificationPrefs>) {
    mutate((d) => {
      Object.assign(d.settings.notifications, patch);
    });
  },

  // ----- areas -----
  addArea(input: Pick<Area, 'name' | 'color' | 'icon'>): string {
    const area = makeArea(input, Object.keys(getData().areas).length);
    mutate((d) => {
      d.areas[area.id] = area;
    });
    return area.id;
  },
  updateArea(id: string, patch: Partial<Area>) {
    mutate((d) => {
      if (d.areas[id]) stamp(Object.assign(d.areas[id], patch));
    });
  },
  deleteArea(id: string) {
    mutate((d) => {
      delete d.areas[id];
      tomb(d, id);
      for (const c of [d.habits, d.tasks, d.reminders, d.events] as Record<string, { areaId: string | null }>[]) {
        for (const r of Object.values(c)) if (r.areaId === id) r.areaId = null;
      }
    });
  },

  // ----- habits -----
  addHabit(input: Partial<Habit> & Pick<Habit, 'name'>): string {
    const d0 = getData();
    const order = Math.max(-1, ...Object.values(d0.habits).map((h) => h.order)) + 1;
    const habit = makeHabit(input, order);
    mutate((d) => {
      d.habits[habit.id] = habit;
      const cws = currentWeekStart(d);
      for (const p of Object.values(d.weekPlans)) if (p.weekStart >= cws) p.targets[habit.id] = initialWeekTarget(habit, p.weekStart);
    });
    return habit.id;
  },
  updateHabit(id: string, patch: Partial<Habit>) {
    mutate((d) => {
      const h = d.habits[id];
      if (!h) return;
      const prevTarget = h.weeklyTarget;
      stamp(Object.assign(h, patch));
      if (patch.weeklyTarget !== undefined && patch.weeklyTarget !== prevTarget) {
        // Goal changes apply to this week and the future; past weeks keep their snapshot.
        const cws = currentWeekStart(d);
        for (const p of Object.values(d.weekPlans)) if (p.weekStart >= cws && id in p.targets) p.targets[id] = h.weeklyTarget;
      }
    });
  },
  setHabitArchived(id: string, archived: boolean) {
    mutate((d) => {
      const h = d.habits[id];
      if (!h) return;
      h.archived = archived;
      h.archivedAt = archived ? nowISO() : null;
      stamp(h);
      const cws = currentWeekStart(d);
      for (const p of Object.values(d.weekPlans)) {
        if (p.weekStart < cws) continue;
        if (archived) delete p.targets[id];
        else p.targets[id] = h.weeklyTarget;
      }
    });
  },
  /** Deletes a habit with all its records. Returns an undo function. */
  deleteHabit(id: string): () => void {
    const d0 = getData();
    const habit = d0.habits[id];
    if (!habit) return () => {};
    const logs = Object.entries(d0.logs).filter(([, l]) => l.habitId === id);
    const planTargets = Object.values(d0.weekPlans)
      .filter((p) => id in p.targets)
      .map((p) => [p.weekStart, p.targets[id]] as const);
    mutate((d) => {
      delete d.habits[id];
      for (const [k] of logs) delete d.logs[k];
      for (const p of Object.values(d.weekPlans)) delete p.targets[id];
      tomb(d, id);
    });
    return () =>
      mutate((d) => {
        d.habits[id] = habit;
        for (const [k, l] of logs) d.logs[k] = l;
        for (const [ws, t] of planTargets) if (d.weekPlans[ws]) d.weekPlans[ws].targets[id] = t;
        delete d.tombstones[id];
      });
  },
  moveHabit(id: string, dir: -1 | 1) {
    mutate((d) => {
      const list = Object.values(d.habits)
        .filter((h) => !h.archived)
        .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
      const i = list.findIndex((h) => h.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      list.forEach((h, idx) => (h.order = idx));
    });
  },

  // ----- habit logs -----
  setHabitCount(habitId: string, date: DateKey, count: number) {
    mutate((d) => {
      const h = d.habits[habitId];
      if (!h) return;
      const k = logKey(habitId, date);
      const c = Math.max(0, Math.min(999, Math.round(count)));
      if (c === 0) delete d.logs[k];
      else d.logs[k] = { habitId, date, count: c, updatedAt: nowISO() } satisfies HabitLog;
    });
  },
  /** One-tap toggle: done ↔ not done. Returns the previous count (for undo). */
  toggleHabit(habitId: string, date: DateKey): number {
    const d0 = getData();
    const h = d0.habits[habitId];
    if (!h) return 0;
    const prev = d0.logs[logKey(habitId, date)]?.count ?? 0;
    actions.setHabitCount(habitId, date, prev >= h.dailyTarget ? 0 : h.dailyTarget);
    return prev;
  },
  incrementHabit(habitId: string, date: DateKey, delta: number): number {
    const d0 = getData();
    const prev = d0.logs[logKey(habitId, date)]?.count ?? 0;
    actions.setHabitCount(habitId, date, prev + delta);
    return prev;
  },

  // ----- weekly goals -----
  ensureWeekPlan(weekStart: DateKey) {
    if (getData().weekPlans[weekStart]) return;
    mutate((d) => {
      planFor(d, weekStart);
    });
  },
  setWeekTarget(weekStart: DateKey, habitId: string, target: number) {
    mutate((d) => {
      const p = planFor(d, weekStart);
      p.targets[habitId] = Math.max(0, Math.min(21, Math.round(target)));
      p.updatedAt = nowISO();
    });
  },

  // ----- tasks -----
  addTask(input: Partial<Task> & Pick<Task, 'title'>): string {
    const t = nowISO();
    const task = normalizeTask({ ...input, id: uid(), createdAt: t, updatedAt: t, done: false, doneAt: null });
    mutate((d) => {
      d.tasks[task.id] = task;
    });
    return task.id;
  },
  updateTask(id: string, patch: Partial<Task>) {
    mutate((d) => {
      if (d.tasks[id]) stamp(Object.assign(d.tasks[id], patch));
    });
  },
  toggleTask(id: string) {
    mutate((d) => {
      const t = d.tasks[id];
      if (!t) return;
      t.done = !t.done;
      t.doneAt = t.done ? nowISO() : null;
      stamp(t);
    });
  },
  deleteTask(id: string): () => void {
    return removeWithUndo('tasks', id);
  },

  // ----- subjects -----
  addSubject(input: Pick<Subject, 'name' | 'color'> & Partial<Subject>): string {
    const t = nowISO();
    const s = normalizeSubject({ ...input, id: uid(), createdAt: t, updatedAt: t });
    mutate((d) => {
      d.subjects[s.id] = s;
    });
    return s.id;
  },
  updateSubject(id: string, patch: Partial<Subject>) {
    mutate((d) => {
      if (d.subjects[id]) stamp(Object.assign(d.subjects[id], patch));
    });
  },
  deleteSubject(id: string) {
    mutate((d) => {
      delete d.subjects[id];
      tomb(d, id);
      for (const a of Object.values(d.academic)) if (a.subjectId === id) a.subjectId = null;
    });
  },

  // ----- academic -----
  addAcademic(input: Partial<AcademicItem> & Pick<AcademicItem, 'title' | 'date'>): string {
    const t = nowISO();
    const a = normalizeAcademic({ ...input, id: uid(), createdAt: t, updatedAt: t });
    if (a.status === 'concluido') a.completedAt = t;
    mutate((d) => {
      d.academic[a.id] = a;
    });
    return a.id;
  },
  updateAcademic(id: string, patch: Partial<AcademicItem>) {
    mutate((d) => {
      const a = d.academic[id];
      if (!a) return;
      const wasDone = a.status === 'concluido';
      stamp(Object.assign(a, patch));
      if (a.status === 'concluido' && !wasDone) a.completedAt = nowISO();
      if (a.status !== 'concluido') a.completedAt = null;
    });
  },
  setAcademicStatus(id: string, status: AcademicStatus) {
    actions.updateAcademic(id, { status });
  },
  deleteAcademic(id: string): () => void {
    return removeWithUndo('academic', id);
  },

  // ----- reminders -----
  addReminder(input: Partial<Reminder> & Pick<Reminder, 'title' | 'date' | 'time'>): string {
    const t = nowISO();
    const r = normalizeReminder({ ...input, id: uid(), createdAt: t, updatedAt: t, occurrence: toLocalDateTime(input.date, input.time), snoozedUntil: null, done: false });
    mutate((d) => {
      d.reminders[r.id] = r;
    });
    return r.id;
  },
  updateReminder(id: string, patch: Partial<Reminder>) {
    mutate((d) => {
      const r = d.reminders[id];
      if (!r) return;
      const scheduleChanged =
        (patch.date !== undefined && patch.date !== r.date) ||
        (patch.time !== undefined && patch.time !== r.time) ||
        (patch.repeat !== undefined && JSON.stringify(patch.repeat) !== JSON.stringify(r.repeat));
      stamp(Object.assign(r, patch));
      if (scheduleChanged) {
        r.occurrence = toLocalDateTime(r.date, r.time);
        r.snoozedUntil = null;
        r.done = false;
        r.doneAt = null;
      }
    });
  },
  /** Completes the current occurrence (repeating reminders move to the next one). Returns undo. */
  completeReminder(id: string): () => void {
    const prev = getData().reminders[id];
    if (!prev) return () => {};
    mutate((d) => {
      const r = d.reminders[id];
      const next = nextReminderOccurrence(r);
      r.completedCount += 1;
      r.snoozedUntil = null;
      if (next) r.occurrence = next;
      else {
        r.done = true;
        r.doneAt = nowISO();
      }
      stamp(r);
    });
    return () =>
      mutate((d) => {
        d.reminders[id] = prev;
      });
  },
  reopenReminder(id: string) {
    mutate((d) => {
      const r = d.reminders[id];
      if (!r) return;
      r.done = false;
      r.doneAt = null;
      stamp(r);
    });
  },
  snoozeReminder(id: string, until: LocalDateTime) {
    mutate((d) => {
      const r = d.reminders[id];
      if (!r) return;
      r.snoozedUntil = until;
      r.done = false;
      stamp(r);
    });
  },
  snoozeReminderMinutes(id: string, minutes: number) {
    actions.snoozeReminder(id, addMinutesLocal(nowLocal(), minutes));
  },
  deleteReminder(id: string): () => void {
    return removeWithUndo('reminders', id);
  },
  catchUpReminders(now = new Date()) {
    const d0 = getData();
    const changed = Object.values(d0.reminders).filter((r) => catchUpReminder(r, now) !== r);
    if (!changed.length) return;
    mutate((d) => {
      for (const r of changed) d.reminders[r.id] = catchUpReminder(d.reminders[r.id], now);
    });
  },

  // ----- events -----
  addEvent(input: Partial<CalendarEvent> & Pick<CalendarEvent, 'title' | 'date'>): string {
    const t = nowISO();
    const e = normalizeEvent({ ...input, id: uid(), createdAt: t, updatedAt: t });
    mutate((d) => {
      d.events[e.id] = e;
    });
    return e.id;
  },
  updateEvent(id: string, patch: Partial<CalendarEvent>) {
    mutate((d) => {
      if (d.events[id]) stamp(Object.assign(d.events[id], patch));
    });
  },
  deleteEvent(id: string): () => void {
    return removeWithUndo('events', id);
  },

  // ----- whole data -----
  replaceData(data: AppData) {
    useApp.setState({ data });
  },
  resetData() {
    const fresh = emptyData();
    useApp.setState({ data: fresh });
  },
};

function removeWithUndo(collection: 'tasks' | 'academic' | 'reminders' | 'events', id: string): () => void {
  const rec = getData()[collection][id];
  if (!rec) return () => {};
  mutate((d) => {
    delete d[collection][id];
    tomb(d, id);
  });
  return () =>
    mutate((d) => {
      (d[collection] as Record<string, unknown>)[id] = rec;
      delete d.tombstones[id];
    });
}

export type Actions = typeof actions;

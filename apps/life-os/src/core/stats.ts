import { addDays, endOfWeek, startOfWeek, type DateKey } from './date';
import {
  completionsOn,
  habitsForWeek,
  isDayDone,
  proratedTarget,
  weekDoneCount,
  weekScore,
  weekSummary,
  weekTarget,
  type WeekSummary,
} from './habits';
import type { AppData, Habit } from './types';

export interface WeekPoint {
  weekStart: DateKey;
  pct: number | null; // achieved / target (null when there were no goals)
  met: number;
  goals: number;
  current: boolean;
}

export function weekSeries(data: AppData, today: DateKey, count: number): WeekPoint[] {
  const current = startOfWeek(today, data.settings.weekStartsOn);
  const out: WeekPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const ws = addDays(current, -7 * i);
    const s = weekSummary(data, ws, today);
    out.push({ weekStart: ws, pct: s.target > 0 ? s.pct : null, met: s.met, goals: s.goals.length, current: i === 0 });
  }
  return out;
}

export interface HabitStat {
  habit: Habit;
  /** Days on which the habit counted as done in the period. */
  daysDone: number;
  /** Sum of all check-ins (e.g. copos de água). */
  checkins: number;
  /** Sum of weekly targets for weeks in the period (full weeks only for past, current counted fully). */
  target: number;
  /** Achieved capped by weekly targets. */
  achieved: number;
  rate: number | null;
  weeksMet: number;
  weeks: number;
}

export function habitStats(data: AppData, today: DateKey, weeksBack: number): HabitStat[] {
  const wso = data.settings.weekStartsOn;
  const current = startOfWeek(today, wso);
  const from = addDays(current, -7 * (weeksBack - 1));
  const to = today;
  const stats = new Map<string, HabitStat>();
  const get = (h: Habit) => {
    let s = stats.get(h.id);
    if (!s) {
      s = { habit: h, daysDone: 0, checkins: 0, target: 0, achieved: 0, rate: null, weeksMet: 0, weeks: 0 };
      stats.set(h.id, s);
    }
    return s;
  };
  for (const l of Object.values(data.logs)) {
    if (l.date < from || l.date > to) continue;
    const h = data.habits[l.habitId];
    if (!h) continue;
    const s = get(h);
    s.checkins += l.count;
    if (l.count >= h.dailyTarget) s.daysDone++;
  }
  for (let i = 0; i < weeksBack; i++) {
    const ws = addDays(current, -7 * i);
    const isCurrent = i === 0;
    for (const h of habitsForWeek(data, ws)) {
      const t = weekTarget(data, h, ws);
      if (t <= 0) continue;
      const done = weekDoneCount(data, h, ws);
      const s = get(h);
      // The current week only counts once it's met, so an unfinished week never drags the rate down.
      if (isCurrent && done < t) continue;
      const pt = Math.max(proratedTarget(h, t, ws), Math.min(done, t));
      s.target += pt;
      s.achieved += Math.min(done, pt);
      s.weeks++;
      if (done >= Math.ceil(pt - 0.001)) s.weeksMet++;
    }
  }
  for (const s of stats.values()) s.rate = s.target > 0 ? s.achieved / s.target : null;
  return [...stats.values()].filter((s) => !s.habit.archived || s.daysDone > 0);
}

export interface PeriodTotals {
  consistency: number | null;
  goalsMet: number;
  goalsTotal: number;
  checkinDays: number;
  bestWeek: WeekPoint | null;
}

export function periodTotals(data: AppData, today: DateKey, weeksBack: number): PeriodTotals {
  const current = startOfWeek(today, data.settings.weekStartsOn);
  let a = 0;
  let e = 0;
  let goalsMet = 0;
  let goalsTotal = 0;
  const series = weekSeries(data, today, weeksBack);
  for (let i = 0; i < weeksBack; i++) {
    const ws = addDays(current, -7 * i);
    const sc = weekScore(data, ws, today);
    a += sc.achieved;
    e += sc.expected;
    const sum = weekSummary(data, ws, today);
    if (i === 0) {
      // Current week: count goals already met; the rest are still in play.
      goalsMet += sum.met;
      goalsTotal += sum.met;
    } else {
      goalsMet += sum.met;
      goalsTotal += sum.goals.length;
    }
  }
  const from = addDays(current, -7 * (weeksBack - 1));
  const days = new Set<string>();
  for (const l of Object.values(data.logs)) if (l.date >= from && l.date <= today) days.add(l.date);
  const past = series.filter((w) => !w.current && w.pct !== null);
  const bestWeek = past.length ? past.reduce((b, w) => ((w.pct ?? 0) > (b.pct ?? 0) ? w : b)) : null;
  return { consistency: e > 0 ? a / e : null, goalsMet, goalsTotal, checkinDays: days.size, bestWeek };
}

export interface DayCell {
  date: DateKey;
  count: number;
  future: boolean;
}

export function heatmap(data: AppData, today: DateKey, weeks: number): DayCell[][] {
  const wso = data.settings.weekStartsOn;
  const current = startOfWeek(today, wso);
  const cols: DayCell[][] = [];
  const counts = new Map<string, number>();
  for (const l of Object.values(data.logs)) {
    const h = data.habits[l.habitId];
    if (h && l.count >= h.dailyTarget) counts.set(l.date, (counts.get(l.date) ?? 0) + 1);
  }
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(current, -7 * i);
    const col: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(ws, d);
      col.push({ date, count: counts.get(date) ?? 0, future: date > today });
    }
    cols.push(col);
  }
  return cols;
}

export interface MonthPoint {
  month: string; // YYYY-MM
  pct: number | null;
  checkins: number;
}

/** Average weekly goal completion of weeks starting in each month. */
export function monthSeries(data: AppData, today: DateKey, months: number): MonthPoint[] {
  const wso = data.settings.weekStartsOn;
  const out: MonthPoint[] = [];
  const t = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const first = `${month}-01`;
    let ws = startOfWeek(first, wso);
    if (ws < first) ws = addDays(ws, 7);
    let a = 0;
    let e = 0;
    while (ws.slice(0, 7) === month && ws <= today) {
      const s = weekScore(data, ws, today);
      a += s.achieved;
      e += s.expected;
      ws = addDays(ws, 7);
    }
    let checkins = 0;
    for (const l of Object.values(data.logs)) {
      const h = data.habits[l.habitId];
      if (h && l.date.startsWith(month) && l.count >= h.dailyTarget) checkins++;
    }
    out.push({ month, pct: e > 0 ? a / e : null, checkins });
  }
  return out;
}

export function compareWeeks(data: AppData, today: DateKey): { current: WeekSummary; previous: WeekSummary } {
  const ws = startOfWeek(today, data.settings.weekStartsOn);
  return { current: weekSummary(data, ws, today), previous: weekSummary(data, addDays(ws, -7), today) };
}

export function weekDayCompletion(data: AppData, weekStart: DateKey): { date: DateKey; done: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return { date, done: completionsOn(data, date).length };
  });
}

export function academicStats(data: AppData, from: DateKey, to: DateKey) {
  let done = 0;
  let onTime = 0;
  let pending = 0;
  for (const a of Object.values(data.academic)) {
    if (a.date < from || a.date > to) continue;
    if (a.status === 'concluido') {
      done++;
      if (!a.completedAt || toLocalKey(a.completedAt) <= a.date) onTime++;
    } else pending++;
  }
  return { done, onTime, pending };
}

function toLocalKey(isoStr: string): DateKey {
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function tasksDone(data: AppData, from: DateKey, to: DateKey): number {
  let n = 0;
  for (const t of Object.values(data.tasks)) {
    if (!t.done || !t.doneAt) continue;
    const k = toLocalKey(t.doneAt);
    if (k >= from && k <= to) n++;
  }
  return n;
}

export { isDayDone, endOfWeek };

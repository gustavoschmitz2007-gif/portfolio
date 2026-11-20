import { addDays, endOfWeek, rangeKeys, startOfWeek, toKey, weekDays, weekday, type DateKey } from './date';
import { logKey, type AppData, type Habit, type HabitLog } from './types';

export const createdDay = (h: Habit): DateKey => toKey(new Date(h.createdAt));
const archivedDay = (h: Habit): DateKey | null => (h.archivedAt ? toKey(new Date(h.archivedAt)) : null);

export function sortedHabits(data: AppData, includeArchived = false): Habit[] {
  return Object.values(data.habits)
    .filter((h) => includeArchived || !h.archived)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

export function getLog(data: AppData, habitId: string, date: DateKey): HabitLog | undefined {
  return data.logs[logKey(habitId, date)];
}

export function countOn(data: AppData, habitId: string, date: DateKey): number {
  return data.logs[logKey(habitId, date)]?.count ?? 0;
}

export function isDayDone(data: AppData, h: Habit, date: DateKey): boolean {
  return countOn(data, h.id, date) >= h.dailyTarget;
}

export function isScheduledOn(h: Habit, date: DateKey): boolean {
  if (h.frequency === 'weekly') return true;
  return h.days.includes(weekday(date));
}

/** Is this habit part of the goals for the given week? */
export function isActiveInWeek(data: AppData, h: Habit, weekStart: DateKey): boolean {
  const plan = data.weekPlans[weekStart];
  if (plan && h.id in plan.targets) return plan.targets[h.id] > 0;
  const end = endOfWeek(weekStart);
  if (createdDay(h) > end) return false;
  if (h.archived) {
    const a = archivedDay(h);
    if (!a || a < weekStart) return false;
  }
  return true;
}

export function weekTarget(data: AppData, h: Habit, weekStart: DateKey): number {
  const plan = data.weekPlans[weekStart];
  if (plan && h.id in plan.targets) return plan.targets[h.id];
  return h.weeklyTarget;
}

export function weekDoneCount(data: AppData, h: Habit, weekStart: DateKey): number {
  let n = 0;
  for (const d of weekDays(weekStart)) if (isDayDone(data, h, d)) n++;
  return n;
}

export function habitsForWeek(data: AppData, weekStart: DateKey): Habit[] {
  return Object.values(data.habits)
    .filter((h) => isActiveInWeek(data, h, weekStart))
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

export type GoalState = 'done' | 'on-track' | 'behind' | 'out-of-reach' | 'partial' | 'missed' | 'upcoming';

export interface GoalProgress {
  habit: Habit;
  target: number;
  done: number;
  pct: number;
  remaining: number;
  daysLeft: number;
  state: GoalState;
}

/** Days (including today) still available in the week for this habit. */
function remainingSlots(h: Habit, weekStart: DateKey, today: DateKey, data: AppData): number {
  const days = weekDays(weekStart).filter((d) => d >= today);
  return days.filter((d) => isScheduledOn(h, d) && !(d === today && isDayDone(data, h, d))).length;
}

export function goalProgress(data: AppData, h: Habit, weekStart: DateKey, today: DateKey): GoalProgress {
  const target = weekTarget(data, h, weekStart);
  const done = weekDoneCount(data, h, weekStart);
  const end = endOfWeek(weekStart);
  const pct = target > 0 ? Math.min(1, done / target) : 0;
  const remaining = Math.max(0, target - done);
  let state: GoalState;
  let daysLeft = 0;
  if (weekStart > today) state = 'upcoming';
  else if (end < today) state = done >= target ? 'done' : done > 0 ? 'partial' : 'missed';
  else {
    daysLeft = remainingSlots(h, weekStart, today, data);
    if (done >= target) state = 'done';
    else if (remaining > daysLeft) state = 'out-of-reach';
    else {
      // Pace: what fraction of the week (or scheduled days) has already passed (excluding today).
      const expected = expectedSoFar(h, target, weekStart, today);
      state = done + 0.001 >= Math.floor(expected) ? 'on-track' : 'behind';
    }
  }
  return { habit: h, target, done, pct, remaining, daysLeft, state };
}

/** First day the habit counts in this week (the creation day for the week it was created). */
function activeFrom(h: Habit, weekStart: DateKey): DateKey {
  const c = createdDay(h);
  return c > weekStart ? c : weekStart;
}

/** Days of the week on which the habit could be done (from its creation day on). */
function availableDays(h: Habit, weekStart: DateKey): DateKey[] {
  const from = activeFrom(h, weekStart);
  return weekDays(weekStart).filter((d) => d >= from && isScheduledOn(h, d));
}

/** Target for the week the habit was created: never more than the days it actually had. */
export function proratedTarget(h: Habit, target: number, weekStart: DateKey): number {
  if (activeFrom(h, weekStart) === weekStart) return target;
  return Math.min(target, availableDays(h, weekStart).length);
}

/** Initial goal written into a week plan (respects a mid-week creation). */
export function initialWeekTarget(h: Habit, weekStart: DateKey): number {
  return Math.max(1, proratedTarget(h, h.weeklyTarget, weekStart));
}

/** Expected completions before today (today is never counted against you). */
function expectedSoFar(h: Habit, target: number, weekStart: DateKey, today: DateKey): number {
  const avail = availableDays(h, weekStart);
  if (!avail.length) return 0;
  const before = avail.filter((d) => d < today).length;
  return (proratedTarget(h, target, weekStart) * before) / avail.length;
}

export interface WeekSummary {
  weekStart: DateKey;
  goals: GoalProgress[];
  target: number;
  achieved: number;
  pct: number;
  met: number;
}

export function weekSummary(data: AppData, weekStart: DateKey, today: DateKey): WeekSummary {
  const goals = habitsForWeek(data, weekStart).map((h) => goalProgress(data, h, weekStart, today)).filter((g) => g.target > 0);
  const target = goals.reduce((s, g) => s + g.target, 0);
  const achieved = goals.reduce((s, g) => s + Math.min(g.done, g.target), 0);
  return { weekStart, goals, target, achieved, pct: target ? achieved / target : 0, met: goals.filter((g) => g.done >= g.target).length };
}

/** Achieved vs expected for one week; the current week is pro-rated so you are never penalized for the future. */
export function weekScore(data: AppData, weekStart: DateKey, today: DateKey): { achieved: number; expected: number } {
  const end = endOfWeek(weekStart);
  if (weekStart > today) return { achieved: 0, expected: 0 };
  const partial = today <= end;
  let achieved = 0;
  let expected = 0;
  for (const h of habitsForWeek(data, weekStart)) {
    const target = weekTarget(data, h, weekStart);
    if (target <= 0) continue;
    const done = Math.min(weekDoneCount(data, h, weekStart), target);
    if (!partial) {
      achieved += done;
      expected += Math.max(proratedTarget(h, target, weekStart), done);
    } else {
      achieved += done;
      expected += Math.max(expectedSoFar(h, target, weekStart, today), done);
    }
  }
  return { achieved, expected };
}

export interface Consistency {
  score: number | null;
  previous: number | null;
  weeks: number;
}

/** Consistency over the last `weeks` weeks (current week pro-rated) vs the window before it. */
export function consistency(data: AppData, today: DateKey, weeks = 4): Consistency {
  const wso = data.settings.weekStartsOn;
  const current = startOfWeek(today, wso);
  const score = (startWeek: DateKey, count: number) => {
    let a = 0;
    let e = 0;
    for (let i = 0; i < count; i++) {
      const ws = addDays(startWeek, -7 * i);
      const s = weekScore(data, ws, today);
      a += s.achieved;
      e += s.expected;
    }
    return e > 0 ? a / e : null;
  };
  return { score: score(current, weeks), previous: score(addDays(current, -7 * weeks), weeks), weeks };
}

export function completionsOn(data: AppData, date: DateKey): Habit[] {
  return Object.values(data.habits).filter((h) => isDayDone(data, h, date));
}

/** Habits that make sense to show on "today": scheduled daily ones, and weekly ones not yet met (or done today). */
export function habitsForDay(data: AppData, date: DateKey): Habit[] {
  const ws = startOfWeek(date, data.settings.weekStartsOn);
  return sortedHabits(data).filter((h) => {
    if (!isActiveInWeek(data, h, ws) && !isDayDone(data, h, date)) return false;
    if (h.frequency === 'daily') return isScheduledOn(h, date) || countOn(data, h.id, date) > 0;
    return true;
  });
}

export function firstActivityDay(data: AppData): DateKey | null {
  let min: DateKey | null = null;
  for (const h of Object.values(data.habits)) {
    const c = createdDay(h);
    if (!min || c < min) min = c;
  }
  for (const l of Object.values(data.logs)) if (!min || l.date < min) min = l.date;
  return min;
}

export function daysWithAnyCompletion(data: AppData, habitIds: Set<string> | null, from: DateKey, to: DateKey): number {
  const days = new Set<string>();
  for (const l of Object.values(data.logs)) {
    if (l.date < from || l.date > to) continue;
    if (habitIds && !habitIds.has(l.habitId)) continue;
    const h = data.habits[l.habitId];
    if (h && l.count >= h.dailyTarget) days.add(l.date);
  }
  return days.size;
}

export { rangeKeys };

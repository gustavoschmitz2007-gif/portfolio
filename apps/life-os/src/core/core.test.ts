import { describe, expect, it } from 'vitest';
import { addDays, addMonths, startOfWeek, weekDays, countdownLabel, diffDays } from './date';
import { catchUpReminder, nextOccurrenceDay, occurrencesBetween } from './recurrence';
import { emptyData, makeHabit, normalizeData, normalizeReminder } from './defaults';
import { consistency, goalProgress, habitsForDay, initialWeekTarget, weekDoneCount, weekSummary } from './habits';
import { collectDue } from './due';
import { parseQuickTask } from './parse';
import { buildIcs } from './ics';
import { logKey, type AppData, type Habit } from './types';
import { habitStats, weekSeries } from './stats';

function withHabit(data: AppData, h: Partial<Habit> & { name: string }, createdAt = '2026-11-01T12:00:00.000Z'): Habit {
  const habit = makeHabit(h, Object.keys(data.habits).length);
  habit.createdAt = createdAt;
  data.habits[habit.id] = habit;
  return habit;
}
const log = (data: AppData, h: Habit, date: string, count = 1) => {
  data.logs[logKey(h.id, date)] = { habitId: h.id, date, count, updatedAt: '' };
};

describe('dates', () => {
  it('computes week start for Monday and Sunday weeks', () => {
    // 2026-11-20 is a Friday
    expect(startOfWeek('2026-11-20', 1)).toBe('2026-11-16');
    expect(startOfWeek('2026-11-20', 0)).toBe('2026-11-15');
    expect(startOfWeek('2026-11-16', 1)).toBe('2026-11-16');
    expect(startOfWeek('2026-11-22', 1)).toBe('2026-11-16');
    expect(weekDays('2026-11-16')).toHaveLength(7);
  });
  it('handles month/year boundaries and DST-free day math', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(diffDays('2026-02-27', '2026-03-02')).toBe(3);
  });
  it('labels deadlines', () => {
    expect(countdownLabel('2026-11-20', '2026-11-20')).toBe('Hoje');
    expect(countdownLabel('2026-11-21', '2026-11-20')).toBe('Amanhã');
    expect(countdownLabel('2026-11-18', '2026-11-20')).toBe('Atrasado 2 dias');
    expect(countdownLabel('2026-11-25', '2026-11-20')).toBe('em 5 dias');
  });
});

describe('recurrence', () => {
  it('expands weekly, weekdays and monthly rules', () => {
    expect(occurrencesBetween('2026-11-02', { type: 'weekly', days: [] }, '2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
    expect(occurrencesBetween('2026-11-20', { type: 'weekdays', days: [] }, '2026-11-20', '2026-11-24')).toEqual(['2026-11-20', '2026-11-23', '2026-11-24']);
    expect(nextOccurrenceDay('2026-01-31', { type: 'monthly', days: [] }, '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrenceDay('2026-01-31', { type: 'monthly', days: [] }, '2026-02-28')).toBe('2026-03-31');
    expect(nextOccurrenceDay('2026-11-20', { type: 'none', days: [] }, '2026-11-20')).toBeNull();
    expect(occurrencesBetween('2026-11-16', { type: 'custom', days: [2, 4] }, '2026-11-16', '2026-11-22')).toEqual(['2026-11-17', '2026-11-19']);
  });
  it('catches up stale repeating reminders to the latest missed occurrence', () => {
    const r = normalizeReminder({ title: 'Água', date: '2026-11-10', time: '09:00', repeat: { type: 'daily', days: [] } });
    const caught = catchUpReminder(r, new Date(2026, 10, 20, 10, 0));
    expect(caught.occurrence).toBe('2026-11-20T09:00');
    const early = catchUpReminder(r, new Date(2026, 10, 10, 8, 0));
    expect(early.occurrence).toBe('2026-11-10T09:00');
  });
});

describe('habits and weekly goals', () => {
  it('counts completions per week without mixing weeks', () => {
    const d = emptyData();
    const gym = withHabit(d, { name: 'Academia', frequency: 'weekly', weeklyTarget: 3 });
    log(d, gym, '2026-11-15'); // Sunday → previous Monday-week
    log(d, gym, '2026-11-16');
    log(d, gym, '2026-11-18');
    expect(weekDoneCount(d, gym, '2026-11-16')).toBe(2);
    expect(weekDoneCount(d, gym, '2026-11-09')).toBe(1);
  });

  it('uses the week plan snapshot for past weeks after the default changes', () => {
    const d = emptyData();
    const gym = withHabit(d, { name: 'Academia', frequency: 'weekly', weeklyTarget: 3 });
    d.weekPlans['2026-11-09'] = { weekStart: '2026-11-09', targets: { [gym.id]: 3 }, createdAt: '', updatedAt: '' };
    gym.weeklyTarget = 5;
    expect(goalProgress(d, gym, '2026-11-09', '2026-11-20').target).toBe(3);
    expect(goalProgress(d, gym, '2026-11-16', '2026-11-20').target).toBe(5);
  });

  it('daily habits with a count target only count once the day target is met', () => {
    const d = emptyData();
    const water = withHabit(d, { name: 'Água', frequency: 'daily', days: [0, 1, 2, 3, 4, 5, 6], weeklyTarget: 7, dailyTarget: 8 });
    log(d, water, '2026-11-16', 8);
    log(d, water, '2026-11-17', 5);
    expect(weekDoneCount(d, water, '2026-11-16')).toBe(1);
  });

  it('gives realistic goal states (no penalty for the future)', () => {
    const d = emptyData();
    const gym = withHabit(d, { name: 'Academia', frequency: 'weekly', weeklyTarget: 3 });
    // Monday, nothing done yet → still on track
    expect(goalProgress(d, gym, '2026-11-16', '2026-11-16').state).toBe('on-track');
    // Saturday with 0 done → 2 days left for 3 sessions → cannot close
    expect(goalProgress(d, gym, '2026-11-16', '2026-11-21').state).toBe('out-of-reach');
    log(d, gym, '2026-11-16');
    log(d, gym, '2026-11-17');
    log(d, gym, '2026-11-18');
    expect(goalProgress(d, gym, '2026-11-16', '2026-11-19').state).toBe('done');
  });

  it('weekly summary and consistency use real records only', () => {
    const d = emptyData();
    const gym = withHabit(d, { name: 'Academia', frequency: 'weekly', weeklyTarget: 2 });
    const diet = withHabit(d, { name: 'Dieta', frequency: 'daily', days: [0, 1, 2, 3, 4, 5, 6], weeklyTarget: 7 });
    expect(consistency(d, '2026-11-20').score).toBe(0);
    // Previous full week: gym 2/2, diet 7/7
    for (const day of weekDays('2026-11-09')) log(d, diet, day);
    log(d, gym, '2026-11-10');
    log(d, gym, '2026-11-12');
    const prev = weekSummary(d, '2026-11-09', '2026-11-20');
    expect(prev.pct).toBe(1);
    expect(prev.met).toBe(2);
    const c = consistency(d, '2026-11-20');
    expect(c.score).toBeGreaterThan(0);
    expect(c.score).toBeLessThan(1);
  });

  it('does not charge days before a habit existed', () => {
    const d = emptyData();
    // Created on Friday 20/11 (local noon) — Mon–Thu must not count as missed.
    const diet = withHabit(d, { name: 'Dieta', frequency: 'daily', days: [0, 1, 2, 3, 4, 5, 6], weeklyTarget: 7 }, new Date(2026, 10, 20, 12).toISOString());
    expect(consistency(d, '2026-11-20').score).toBeNull();
    log(d, diet, '2026-11-20');
    expect(consistency(d, '2026-11-20').score).toBe(1);
    expect(consistency(d, '2026-11-21').score).toBe(1);
  });

  it('first-week goal only counts the days left after creation', () => {
    const d = emptyData();
    const diet = withHabit(d, { name: 'Dieta', frequency: 'daily', days: [0, 1, 2, 3, 4, 5, 6], weeklyTarget: 7 }, new Date(2026, 10, 20, 12).toISOString());
    const gym = withHabit(d, { name: 'Academia', frequency: 'weekly', weeklyTarget: 3 }, new Date(2026, 10, 21, 12).toISOString());
    const study = withHabit(d, { name: 'Estudo', frequency: 'daily', days: [1, 2, 3, 4, 5], weeklyTarget: 5 }, new Date(2026, 10, 20, 12).toISOString());
    expect(initialWeekTarget(diet, '2026-11-16')).toBe(3);
    expect(initialWeekTarget(gym, '2026-11-16')).toBe(2);
    expect(initialWeekTarget(study, '2026-11-16')).toBe(1);
    expect(initialWeekTarget(diet, '2026-11-23')).toBe(7);
  });

  it('shows weekly habits on today until the goal is met', () => {
    const d = emptyData();
    d.settings.onboarded = true;
    const gym = withHabit(d, { name: 'Academia', frequency: 'weekly', weeklyTarget: 3 });
    const study = withHabit(d, { name: 'Estudar', frequency: 'daily', days: [1, 2, 3, 4, 5], weeklyTarget: 5 });
    const sat = habitsForDay(d, '2026-11-21').map((h) => h.id);
    expect(sat).toContain(gym.id);
    expect(sat).not.toContain(study.id);
  });

  it('stats series and per-habit rates', () => {
    const d = emptyData();
    const gym = withHabit(d, { name: 'Academia', frequency: 'weekly', weeklyTarget: 2 });
    log(d, gym, '2026-11-10');
    log(d, gym, '2026-11-12');
    log(d, gym, '2026-11-03');
    const series = weekSeries(d, '2026-11-20', 3);
    expect(series.map((w) => w.pct)).toEqual([0.5, 1, 0]);
    const s = habitStats(d, '2026-11-20', 3).find((x) => x.habit.id === gym.id)!;
    expect(s.daysDone).toBe(3);
    expect(s.weeksMet).toBe(1);
    expect(s.rate).toBe(0.75);
  });
});

describe('notifications', () => {
  it('collects due reminders, academic alerts and events inside the window', () => {
    const d = emptyData();
    const r = normalizeReminder({ id: 'r1', title: 'Entregar relatório', date: '2026-11-20', time: '10:00' });
    d.reminders[r.id] = r;
    d.academic['a1'] = normalizeData({ academic: [{ id: 'a1', title: 'Prova de Cálculo', type: 'prova', date: '2026-11-21', time: '08:00', alerts: [1, 0] }] }).academic['a1'];
    const due = collectDue(d, new Date(2026, 10, 20, 8, 0), new Date(2026, 10, 20, 10, 0));
    const keys = due.map((x) => x.key);
    expect(keys).toContain('r:r1:2026-11-20T10:00');
    expect(keys).toContain('a:a1:1:2026-11-21'); // 1 day before at 09:00
    // Same-day alert for an 08:00 exam is moved to 06:00
    const morning = collectDue(d, new Date(2026, 10, 21, 5, 0), new Date(2026, 10, 21, 6, 30));
    expect(morning.map((x) => x.key)).toContain('a:a1:0:2026-11-21');
  });

  it('respects snooze and done state', () => {
    const d = emptyData();
    const r = normalizeReminder({ id: 'r1', title: 'Cardio', date: '2026-11-20', time: '10:00', snoozedUntil: '2026-11-20T10:30' });
    d.reminders[r.id] = r;
    expect(collectDue(d, new Date(2026, 10, 20, 9, 0), new Date(2026, 10, 20, 10, 15))).toHaveLength(0);
    expect(collectDue(d, new Date(2026, 10, 20, 10, 15), new Date(2026, 10, 20, 10, 31))).toHaveLength(1);
    d.reminders[r.id] = { ...r, done: true };
    expect(collectDue(d, new Date(2026, 10, 20, 10, 15), new Date(2026, 10, 20, 10, 31))).toHaveLength(0);
  });
});

describe('quick task parser', () => {
  it('extracts time, priority and day', () => {
    expect(parseQuickTask('Estudar cálculo 14h !', '2026-11-20')).toEqual({ title: 'Estudar cálculo', time: '14:00', priority: 'high', date: null });
    expect(parseQuickTask('Comprar pão amanhã às 18:30', '2026-11-20')).toEqual({ title: 'Comprar pão', time: '18:30', priority: null, date: '2026-11-21' });
    expect(parseQuickTask('Ler 2 capítulos', '2026-11-20')).toEqual({ title: 'Ler 2 capítulos', time: null, priority: null, date: null });
  });
});

describe('backup / normalization', () => {
  it('round-trips data through JSON and drops invalid records', () => {
    const d = emptyData();
    const gym = withHabit(d, { name: 'Academia', frequency: 'weekly', weeklyTarget: 3 });
    log(d, gym, '2026-11-16');
    const json = JSON.parse(JSON.stringify({ ...d, logs: { ...d.logs, bad: { habitId: 'nope', date: 'x', count: 1 } } }));
    const back = normalizeData(json);
    expect(Object.keys(back.logs)).toEqual([logKey(gym.id, '2026-11-16')]);
    expect(back.habits[gym.id].name).toBe('Academia');
    expect(() => normalizeData('lixo')).toThrow();
    expect(() => normalizeData({ schemaVersion: 999 })).toThrow();
  });
  it('exports a valid iCalendar file', () => {
    const d = emptyData();
    d.reminders['r1'] = normalizeReminder({ id: 'r1', title: 'Pagar, conta; luz', date: '2026-11-20', time: '10:00', repeat: { type: 'weekly', days: [] } });
    const ics = buildIcs(d);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20261120T100000');
    expect(ics).toContain('RRULE:FREQ=WEEKLY');
    expect(ics).toContain('Pagar\\, conta\\; luz');
    expect(ics).toContain('BEGIN:VALARM');
  });
});

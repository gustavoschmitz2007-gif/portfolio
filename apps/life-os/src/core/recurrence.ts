import { addDays, addMonths, diffDays, fromKey, parseLocal, toLocalDateTime, weekday, type DateKey, type LocalDateTime } from './date';
import type { Reminder, Repeat } from './types';

/** Does a repeating rule that starts on `start` produce an occurrence on `day`? */
export function occursOn(start: DateKey, repeat: Repeat, day: DateKey): boolean {
  if (day < start) return false;
  switch (repeat.type) {
    case 'none':
      return day === start;
    case 'daily':
      return true;
    case 'weekdays': {
      const wd = weekday(day);
      return wd >= 1 && wd <= 5;
    }
    case 'weekly':
      return diffDays(start, day) % 7 === 0;
    case 'custom':
      return repeat.days.length ? repeat.days.includes(weekday(day)) : diffDays(start, day) % 7 === 0;
    case 'monthly': {
      const s = fromKey(start);
      const d = fromKey(day);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(s.getDate(), last);
    }
  }
}

/** All occurrence days of a rule within [from, to]. */
export function occurrencesBetween(start: DateKey, repeat: Repeat, from: DateKey, to: DateKey): DateKey[] {
  if (to < start) return [];
  if (repeat.type === 'none') return start >= from && start <= to ? [start] : [];
  const out: DateKey[] = [];
  let k = from < start ? start : from;
  let guard = 0;
  while (k <= to && guard < 800) {
    if (occursOn(start, repeat, k)) out.push(k);
    k = addDays(k, 1);
    guard++;
  }
  return out;
}

/** First occurrence day strictly after `after` (null for non-repeating). */
export function nextOccurrenceDay(start: DateKey, repeat: Repeat, after: DateKey): DateKey | null {
  if (repeat.type === 'none') return null;
  if (repeat.type === 'monthly') {
    // Jump straight to the right month (addMonths clamps to the month's last day).
    const base = after < start ? 0 : monthsBetween(start, after);
    for (let i = 0; i < 3; i++) {
      const candidate = addMonths(start, base + i);
      if (candidate > after) return candidate;
    }
    return null;
  }
  let k = addDays(after < start ? addDays(start, -1) : after, 1);
  for (let i = 0; i < 400; i++) {
    if (occursOn(start, repeat, k)) return k;
    k = addDays(k, 1);
  }
  return null;
}

function monthsBetween(a: DateKey, b: DateKey): number {
  const da = fromKey(a);
  const db = fromKey(b);
  return Math.max(0, (db.getFullYear() - da.getFullYear()) * 12 + db.getMonth() - da.getMonth());
}

export function reminderFireAt(r: Reminder): LocalDateTime {
  return r.snoozedUntil ?? r.occurrence;
}

/** Occurrence that follows the reminder's current one (null if it doesn't repeat). */
export function nextReminderOccurrence(r: Reminder): LocalDateTime | null {
  const day = nextOccurrenceDay(r.date, r.repeat, r.occurrence.slice(0, 10));
  return day ? toLocalDateTime(day, r.time) : null;
}

/**
 * For repeating reminders that were not handled for a while, skip stale
 * occurrences so only the most recent missed one stays pending.
 */
export function catchUpReminder(r: Reminder, now: Date): Reminder {
  if (r.done || r.repeat.type === 'none') return r;
  let occ = r.occurrence;
  let changed = false;
  for (let i = 0; i < 500; i++) {
    const nextDay = nextOccurrenceDay(r.date, r.repeat, occ.slice(0, 10));
    if (!nextDay) break;
    const next = toLocalDateTime(nextDay, r.time);
    if (parseLocal(next) <= now) {
      occ = next;
      changed = true;
    } else break;
  }
  if (!changed) return r;
  return { ...r, occurrence: occ, snoozedUntil: null };
}

export const REPEAT_LABELS: Record<Repeat['type'], string> = {
  none: 'Não repete',
  daily: 'Todos os dias',
  weekdays: 'Dias úteis (seg–sex)',
  weekly: 'Toda semana',
  monthly: 'Todo mês',
  custom: 'Dias específicos',
};

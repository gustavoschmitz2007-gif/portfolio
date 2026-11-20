// Date helpers based on local calendar days.
// Dates are stored as "YYYY-MM-DD" keys (DateKey) and times as "HH:mm".
// Local date-times are stored as "YYYY-MM-DDTHH:mm" (no timezone; interpreted locally).

export type DateKey = string;
export type TimeStr = string;
export type LocalDateTime = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function todayKey(now = new Date()): DateKey {
  return toKey(now);
}

export function isDateKey(v: unknown): v is DateKey {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function isTime(v: unknown): v is TimeStr {
  return typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);
}

export function addDays(key: DateKey, n: number): DateKey {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function addMonths(key: DateKey, n: number): DateKey {
  const d = fromKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toKey(d);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: DateKey, b: DateKey): number {
  const da = fromKey(a);
  const db = fromKey(b);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function weekday(key: DateKey): number {
  return fromKey(key).getDay();
}

export function startOfWeek(key: DateKey, weekStartsOn: 0 | 1): DateKey {
  const wd = weekday(key);
  const diff = (wd - weekStartsOn + 7) % 7;
  return addDays(key, -diff);
}

export function weekDays(weekStart: DateKey): DateKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function endOfWeek(weekStart: DateKey): DateKey {
  return addDays(weekStart, 6);
}

export function startOfMonth(key: DateKey): DateKey {
  return key.slice(0, 8) + '01';
}

export function daysInMonth(key: DateKey): number {
  const d = fromKey(key);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function endOfMonth(key: DateKey): DateKey {
  return key.slice(0, 8) + pad(daysInMonth(key));
}

export function monthKey(key: DateKey): string {
  return key.slice(0, 7);
}

export function rangeKeys(start: DateKey, end: DateKey): DateKey[] {
  const out: DateKey[] = [];
  let k = start;
  let guard = 0;
  while (k <= end && guard < 4000) {
    out.push(k);
    k = addDays(k, 1);
    guard++;
  }
  return out;
}

export function nowLocal(now = new Date()): LocalDateTime {
  return `${toKey(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function toLocalDateTime(key: DateKey, time: TimeStr | null | undefined): LocalDateTime {
  return `${key}T${time && isTime(time) ? time : '00:00'}`;
}

export function parseLocal(ldt: LocalDateTime): Date {
  const [k, t = '00:00'] = ldt.split('T');
  const d = fromKey(k);
  const [h, m] = t.split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export function localFromDate(d: Date): LocalDateTime {
  return nowLocal(d);
}

export function timeOf(ldt: LocalDateTime): TimeStr {
  return ldt.slice(11, 16);
}

export function dateOf(ldt: LocalDateTime): DateKey {
  return ldt.slice(0, 10);
}

export function addMinutesLocal(ldt: LocalDateTime, minutes: number): LocalDateTime {
  const d = parseLocal(ldt);
  d.setMinutes(d.getMinutes() + minutes);
  return localFromDate(d);
}

export function minutesOf(t: TimeStr): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// ---------- Formatting (pt-BR) ----------

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions) {
  const k = JSON.stringify(opts);
  let f = fmtCache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat('pt-BR', opts);
    fmtCache.set(k, f);
  }
  return f;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function formatLongDate(key: DateKey): string {
  // "Sexta-feira, 20 de novembro"
  return cap(fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(fromKey(key)));
}

export function formatDayMonth(key: DateKey): string {
  // "20 nov"
  return fmt({ day: 'numeric', month: 'short' }).format(fromKey(key)).replace('.', '').replace(' de ', ' ');
}

export function formatDayMonthYear(key: DateKey): string {
  return fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(fromKey(key)).replace(/\./g, '').replace(/ de /g, ' ');
}

export function formatMonthYear(key: DateKey): string {
  return cap(fmt({ month: 'long', year: 'numeric' }).format(fromKey(key)));
}

export function formatMonthShort(key: DateKey): string {
  return cap(fmt({ month: 'short' }).format(fromKey(key)).replace('.', ''));
}

export function weekdayShort(key: DateKey): string {
  return cap(fmt({ weekday: 'short' }).format(fromKey(key)).replace('.', ''));
}

export function weekdayLong(key: DateKey): string {
  return cap(fmt({ weekday: 'long' }).format(fromKey(key)));
}

export const WEEKDAY_LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAY_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function orderedWeekdays(weekStartsOn: 0 | 1): number[] {
  return Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);
}

export function formatWeekRange(weekStart: DateKey): string {
  const end = endOfWeek(weekStart);
  const s = fromKey(weekStart);
  const e = fromKey(end);
  const month = (d: Date) => fmt({ month: 'short' }).format(d).replace('.', '');
  if (s.getMonth() === e.getMonth()) return `${s.getDate()} – ${e.getDate()} ${month(e)}`;
  return `${s.getDate()} ${month(s)} – ${e.getDate()} ${month(e)}`;
}

/** ISO week number (used only as a friendly label). */
export function isoWeekNumber(key: DateKey): number {
  const d = fromKey(key);
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export function relativeDayLabel(key: DateKey, today: DateKey): string {
  const d = diffDays(today, key);
  if (d === 0) return 'Hoje';
  if (d === 1) return 'Amanhã';
  if (d === -1) return 'Ontem';
  if (d > 1 && d < 7) return weekdayLong(key);
  return formatDayMonth(key);
}

export function countdownLabel(key: DateKey, today: DateKey): string {
  const d = diffDays(today, key);
  if (d === 0) return 'Hoje';
  if (d === 1) return 'Amanhã';
  if (d === -1) return 'Atrasado 1 dia';
  if (d < 0) return `Atrasado ${-d} dias`;
  if (d < 7) return `em ${d} dias`;
  if (d < 14) return 'em 1 semana';
  if (d < 60) return `em ${Math.floor(d / 7)} semanas`;
  return formatDayMonth(key);
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Boa noite';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

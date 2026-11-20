// iCalendar (.ics) export so the phone's own calendar can deliver alerts even with LIFE OS closed.
import { addDays, addMinutesLocal, minutesOf, type DateKey, type TimeStr } from './date';
import type { AcademicItem, AppData, CalendarEvent, Reminder, Repeat } from './types';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

function fold(line: string): string {
  // RFC 5545: lines longer than 75 octets are folded.
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
}

const dateVal = (k: DateKey) => k.replace(/-/g, '');
const dateTimeVal = (k: DateKey, t: TimeStr) => `${dateVal(k)}T${t.replace(':', '')}00`;
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function rrule(r: Repeat): string | null {
  const map = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  switch (r.type) {
    case 'daily':
      return 'RRULE:FREQ=DAILY';
    case 'weekdays':
      return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    case 'weekly':
      return 'RRULE:FREQ=WEEKLY';
    case 'monthly':
      return 'RRULE:FREQ=MONTHLY';
    case 'custom':
      return r.days.length ? `RRULE:FREQ=WEEKLY;BYDAY=${r.days.map((d) => map[d]).join(',')}` : 'RRULE:FREQ=WEEKLY';
    default:
      return null;
  }
}

function alarm(minutesBefore: number, text: string): string[] {
  return ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(text)}`, `TRIGGER:-PT${Math.max(0, Math.round(minutesBefore))}M`, 'END:VALARM'];
}

function reminderVEvent(r: Reminder): string[] {
  const day = r.occurrence.slice(0, 10);
  const time = r.occurrence.slice(11, 16);
  const end = addMinutesLocal(r.occurrence, 15);
  const lines = [
    'BEGIN:VEVENT',
    `UID:reminder-${r.id}@lifeos`,
    `DTSTAMP:${stamp()}`,
    `DTSTART:${dateTimeVal(day, time)}`,
    `DTEND:${dateTimeVal(end.slice(0, 10), end.slice(11, 16))}`,
    `SUMMARY:${esc('🔔 ' + r.title)}`,
  ];
  if (r.description) lines.push(`DESCRIPTION:${esc(r.description)}`);
  const rr = rrule(r.repeat);
  if (rr) lines.push(rr);
  lines.push(...alarm(0, r.title), 'END:VEVENT');
  return lines;
}

const TYPE: Record<string, string> = { trabalho: 'Trabalho', prova: 'Prova', apresentacao: 'Apresentação', atividade: 'Atividade', relatorio: 'Relatório', outro: 'Entrega' };

function academicVEvent(a: AcademicItem, data: AppData): string[] {
  const subject = a.subjectId ? data.subjects[a.subjectId]?.name : '';
  const summary = `${TYPE[a.type] ?? 'Entrega'}: ${a.title}${subject ? ` (${subject})` : ''}`;
  const lines = ['BEGIN:VEVENT', `UID:academic-${a.id}@lifeos`, `DTSTAMP:${stamp()}`];
  if (a.time) {
    const startMin = minutesOf(a.time);
    const endMin = Math.min(startMin + 60, 23 * 60 + 59);
    const endT = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    lines.push(`DTSTART:${dateTimeVal(a.date, a.time)}`, `DTEND:${dateTimeVal(a.date, endT)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${dateVal(a.date)}`, `DTEND;VALUE=DATE:${dateVal(addDays(a.date, 1))}`);
  }
  lines.push(`SUMMARY:${esc(summary)}`);
  const desc = [a.description, a.notes].filter(Boolean).join('\n\n');
  if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
  for (const before of a.alerts) {
    // For all-day items the trigger is relative to 00:00; aim for ~9h on the alert day.
    const minutes = a.time ? before * 1440 + 120 : before * 1440 - 540;
    lines.push(...alarm(Math.max(0, minutes), summary));
  }
  lines.push('END:VEVENT');
  return lines;
}

function eventVEvent(e: CalendarEvent): string[] {
  const lines = ['BEGIN:VEVENT', `UID:event-${e.id}@lifeos`, `DTSTAMP:${stamp()}`];
  if (e.allDay || !e.time) {
    lines.push(`DTSTART;VALUE=DATE:${dateVal(e.date)}`, `DTEND;VALUE=DATE:${dateVal(addDays(e.date, 1))}`);
  } else {
    const end = e.endTime && e.endTime > e.time ? e.endTime : addMinutesLocal(`${e.date}T${e.time}`, 60).slice(11, 16);
    lines.push(`DTSTART:${dateTimeVal(e.date, e.time)}`, `DTEND:${dateTimeVal(e.date, end)}`);
  }
  lines.push(`SUMMARY:${esc(e.title)}`);
  if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
  if (e.notes) lines.push(`DESCRIPTION:${esc(e.notes)}`);
  const rr = rrule(e.repeat);
  if (rr) lines.push(rr);
  if (e.alertMinutes !== null && e.time && !e.allDay) lines.push(...alarm(e.alertMinutes, e.title));
  lines.push('END:VEVENT');
  return lines;
}

export interface IcsOptions {
  reminders?: boolean;
  academic?: boolean;
  events?: boolean;
}

export function buildIcs(data: AppData, opts: IcsOptions = { reminders: true, academic: true, events: true }, only?: { kind: 'reminder' | 'academic' | 'event'; id: string }): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LIFE OS//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:LIFE OS'];
  const want = (kind: 'reminder' | 'academic' | 'event', id: string) => !only || (only.kind === kind && only.id === id);
  if (opts.reminders) for (const r of Object.values(data.reminders)) if (!r.done && want('reminder', r.id)) lines.push(...reminderVEvent(r));
  if (opts.academic) for (const a of Object.values(data.academic)) if (a.status !== 'concluido' && want('academic', a.id)) lines.push(...academicVEvent(a, data));
  if (opts.events) for (const e of Object.values(data.events)) if (want('event', e.id)) lines.push(...eventVEvent(e));
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

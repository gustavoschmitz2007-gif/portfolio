import { addDays, type DateKey, type TimeStr } from './date';
import { occurrencesBetween } from './recurrence';
import type { AppData, ColorKey, Priority } from './types';

export type AgendaKind = 'event' | 'task' | 'reminder' | 'academic';

export interface AgendaItem {
  key: string;
  kind: AgendaKind;
  id: string;
  date: DateKey;
  time: TimeStr | null;
  endTime: TimeStr | null;
  title: string;
  sub: string;
  color: ColorKey;
  done: boolean;
  priority: Priority | null;
  /** For reminders: the pending occurrence is the "current" one (actionable). */
  current: boolean;
}

export interface AgendaFilter {
  event?: boolean;
  task?: boolean;
  reminder?: boolean;
  academic?: boolean;
}

const ACADEMIC_LABEL: Record<string, string> = {
  trabalho: 'Trabalho',
  prova: 'Prova',
  apresentacao: 'Apresentação',
  atividade: 'Atividade',
  relatorio: 'Relatório',
  outro: 'Entrega',
};

export function agendaBetween(data: AppData, from: DateKey, to: DateKey, filter: AgendaFilter = {}): AgendaItem[] {
  const want = (k: AgendaKind) => filter[k] !== false;
  const out: AgendaItem[] = [];
  const areaColor = (id: string | null, fallback: ColorKey): ColorKey => (id && data.areas[id]?.color) || fallback;
  const areaName = (id: string | null) => (id && data.areas[id]?.name) || '';

  if (want('event')) {
    for (const e of Object.values(data.events)) {
      for (const day of occurrencesBetween(e.date, e.repeat, from, to)) {
        out.push({
          key: `e:${e.id}:${day}`,
          kind: 'event',
          id: e.id,
          date: day,
          time: e.allDay ? null : e.time,
          endTime: e.allDay ? null : e.endTime,
          title: e.title,
          sub: [e.location, areaName(e.areaId)].filter(Boolean).join(' · '),
          color: areaColor(e.areaId, 'blue'),
          done: false,
          priority: null,
          current: true,
        });
      }
    }
  }

  if (want('task')) {
    for (const t of Object.values(data.tasks)) {
      if (!t.date || t.date < from || t.date > to) continue;
      out.push({
        key: `t:${t.id}`,
        kind: 'task',
        id: t.id,
        date: t.date,
        time: t.time,
        endTime: null,
        title: t.title,
        sub: areaName(t.areaId),
        color: areaColor(t.areaId, 'slate'),
        done: t.done,
        priority: t.priority,
        current: true,
      });
    }
  }

  if (want('reminder')) {
    for (const r of Object.values(data.reminders)) {
      const occDay = r.occurrence.slice(0, 10);
      if (r.done) {
        if (occDay >= from && occDay <= to)
          out.push({ key: `r:${r.id}:${occDay}`, kind: 'reminder', id: r.id, date: occDay, time: r.time, endTime: null, title: r.title, sub: 'Concluído', color: areaColor(r.areaId, 'yellow'), done: true, priority: null, current: false });
        continue;
      }
      const days = r.repeat.type === 'none' ? (occDay >= from && occDay <= to ? [occDay] : []) : occurrencesBetween(r.date, r.repeat, occDay > from ? occDay : from, to);
      for (const day of days) {
        const isCurrent = day === occDay;
        const snooze = isCurrent && r.snoozedUntil ? `Adiado para ${r.snoozedUntil.slice(11, 16)}` : '';
        out.push({
          key: `r:${r.id}:${day}`,
          kind: 'reminder',
          id: r.id,
          date: day,
          time: r.time,
          endTime: null,
          title: r.title,
          sub: snooze || r.description,
          color: areaColor(r.areaId, 'yellow'),
          done: false,
          priority: null,
          current: isCurrent,
        });
      }
    }
  }

  if (want('academic')) {
    for (const a of Object.values(data.academic)) {
      if (a.date < from || a.date > to) continue;
      const subj = a.subjectId ? data.subjects[a.subjectId] : null;
      out.push({
        key: `a:${a.id}`,
        kind: 'academic',
        id: a.id,
        date: a.date,
        time: a.time,
        endTime: null,
        title: a.title,
        sub: [ACADEMIC_LABEL[a.type], subj?.name].filter(Boolean).join(' · '),
        color: subj?.color ?? 'violet',
        done: a.status === 'concluido',
        priority: a.priority,
        current: true,
      });
    }
  }

  return out.sort(compareAgenda);
}

export function compareAgenda(a: AgendaItem, b: AgendaItem): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  // All-day/untimed items first, then by time.
  const ta = a.time ?? '';
  const tb = b.time ?? '';
  if (ta !== tb) return ta === '' ? -1 : tb === '' ? 1 : ta.localeCompare(tb);
  const order: Record<AgendaKind, number> = { academic: 0, event: 1, reminder: 2, task: 3 };
  return order[a.kind] - order[b.kind];
}

export function agendaByDay(items: AgendaItem[]): Map<DateKey, AgendaItem[]> {
  const m = new Map<DateKey, AgendaItem[]>();
  for (const it of items) {
    const list = m.get(it.date);
    if (list) list.push(it);
    else m.set(it.date, [it]);
  }
  return m;
}

export { addDays };

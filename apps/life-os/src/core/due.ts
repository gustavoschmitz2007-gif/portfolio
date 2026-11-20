// Computes which notifications are due. Pure: shared by the app scheduler and the service worker.
import { addDays, addMinutesLocal, minutesOf, parseLocal, toKey, toLocalDateTime, type LocalDateTime } from './date';
import { isDayDone, isScheduledOn, isActiveInWeek, weekDoneCount, weekTarget } from './habits';
import { catchUpReminder, occurrencesBetween, reminderFireAt } from './recurrence';
import { startOfWeek } from './date';
import type { AppData } from './types';

export interface DueNotification {
  key: string;
  at: LocalDateTime;
  title: string;
  body: string;
  url: string;
  kind: 'reminder' | 'habit' | 'task' | 'event' | 'academic';
  refId: string;
}

const TYPE_LABEL: Record<string, string> = {
  trabalho: 'Trabalho',
  prova: 'Prova',
  apresentacao: 'Apresentação',
  atividade: 'Atividade',
  relatorio: 'Relatório',
  outro: 'Entrega',
};

/**
 * All notifications whose time falls in (from, to]. Callers dedupe with the
 * "notified" keys store.
 */
export function collectDue(data: AppData, from: Date, to: Date): DueNotification[] {
  const out: DueNotification[] = [];
  const prefs = data.settings.notifications;
  const inWindow = (ldt: LocalDateTime) => {
    const t = parseLocal(ldt).getTime();
    return t > from.getTime() && t <= to.getTime();
  };
  const fromKey = toKey(from);
  const toKeyStr = toKey(to);

  if (prefs.reminders) {
    for (const raw of Object.values(data.reminders)) {
      if (raw.done) continue;
      const r = catchUpReminder(raw, to);
      const at = reminderFireAt(r);
      if (inWindow(at)) {
        out.push({
          key: `r:${r.id}:${at}`,
          at,
          title: r.title,
          body: r.description || 'Lembrete do LIFE OS',
          url: '#/lembretes',
          kind: 'reminder',
          refId: r.id,
        });
      }
    }
  }

  // Iterate the calendar days spanned by the window (usually 1-2 days).
  const days: string[] = [];
  for (let k = fromKey, i = 0; k <= toKeyStr && i < 3; k = addDays(k, 1), i++) days.push(k);

  if (prefs.habits) {
    for (const h of Object.values(data.habits)) {
      if (h.archived || !h.remind || !h.time) continue;
      for (const day of days) {
        const ws = startOfWeek(day, data.settings.weekStartsOn);
        if (!isActiveInWeek(data, h, ws) || !isScheduledOn(h, day) || isDayDone(data, h, day)) continue;
        if (h.frequency === 'weekly' && weekDoneCount(data, h, ws) >= weekTarget(data, h, ws)) continue;
        const at = toLocalDateTime(day, h.time);
        if (inWindow(at)) {
          out.push({ key: `h:${h.id}:${day}`, at, title: h.name, body: 'Hora do seu hábito. Toque para registrar.', url: '#/habitos', kind: 'habit', refId: h.id });
        }
      }
    }
  }

  if (prefs.tasks) {
    for (const t of Object.values(data.tasks)) {
      if (t.done || !t.remind || !t.date || !t.time) continue;
      const at = toLocalDateTime(t.date, t.time);
      if (inWindow(at)) out.push({ key: `t:${t.id}:${at}`, at, title: t.title, body: 'Tarefa agendada para agora.', url: '#/planejar', kind: 'task', refId: t.id });
    }
  }

  if (prefs.events) {
    for (const e of Object.values(data.events)) {
      if (e.allDay || !e.time || e.alertMinutes === null) continue;
      // An alert today may belong to an event later today or tomorrow.
      const startDays = occurrencesBetween(e.date, e.repeat, fromKey, addDays(toKeyStr, 7));
      for (const d of startDays) {
        const start = toLocalDateTime(d, e.time);
        const at = addMinutesLocal(start, -e.alertMinutes);
        if (inWindow(at)) {
          const when = e.alertMinutes === 0 ? 'Começa agora' : `Começa às ${e.time}`;
          out.push({ key: `e:${e.id}:${start}`, at, title: e.title, body: e.location ? `${when} · ${e.location}` : when, url: '#/agenda', kind: 'event', refId: e.id });
        }
      }
    }
  }

  if (prefs.academic) {
    for (const a of Object.values(data.academic)) {
      if (a.status === 'concluido') continue;
      for (const before of a.alerts) {
        const day = addDays(a.date, -before);
        let time = prefs.academicTime;
        if (before === 0 && a.time) {
          // Same-day alert: at the configured time, or 2h before if the item happens earlier.
          const m = Math.max(0, minutesOf(a.time) - 120);
          if (m < minutesOf(time)) time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        }
        const at = toLocalDateTime(day, time);
        if (!inWindow(at)) continue;
        const label = TYPE_LABEL[a.type] ?? 'Entrega';
        const subject = a.subjectId ? data.subjects[a.subjectId]?.name : '';
        const whenTxt = before === 0 ? `é hoje${a.time ? ` às ${a.time}` : ''}` : before === 1 ? 'é amanhã' : `em ${before} dias`;
        out.push({
          key: `a:${a.id}:${before}:${a.date}`,
          at,
          title: `${label} ${whenTxt}`,
          body: subject ? `${a.title} · ${subject}` : a.title,
          url: '#/faculdade',
          kind: 'academic',
          refId: a.id,
        });
      }
    }
  }

  return out.sort((x, y) => x.at.localeCompare(y.at));
}

/** Next notification time after `now` (within the next 48h), to schedule a precise timer. */
export function nextDueTime(data: AppData, now: Date): Date | null {
  const horizon = new Date(now.getTime() + 48 * 3600 * 1000);
  const list = collectDue(data, now, horizon);
  return list.length ? parseLocal(list[0].at) : null;
}

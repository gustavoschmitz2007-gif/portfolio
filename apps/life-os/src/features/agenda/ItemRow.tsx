import { AlarmClock, Bell, CalendarDays, Check, GraduationCap, Repeat } from 'lucide-react';
import type { AgendaItem } from '../../core/agenda';
import { actions, getData } from '../../store/store';
import { openSheet, toastUndo } from '../../store/ui';
import { cx } from '../../ui/components';

export function openAgendaItem(it: Pick<AgendaItem, 'kind' | 'id'>) {
  if (it.kind === 'task') openSheet({ kind: 'task', id: it.id });
  else if (it.kind === 'reminder') openSheet({ kind: 'reminder', id: it.id });
  else if (it.kind === 'academic') openSheet({ kind: 'academicDetail', id: it.id });
  else openSheet({ kind: 'event', id: it.id });
}

export function toggleAgendaItem(it: AgendaItem) {
  if (it.kind === 'task') {
    const t = getData().tasks[it.id];
    actions.toggleTask(it.id);
    if (t && !t.done) toastUndo('Tarefa concluída', () => actions.toggleTask(it.id), 'success');
  } else if (it.kind === 'reminder') {
    if (it.done) {
      actions.reopenReminder(it.id);
      return;
    }
    const undo = actions.completeReminder(it.id);
    toastUndo('Lembrete concluído', undo, 'success');
  } else if (it.kind === 'academic') {
    const a = getData().academic[it.id];
    if (!a) return;
    const prev = a.status;
    actions.setAcademicStatus(it.id, prev === 'concluido' ? 'pendente' : 'concluido');
    if (prev !== 'concluido') toastUndo('Atividade concluída 🎓', () => actions.setAcademicStatus(it.id, prev), 'success');
  }
}

const KIND_ICON = {
  event: CalendarDays,
  reminder: Bell,
  academic: GraduationCap,
  task: Check,
};

export function AgendaRow({ item: it, showDate, overdueLabel }: { item: AgendaItem; showDate?: string; overdueLabel?: string }) {
  const Icon = KIND_ICON[it.kind];
  const checkable = it.kind !== 'event' && it.current;
  const reminder = it.kind === 'reminder' ? getData().reminders[it.id] : null;
  const subText = [overdueLabel, showDate, kindLabel(it), it.sub].filter(Boolean).join(' · ');
  return (
    <div className={cx('agenda-row', `hue-${it.color}`, it.done && 'done', `kind-${it.kind}`)}>
      <div className="agenda-time">
        {it.time ? <span className="num">{it.time}</span> : <span className="faint">{it.kind === 'event' ? 'Dia todo' : '—'}</span>}
        {it.endTime && <span className="faint">{it.endTime}</span>}
      </div>
      <span className="agenda-bar" />
      <button className="agenda-main" onClick={() => openAgendaItem(it)}>
        <div className="agenda-title truncate">{it.title}</div>
        {subText && (
          <div className="agenda-sub">
            <Icon size={13} />
            <span className="truncate">{subText}</span>
            {reminder && reminder.repeat.type !== 'none' && <Repeat size={12} />}
          </div>
        )}
      </button>
      {it.kind === 'reminder' && !it.done && it.current && (
        <button className="icon-btn icon-btn-sm" aria-label="Adiar" title="Adiar" onClick={() => openSheet({ kind: 'snooze', id: it.id })}>
          <AlarmClock size={16} />
        </button>
      )}
      {checkable && (
        <button
          className={cx('check', it.done && 'on', it.kind === 'task' && it.priority === 'high' && !it.done && 'check-prio-high')}
          aria-label={it.done ? 'Desmarcar' : 'Concluir'}
          aria-pressed={it.done}
          onClick={() => toggleAgendaItem(it)}
        >
          <Check size={14} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

function kindLabel(it: AgendaItem): string {
  if (it.kind === 'reminder') return 'Lembrete';
  if (it.kind === 'event') return '';
  if (it.kind === 'task') return it.priority === 'high' ? 'Prioridade alta' : '';
  return '';
}

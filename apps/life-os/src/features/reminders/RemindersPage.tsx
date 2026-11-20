import { useMemo, useState } from 'react';
import { AlarmClock, Bell, CalendarPlus, Check, ChevronDown, Pencil, Plus, Repeat, RotateCcw, Trash2 } from 'lucide-react';
import { dateOf, relativeDayLabel, timeOf } from '../../core/date';
import { REPEAT_LABELS, reminderFireAt } from '../../core/recurrence';
import type { Reminder } from '../../core/types';
import { actions, getData, useData } from '../../store/store';
import { useMinute, useToday } from '../../store/clock';
import { openSheet, toastUndo } from '../../store/ui';
import { cx, Empty, Menu } from '../../ui/components';
import { PlannerSubnav } from '../habits/Subnav';
import { NotificationNotice } from './NotificationNotice';
import { downloadIcs } from '../settings/backup';

export default function RemindersPage() {
  const data = useData();
  const today = useToday();
  const minute = useMinute();
  const [showDone, setShowDone] = useState(false);

  const groups = useMemo(() => {
    const pending = Object.values(data.reminders).filter((r) => !r.done);
    const at = (r: Reminder) => reminderFireAt(r);
    pending.sort((a, b) => at(a).localeCompare(at(b)));
    return {
      overdue: pending.filter((r) => at(r) <= minute),
      today: pending.filter((r) => at(r) > minute && dateOf(at(r)) === today),
      upcoming: pending.filter((r) => dateOf(at(r)) > today),
      done: Object.values(data.reminders)
        .filter((r) => r.done)
        .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
        .slice(0, 30),
    };
  }, [data.reminders, minute, today]);

  const total = Object.keys(data.reminders).length;

  return (
    <div className="page page-narrow">
      <PlannerSubnav />
      <div className="page-head">
        <div>
          <h1 className="page-title">Lembretes</h1>
          <p className="page-sub">Com horário, repetição e adiamento.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => openSheet({ kind: 'reminder' })}>
            <Plus size={17} /> Novo lembrete
          </button>
        </div>
      </div>

      <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
        <NotificationNotice />

        {total === 0 && (
          <div className="card">
            <Empty
              icon={<Bell size={24} />}
              title="Nenhum lembrete"
              text="Crie lembretes para entregar trabalhos, estudar, ir à academia, comprar algo ou comparecer a compromissos."
              action={
                <button className="btn btn-accent" onClick={() => openSheet({ kind: 'reminder' })}>
                  <Plus size={17} /> Criar lembrete
                </button>
              }
            />
          </div>
        )}

        {groups.overdue.length > 0 && (
          <Group title="Pendentes" badge={<span className="badge badge-danger">{groups.overdue.length}</span>} hint="O horário já passou">
            {groups.overdue.map((r) => (
              <ReminderRow key={r.id} r={r} today={today} overdue />
            ))}
          </Group>
        )}
        {groups.today.length > 0 && (
          <Group title="Hoje">
            {groups.today.map((r) => (
              <ReminderRow key={r.id} r={r} today={today} />
            ))}
          </Group>
        )}
        {groups.upcoming.length > 0 && (
          <Group title="Próximos">
            {groups.upcoming.map((r) => (
              <ReminderRow key={r.id} r={r} today={today} />
            ))}
          </Group>
        )}
        {groups.done.length > 0 && (
          <section className="card">
            <button className="row" style={{ width: '100%' }} onClick={() => setShowDone((s) => !s)} aria-expanded={showDone}>
              <Check size={17} className="faint" />
              <span className="card-title">Concluídos</span>
              <span className="badge">{groups.done.length}</span>
              <ChevronDown size={18} className="faint" style={{ marginLeft: 'auto', transform: showDone ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
            </button>
            {showDone && (
              <div className="list" style={{ marginTop: 8 }}>
                {groups.done.map((r) => (
                  <ReminderRow key={r.id} r={r} today={today} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Group({ title, badge, hint, children }: { title: string; badge?: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        <div className="card-title">{title}</div>
        {badge}
        {hint && <span className="card-sub" style={{ marginLeft: 'auto' }}>{hint}</span>}
      </div>
      <div className="list">{children}</div>
    </section>
  );
}

function ReminderRow({ r, today, overdue }: { r: Reminder; today: string; overdue?: boolean }) {
  const data = useData();
  const area = r.areaId ? data.areas[r.areaId] : null;
  const at = reminderFireAt(r);
  const when = `${relativeDayLabel(dateOf(at), today)} às ${timeOf(at)}`;
  const complete = () => toastUndo(r.repeat.type === 'none' ? 'Lembrete concluído' : 'Feito! Próxima ocorrência agendada', actions.completeReminder(r.id), 'success');
  return (
    <div className={cx('list-row', r.done && 'done')}>
      <span className={cx('tile-icon tile-icon-sm', `hue-${area?.color ?? 'yellow'}`)}>
        <Bell size={16} />
      </span>
      <button className="list-row-main" style={{ textAlign: 'left' }} onClick={() => openSheet({ kind: 'reminder', id: r.id })}>
        <div className="list-row-title">{r.title}</div>
        <div className="list-row-sub">
          <span className={cx(overdue && 'text-danger')}>{r.done ? 'Concluído' : when}</span>
          {r.snoozedUntil && !r.done && <span className="badge" style={{ height: 19 }}><AlarmClock size={11} /> adiado</span>}
          {r.repeat.type !== 'none' && (
            <span className="row" style={{ '--gap': '3px' } as React.CSSProperties}>
              <Repeat size={12} /> {REPEAT_LABELS[r.repeat.type]}
            </span>
          )}
          {r.description && <span className="truncate faint">{r.description}</span>}
        </div>
      </button>
      {!r.done && (
        <button className="icon-btn icon-btn-sm" aria-label="Adiar" title="Adiar" onClick={() => openSheet({ kind: 'snooze', id: r.id })}>
          <AlarmClock size={17} />
        </button>
      )}
      {r.done ? (
        <button className="icon-btn icon-btn-sm" aria-label="Reabrir" title="Reabrir" onClick={() => actions.reopenReminder(r.id)}>
          <RotateCcw size={16} />
        </button>
      ) : (
        <button className="check" aria-label="Concluir" onClick={complete}>
          <Check size={14} strokeWidth={3} />
        </button>
      )}
      <Menu
        actions={[
          { label: 'Editar', icon: <Pencil size={16} />, onClick: () => openSheet({ kind: 'reminder', id: r.id }) },
          { label: 'Adicionar ao calendário', icon: <CalendarPlus size={16} />, onClick: () => downloadIcs(getData(), `lembrete-${r.title}`, { kind: 'reminder', id: r.id }) },
          { label: 'Excluir', icon: <Trash2 size={16} />, danger: true, separator: true, onClick: () => toastUndo('Lembrete excluído', actions.deleteReminder(r.id)) },
        ]}
      />
    </div>
  );
}

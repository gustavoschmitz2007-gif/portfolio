import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarClock, Check, ChevronDown, Clock, ListTodo, Pencil, Plus, Trash2 } from 'lucide-react';
import { addDays, diffDays, formatDayMonth, formatLongDate, weekdayShort, type DateKey } from '../../core/date';
import { agendaBetween } from '../../core/agenda';
import type { Task } from '../../core/types';
import { actions, useData } from '../../store/store';
import { useToday } from '../../store/clock';
import { openSheet, toast, toastUndo } from '../../store/ui';
import { Bar, cx, Empty, Menu } from '../../ui/components';
import { PRIORITY_RANK } from '../../ui/labels';
import { PlannerSubnav } from '../habits/Subnav';
import { AgendaRow } from '../agenda/ItemRow';
import { useRoute } from '../../app/router';
import { TaskQuickInput } from '../quick/TaskQuickInput';

export default function PlannerPage() {
  const data = useData();
  const today = useToday();
  const { query } = useRoute();
  const [date, setDate] = useState<DateKey>(() => query.get('d') ?? today);
  const [showDone, setShowDone] = useState(false);
  const isToday = date === today;

  const { timed, untimed, done, overdue, undated, total, finished } = useMemo(() => {
    const tasks = Object.values(data.tasks);
    const ofDay = tasks.filter((t) => t.date === date);
    const byPrio = (a: Task, b: Task) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt);
    const agenda = agendaBetween(data, date, date, { task: false }).filter((i) => !(i.kind === 'reminder' && i.done));
    const timedTasks = ofDay.filter((t) => !t.done && t.time);
    const timed = [
      ...timedTasks.map((t) => ({ type: 'task' as const, time: t.time!, task: t })),
      ...agenda.map((i) => ({ type: 'agenda' as const, time: i.time ?? '', item: i })),
    ].sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
    return {
      timed,
      untimed: ofDay.filter((t) => !t.done && !t.time).sort(byPrio),
      done: ofDay.filter((t) => t.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')),
      overdue: isToday ? tasks.filter((t) => !t.done && t.date && t.date < today).sort((a, b) => a.date!.localeCompare(b.date!)) : [],
      undated: tasks.filter((t) => !t.date && !t.done).sort(byPrio),
      total: ofDay.length,
      finished: ofDay.filter((t) => t.done).length,
    };
  }, [data, date, today, isToday]);

  return (
    <div className="page page-narrow">
      <PlannerSubnav />
      <div className="page-head">
        <div>
          <h1 className="page-title">Planejamento</h1>
          <p className="page-sub">{isToday ? `Hoje, ${formatLongDate(date).toLowerCase()}` : formatLongDate(date)}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => openSheet({ kind: 'task', date })}>
            <Plus size={17} /> Tarefa
          </button>
        </div>
      </div>

      <DateStrip date={date} today={today} onChange={setDate} />

      <TaskQuickInput date={date} />

      {total > 0 && (
        <div className="planner-progress">
          <span className="num" style={{ fontWeight: 750 }}>
            {finished}/{total}
          </span>
          <span className="muted">tarefas concluídas</span>
          <div className="spacer" />
          <div style={{ width: 120 }}>
            <Bar value={total ? finished / total : 0} />
          </div>
        </div>
      )}

      <div className="stack" style={{ '--gap': '16px', marginTop: 16 } as React.CSSProperties}>
        {overdue.length > 0 && (
          <section className="card card-overdue">
            <div className="card-head">
              <div className="card-title">Atrasadas</div>
              <span className="badge badge-danger">{overdue.length}</span>
              <button
                className="card-link"
                onClick={() => {
                  overdue.forEach((t) => actions.updateTask(t.id, { date: today }));
                  toast(`${overdue.length} tarefa${overdue.length > 1 ? 's' : ''} movida${overdue.length > 1 ? 's' : ''} para hoje`);
                }}
              >
                Mover todas para hoje <ArrowRight size={14} />
              </button>
            </div>
            <div className="list">
              {overdue.map((t) => (
                <TaskRow key={t.id} task={t} today={today} showDate />
              ))}
            </div>
          </section>
        )}

        <section className="card">
          <div className="card-head">
            <div className="card-title">Agenda do dia</div>
            <span className="card-sub">por horário</span>
          </div>
          {timed.length === 0 ? (
            <Empty small icon={<Clock size={20} />} title="Nada com horário" text="Adicione um horário à tarefa (ex.: “Estudar 14h”) para organizá-la aqui." />
          ) : (
            <div className="timeline">
              {timed.map((e) =>
                e.type === 'task' ? (
                  <TaskRow key={e.task.id} task={e.task} today={today} timeline />
                ) : (
                  <AgendaRow key={e.item.key} item={e.item} />
                ),
              )}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div className="card-title">Sem horário</div>
            <span className="card-sub">por prioridade</span>
          </div>
          {untimed.length === 0 ? (
            <Empty small icon={<ListTodo size={20} />} title={total ? 'Tudo organizado' : 'Nenhuma tarefa para este dia'} text={total ? undefined : 'Use o campo acima para adicionar em segundos.'} />
          ) : (
            <div className="list">
              {untimed.map((t) => (
                <TaskRow key={t.id} task={t} today={today} />
              ))}
            </div>
          )}
        </section>

        {done.length > 0 && (
          <section className="card">
            <button className="row" style={{ width: '100%' }} onClick={() => setShowDone((s) => !s)} aria-expanded={showDone}>
              <Check size={17} className="faint" />
              <span className="card-title">Concluídas</span>
              <span className="badge">{done.length}</span>
              <ChevronDown size={18} className="faint" style={{ marginLeft: 'auto', transform: showDone ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
            </button>
            {showDone && (
              <div className="list" style={{ marginTop: 8 }}>
                {done.map((t) => (
                  <TaskRow key={t.id} task={t} today={today} />
                ))}
              </div>
            )}
          </section>
        )}

        {undated.length > 0 && (
          <section className="card">
            <div className="card-head">
              <div className="card-title">Sem data</div>
              <span className="card-sub">quando der</span>
            </div>
            <div className="list">
              {undated.map((t) => (
                <TaskRow key={t.id} task={t} today={today} undatedTarget={date} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function DateStrip({ date, today, onChange }: { date: DateKey; today: DateKey; onChange: (d: DateKey) => void }) {
  const data = useData();
  const ref = useRef<HTMLDivElement>(null);
  const start = addDays(date < today ? date : today, -3);
  const days = Array.from({ length: 21 }, (_, i) => addDays(start, i));
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of Object.values(data.tasks)) if (t.date && !t.done) m.set(t.date, (m.get(t.date) ?? 0) + 1);
    return m;
  }, [data.tasks]);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.dstrip-day.active');
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [date]);
  return (
    <div className="dstrip-wrap">
      <div className="dstrip" ref={ref}>
        {days.map((d) => (
          <button key={d} className={cx('dstrip-day', d === date && 'active', d === today && 'today', d < today && 'past')} onClick={() => onChange(d)}>
            <span className="dstrip-wd">{d === today ? 'Hoje' : weekdayShort(d).slice(0, 3)}</span>
            <span className="dstrip-n num">{Number(d.slice(8))}</span>
            <span className={cx('dstrip-dot', (counts.get(d) ?? 0) > 0 && 'on')} />
          </button>
        ))}
      </div>
      {date !== today && (
        <button className="btn btn-sm btn-outline" onClick={() => onChange(today)}>
          Hoje
        </button>
      )}
    </div>
  );
}

export function TaskRow({ task: t, today, showDate, timeline, undatedTarget }: { task: Task; today: DateKey; showDate?: boolean; timeline?: boolean; undatedTarget?: DateKey }) {
  const data = useData();
  const area = t.areaId ? data.areas[t.areaId] : null;
  const toggle = () => {
    actions.toggleTask(t.id);
    if (!t.done) toastUndo('Tarefa concluída', () => actions.toggleTask(t.id), 'success');
  };
  const sub = [
    showDate && t.date ? (diffDays(t.date, today) === 1 ? 'Ontem' : formatDayMonth(t.date)) : null,
    !timeline && t.time ? t.time : null,
    area?.name,
    t.priority === 'high' ? 'Alta prioridade' : null,
    t.notes ? 'Com notas' : null,
  ].filter(Boolean);

  const content = (
    <>
      <button className={cx('check', t.done && 'on', !t.done && `check-prio-${t.priority}`)} onClick={toggle} aria-label={t.done ? 'Desmarcar tarefa' : 'Concluir tarefa'} aria-pressed={t.done}>
        <Check size={14} strokeWidth={3} />
      </button>
      <button className="list-row-main" style={{ textAlign: 'left' }} onClick={() => openSheet({ kind: 'task', id: t.id })}>
        <div className="list-row-title">{t.title}</div>
        {sub.length > 0 && (
          <div className="list-row-sub">
            {area && <span className={cx('dot', `hue-${area.color}`)} />}
            {sub.join(' · ')}
          </div>
        )}
      </button>
      {undatedTarget && (
        <button className="btn btn-sm btn-ghost" onClick={() => actions.updateTask(t.id, { date: undatedTarget })}>
          Planejar
        </button>
      )}
      <Menu
        actions={[
          { label: 'Editar', icon: <Pencil size={16} />, onClick: () => openSheet({ kind: 'task', id: t.id }) },
          ...(t.date !== today ? [{ label: 'Mover para hoje', icon: <ArrowRight size={16} />, onClick: () => actions.updateTask(t.id, { date: today }) }] : []),
          { label: 'Mover para amanhã', icon: <CalendarClock size={16} />, onClick: () => actions.updateTask(t.id, { date: addDays(t.date && t.date > today ? t.date : today, 1) }) },
          { label: 'Excluir', icon: <Trash2 size={16} />, danger: true, separator: true, onClick: () => toastUndo('Tarefa excluída', actions.deleteTask(t.id)) },
        ]}
      />
    </>
  );

  if (timeline)
    return (
      <div className={cx('agenda-row task-timeline', t.done && 'done', area && `hue-${area.color}`)}>
        <div className="agenda-time">
          <span className="num">{t.time}</span>
        </div>
        <span className="agenda-bar" />
        <div className="row" style={{ flex: 1, minWidth: 0, '--gap': '10px' } as React.CSSProperties}>
          {content}
        </div>
      </div>
    );

  return <div className={cx('list-row', t.done && 'done')}>{content}</div>;
}

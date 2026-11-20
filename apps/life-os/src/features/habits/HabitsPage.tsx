import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Check, ChevronDown, CircleCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { formatWeekRange, startOfWeek, weekDays, weekdayShort, type DateKey } from '../../core/date';
import { countOn, goalProgress, habitsForWeek, isActiveInWeek, isScheduledOn, sortedHabits } from '../../core/habits';
import type { Habit } from '../../core/types';
import { actions, useData } from '../../store/store';
import { useToday } from '../../store/clock';
import { confirmDialog, openSheet, toast, toastUndo } from '../../store/ui';
import { Bar, cx, Empty, Menu, TileIcon } from '../../ui/components';
import { frequencyLabel, tapHabit } from './shared';
import { HabitsSubnav, WeekNav } from './Subnav';

export default function HabitsPage() {
  const data = useData();
  const today = useToday();
  const wso = data.settings.weekStartsOn;
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, wso));
  const [area, setArea] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const days = weekDays(weekStart);

  const habits = useMemo(() => {
    const isCurrentOrFuture = weekStart >= startOfWeek(today, wso);
    const list = isCurrentOrFuture ? sortedHabits(data) : habitsForWeek(data, weekStart);
    // Also show habits with records that week even if outside the goals.
    const extra = sortedHabits(data).filter((h) => !list.includes(h) && days.some((d) => countOn(data, h.id, d) > 0));
    return [...list, ...extra].filter((h) => area === 'all' || h.areaId === area);
  }, [data, weekStart, area, today, wso]);

  const archived = useMemo(() => Object.values(data.habits).filter((h) => h.archived), [data.habits]);
  const areasInUse = useMemo(() => {
    const ids = new Set(sortedHabits(data).map((h) => h.areaId).filter(Boolean) as string[]);
    return Object.values(data.areas).filter((a) => ids.has(a.id)).sort((a, b) => a.order - b.order);
  }, [data]);

  const hasAny = Object.keys(data.habits).length > 0;

  return (
    <div className="page">
      <HabitsSubnav />
      <div className="page-head">
        <div>
          <h1 className="page-title">Hábitos</h1>
          <p className="page-sub">Toque em um dia para registrar ou corrigir.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => openSheet({ kind: 'habit' })}>
            <Plus size={17} /> Novo hábito
          </button>
        </div>
      </div>

      {!hasAny ? (
        <div className="card">
          <Empty
            icon={<CircleCheck size={24} />}
            title="Nenhum hábito ainda"
            text="Crie hábitos como Academia 3× por semana ou Dieta todos os dias. Registrar leva um toque."
            action={
              <button className="btn btn-accent" onClick={() => openSheet({ kind: 'habit' })}>
                <Plus size={17} /> Criar primeiro hábito
              </button>
            }
          />
        </div>
      ) : (
        <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
          <div className="row wrap" style={{ '--gap': '10px' } as React.CSSProperties}>
            <WeekNav weekStart={weekStart} onChange={setWeekStart} today={today} />
            {areasInUse.length > 1 && (
              <div className="chips" style={{ flex: '1 1 260px' }}>
                <button className={cx('chip', area === 'all' && 'active')} onClick={() => setArea('all')}>
                  Todos
                </button>
                {areasInUse.map((a) => (
                  <button key={a.id} className={cx('chip', `hue-${a.color}`, area === a.id && 'active')} onClick={() => setArea(a.id)}>
                    <span className="dot" />
                    {a.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card tracker">
            <div className="tracker-head">
              <div className="tracker-name-col faint">{formatWeekRange(weekStart)}</div>
              <div className="tracker-days">
                {days.map((d) => (
                  <div key={d} className={cx('tracker-dayhead', d === today && 'today')}>
                    <span>{weekdayShort(d).slice(0, 3)}</span>
                    <b>{Number(d.slice(8))}</b>
                  </div>
                ))}
              </div>
            </div>
            {habits.length === 0 && <Empty small title="Nenhum hábito nesta categoria" />}
            {habits.map((h, i) => (
              <TrackerRow key={h.id} habit={h} weekStart={weekStart} days={days} today={today} first={i === 0} last={i === habits.length - 1} />
            ))}
          </div>

          {archived.length > 0 && (
            <div className="card">
              <button className="row" style={{ width: '100%' }} onClick={() => setShowArchived((s) => !s)} aria-expanded={showArchived}>
                <Archive size={17} className="faint" />
                <span className="card-title">Arquivados</span>
                <span className="badge">{archived.length}</span>
                <ChevronDown size={18} className="faint" style={{ marginLeft: 'auto', transform: showArchived ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
              </button>
              {showArchived && (
                <div className="list" style={{ marginTop: 10 }}>
                  {archived.map((h) => (
                    <div key={h.id} className="list-row">
                      <TileIcon icon={h.icon} color={h.color} size="sm" />
                      <button className="list-row-main" style={{ textAlign: 'left' }} onClick={() => openSheet({ kind: 'habitDetail', id: h.id })}>
                        <div className="list-row-title">{h.name}</div>
                        <div className="list-row-sub">Histórico preservado</div>
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          actions.setHabitArchived(h.id, false);
                          toast('Hábito reativado');
                        }}
                      >
                        <ArchiveRestore size={15} /> Reativar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrackerRow({ habit: h, weekStart, days, today, first, last }: { habit: Habit; weekStart: DateKey; days: DateKey[]; today: DateKey; first: boolean; last: boolean }) {
  const data = useData();
  const active = isActiveInWeek(data, h, weekStart);
  const g = goalProgress(data, h, weekStart, today);
  const met = active && g.done >= g.target;

  const onCell = (d: DateKey) => {
    if (d > today) return;
    if (h.dailyTarget > 1) openSheet({ kind: 'habitCount', id: h.id, date: d });
    else tapHabit(h, d);
  };

  const remove = async () => {
    const ok = await confirmDialog({ title: `Excluir “${h.name}”?`, message: 'Os registros deste hábito também serão apagados. Para manter o histórico, use Arquivar.', confirmLabel: 'Excluir', danger: true });
    if (ok) toastUndo('Hábito excluído', actions.deleteHabit(h.id));
  };

  return (
    <div className="tracker-row">
      <div className="tracker-name-col">
        <button className="tracker-name" onClick={() => openSheet({ kind: 'habitDetail', id: h.id })}>
          <TileIcon icon={h.icon} color={h.color} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="habit-row-title truncate">{h.name}</div>
            <div className="habit-row-sub">
              <span className="truncate">{frequencyLabel(h, data.settings.weekStartsOn)}</span>
            </div>
          </div>
        </button>
        <div className={cx('tracker-score', met && 'met', `hue-${h.color}`)}>
          {active ? (
            <>
              <span className="num">
                {g.done}/{g.target}
              </span>
              <Bar value={g.pct} thin />
            </>
          ) : (
            <span className="faint" style={{ fontSize: 12 }}>
              fora da semana
            </span>
          )}
        </div>
        <Menu
          actions={[
            { label: 'Editar', icon: <Pencil size={16} />, onClick: () => openSheet({ kind: 'habit', id: h.id }) },
            ...(!first ? [{ label: 'Mover para cima', icon: <ArrowUp size={16} />, onClick: () => actions.moveHabit(h.id, -1) }] : []),
            ...(!last ? [{ label: 'Mover para baixo', icon: <ArrowDown size={16} />, onClick: () => actions.moveHabit(h.id, 1) }] : []),
            {
              label: 'Arquivar',
              icon: <Archive size={16} />,
              onClick: () => {
                actions.setHabitArchived(h.id, true);
                toast('Hábito arquivado — histórico preservado');
              },
            },
            { label: 'Excluir', icon: <Trash2 size={16} />, danger: true, separator: true, onClick: remove },
          ]}
        />
      </div>
      <div className="tracker-days">
        {days.map((d) => {
          const c = countOn(data, h.id, d);
          const done = c >= h.dailyTarget;
          const partial = !done && c > 0;
          const scheduled = h.frequency === 'daily' && isScheduledOn(h, d);
          const future = d > today;
          return (
            <button
              key={d}
              className={cx('tcell', `hue-${h.color}`, done && 'on', partial && 'partial', scheduled && 'sched', future && 'future', d === today && 'today')}
              onClick={() => onCell(d)}
              disabled={future}
              aria-label={`${h.name}, ${weekdayShort(d)} ${Number(d.slice(8))}: ${done ? 'feito' : partial ? `${c} de ${h.dailyTarget}` : 'não feito'}`}
              aria-pressed={done}
            >
              {done ? <Check size={16} strokeWidth={3} /> : partial ? <span className="tcell-count">{c}</span> : <span className="tcell-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}


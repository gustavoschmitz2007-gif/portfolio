import { useMemo, useState } from 'react';
import { Bell, CalendarDays, ChevronLeft, ChevronRight, GraduationCap, ListTodo, Plus } from 'lucide-react';
import { addDays, addMonths, endOfMonth, formatLongDate, formatMonthYear, formatWeekRange, startOfMonth, startOfWeek, weekDays, weekdayShort, type DateKey } from '../../core/date';
import { agendaBetween, agendaByDay, type AgendaFilter, type AgendaKind } from '../../core/agenda';
import { useData } from '../../store/store';
import { useToday } from '../../store/clock';
import { openSheet } from '../../store/ui';
import { cx, Empty, Segmented } from '../../ui/components';
import { MonthGrid } from './MonthGrid';
import { AgendaRow, openAgendaItem } from './ItemRow';

type View = 'day' | 'week' | 'month';

const KINDS: Array<{ kind: AgendaKind; label: string; icon: React.ReactNode }> = [
  { kind: 'event', label: 'Compromissos', icon: <CalendarDays size={14} /> },
  { kind: 'academic', label: 'Faculdade', icon: <GraduationCap size={14} /> },
  { kind: 'reminder', label: 'Lembretes', icon: <Bell size={14} /> },
  { kind: 'task', label: 'Tarefas', icon: <ListTodo size={14} /> },
];

export default function AgendaPage() {
  const data = useData();
  const today = useToday();
  const wso = data.settings.weekStartsOn;
  const [view, setView] = useState<View>(() => (window.innerWidth < 768 ? 'month' : 'month'));
  const [cursor, setCursor] = useState<DateKey>(today);
  const [filter, setFilter] = useState<AgendaFilter>({});

  const range = useMemo(() => {
    if (view === 'day') return { from: cursor, to: cursor };
    if (view === 'week') {
      const ws = startOfWeek(cursor, wso);
      return { from: ws, to: addDays(ws, 6) };
    }
    const first = startOfMonth(cursor);
    return { from: startOfWeek(first, wso), to: addDays(startOfWeek(endOfMonth(cursor), wso), 6) };
  }, [view, cursor, wso]);

  const items = useMemo(() => agendaBetween(data, range.from, range.to, filter), [data, range, filter]);
  const byDay = useMemo(() => agendaByDay(items), [items]);

  const move = (dir: -1 | 1) => {
    if (view === 'day') setCursor(addDays(cursor, dir));
    else if (view === 'week') setCursor(addDays(cursor, 7 * dir));
    else setCursor(addMonths(startOfMonth(cursor), dir));
  };

  const title = view === 'day' ? formatLongDate(cursor) : view === 'week' ? formatWeekRange(startOfWeek(cursor, wso)) : formatMonthYear(cursor);
  const isCurrent = view === 'day' ? cursor === today : view === 'week' ? startOfWeek(cursor, wso) === startOfWeek(today, wso) : cursor.slice(0, 7) === today.slice(0, 7);
  const selectedItems = byDay.get(cursor) ?? [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="page-sub">Compromissos, provas, trabalhos, lembretes e tarefas.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => openSheet({ kind: 'addForDay', date: cursor })}>
            <Plus size={17} /> Adicionar
          </button>
        </div>
      </div>

      <div className="agenda-toolbar">
        <Segmented<View>
          value={view}
          onChange={setView}
          options={[
            { value: 'day', label: 'Dia' },
            { value: 'week', label: 'Semana' },
            { value: 'month', label: 'Mês' },
          ]}
        />
        <div className="agenda-nav">
          <button className="icon-btn icon-btn-sm" onClick={() => move(-1)} aria-label="Anterior">
            <ChevronLeft size={18} />
          </button>
          <div className="agenda-nav-title">
            {title}
          </div>
          <button className="icon-btn icon-btn-sm" onClick={() => move(1)} aria-label="Próximo">
            <ChevronRight size={18} />
          </button>
          {!isCurrent && (
            <button className="btn btn-sm btn-outline" onClick={() => setCursor(today)}>
              Hoje
            </button>
          )}
        </div>
      </div>

      <div className="chips" style={{ marginBottom: 14 }}>
        {KINDS.map((k) => {
          const on = filter[k.kind] !== false;
          return (
            <button key={k.kind} className={cx('chip', on && 'active')} aria-pressed={on} onClick={() => setFilter((f) => ({ ...f, [k.kind]: !on }))}>
              {k.icon}
              {k.label}
            </button>
          );
        })}
      </div>

      {view === 'month' && (
        <div className="agenda-layout">
          <div className="card month-card">
            <MonthGrid month={cursor} selected={cursor} today={today} weekStartsOn={wso} byDay={byDay} onSelect={setCursor} />
          </div>
          <DayPanel date={cursor} items={selectedItems} today={today} />
        </div>
      )}

      {view === 'week' && (
        <div className="week-cols">
          {weekDays(startOfWeek(cursor, wso)).map((d) => {
            const list = byDay.get(d) ?? [];
            return (
              <div key={d} className={cx('week-col card', d === today && 'today')}>
                <div className="week-col-head">
                  <button onClick={() => { setCursor(d); setView('day'); }} className="week-col-date">
                    <span>{weekdayShort(d)}</span>
                    <b className="num">{Number(d.slice(8))}</b>
                  </button>
                  <button className="icon-btn icon-btn-sm" aria-label="Adicionar neste dia" onClick={() => openSheet({ kind: 'addForDay', date: d })}>
                    <Plus size={16} />
                  </button>
                </div>
                {list.length === 0 ? (
                  <div className="faint" style={{ fontSize: 12.5, padding: '4px 2px' }}>Livre</div>
                ) : (
                  <div className="week-col-items">
                    {list.map((it) => (
                      <button key={it.key} className={cx('wchip', `hue-${it.color}`, it.done && 'done')} onClick={() => openAgendaItem(it)}>
                        {it.time && <span className="num">{it.time}</span>}
                        <span className="wchip-title">{it.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === 'day' && <DayPanel date={cursor} items={selectedItems} today={today} large />}
    </div>
  );
}

function DayPanel({ date, items, today, large }: { date: DateKey; items: ReturnType<typeof agendaBetween>; today: DateKey; large?: boolean }) {
  return (
    <div className={cx('card', large && 'day-large')}>
      <div className="card-head">
        <div>
          <div className="card-title">
            {date === today ? 'Hoje' : formatLongDate(date)}
          </div>
          <div className="card-sub">{items.length ? `${items.length} ${items.length === 1 ? 'item' : 'itens'}` : 'Dia livre'}</div>
        </div>
        <button className="card-link" onClick={() => openSheet({ kind: 'addForDay', date })}>
          <Plus size={14} /> Adicionar
        </button>
      </div>
      {items.length === 0 ? (
        <Empty small icon={<CalendarDays size={20} />} title="Nada marcado" text="Toque em Adicionar para criar um compromisso, tarefa, lembrete ou entrega neste dia." />
      ) : (
        <div className="timeline">
          {items.map((it) => (
            <AgendaRow key={it.key} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

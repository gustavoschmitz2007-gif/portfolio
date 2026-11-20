import { useMemo, useState } from 'react';
import { Check, Plus, SlidersHorizontal, Target } from 'lucide-react';
import { addDays, diffDays, endOfWeek, formatDayMonth, formatWeekRange, startOfWeek } from '../../core/date';
import { countOn, firstActivityDay, isDayDone, sortedHabits, weekSummary, type GoalProgress } from '../../core/habits';
import { weekSeries } from '../../core/stats';
import { actions, useData } from '../../store/store';
import { useToday } from '../../store/clock';
import { openSheet } from '../../store/ui';
import { cx, Empty, Pct, Ring, Stepper, TileIcon } from '../../ui/components';
import { HabitsSubnav, WeekNav } from '../habits/Subnav';
import { tapHabit } from '../habits/shared';
import { ColumnChart } from '../stats/charts';

const STATE_LABEL: Record<GoalProgress['state'], { text: string; cls: string }> = {
  done: { text: 'Cumprida', cls: 'badge-accent-soft' },
  'on-track': { text: 'No ritmo', cls: 'badge-info' },
  behind: { text: 'Atenção', cls: 'badge-warning' },
  'out-of-reach': { text: 'Fora de alcance', cls: '' },
  partial: { text: 'Parcial', cls: '' },
  missed: { text: 'Sem registros', cls: '' },
  upcoming: { text: 'Planejada', cls: '' },
};

export default function GoalsPage() {
  const data = useData();
  const today = useToday();
  const wso = data.settings.weekStartsOn;
  const current = startOfWeek(today, wso);
  const [weekStart, setWeekStart] = useState(current);
  const [editing, setEditing] = useState(false);

  const summary = useMemo(() => weekSummary(data, weekStart, today), [data, weekStart, today]);
  const prev = useMemo(() => weekSummary(data, addDays(weekStart, -7), today), [data, weekStart, today]);
  const history = useMemo(() => {
    const all = weekSeries(data, today, 12);
    const first = firstActivityDay(data);
    const firstWeek = first ? startOfWeek(first, wso) : current;
    const idx = all.findIndex((w) => w.weekStart >= firstWeek);
    // Start the chart at the first week with activity (keep a few weeks for scale).
    return all.slice(Math.max(0, Math.min(idx < 0 ? all.length - 1 : idx, all.length - 4)));
  }, [data, today, wso, current]);
  const pastWeeks = useMemo(() => {
    const first = firstActivityDay(data);
    const firstWeek = first ? startOfWeek(first, wso) : current;
    return history.filter((w) => !w.current && w.weekStart >= firstWeek).reverse().slice(0, 8);
  }, [history, data, wso, current]);
  const editable = useMemo(() => {
    // In edit mode list every habit, so goals can be added back to the week.
    const plan = data.weekPlans[weekStart];
    return sortedHabits(data).map((h) => ({ habit: h, target: plan && h.id in plan.targets ? plan.targets[h.id] : weekStart >= current ? h.weeklyTarget : 0 }));
  }, [data, weekStart, current]);

  const isCurrent = weekStart === current;
  const isPast = endOfWeek(weekStart) < today;
  const daysLeft = isCurrent ? diffDays(today, endOfWeek(weekStart)) + 1 : 0;
  const delta = summary.target && prev.target ? summary.pct - prev.pct : null;

  const startEdit = () => {
    actions.ensureWeekPlan(weekStart);
    setEditing(true);
  };

  if (Object.keys(data.habits).length === 0) {
    return (
      <div className="page">
        <HabitsSubnav />
        <div className="page-head">
          <h1 className="page-title">Metas semanais</h1>
        </div>
        <div className="card">
          <Empty
            icon={<Target size={24} />}
            title="Defina suas metas da semana"
            text="Cada meta é um hábito com um alvo semanal, como Academia 3×, Cardio 3× ou Dieta 7 dias."
            action={
              <button className="btn btn-accent" onClick={() => openSheet({ kind: 'habit' })}>
                <Plus size={17} /> Criar meta
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <HabitsSubnav />
      <div className="page-head">
        <div>
          <h1 className="page-title">Metas semanais</h1>
          <p className="page-sub">Cada semana tem suas próprias metas; semanas passadas ficam salvas.</p>
        </div>
        <div className="page-actions">
          {editing ? (
            <button className="btn btn-primary" onClick={() => setEditing(false)}>
              <Check size={17} /> Concluir ajustes
            </button>
          ) : (
            <>
              <button className="btn btn-outline" onClick={startEdit}>
                <SlidersHorizontal size={16} /> Ajustar metas
              </button>
              <button className="btn btn-primary" onClick={() => openSheet({ kind: 'habit', defaults: { frequency: 'weekly' } })}>
                <Plus size={17} /> Nova meta
              </button>
            </>
          )}
        </div>
      </div>

      <div className="row wrap" style={{ marginBottom: 14 }}>
        <WeekNav
          weekStart={weekStart}
          onChange={(ws) => {
            setWeekStart(ws);
            setEditing(false);
          }}
          today={today}
        />
      </div>

      <div className="goals-layout">
        <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
          <div className="card goal-summary">
            <Ring value={summary.pct} size={112} stroke={10}>
              <div className="kpi-value" style={{ fontSize: 30 }}>
                <Pct value={summary.target ? summary.pct : null} />
              </div>
              <div className="faint" style={{ fontSize: 11.5, fontWeight: 600 }}>da semana</div>
            </Ring>
            <div className="stack" style={{ '--gap': '6px', flex: 1, minWidth: 0 } as React.CSSProperties}>
              <div className="card-title" style={{ fontSize: 18 }}>
                {summary.met} de {summary.goals.length} metas cumpridas
              </div>
              <div className="muted" style={{ fontSize: 13.5 }}>
                {formatWeekRange(weekStart)} ·{' '}
                {isCurrent ? (daysLeft === 1 ? 'último dia da semana' : `${daysLeft} dias restantes`) : isPast ? 'semana encerrada' : 'semana futura'}
              </div>
              {delta !== null && (
                <div className={cx('delta', delta > 0.005 ? 'up' : delta < -0.005 ? 'down' : 'flat')}>
                  {delta > 0.005 ? '▲' : delta < -0.005 ? '▼' : '='} {Math.abs(Math.round(delta * 100))} p.p. vs. semana anterior
                </div>
              )}
              <div className="faint" style={{ fontSize: 12.5 }}>
                {summary.achieved} de {summary.target} registros planejados
              </div>
            </div>
          </div>

          {editing ? (
            <div className="card">
              <div className="card-head">
                <div className="card-title">Metas de {formatWeekRange(weekStart)}</div>
              </div>
              <p className="faint" style={{ fontSize: 13, marginBottom: 8 }}>
                Os valores valem só para esta semana. Use 0 para tirar um hábito das metas desta semana. Para mudar o padrão das próximas semanas, edite o hábito.
              </p>
              <div className="list">
                {editable.map(({ habit: h, target }) => (
                  <div key={h.id} className="list-row">
                    <TileIcon icon={h.icon} color={h.color} size="sm" />
                    <div className="list-row-main">
                      <div className="list-row-title truncate">{h.name}</div>
                      <div className="list-row-sub">Padrão: {h.weeklyTarget}×</div>
                    </div>
                    <Stepper size="sm" value={target} min={0} max={h.frequency === 'daily' ? 7 : 14} onChange={(v) => actions.setWeekTarget(weekStart, h.id, v)} />
                  </div>
                ))}
              </div>
            </div>
          ) : summary.goals.length === 0 ? (
            <div className="card">
              <Empty small title="Sem metas nesta semana" text={isPast ? 'Não havia metas registradas para esta semana.' : 'Use “Ajustar metas” para definir os alvos desta semana.'} />
            </div>
          ) : (
            <div className="goal-grid">
              {summary.goals.map((g) => (
                <GoalCard key={g.habit.id} g={g} isCurrent={isCurrent} today={today} />
              ))}
            </div>
          )}
        </div>

        <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
          <div className="card">
            <div className="card-head">
              <div className="card-title">Evolução</div>
              <div className="card-sub" style={{ marginLeft: 'auto' }}>% das metas por semana</div>
            </div>
            <ColumnChart
              points={history.map((w) => ({
                key: w.weekStart,
                label: formatDayMonth(w.weekStart).split(' ')[0],
                value: w.pct,
                highlight: w.weekStart === weekStart,
                tooltip: (
                  <>
                    <b>{formatWeekRange(w.weekStart)}</b>
                    <br />
                    {w.pct === null ? 'Sem metas' : `${Math.round(w.pct * 100)}% · ${w.met}/${w.goals} metas`}
                  </>
                ),
              }))}
            />
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">Semanas anteriores</div>
            </div>
            {pastWeeks.length === 0 && <p className="faint" style={{ fontSize: 13 }}>As semanas encerradas aparecem aqui, com o resultado de cada uma.</p>}
            <div className="list">
              {pastWeeks.map((w) => (
                  <button key={w.weekStart} className={cx('list-row clickable week-hist', w.weekStart === weekStart && 'selected')} onClick={() => setWeekStart(w.weekStart)}>
                    <div className="list-row-main" style={{ textAlign: 'left' }}>
                      <div className="list-row-title">{formatWeekRange(w.weekStart)}</div>
                      <div className="list-row-sub">{w.goals ? `${w.met} de ${w.goals} metas` : 'Sem metas'}</div>
                    </div>
                    <div className="week-hist-bar">
                      <div className="bar bar-thin">
                        <div className="bar-fill" style={{ width: `${(w.pct ?? 0) * 100}%` }} />
                      </div>
                    </div>
                    <span className="num" style={{ width: 44, textAlign: 'right', fontWeight: 700 }}>
                      <Pct value={w.pct} />
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoalCard({ g, isCurrent, today }: { g: GoalProgress; isCurrent: boolean; today: string }) {
  const data = useData();
  const h = g.habit;
  const st = STATE_LABEL[g.state];
  const doneToday = isDayDone(data, h, today);
  let hint = '';
  if (g.state === 'done') hint = g.done > g.target ? `+${g.done - g.target} além da meta` : 'Meta batida';
  else if (isCurrent) hint = g.state === 'out-of-reach' ? `Faltam ${g.remaining} · tudo bem, siga em frente` : `Faltam ${g.remaining} · ${g.daysLeft} ${g.daysLeft === 1 ? 'dia disponível' : 'dias disponíveis'}`;
  else if (g.state === 'partial' || g.state === 'missed') hint = `Ficaram faltando ${g.remaining}`;

  return (
    <div className={cx('card goal-card', `hue-${h.color}`, g.state === 'done' && 'met')}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Ring value={g.pct} size={64} stroke={6} hue={`var(--c-${h.color})`}>
          <span className="num" style={{ fontWeight: 800, fontSize: 17 }}>
            {g.done}
            <span className="faint" style={{ fontSize: 12 }}>/{g.target}</span>
          </span>
        </Ring>
        <div className="spacer" />
        {st.text && <span className={cx('badge goal-badge', st.cls)}>{st.text}</span>}
      </div>
      <div style={{ marginTop: 12, minWidth: 0 }}>
        <button className="goal-name truncate" onClick={() => openSheet({ kind: 'habitDetail', id: h.id })}>
          {h.name}
        </button>
        <div className="faint" style={{ fontSize: 12.5, marginTop: 2, minHeight: 18 }}>
          {hint}
        </div>
      </div>
      {isCurrent && (
        <button className={cx('btn btn-sm goal-log', doneToday && 'done')} onClick={() => (h.dailyTarget > 1 ? openSheet({ kind: 'habitCount', id: h.id, date: today }) : tapHabit(h, today))}>
          {doneToday ? <Check size={15} strokeWidth={3} /> : <Plus size={15} />}
          {doneToday ? 'Feito hoje' : h.dailyTarget > 1 ? `Hoje: ${countOn(data, h.id, today)}/${h.dailyTarget}` : 'Registrar hoje'}
        </button>
      )}
    </div>
  );
}

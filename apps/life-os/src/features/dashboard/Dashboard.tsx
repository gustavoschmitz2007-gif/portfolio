import { useMemo } from 'react';
import { ArrowRight, CalendarCheck, CircleCheck, GraduationCap, Plus, Sparkles } from 'lucide-react';
import { addDays, diffDays, endOfWeek, formatLongDate, formatWeekRange, greeting, isoWeekNumber, startOfWeek, weekDays, WEEKDAY_LETTERS, weekday } from '../../core/date';
import { consistency, habitsForDay, isDayDone, weekSummary } from '../../core/habits';
import { weekSeries } from '../../core/stats';
import { agendaBetween } from '../../core/agenda';
import { reminderFireAt } from '../../core/recurrence';
import { useData } from '../../store/store';
import { useMinute, useToday } from '../../store/clock';
import { openSheet } from '../../store/ui';
import { cx, Empty, Pct, Ring } from '../../ui/components';
import { HabitTodayRow } from '../habits/shared';
import { AgendaRow } from '../agenda/ItemRow';
import { AcademicCard } from '../academic/AcademicCard';
import { SparkColumns } from '../stats/charts';
import { NotificationNotice } from '../reminders/NotificationNotice';
import { TaskQuickInput } from '../quick/TaskQuickInput';

export function Dashboard() {
  const data = useData();
  const today = useToday();
  const minute = useMinute();
  const wso = data.settings.weekStartsOn;
  const ws = startOfWeek(today, wso);

  const model = useMemo(() => {
    const habits = habitsForDay(data, today);
    const habitsDone = habits.filter((h) => isDayDone(data, h, today)).length;
    const weekly = weekSummary(data, ws, today);
    // Habits still relevant today: daily scheduled ones + weekly goals not yet met (or done today).
    const relevant = habits.filter((h) => {
      if (h.frequency === 'daily') return true;
      const g = weekly.goals.find((x) => x.habit.id === h.id);
      return !g || g.done < g.target || isDayDone(data, h, today);
    });
    const relevantDone = relevant.filter((h) => isDayDone(data, h, today)).length;

    const tasksToday = Object.values(data.tasks).filter((t) => t.date === today);
    const tasksDone = tasksToday.filter((t) => t.done).length;
    const overdueTasks = Object.values(data.tasks).filter((t) => !t.done && t.date && t.date < today);

    const agenda = agendaBetween(data, today, today).filter((i) => !(i.kind === 'reminder' && i.done));
    const overdueReminders = Object.values(data.reminders)
      .filter((r) => !r.done && reminderFireAt(r) <= minute && r.occurrence.slice(0, 10) < today)
      .map((r) => agendaBetween(data, r.occurrence.slice(0, 10), r.occurrence.slice(0, 10), { event: false, task: false, academic: false }).find((i) => i.id === r.id))
      .filter(Boolean) as ReturnType<typeof agendaBetween>;
    const remindersToday = agenda.filter((i) => i.kind === 'reminder');

    const pendingAcademic = Object.values(data.academic)
      .filter((a) => a.status !== 'concluido' && diffDays(today, a.date) <= 21)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '99').localeCompare(b.time ?? '99'));

    const total = relevant.length + tasksToday.length + remindersToday.length;
    const done = relevantDone + tasksDone + remindersToday.filter((r) => r.done).length;
    const cons = consistency(data, today);
    const series = weekSeries(data, today, 8);
    const dayDots = weekDays(ws).map((d) => {
      const scheduled = Object.values(data.habits).filter((h) => !h.archived && h.frequency === 'daily' && h.days.includes(weekday(d))).length;
      const completed = Object.values(data.habits).filter((h) => isDayDone(data, h, d)).length;
      return { d, completed, scheduled };
    });

    return { relevant, relevantDone, habitsDone, tasksToday, tasksDone, overdueTasks, agenda, overdueReminders, pendingAcademic, total, done, weekly, cons, series, dayDots };
  }, [data, today, minute, ws]);

  const name = data.settings.name.trim().split(' ')[0];
  const pct = model.total ? model.done / model.total : 0;
  const hasHabits = Object.values(data.habits).some((h) => !h.archived);
  const nextAcademic = model.pendingAcademic.find((a) => a.date >= today);
  const daysLeft = diffDays(today, endOfWeek(ws)) + 1;

  const summaryLine = (() => {
    const parts: string[] = [];
    const habitsLeft = model.relevant.length - model.relevantDone;
    const tasksLeft = model.tasksToday.length - model.tasksDone;
    if (habitsLeft > 0) parts.push(`${habitsLeft} hábito${habitsLeft > 1 ? 's' : ''}`);
    if (tasksLeft > 0) parts.push(`${tasksLeft} tarefa${tasksLeft > 1 ? 's' : ''}`);
    if (!model.total) return 'Nada planejado para hoje ainda. Adicione tarefas ou hábitos para montar o seu dia.';
    if (!parts.length) return 'Tudo feito por hoje. Excelente trabalho! ✨';
    return `Faltam ${parts.join(' e ')} para fechar o dia.`;
  })();

  return (
    <div className="page dash">
      <header className="dash-head">
        <div>
          <p className="dash-date">
            {formatLongDate(today)} · Semana {isoWeekNumber(today)}
          </p>
          <h1 className="page-title">
            {greeting()}
            {name ? `, ${name}` : ''}
          </h1>
        </div>
      </header>

      <div className="dash-grid">
        {/* Hero: today */}
        <section className="card dash-hero" style={{ gridArea: 'hero' }}>
          <Ring value={pct} size={118} stroke={10}>
            <div className="kpi-value" style={{ fontSize: 30 }}>
              {model.total ? <Pct value={pct} /> : '—'}
            </div>
            <div className="faint" style={{ fontSize: 11.5, fontWeight: 600 }}>
              do dia
            </div>
          </Ring>
          <div className="dash-hero-body">
            <div className="card-title" style={{ fontSize: 18 }}>
              Seu dia
            </div>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
              {summaryLine}
            </p>
            <div className="dash-hero-stats">
              <a href="#/habitos" className="hero-stat">
                <span className="num">
                  {model.relevantDone}/{model.relevant.length}
                </span>
                <span>Hábitos</span>
              </a>
              <a href="#/planejar" className="hero-stat">
                <span className="num">
                  {model.tasksDone}/{model.tasksToday.length}
                </span>
                <span>Tarefas</span>
              </a>
              <a href="#/faculdade" className="hero-stat">
                <span className={cx('num', nextAcademic && diffDays(today, nextAcademic.date) <= 1 && 'text-warning')}>{model.pendingAcademic.filter((a) => a.date <= addDays(today, 7)).length}</span>
                <span>Prazos 7d</span>
              </a>
            </div>
          </div>
        </section>

        {/* Consistency */}
        <a href="#/estatisticas" className="card card-hover dash-cons" style={{ gridArea: 'cons' }}>
          <div className="card-head" style={{ marginBottom: 6 }}>
            <div className="card-title">Consistência</div>
            <span className="card-link">
              Estatísticas <ArrowRight size={14} />
            </span>
          </div>
          <div className="row" style={{ alignItems: 'flex-end', '--gap': '14px' } as React.CSSProperties}>
            <div>
              <div className="kpi-value" style={{ fontSize: 40 }}>
                <Pct value={model.cons.score} />
              </div>
              <div className="kpi-label">últimas 4 semanas</div>
              {model.cons.score !== null && model.cons.previous !== null && (
                <div className={cx('delta', model.cons.score - model.cons.previous > 0.005 ? 'up' : model.cons.score - model.cons.previous < -0.005 ? 'down' : 'flat')} style={{ marginTop: 4 }}>
                  {model.cons.score - model.cons.previous > 0.005 ? '▲' : model.cons.score - model.cons.previous < -0.005 ? '▼' : '='} {Math.abs(Math.round((model.cons.score - model.cons.previous) * 100))} p.p. vs. 4 semanas antes
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SparkColumns values={model.series.map((w) => w.pct)} height={56} />
            </div>
          </div>
          {model.cons.score === null && <p className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>Aparece assim que você registrar seus primeiros hábitos.</p>}
        </a>

        {/* Habits today */}
        <section className="card" style={{ gridArea: 'habits' }}>
          <div className="card-head">
            <div className="card-title">Hábitos de hoje</div>
            {model.relevant.length > 0 && (
              <span className="badge">
                {model.relevantDone}/{model.relevant.length}
              </span>
            )}
            <a href="#/habitos" className="card-link">
              Ver semana <ArrowRight size={14} />
            </a>
          </div>
          {!hasHabits ? (
            <Empty
              small
              icon={<CircleCheck size={20} />}
              title="Crie seus hábitos"
              text="Academia, dieta, estudos… registre cada um com um toque."
              action={
                <button className="btn btn-sm btn-accent" onClick={() => openSheet({ kind: 'habit' })}>
                  <Plus size={15} /> Novo hábito
                </button>
              }
            />
          ) : model.relevant.length === 0 ? (
            <Empty small icon={<Sparkles size={20} />} title="Nada pendente hoje" text="Suas metas semanais já estão cumpridas ou não há hábitos para hoje." />
          ) : (
            <div className="habit-list">
              {[...model.relevant]
                .sort((a, b) => Number(isDayDone(data, a, today)) - Number(isDayDone(data, b, today)))
                .map((h) => (
                  <HabitTodayRow key={h.id} habit={h} data={data} date={today} />
                ))}
            </div>
          )}
        </section>

        {/* Today agenda */}
        <section className="card" style={{ gridArea: 'agenda' }}>
          <div className="card-head">
            <div className="card-title">Hoje na agenda</div>
            <a href="#/planejar" className="card-link">
              Planejar <ArrowRight size={14} />
            </a>
          </div>
          <TaskQuickInput date={today} />
          {(model.overdueTasks.length > 0 || model.overdueReminders.length > 0) && (
            <a href="#/planejar" className="dash-overdue">
              <span className="badge badge-danger">{model.overdueTasks.length + model.overdueReminders.length}</span>
              <span className="muted">
                {[model.overdueTasks.length ? `${model.overdueTasks.length} tarefa${model.overdueTasks.length > 1 ? 's' : ''} atrasada${model.overdueTasks.length > 1 ? 's' : ''}` : '', model.overdueReminders.length ? `${model.overdueReminders.length} lembrete${model.overdueReminders.length > 1 ? 's' : ''} pendente${model.overdueReminders.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}
              </span>
              <ArrowRight size={14} className="faint" style={{ marginLeft: 'auto' }} />
            </a>
          )}
          {model.overdueReminders.length > 0 && (
            <div className="timeline" style={{ marginBottom: 6 }}>
              {model.overdueReminders.map((it) => (
                <AgendaRow key={it.key} item={it} overdueLabel="Pendente" />
              ))}
            </div>
          )}
          {model.agenda.length === 0 && model.overdueReminders.length === 0 ? (
            <Empty small icon={<CalendarCheck size={20} />} title="Agenda livre" text="Nenhum compromisso, lembrete ou tarefa para hoje." />
          ) : (
            <div className="timeline">
              {model.agenda.map((it) => (
                <AgendaRow key={it.key} item={it} />
              ))}
            </div>
          )}
        </section>

        {/* Academic deadlines */}
        <section className="card" style={{ gridArea: 'acad' }}>
          <div className="card-head">
            <div className="card-title">Prazos da faculdade</div>
            <a href="#/faculdade" className="card-link">
              Ver tudo <ArrowRight size={14} />
            </a>
          </div>
          {model.pendingAcademic.length === 0 ? (
            <Empty
              small
              icon={<GraduationCap size={20} />}
              title="Sem prazos nas próximas 3 semanas"
              action={
                <button className="btn btn-sm btn-outline" onClick={() => openSheet({ kind: 'academic' })}>
                  <Plus size={15} /> Trabalho ou prova
                </button>
              }
            />
          ) : (
            <div className="acad-list">
              {model.pendingAcademic.slice(0, 5).map((a) => (
                <AcademicCard key={a.id} a={a} today={today} compact />
              ))}
            </div>
          )}
        </section>

        {/* Week */}
        <a href="#/metas" className="card card-hover" style={{ gridArea: 'week' }}>
          <div className="card-head">
            <div>
              <div className="card-title">Semana</div>
              <div className="card-sub">
                {formatWeekRange(ws)} · {daysLeft === 1 ? 'último dia' : `${daysLeft} dias restantes`}
              </div>
            </div>
            <span className="card-link">
              Metas <ArrowRight size={14} />
            </span>
          </div>
          <div className="week-dots">
            {model.dayDots.map(({ d, completed }) => (
              <div key={d} className={cx('week-dot', d === today && 'today', d > today && 'future')}>
                <span className="faint">{WEEKDAY_LETTERS[weekday(d)]}</span>
                <i style={{ '--fill': Math.min(1, completed / Math.max(1, model.weekly.goals.length)) } as React.CSSProperties}>{completed > 0 ? completed : ''}</i>
              </div>
            ))}
          </div>
          {model.weekly.goals.length === 0 ? (
            <p className="faint" style={{ fontSize: 13, marginTop: 12 }}>
              Sem metas nesta semana.
            </p>
          ) : (
            <div className="week-goals">
              {model.weekly.goals.slice(0, 8).map((g) => (
                <div key={g.habit.id} className={cx('week-goal', `hue-${g.habit.color}`)}>
                  <span className="truncate">{g.habit.name}</span>
                  <span className="num">
                    {g.done}/{g.target}
                  </span>
                  <div className="bar bar-thin" style={{ gridColumn: '1 / -1' }}>
                    <div className="bar-fill" style={{ width: `${g.pct * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </a>
      </div>

      <div style={{ marginTop: 16 }}>
        <NotificationNotice dismissible />
      </div>
    </div>
  );
}

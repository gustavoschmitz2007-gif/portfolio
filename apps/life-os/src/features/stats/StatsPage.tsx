import { useMemo, useState } from 'react';
import { ChartColumn, Plus, Trophy } from 'lucide-react';
import { addDays, diffDays, formatDayMonth, formatDayMonthYear, formatMonthShort, formatWeekRange, orderedWeekdays, startOfWeek, WEEKDAY_SHORT } from '../../core/date';
import { academicStats, compareWeeks, habitStats, heatmap, monthSeries, periodTotals, tasksDone, weekSeries } from '../../core/stats';
import { completionsOn, firstActivityDay } from '../../core/habits';
import { useData } from '../../store/store';
import { useToday } from '../../store/clock';
import { openSheet } from '../../store/ui';
import { cx, Empty, Pct, Segmented, TileIcon } from '../../ui/components';
import { ColumnChart, Heatmap } from './charts';

type Period = '4' | '12' | '26';

export default function StatsPage() {
  const data = useData();
  const today = useToday();
  const [period, setPeriod] = useState<Period>('12');
  const weeks = Number(period);
  const wso = data.settings.weekStartsOn;
  const from = addDays(startOfWeek(today, wso), -7 * (weeks - 1));

  const m = useMemo(() => {
    const totals = periodTotals(data, today, weeks);
    const first = firstActivityDay(data);
    const allSeries = weekSeries(data, today, weeks);
    const firstWeek = first ? startOfWeek(first, wso) : startOfWeek(today, wso);
    const idx = allSeries.findIndex((w) => w.weekStart >= firstWeek);
    const series = allSeries.slice(Math.max(0, Math.min(idx < 0 ? allSeries.length - 1 : idx, allSeries.length - 4)));
    const activeFrom = first && first > from ? first : from;
    const hs = habitStats(data, today, weeks).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.daysDone - a.daysDone);
    const cmp = compareWeeks(data, today);
    const months = monthSeries(data, today, weeks >= 26 ? 6 : weeks >= 12 ? 3 : 2);
    const heat = heatmap(data, today, Math.min(weeks, 26)).map((col) =>
      col.map((c) => ({ ...c, label: `${formatDayMonth(c.date)}: ${c.count ? `${c.count} hábito${c.count > 1 ? 's' : ''} · ${completionsOn(data, c.date).map((h) => h.name).join(', ')}` : 'nenhum registro'}` })),
    );
    const acad = academicStats(data, from, today);
    const tasks = tasksDone(data, from, today);
    return { totals, series, hs, cmp, months, heat, acad, tasks, activeFrom };
  }, [data, today, weeks, from, wso]);

  const hasLogs = Object.keys(data.logs).length > 0;
  const ranked = m.hs.filter((s) => s.rate !== null);
  const best = ranked.slice(0, 3);
  const worst = ranked.length > 3 ? ranked.slice(-3).reverse() : [];
  const cmpRows = (() => {
    const ids = new Set([...m.cmp.current.goals.map((g) => g.habit.id), ...m.cmp.previous.goals.map((g) => g.habit.id)]);
    return [...ids].map((id) => {
      const c = m.cmp.current.goals.find((g) => g.habit.id === id);
      const p = m.cmp.previous.goals.find((g) => g.habit.id === id);
      const habit = (c ?? p)!.habit;
      return { habit, cur: c?.done ?? 0, curT: c?.target ?? 0, prev: p?.done ?? 0, prevT: p?.target ?? 0 };
    });
  })();
  const maxCmp = Math.max(1, ...cmpRows.flatMap((r) => [r.cur, r.prev, r.curT, r.prevT]));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Estatísticas</h1>
          <p className="page-sub">Calculadas a partir dos seus registros · desde {formatDayMonthYear(from)}</p>
        </div>
        <div className="page-actions">
          <Segmented<Period>
            value={period}
            onChange={setPeriod}
            options={[
              { value: '4', label: '4 sem.' },
              { value: '12', label: '12 sem.' },
              { value: '26', label: '6 meses' },
            ]}
          />
        </div>
      </div>

      {!hasLogs ? (
        <div className="card">
          <Empty
            icon={<ChartColumn size={24} />}
            title="Ainda sem dados"
            text="As estatísticas aparecem conforme você registra seus hábitos. Nenhum número aqui é inventado: tudo vem do que você marca."
            action={
              Object.keys(data.habits).length === 0 ? (
                <button className="btn btn-accent" onClick={() => openSheet({ kind: 'habit' })}>
                  <Plus size={17} /> Criar hábito
                </button>
              ) : (
                <a className="btn btn-accent" href="#/habitos">
                  Registrar hábitos
                </a>
              )
            }
          />
        </div>
      ) : (
        <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
          <div className="kpi-grid">
            <div className="card kpi">
              <div className="kpi-label">Consistência</div>
              <div className="kpi-value">
                <Pct value={m.totals.consistency} />
              </div>
              <div className="faint kpi-foot">metas cumpridas no ritmo certo</div>
            </div>
            <div className="card kpi">
              <div className="kpi-label">Metas semanais batidas</div>
              <div className="kpi-value">
                {m.totals.goalsMet}
                <span className="faint" style={{ fontSize: 18 }}>/{m.totals.goalsTotal}</span>
              </div>
              <div className="faint kpi-foot">
                <Pct value={m.totals.goalsTotal ? m.totals.goalsMet / m.totals.goalsTotal : null} /> das metas encerradas
              </div>
            </div>
            <div className="card kpi">
              <div className="kpi-label">Dias com registro</div>
              <div className="kpi-value">{m.totals.checkinDays}</div>
              <div className="faint kpi-foot">de {diffDays(m.activeFrom, today) + 1} dias</div>
            </div>
            <div className="card kpi">
              <div className="kpi-label">Melhor semana</div>
              <div className="kpi-value">
                <Pct value={m.totals.bestWeek?.pct ?? null} />
              </div>
              <div className="faint kpi-foot">{m.totals.bestWeek ? formatWeekRange(m.totals.bestWeek.weekStart) : 'nenhuma semana encerrada'}</div>
            </div>
          </div>

          <div className="stats-grid">
            <section className="card" style={{ gridColumn: 'span 2' }}>
              <div className="card-head">
                <div>
                  <div className="card-title">Consistência semanal</div>
                  <div className="card-sub">% das metas cumpridas em cada semana</div>
                </div>
              </div>
              <ColumnChart
                points={m.series.map((w) => ({
                  key: w.weekStart,
                  label: formatDayMonth(w.weekStart).split(' ')[0] + (weeks <= 12 ? ' ' + formatDayMonth(w.weekStart).split(' ')[1] : ''),
                  value: w.pct,
                  highlight: w.current,
                  tooltip: (
                    <>
                      <b>{formatWeekRange(w.weekStart)}</b>
                      <br />
                      {w.pct === null ? 'Sem metas' : `${Math.round(w.pct * 100)}% · ${w.met}/${w.goals} metas${w.current ? ' (em andamento)' : ''}`}
                    </>
                  ),
                }))}
              />
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Hábitos no período</div>
                  <div className="card-sub">taxa de cumprimento da meta</div>
                </div>
              </div>
              {ranked.length === 0 ? (
                <Empty small title="Sem semanas suficientes" text="A taxa aparece após a primeira semana completa." />
              ) : (
                <div className="rank-list">
                  {ranked.map((s, i) => (
                    <div key={s.habit.id} className={cx('rank-row', `hue-${s.habit.color}`)}>
                      <TileIcon icon={s.habit.icon} color={s.habit.color} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="row" style={{ '--gap': '6px' } as React.CSSProperties}>
                          <span className="truncate" style={{ fontWeight: 600, fontSize: 14 }}>
                            {s.habit.name}
                          </span>
                          {i === 0 && ranked.length > 1 && <Trophy size={13} style={{ color: 'var(--warning)' }} />}
                        </div>
                        <div className="bar bar-thin" style={{ marginTop: 6 }}>
                          <div className="bar-fill" style={{ width: `${(s.rate ?? 0) * 100}%` }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 62 }}>
                        <div className="num" style={{ fontWeight: 750 }}>
                          <Pct value={s.rate} />
                        </div>
                        <div className="faint" style={{ fontSize: 11.5 }}>
                          {s.weeksMet}/{s.weeks} sem.
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <div className="card-title">Destaques</div>
              </div>
              {best.length === 0 ? (
                <Empty small title="Em breve" text="Complete uma semana para ver seus hábitos mais e menos cumpridos." />
              ) : (
                <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
                  <div>
                    <div className="section-label" style={{ marginTop: 0 }}>Mais cumpridos</div>
                    {best.map((s) => (
                      <HighlightRow key={s.habit.id} s={s} />
                    ))}
                  </div>
                  {worst.length > 0 && (
                    <div>
                      <div className="section-label">Pedem mais atenção</div>
                      {worst.map((s) => (
                        <HighlightRow key={s.habit.id} s={s} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="card" style={{ gridColumn: 'span 2' }}>
              <div className="card-head">
                <div>
                  <div className="card-title">Totais no período</div>
                  <div className="card-sub">treinos, sessões, dias estudados…</div>
                </div>
              </div>
              <div className="totals-grid">
                {[...m.hs]
                  .sort((a, b) => (b.habit.dailyTarget > 1 ? b.checkins : b.daysDone) - (a.habit.dailyTarget > 1 ? a.checkins : a.daysDone))
                  .map((s) => (
                    <div key={s.habit.id} className={cx('total-tile', `hue-${s.habit.color}`)}>
                      <TileIcon icon={s.habit.icon} color={s.habit.color} size="sm" />
                      <div style={{ minWidth: 0 }}>
                        <div className="kpi-value" style={{ fontSize: 24 }}>
                          {s.habit.dailyTarget > 1 ? s.checkins : s.daysDone}
                        </div>
                        <div className="truncate muted" style={{ fontSize: 12.5 }}>
                          {s.habit.unit} · {s.habit.name}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Esta semana × anterior</div>
                  <div className="card-sub">registros por hábito</div>
                </div>
              </div>
              <div className="legend">
                <span>
                  <i style={{ background: 'var(--accent)' }} /> Esta semana
                </span>
                <span>
                  <i style={{ background: 'var(--text-3)' }} /> Semana anterior
                </span>
              </div>
              {cmpRows.length === 0 ? (
                <Empty small title="Sem metas para comparar" />
              ) : (
                <div className="cmp-list">
                  {cmpRows.map((r) => {
                    const d = r.cur - r.prev;
                    return (
                      <div key={r.habit.id} className="cmp-row">
                        <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
                          <span className="truncate" style={{ fontWeight: 600, fontSize: 13.5, flex: 1 }}>
                            {r.habit.name}
                          </span>
                          <span className={cx('delta', d > 0 ? 'up' : d < 0 ? 'down' : 'flat')}>{d > 0 ? `+${d}` : d}</span>
                        </div>
                        <div className="cmp-bars">
                          <div className="cmp-bar">
                            <span style={{ width: `${(r.cur / maxCmp) * 100}%`, background: 'var(--accent)' }} />
                            <b className="num">
                              {r.cur}/{r.curT}
                            </b>
                          </div>
                          <div className="cmp-bar">
                            <span style={{ width: `${(r.prev / maxCmp) * 100}%`, background: 'var(--text-3)' }} />
                            <b className="num">
                              {r.prev}/{r.prevT}
                            </b>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Histórico mensal</div>
                  <div className="card-sub">média das metas semanais</div>
                </div>
              </div>
              <div className="month-bars">
                {m.months.map((mo) => (
                  <div key={mo.month} className="month-bar">
                    <div className="month-bar-track">
                      <div className="month-bar-fill" style={{ height: `${(mo.pct ?? 0) * 100}%` }} />
                    </div>
                    <div className="num" style={{ fontWeight: 750, fontSize: 14 }}>
                      <Pct value={mo.pct} />
                    </div>
                    <div className="faint" style={{ fontSize: 12 }}>
                      {formatMonthShort(mo.month + '-01')}
                    </div>
                    <div className="faint" style={{ fontSize: 11 }}>
                      {mo.checkins} reg.
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card" style={{ gridColumn: 'span 2' }}>
              <div className="card-head">
                <div>
                  <div className="card-title">Atividade diária</div>
                  <div className="card-sub">hábitos concluídos por dia</div>
                </div>
              </div>
              <Heatmap cols={m.heat} rowLabels={orderedWeekdays(wso).map((d) => WEEKDAY_SHORT[d])} />
            </section>

            <section className="card" style={{ gridColumn: 'span 2' }}>
              <div className="card-head">
                <div className="card-title">Faculdade e tarefas no período</div>
              </div>
              <div className="kpi-grid kpi-grid-inner">
                <div>
                  <div className="kpi-value">{m.acad.done}</div>
                  <div className="kpi-label">entregas e provas concluídas</div>
                </div>
                <div>
                  <div className="kpi-value">
                    <Pct value={m.acad.done ? m.acad.onTime / m.acad.done : null} />
                  </div>
                  <div className="kpi-label">concluídas dentro do prazo</div>
                </div>
                <div>
                  <div className="kpi-value">{m.acad.pending}</div>
                  <div className="kpi-label">ainda pendentes no período</div>
                </div>
                <div>
                  <div className="kpi-value">{m.tasks}</div>
                  <div className="kpi-label">tarefas concluídas</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function HighlightRow({ s }: { s: ReturnType<typeof habitStats>[number] }) {
  return (
    <div className="row" style={{ padding: '6px 0' }}>
      <TileIcon icon={s.habit.icon} color={s.habit.color} size="sm" />
      <span className="truncate" style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>
        {s.habit.name}
      </span>
      <span className="num" style={{ fontWeight: 750 }}>
        <Pct value={s.rate} />
      </span>
    </div>
  );
}

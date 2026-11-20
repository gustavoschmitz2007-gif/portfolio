import { useMemo } from 'react';
import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react';
import { addDays, formatDayMonth, startOfWeek, weekDays, WEEKDAY_LETTERS, type DateKey } from '../../core/date';
import { countOn, createdDay, goalProgress, isActiveInWeek, isDayDone, weekDoneCount, weekTarget } from '../../core/habits';
import { actions, useData } from '../../store/store';
import { useToday } from '../../store/clock';
import { confirmDialog, openSheet, replaceSheet, toast, toastUndo, useUI } from '../../store/ui';
import { cx, Pct, Sheet, TileIcon } from '../../ui/components';
import { frequencyLabel } from './shared';
import { MiniColumns } from '../stats/charts';

export function HabitDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const data = useData();
  const today = useToday();
  const h = data.habits[id];
  const sheetKey = useUI((s) => s.sheets.find((x) => x.kind === 'habitDetail' && x.id === id)?.key);

  const info = useMemo(() => {
    if (!h) return null;
    const wso = data.settings.weekStartsOn;
    const cws = startOfWeek(today, wso);
    const weeks: Array<{ ws: DateKey; done: number; target: number; active: boolean }> = [];
    for (let i = 11; i >= 0; i--) {
      const ws = addDays(cws, -7 * i);
      const active = isActiveInWeek(data, h, ws);
      weeks.push({ ws, done: weekDoneCount(data, h, ws), target: weekTarget(data, h, ws), active });
    }
    // Weeks in a row with the goal met (current week counts once it's met).
    let streak = 0;
    const cur = weeks[weeks.length - 1];
    const startIdx = cur.active && cur.done >= cur.target ? weeks.length - 1 : weeks.length - 2;
    for (let i = startIdx; i >= 0; i--) {
      const w = weeks[i];
      if (!w.active) break;
      if (w.done >= w.target) streak++;
      else break;
    }
    let totalDays = 0;
    let totalCheckins = 0;
    for (const l of Object.values(data.logs)) {
      if (l.habitId !== h.id) continue;
      totalCheckins += l.count;
      if (l.count >= h.dailyTarget) totalDays++;
    }
    const past4 = weeks.slice(-5, -1).filter((w) => w.active);
    const t4 = past4.reduce((s, w) => s + w.target, 0);
    const a4 = past4.reduce((s, w) => s + Math.min(w.done, w.target), 0);
    // 5-week calendar ending this week.
    const calStart = addDays(cws, -28);
    const cal = Array.from({ length: 35 }, (_, i) => addDays(calStart, i));
    return { weeks, streak, totalDays, totalCheckins, rate4: t4 ? a4 / t4 : null, cal, current: goalProgress(data, h, cws, today) };
  }, [data, h, today]);

  if (!h || !info) return null;
  const area = h.areaId ? data.areas[h.areaId] : null;

  const remove = async () => {
    const n = Object.values(data.logs).filter((l) => l.habitId === h.id).length;
    const ok = await confirmDialog({
      title: `Excluir “${h.name}”?`,
      message: n
        ? `Isso apaga também ${n} registro${n > 1 ? 's' : ''} do histórico. Se quiser só parar de acompanhar e manter o histórico, use “Arquivar”.`
        : 'O hábito será removido.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    const undo = actions.deleteHabit(h.id);
    onClose();
    toastUndo('Hábito excluído', undo);
  };

  const archive = () => {
    actions.setHabitArchived(h.id, !h.archived);
    toast(h.archived ? 'Hábito reativado' : 'Hábito arquivado — histórico preservado');
    if (!h.archived) onClose();
  };

  return (
    <Sheet
      title={
        <span className="row" style={{ '--gap': '12px' } as React.CSSProperties}>
          <TileIcon icon={h.icon} color={h.color} />
          <span style={{ minWidth: 0 }}>
            <span className="truncate" style={{ display: 'block' }}>{h.name}</span>
            <span className="card-sub" style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, letterSpacing: 0 }}>
              {frequencyLabel(h, data.settings.weekStartsOn)}
              {area ? ` · ${area.name}` : ''}
              {h.archived ? ' · Arquivado' : ''}
            </span>
          </span>
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={archive}>
            {h.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            {h.archived ? 'Reativar' : 'Arquivar'}
          </button>
          <button className="btn btn-primary" onClick={() => (sheetKey !== undefined ? replaceSheet(sheetKey, { kind: 'habit', id: h.id }) : openSheet({ kind: 'habit', id: h.id }))}>
            <Pencil size={16} /> Editar
          </button>
        </>
      }
    >
      <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
        <div className="detail-kpis">
          <div className="detail-kpi">
            <div className="kpi-value">
              {info.current.done}
              <span className="faint" style={{ fontSize: 18 }}>/{info.current.target}</span>
            </div>
            <div className="kpi-label">Esta semana</div>
          </div>
          <div className="detail-kpi">
            <div className="kpi-value">
              <Pct value={info.rate4} />
            </div>
            <div className="kpi-label">Últimas 4 semanas</div>
          </div>
          <div className="detail-kpi">
            <div className="kpi-value">{info.streak}</div>
            <div className="kpi-label">{info.streak === 1 ? 'Semana seguida na meta' : 'Semanas seguidas na meta'}</div>
          </div>
          <div className="detail-kpi">
            <div className="kpi-value">{h.dailyTarget > 1 ? info.totalCheckins : info.totalDays}</div>
            <div className="kpi-label">Total de {h.unit}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div className="card-head" style={{ marginBottom: 8 }}>
            <div className="card-title">Últimas 12 semanas</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>registros × meta</div>
          </div>
          <MiniColumns
            hue={`var(--c-${h.color})`}
            points={info.weeks.map((w, i) => ({
              label: formatDayMonth(w.ws),
              value: w.active ? w.done : null,
              target: w.active ? w.target : null,
              highlight: i === info.weeks.length - 1,
            }))}
          />
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div className="card-head" style={{ marginBottom: 10 }}>
            <div className="card-title">Últimos 35 dias</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>desde {formatDayMonth(createdDay(h))}</div>
          </div>
          <div className={cx('mini-cal', `hue-${h.color}`)}>
            {weekDays(info.cal[0]).map((d) => (
              <span key={'h' + d} className="mini-cal-head">
                {WEEKDAY_LETTERS[new Date(d + 'T00:00').getDay()]}
              </span>
            ))}
            {info.cal.map((d) => {
              const done = isDayDone(data, h, d);
              const partial = !done && countOn(data, h.id, d) > 0;
              return (
                <span
                  key={d}
                  className={cx('mini-cal-day', done && 'on', partial && 'partial', d === today && 'today', d > today && 'future')}
                  title={`${formatDayMonth(d)}${done ? ' · feito' : ''}`}
                >
                  {Number(d.slice(8))}
                </span>
              );
            })}
          </div>
        </div>

        {h.notes && <div className="notice">{h.notes}</div>}

        <button className="btn btn-danger btn-sm" style={{ alignSelf: 'flex-start' }} onClick={remove}>
          <Trash2 size={15} /> Excluir hábito
        </button>
      </div>
    </Sheet>
  );
}

import { Check, Minus } from 'lucide-react';
import { startOfWeek, type DateKey } from '../../core/date';
import { countOn, goalProgress, isActiveInWeek, weekDoneCount, weekTarget } from '../../core/habits';
import type { AppData, Habit } from '../../core/types';
import { actions, getData } from '../../store/store';
import { openSheet, toastUndo } from '../../store/ui';
import { cx, Ring, Segments, TileIcon } from '../../ui/components';

/** One-tap registration with feedback + undo. */
export function tapHabit(h: Habit, date: DateKey) {
  const before = getData();
  const prev = countOn(before, h.id, date);
  const ws = startOfWeek(date, before.settings.weekStartsOn);
  if (h.dailyTarget > 1) {
    actions.incrementHabit(h.id, date, 1);
    if (prev + 1 === h.dailyTarget) {
      const d = getData();
      toastUndo(`${h.name}: meta do dia batida · ${weekDoneCount(d, h, ws)}/${weekTarget(d, h, ws)} na semana`, () => actions.setHabitCount(h.id, date, prev), 'success');
    }
    return;
  }
  actions.toggleHabit(h.id, date);
  const d = getData();
  if (prev < h.dailyTarget) {
    toastUndo(`${h.name} registrado · ${weekDoneCount(d, h, ws)}/${weekTarget(d, h, ws)} na semana`, () => actions.setHabitCount(h.id, date, prev), 'success');
  } else {
    toastUndo(`${h.name} desmarcado`, () => actions.setHabitCount(h.id, date, prev));
  }
}

export function HabitCheck({ habit, count, onTap, size = 44 }: { habit: Habit; count: number; onTap: () => void; size?: number }) {
  const done = count >= habit.dailyTarget;
  const multi = habit.dailyTarget > 1;
  return (
    <button
      type="button"
      className={cx('hcheck', `hue-${habit.color}`, done && 'on')}
      style={{ width: size, height: size }}
      onClick={(e) => {
        e.stopPropagation();
        onTap();
      }}
      aria-pressed={done}
      aria-label={done ? `${habit.name}: concluído. Toque para ${multi ? 'adicionar' : 'desmarcar'}` : `Marcar ${habit.name} como feito`}
    >
      <Ring value={multi ? count / habit.dailyTarget : done ? 1 : 0} size={size} stroke={3} hue={`var(--c-${habit.color})`} className="hcheck-ring">
        <span className="hcheck-inner" style={{ width: size - 12, height: size - 12 }}>
          {done ? <Check size={18} strokeWidth={3} /> : multi && count > 0 ? <span className="hcheck-count">{count}</span> : <Check size={16} strokeWidth={2.5} style={{ opacity: 0.35 }} />}
        </span>
      </Ring>
    </button>
  );
}

export function HabitTodayRow({ habit, data, date, compact }: { habit: Habit; data: AppData; date: DateKey; compact?: boolean }) {
  const count = countOn(data, habit.id, date);
  const ws = startOfWeek(date, data.settings.weekStartsOn);
  const active = isActiveInWeek(data, habit, ws);
  const g = goalProgress(data, habit, ws, date);
  const done = count >= habit.dailyTarget;
  const metWeek = active && g.done >= g.target;
  let sub: React.ReactNode;
  if (habit.dailyTarget > 1) sub = `${count}/${habit.dailyTarget} ${habit.unit} hoje`;
  else if (!active) sub = 'Fora das metas desta semana';
  else if (metWeek && !done) sub = `Meta da semana cumprida · ${g.done}/${g.target}`;
  else sub = `${g.done}/${g.target} na semana`;

  return (
    <div className={cx('habit-row', done && 'is-done')}>
      <button type="button" className="habit-row-main" onClick={() => openSheet({ kind: 'habitDetail', id: habit.id })}>
        <TileIcon icon={habit.icon} color={habit.color} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="habit-row-title truncate">{habit.name}</div>
          <div className="habit-row-sub">
            <span className="truncate">{sub}</span>
            {habit.time && <span className="faint">· {habit.time}</span>}
          </div>
          {!compact && active && g.target > 0 && (
            <div className={`hue-${habit.color}`} style={{ marginTop: 7, maxWidth: 180 }}>
              <Segments done={g.done} total={g.target} />
            </div>
          )}
        </div>
      </button>
      {habit.dailyTarget > 1 && count > 0 && (
        <button type="button" className="icon-btn icon-btn-sm" aria-label={`Remover um registro de ${habit.name}`} onClick={() => actions.incrementHabit(habit.id, date, -1)}>
          <Minus size={16} />
        </button>
      )}
      <HabitCheck habit={habit} count={count} onTap={() => tapHabit(habit, date)} />
    </div>
  );
}

export function frequencyLabel(h: Habit, weekStartsOn: 0 | 1): string {
  if (h.frequency === 'weekly') return `${h.weeklyTarget}× por semana`;
  if (h.days.length === 7) return h.weeklyTarget === 7 ? 'Todos os dias' : `Diário · meta ${h.weeklyTarget}/7`;
  const names = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const order = weekStartsOn === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  const sel = order.filter((d) => h.days.includes(d));
  if (sel.length === 5 && [1, 2, 3, 4, 5].every((d) => h.days.includes(d))) return 'Seg a sex';
  return sel.map((d) => names[d]).join(', ');
}

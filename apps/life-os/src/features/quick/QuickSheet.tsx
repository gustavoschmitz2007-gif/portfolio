import { useMemo } from 'react';
import { Bell, CalendarDays, Check, GraduationCap, ListTodo, Plus } from 'lucide-react';
import { startOfWeek } from '../../core/date';
import { countOn, habitsForDay, isActiveInWeek, weekDoneCount, weekTarget } from '../../core/habits';
import { useData } from '../../store/store';
import { useToday } from '../../store/clock';
import { replaceSheet, useUI } from '../../store/ui';
import { cx, Sheet } from '../../ui/components';
import { DynIcon } from '../../ui/icons';
import { tapHabit } from '../habits/shared';
import { TaskQuickInput } from './TaskQuickInput';

/** The "+" button: log a habit in one tap or create anything without navigating. */
export function QuickSheet({ onClose }: { onClose: () => void }) {
  const data = useData();
  const today = useToday();
  const key = useUI((s) => s.sheets.find((x) => x.kind === 'quick')?.key);
  const ws = startOfWeek(today, data.settings.weekStartsOn);
  const habits = useMemo(() => habitsForDay(data, today), [data, today]);
  const go = (spec: Parameters<typeof replaceSheet>[1]) => key !== undefined && replaceSheet(key, spec);

  return (
    <Sheet title="Registro rápido" onClose={onClose} wide>
      <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
        {habits.length > 0 && (
          <div>
            <div className="section-label" style={{ marginTop: 0 }}>Toque para registrar hoje</div>
            <div className="quick-habits">
              {habits.map((h) => {
                const c = countOn(data, h.id, today);
                const done = c >= h.dailyTarget;
                const active = isActiveInWeek(data, h, ws);
                const sub = h.dailyTarget > 1 ? `${c}/${h.dailyTarget} hoje` : active ? `${weekDoneCount(data, h, ws)}/${weekTarget(data, h, ws)} semana` : '';
                return (
                  <button key={h.id} className={cx('quick-habit', `hue-${h.color}`, done && 'on')} onClick={() => tapHabit(h, today)} aria-pressed={done}>
                    <span className="quick-habit-icon">{done ? <Check size={20} strokeWidth={3} /> : <DynIcon name={h.icon} size={20} />}</span>
                    <span className="quick-habit-name">{h.name}</span>
                    <span className="quick-habit-sub">{sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className="section-label" style={{ marginTop: 0 }}>Tarefa para hoje</div>
          <TaskQuickInput date={today} autoFocus={habits.length === 0 && window.innerWidth >= 768} />
        </div>

        <div>
          <div className="section-label" style={{ marginTop: 0 }}>Criar</div>
          <div className="quick-create">
            <button onClick={() => go({ kind: 'task', date: today })}>
              <span className="tile-icon hue-slate"><ListTodo size={19} /></span>
              Tarefa
            </button>
            <button onClick={() => go({ kind: 'reminder' })}>
              <span className="tile-icon hue-yellow"><Bell size={19} /></span>
              Lembrete
            </button>
            <button onClick={() => go({ kind: 'academic' })}>
              <span className="tile-icon hue-violet"><GraduationCap size={19} /></span>
              Faculdade
            </button>
            <button onClick={() => go({ kind: 'event', date: today })}>
              <span className="tile-icon hue-blue"><CalendarDays size={19} /></span>
              Compromisso
            </button>
            <button onClick={() => go({ kind: 'habit' })}>
              <span className="tile-icon hue-green"><Plus size={19} /></span>
              Hábito
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

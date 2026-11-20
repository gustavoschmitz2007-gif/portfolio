import { formatLongDate, type DateKey } from '../../core/date';
import { countOn } from '../../core/habits';
import { actions, useData } from '../../store/store';
import { Sheet, Stepper, TileIcon } from '../../ui/components';

/** Adjust the check-in count of a multi-count habit for a specific day. */
export function HabitCountSheet({ id, date, onClose }: { id: string; date: DateKey; onClose: () => void }) {
  const data = useData();
  const h = data.habits[id];
  if (!h) return null;
  const count = countOn(data, id, date);
  return (
    <Sheet title={h.name} onClose={onClose} className="dialog" footer={<button className="btn btn-primary" onClick={onClose}>Pronto</button>}>
      <div className="stack" style={{ alignItems: 'center', '--gap': '16px', padding: '6px 0 4px' } as React.CSSProperties}>
        <TileIcon icon={h.icon} color={h.color} size="lg" />
        <div className="muted">{formatLongDate(date)}</div>
        <Stepper value={count} onChange={(v) => actions.setHabitCount(id, date, v)} min={0} max={99} />
        <div className="faint" style={{ fontSize: 13 }}>
          Meta do dia: {h.dailyTarget} {h.unit} · {count >= h.dailyTarget ? 'concluída' : `faltam ${h.dailyTarget - count}`}
        </div>
      </div>
    </Sheet>
  );
}

import { useState } from 'react';
import { AlarmClock, Clock, Sunrise, Sun } from 'lucide-react';
import { addDays, addMinutesLocal, nowLocal, todayKey, toLocalDateTime } from '../../core/date';
import { actions, useData } from '../../store/store';
import { toast } from '../../store/ui';
import { Sheet } from '../../ui/components';

export function SnoozeSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const data = useData();
  const r = data.reminders[id];
  const [custom, setCustom] = useState(() => addMinutesLocal(nowLocal(), 120));
  if (!r) return null;
  const now = nowLocal();
  const today = todayKey();
  const tonight = toLocalDateTime(today, '20:00');
  const options = [
    { label: 'Em 10 minutos', icon: <Clock size={18} />, at: addMinutesLocal(now, 10) },
    { label: 'Em 1 hora', icon: <AlarmClock size={18} />, at: addMinutesLocal(now, 60) },
    { label: 'Em 3 horas', icon: <AlarmClock size={18} />, at: addMinutesLocal(now, 180) },
    ...(tonight > addMinutesLocal(now, 30) ? [{ label: 'Hoje às 20:00', icon: <Sun size={18} />, at: tonight }] : []),
    { label: 'Amanhã às 9:00', icon: <Sunrise size={18} />, at: toLocalDateTime(addDays(today, 1), '09:00') },
  ];
  const apply = (at: string, label: string) => {
    actions.snoozeReminder(id, at);
    toast(`Adiado: ${label.toLowerCase()}`);
    onClose();
  };
  return (
    <Sheet title="Adiar lembrete" onClose={onClose} className="dialog">
      <p className="muted" style={{ marginBottom: 12, fontSize: 14 }}>
        {r.title}
      </p>
      <div className="list">
        {options.map((o) => (
          <button key={o.label} className="list-row clickable" onClick={() => apply(o.at, o.label)}>
            <span className="tile-icon tile-icon-sm hue-yellow">{o.icon}</span>
            <span className="list-row-main" style={{ textAlign: 'left' }}>
              <span className="list-row-title">{o.label}</span>
            </span>
            <span className="faint num" style={{ fontSize: 13 }}>
              {o.at.slice(11, 16)}
            </span>
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <input className="input" type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value.slice(0, 16))} aria-label="Data e hora personalizadas" />
        <button className="btn btn-primary" onClick={() => custom && apply(custom, 'para o horário escolhido')}>
          Adiar
        </button>
      </div>
    </Sheet>
  );
}

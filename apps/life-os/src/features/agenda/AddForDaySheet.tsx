import { Bell, CalendarDays, GraduationCap, ListTodo } from 'lucide-react';
import { formatLongDate } from '../../core/date';
import { replaceSheet, useUI } from '../../store/ui';
import { Sheet } from '../../ui/components';

export function AddForDaySheet({ date, onClose }: { date: string; onClose: () => void }) {
  const key = useUI((s) => s.sheets.find((x) => x.kind === 'addForDay')?.key);
  const go = (spec: Parameters<typeof replaceSheet>[1]) => (key !== undefined ? replaceSheet(key, spec) : onClose());
  const options = [
    { label: 'Compromisso', desc: 'Aula, consulta, reunião, evento', icon: <CalendarDays size={18} />, hue: 'blue', onClick: () => go({ kind: 'event', date }) },
    { label: 'Tarefa', desc: 'Algo para fazer neste dia', icon: <ListTodo size={18} />, hue: 'slate', onClick: () => go({ kind: 'task', date }) },
    { label: 'Lembrete', desc: 'Aviso em um horário', icon: <Bell size={18} />, hue: 'yellow', onClick: () => go({ kind: 'reminder', date }) },
    { label: 'Faculdade', desc: 'Prova, trabalho ou entrega', icon: <GraduationCap size={18} />, hue: 'violet', onClick: () => go({ kind: 'academic', date }) },
  ];
  return (
    <Sheet title="Adicionar" onClose={onClose} className="dialog">
      <p className="muted" style={{ marginBottom: 10 }}>
        {formatLongDate(date)}
      </p>
      <div className="list">
        {options.map((o) => (
          <button key={o.label} className="list-row clickable" onClick={o.onClick}>
            <span className={`tile-icon hue-${o.hue}`}>{o.icon}</span>
            <span className="list-row-main" style={{ textAlign: 'left' }}>
              <span className="list-row-title" style={{ display: 'block' }}>
                {o.label}
              </span>
              <span className="list-row-sub">{o.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

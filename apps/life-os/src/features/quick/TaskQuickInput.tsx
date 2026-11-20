import { useState } from 'react';
import { CalendarClock, Clock, CornerDownLeft, Flag, Plus } from 'lucide-react';
import { relativeDayLabel, type DateKey } from '../../core/date';
import { parseQuickTask } from '../../core/parse';
import { actions } from '../../store/store';
import { useToday } from '../../store/clock';
import { toast } from '../../store/ui';
import { PRIORITY_LABEL } from '../../ui/labels';

/** One-line task entry with light parsing: "Estudar 14h !" → 14:00, alta prioridade. */
export function TaskQuickInput({ date, autoFocus, onAdded }: { date: DateKey; autoFocus?: boolean; onAdded?: () => void }) {
  const today = useToday();
  const [text, setText] = useState('');
  const parsed = parseQuickTask(text, today);
  const submit = () => {
    if (!parsed.title) return;
    const target = parsed.date ?? date;
    actions.addTask({ title: parsed.title, date: target, time: parsed.time, priority: parsed.priority ?? 'medium' });
    setText('');
    toast(target === date ? 'Tarefa adicionada' : `Tarefa adicionada para ${relativeDayLabel(target, today).toLowerCase()}`, { tone: 'success' });
    onAdded?.();
  };
  return (
    <form
      className="quick-add"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Plus size={19} className="faint" />
      <input
        className="input input-bare"
        placeholder="Nova tarefa… (ex.: Estudar 14h !)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Adicionar tarefa rapidamente"
        enterKeyHint="done"
        autoFocus={autoFocus}
      />
      {text && (
        <div className="quick-add-chips">
          {parsed.time && (
            <span className="badge">
              <Clock size={12} /> {parsed.time}
            </span>
          )}
          {parsed.priority && (
            <span className="badge badge-danger">
              <Flag size={12} /> {PRIORITY_LABEL[parsed.priority]}
            </span>
          )}
          {parsed.date && parsed.date !== date && (
            <span className="badge badge-info">
              <CalendarClock size={12} /> {relativeDayLabel(parsed.date, today)}
            </span>
          )}
        </div>
      )}
      <button type="submit" className="icon-btn icon-btn-sm icon-btn-filled" aria-label="Adicionar" disabled={!parsed.title}>
        <CornerDownLeft size={16} />
      </button>
    </form>
  );
}

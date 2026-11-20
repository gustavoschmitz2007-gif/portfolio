import { useMemo, useState } from 'react';
import { CalendarPlus, Trash2 } from 'lucide-react';
import { addDays, nowLocal, toLocalDateTime } from '../../core/date';
import { REPEAT_LABELS } from '../../core/recurrence';
import type { Repeat, RepeatType } from '../../core/types';
import { actions, getData, useData } from '../../store/store';
import { useToday } from '../../store/clock';
import { toast, toastUndo } from '../../store/ui';
import { DaysPicker, Field, FieldGroup, Sheet } from '../../ui/components';
import { notificationSupport, requestNotificationPermission } from '../../app/notify';
import { downloadIcs } from '../settings/backup';

function defaultTime(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60);
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

export function ReminderForm({ id, date, time, onClose }: { id?: string; date?: string; time?: string; onClose: () => void }) {
  const data = useData();
  const today = useToday();
  const existing = id ? data.reminders[id] : undefined;
  const areas = useMemo(() => Object.values(data.areas).sort((a, b) => a.order - b.order), [data.areas]);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [day, setDay] = useState(existing?.date ?? date ?? today);
  const [hour, setHour] = useState(existing?.time ?? time ?? defaultTime());
  const [repeat, setRepeat] = useState<Repeat>(existing?.repeat ?? { type: 'none', days: [] });
  const [areaId, setAreaId] = useState<string | null>(existing?.areaId ?? null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const t = title.trim();
    if (!t) return setError('Dê um título ao lembrete.');
    if (!hour) return setError('Escolha um horário.');
    const r: Repeat = repeat.type === 'custom' && repeat.days.length === 0 ? { type: 'weekly', days: [] } : repeat;
    if (existing) {
      actions.updateReminder(existing.id, { title: t, description, date: day, time: hour, repeat: r, areaId });
      toast('Lembrete atualizado', { tone: 'success' });
    } else {
      actions.addReminder({ title: t, description, date: day, time: hour, repeat: r, areaId });
      const past = toLocalDateTime(day, hour) <= nowLocal() && r.type === 'none';
      toast(past ? 'Lembrete criado (horário já passou)' : 'Lembrete criado', { tone: 'success' });
      if (notificationSupport() === 'default') await requestNotificationPermission();
    }
    onClose();
  };

  return (
    <Sheet
      title={existing ? 'Editar lembrete' : 'Novo lembrete'}
      onClose={onClose}
      headerExtra={
        existing && (
          <>
            <button className="icon-btn icon-btn-sm" title="Adicionar ao calendário do celular (.ics)" aria-label="Adicionar ao calendário" onClick={() => downloadIcs(getData(), `lembrete-${existing.title}`, { kind: 'reminder', id: existing.id })}>
              <CalendarPlus size={17} />
            </button>
            <button
              className="icon-btn icon-btn-sm"
              aria-label="Excluir lembrete"
              onClick={() => {
                const undo = actions.deleteReminder(existing.id);
                onClose();
                toastUndo('Lembrete excluído', undo);
              }}
            >
              <Trash2 size={17} />
            </button>
          </>
        )
      }
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={save}>
            {existing ? 'Salvar' : 'Criar lembrete'}
          </button>
        </>
      }
    >
      <form
        className="stack"
        style={{ '--gap': '16px' } as React.CSSProperties}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field error={error}>
          <input className="input input-lg" placeholder="Lembrar de…" value={title} onChange={(e) => { setTitle(e.target.value); setError(null); }} autoFocus={!existing} maxLength={200} aria-label="Título" />
        </Field>
        <div className="form-grid">
          <Field label="Data">
            <input className="input" type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} required />
          </Field>
          <Field label="Horário">
            <input className="input" type="time" value={hour} onChange={(e) => setHour(e.target.value)} required />
          </Field>
        </div>
        <div className="row wrap" style={{ '--gap': '6px' } as React.CSSProperties}>
          <button type="button" className="chip" onClick={() => setDay(today)}>Hoje</button>
          <button type="button" className="chip" onClick={() => setDay(addDays(today, 1))}>Amanhã</button>
          <button type="button" className="chip" onClick={() => setDay(addDays(today, 7))}>Em 1 semana</button>
        </div>
        <Field label="Repetir">
          <select className="select" value={repeat.type} onChange={(e) => setRepeat({ type: e.target.value as RepeatType, days: repeat.days })}>
            {(Object.keys(REPEAT_LABELS) as RepeatType[]).map((k) => (
              <option key={k} value={k}>
                {REPEAT_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        {repeat.type === 'custom' && (
          <FieldGroup label="Dias">
            <DaysPicker value={repeat.days} onChange={(days) => setRepeat({ type: 'custom', days })} weekStartsOn={data.settings.weekStartsOn} />
          </FieldGroup>
        )}
        <Field label="Descrição (opcional)">
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Detalhes" />
        </Field>
        <Field label="Categoria">
          <select className="select" value={areaId ?? ''} onChange={(e) => setAreaId(e.target.value || null)}>
            <option value="">Sem categoria</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

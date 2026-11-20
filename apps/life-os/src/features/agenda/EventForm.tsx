import { useMemo, useState } from 'react';
import { CalendarPlus, Trash2 } from 'lucide-react';
import { REPEAT_LABELS } from '../../core/recurrence';
import type { CalendarEvent, RepeatType } from '../../core/types';
import { actions, getData, useData } from '../../store/store';
import { useToday } from '../../store/clock';
import { toast, toastUndo } from '../../store/ui';
import { DaysPicker, Field, FieldGroup, Sheet, Switch } from '../../ui/components';
import { downloadIcs } from '../settings/backup';

type Draft = Pick<CalendarEvent, 'title' | 'date' | 'allDay' | 'time' | 'endTime' | 'areaId' | 'location' | 'notes' | 'repeat' | 'alertMinutes'>;

const ALERTS: Array<{ value: number | null; label: string }> = [
  { value: null, label: 'Sem aviso' },
  { value: 0, label: 'Na hora' },
  { value: 10, label: '10 min antes' },
  { value: 30, label: '30 min antes' },
  { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 dia antes' },
];

export function EventForm({ id, date, time, onClose }: { id?: string; date?: string; time?: string; onClose: () => void }) {
  const data = useData();
  const today = useToday();
  const existing = id ? data.events[id] : undefined;
  const areas = useMemo(() => Object.values(data.areas).sort((a, b) => a.order - b.order), [data.areas]);
  const [d, setD] = useState<Draft>(() => ({
    title: existing?.title ?? '',
    date: existing?.date ?? date ?? today,
    allDay: existing?.allDay ?? !time,
    time: existing?.time ?? time ?? '09:00',
    endTime: existing?.endTime ?? null,
    areaId: existing?.areaId ?? null,
    location: existing?.location ?? '',
    notes: existing?.notes ?? '',
    repeat: existing?.repeat ?? { type: 'none', days: [] },
    alertMinutes: existing ? existing.alertMinutes : 30,
  }));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const save = () => {
    const title = d.title.trim();
    if (!title) return setError('Dê um nome ao compromisso.');
    if (!d.allDay && !d.time) return setError('Informe o horário ou marque “Dia inteiro”.');
    if (!d.allDay && d.endTime && d.time && d.endTime <= d.time) return setError('O término precisa ser depois do início.');
    const payload = { ...d, title, time: d.allDay ? null : d.time, endTime: d.allDay ? null : d.endTime };
    if (existing) {
      actions.updateEvent(existing.id, payload);
      toast('Compromisso atualizado', { tone: 'success' });
    } else {
      actions.addEvent(payload);
      toast('Compromisso adicionado', { tone: 'success' });
    }
    onClose();
  };

  return (
    <Sheet
      title={existing ? 'Editar compromisso' : 'Novo compromisso'}
      onClose={onClose}
      headerExtra={
        existing && (
          <>
            <button className="icon-btn icon-btn-sm" aria-label="Adicionar ao calendário" title="Adicionar ao calendário (.ics)" onClick={() => downloadIcs(getData(), existing.title, { kind: 'event', id: existing.id })}>
              <CalendarPlus size={17} />
            </button>
            <button
              className="icon-btn icon-btn-sm"
              aria-label="Excluir compromisso"
              onClick={() => {
                const undo = actions.deleteEvent(existing.id);
                onClose();
                toastUndo('Compromisso excluído', undo);
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
            {existing ? 'Salvar' : 'Adicionar'}
          </button>
        </>
      }
    >
      <form className="stack" style={{ '--gap': '16px' } as React.CSSProperties} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field error={error}>
          <input className="input input-lg" placeholder="Compromisso (ex.: Aula de Anatomia)" value={d.title} onChange={(e) => { set('title', e.target.value); setError(null); }} autoFocus={!existing} maxLength={200} aria-label="Título" />
        </Field>
        <div className="form-grid">
          <Field label="Data">
            <input className="input" type="date" value={d.date} onChange={(e) => e.target.value && set('date', e.target.value)} required />
          </Field>
          <FieldGroup label="Dia inteiro">
            <div className="row" style={{ minHeight: 46 }}>
              <Switch on={d.allDay} onChange={(v) => set('allDay', v)} label="Dia inteiro" />
            </div>
          </FieldGroup>
        </div>
        {!d.allDay && (
          <div className="form-grid">
            <Field label="Início">
              <input className="input" type="time" value={d.time ?? ''} onChange={(e) => set('time', e.target.value || null)} />
            </Field>
            <Field label="Término (opcional)">
              <input className="input" type="time" value={d.endTime ?? ''} onChange={(e) => set('endTime', e.target.value || null)} />
            </Field>
          </div>
        )}
        <div className="form-grid">
          <Field label="Repetir">
            <select className="select" value={d.repeat.type} onChange={(e) => set('repeat', { type: e.target.value as RepeatType, days: d.repeat.days })}>
              {(Object.keys(REPEAT_LABELS) as RepeatType[]).map((k) => (
                <option key={k} value={k}>
                  {REPEAT_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          {!d.allDay && (
            <Field label="Aviso">
              <select className="select" value={d.alertMinutes === null ? 'none' : String(d.alertMinutes)} onChange={(e) => set('alertMinutes', e.target.value === 'none' ? null : Number(e.target.value))}>
                {ALERTS.map((a) => (
                  <option key={String(a.value)} value={a.value === null ? 'none' : a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {d.repeat.type === 'custom' && (
          <FieldGroup label="Dias">
            <DaysPicker value={d.repeat.days} onChange={(days) => set('repeat', { type: 'custom', days })} weekStartsOn={data.settings.weekStartsOn} />
          </FieldGroup>
        )}
        <div className="form-grid">
          <Field label="Categoria">
            <select className="select" value={d.areaId ?? ''} onChange={(e) => set('areaId', e.target.value || null)}>
              <option value="">Sem categoria</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Local">
            <input className="input" value={d.location} onChange={(e) => set('location', e.target.value)} placeholder="Opcional" maxLength={120} />
          </Field>
        </div>
        <Field label="Notas">
          <textarea className="textarea" value={d.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

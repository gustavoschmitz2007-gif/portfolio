import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { addDays } from '../../core/date';
import type { Priority, Task } from '../../core/types';
import { actions, useData } from '../../store/store';
import { useToday } from '../../store/clock';
import { toast, toastUndo } from '../../store/ui';
import { Field, FieldGroup, Segmented, Sheet, Switch } from '../../ui/components';
import { PRIORITY_LABEL } from '../../ui/labels';

export function TaskForm({ id, date, time, onClose }: { id?: string; date?: string | null; time?: string | null; onClose: () => void }) {
  const data = useData();
  const today = useToday();
  const existing = id ? data.tasks[id] : undefined;
  const areas = useMemo(() => Object.values(data.areas).sort((a, b) => a.order - b.order), [data.areas]);
  const [d, setD] = useState<Pick<Task, 'title' | 'date' | 'time' | 'priority' | 'areaId' | 'notes' | 'remind'>>(() => ({
    title: existing?.title ?? '',
    date: existing ? existing.date : date === undefined ? today : date,
    time: existing?.time ?? time ?? null,
    priority: existing?.priority ?? 'medium',
    areaId: existing?.areaId ?? null,
    notes: existing?.notes ?? '',
    remind: existing?.remind ?? true,
  }));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((p) => ({ ...p, [k]: v }));

  const save = () => {
    const title = d.title.trim();
    if (!title) return setError('Escreva a tarefa.');
    if (existing) {
      actions.updateTask(existing.id, { ...d, title });
      toast('Tarefa atualizada', { tone: 'success' });
    } else {
      actions.addTask({ ...d, title });
      toast('Tarefa adicionada', { tone: 'success' });
    }
    onClose();
  };

  return (
    <Sheet
      title={existing ? 'Editar tarefa' : 'Nova tarefa'}
      onClose={onClose}
      headerExtra={
        existing && (
          <button
            className="icon-btn icon-btn-sm"
            aria-label="Excluir tarefa"
            onClick={() => {
              const undo = actions.deleteTask(existing.id);
              onClose();
              toastUndo('Tarefa excluída', undo);
            }}
          >
            <Trash2 size={17} />
          </button>
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
      <form
        className="stack"
        style={{ '--gap': '16px' } as React.CSSProperties}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field error={error}>
          <input
            className="input input-lg"
            placeholder="O que precisa ser feito?"
            value={d.title}
            onChange={(e) => {
              set('title', e.target.value);
              setError(null);
            }}
            autoFocus={!existing}
            maxLength={200}
            aria-label="Tarefa"
          />
        </Field>
        <div className="form-grid">
          <Field label="Data">
            <input className="input" type="date" value={d.date ?? ''} onChange={(e) => set('date', e.target.value || null)} />
          </Field>
          <Field label="Horário">
            <input className="input" type="time" value={d.time ?? ''} onChange={(e) => set('time', e.target.value || null)} />
          </Field>
        </div>
        <div className="row wrap" style={{ '--gap': '6px' } as React.CSSProperties}>
          <button type="button" className="chip" onClick={() => set('date', today)}>Hoje</button>
          <button type="button" className="chip" onClick={() => set('date', addDays(today, 1))}>Amanhã</button>
          <button type="button" className="chip" onClick={() => set('date', null)}>Sem data</button>
        </div>
        <FieldGroup label="Prioridade">
          <Segmented<Priority>
            block
            value={d.priority}
            onChange={(v) => set('priority', v)}
            options={(['low', 'medium', 'high'] as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
          />
        </FieldGroup>
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
          <FieldGroup label="Avisar no horário">
            <div className="row" style={{ minHeight: 46 }}>
              <Switch on={d.remind && !!d.time} onChange={(v) => set('remind', v)} label="Avisar no horário" />
              <span className="field-hint">{d.time ? (d.remind ? 'Com notificação' : 'Sem notificação') : 'Sem horário'}</span>
            </div>
          </FieldGroup>
        </div>
        <Field label="Notas">
          <textarea className="textarea" value={d.notes} onChange={(e) => set('notes', e.target.value)} rows={3} placeholder="Detalhes, links, observações…" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

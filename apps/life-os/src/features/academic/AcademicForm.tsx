import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { addDays } from '../../core/date';
import type { AcademicItem, AcademicStatus, AcademicType, Priority } from '../../core/types';
import { actions, useData } from '../../store/store';
import { useToday } from '../../store/clock';
import { openSheet, toast } from '../../store/ui';
import { cx, Field, FieldGroup, Segmented, Sheet } from '../../ui/components';
import { DynIcon } from '../../ui/icons';
import { ACADEMIC_TYPES, PRIORITY_LABEL, STATUS_LABEL } from '../../ui/labels';
import { notificationSupport, requestNotificationPermission } from '../../app/notify';

const ALERT_OPTIONS = [
  { value: 0, label: 'No dia' },
  { value: 1, label: '1 dia antes' },
  { value: 2, label: '2 dias antes' },
  { value: 3, label: '3 dias antes' },
  { value: 7, label: '1 semana antes' },
];

type Draft = Pick<AcademicItem, 'title' | 'subjectId' | 'type' | 'date' | 'time' | 'priority' | 'description' | 'notes' | 'status' | 'alerts'>;

export function AcademicForm({ id, date, type, onClose }: { id?: string; date?: string; type?: string; onClose: () => void }) {
  const data = useData();
  const today = useToday();
  const existing = id ? data.academic[id] : undefined;
  const subjects = useMemo(() => Object.values(data.subjects).filter((s) => !s.archived || s.id === existing?.subjectId).sort((a, b) => a.name.localeCompare(b.name)), [data.subjects, existing]);
  const [d, setD] = useState<Draft>(() => ({
    title: existing?.title ?? '',
    subjectId: existing?.subjectId ?? subjects[0]?.id ?? null,
    type: existing?.type ?? ((type as AcademicType) || 'trabalho'),
    date: existing?.date ?? date ?? addDays(today, 7),
    time: existing?.time ?? null,
    priority: existing?.priority ?? 'medium',
    description: existing?.description ?? '',
    notes: existing?.notes ?? '',
    status: existing?.status ?? 'pendente',
    alerts: existing?.alerts ?? [1, 0],
  }));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const title = d.title.trim();
    if (!title) return setError('Dê um nome à atividade.');
    if (!d.date) return setError('Escolha a data.');
    if (existing) {
      actions.updateAcademic(existing.id, { ...d, title });
      toast('Atividade atualizada', { tone: 'success' });
    } else {
      actions.addAcademic({ ...d, title });
      toast('Atividade adicionada', { tone: 'success' });
      if (d.alerts.length && notificationSupport() === 'default') await requestNotificationPermission();
    }
    onClose();
  };

  return (
    <Sheet
      title={existing ? 'Editar atividade' : 'Nova atividade'}
      onClose={onClose}
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
      <form className="stack" style={{ '--gap': '16px' } as React.CSSProperties} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Field error={error}>
          <input className="input input-lg" placeholder="Nome da atividade (ex.: Prova de Cálculo I)" value={d.title} onChange={(e) => { set('title', e.target.value); setError(null); }} autoFocus={!existing} maxLength={200} aria-label="Nome da atividade" />
        </Field>

        <FieldGroup label="Tipo">
          <div className="option-grid">
            {ACADEMIC_TYPES.map((t) => (
              <button type="button" key={t.value} className={cx('option', d.type === t.value && 'on')} onClick={() => set('type', t.value)} aria-pressed={d.type === t.value}>
                <DynIconSafe name={t.icon} />
                {t.label}
              </button>
            ))}
          </div>
        </FieldGroup>

        <FieldGroup
          label="Disciplina"
          aside={
            <button type="button" className="link" style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 2 }} onClick={() => openSheet({ kind: 'subject', onCreated: (sid) => set('subjectId', sid) })}>
              <Plus size={13} /> Nova disciplina
            </button>
          }
        >
          <select className="select" value={d.subjectId ?? ''} onChange={(e) => set('subjectId', e.target.value || null)} aria-label="Disciplina">
            <option value="">Sem disciplina</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </FieldGroup>

        <div className="form-grid">
          <Field label={d.type === 'prova' || d.type === 'apresentacao' ? 'Data de realização' : 'Data de entrega'}>
            <input className="input" type="date" value={d.date} onChange={(e) => e.target.value && set('date', e.target.value)} required />
          </Field>
          <Field label="Horário (opcional)">
            <input className="input" type="time" value={d.time ?? ''} onChange={(e) => set('time', e.target.value || null)} />
          </Field>
        </div>

        <FieldGroup label="Prioridade">
          <Segmented<Priority> block value={d.priority} onChange={(v) => set('priority', v)} options={(['low', 'medium', 'high'] as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
        </FieldGroup>

        <FieldGroup label="Status">
          <Segmented<AcademicStatus> block value={d.status} onChange={(v) => set('status', v)} options={(['pendente', 'andamento', 'concluido'] as AcademicStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
        </FieldGroup>

        <FieldGroup label="Avisos" hint={`Notificação às ${data.settings.notifications.academicTime} do dia escolhido (ajustável em Configurações).`}>
          <div className="row wrap" style={{ '--gap': '6px' } as React.CSSProperties}>
            {ALERT_OPTIONS.map((o) => {
              const on = d.alerts.includes(o.value);
              return (
                <button type="button" key={o.value} className={cx('chip', on && 'active')} aria-pressed={on} onClick={() => set('alerts', on ? d.alerts.filter((x) => x !== o.value) : [...d.alerts, o.value].sort((a, b) => b - a))}>
                  {o.label}
                </button>
              );
            })}
          </div>
        </FieldGroup>

        <Field label="Descrição">
          <textarea className="textarea" value={d.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="O que precisa ser entregue, conteúdo da prova…" />
        </Field>
        <Field label="Observações">
          <textarea className="textarea" value={d.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Grupo, formato, links…" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

function DynIconSafe({ name }: { name: string }) {
  return <DynIcon name={name} size={16} />;
}

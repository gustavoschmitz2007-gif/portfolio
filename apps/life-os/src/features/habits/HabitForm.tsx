import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ColorKey, Habit } from '../../core/types';
import { actions, useData } from '../../store/store';
import { openSheet, toast } from '../../store/ui';
import { ColorPicker, DaysPicker, Field, FieldGroup, IconPicker, Segmented, Sheet, Stepper, Switch, TileIcon, cx } from '../../ui/components';
import { requestNotificationPermission, notificationSupport } from '../../app/notify';

type Draft = Pick<Habit, 'name' | 'areaId' | 'icon' | 'color' | 'frequency' | 'days' | 'weeklyTarget' | 'dailyTarget' | 'unit' | 'time' | 'remind' | 'notes'>;

export function HabitForm({ id, defaults, onClose }: { id?: string; defaults?: Record<string, unknown>; onClose: () => void }) {
  const data = useData();
  const existing = id ? data.habits[id] : undefined;
  const areas = useMemo(() => Object.values(data.areas).sort((a, b) => a.order - b.order), [data.areas]);
  const [d, setD] = useState<Draft>(() => ({
    name: existing?.name ?? '',
    areaId: existing?.areaId ?? areas[0]?.id ?? null,
    icon: existing?.icon ?? 'Target',
    color: existing?.color ?? ('green' as ColorKey),
    frequency: existing?.frequency ?? 'weekly',
    days: existing?.days ?? [],
    weeklyTarget: existing?.weeklyTarget ?? 3,
    dailyTarget: existing?.dailyTarget ?? 1,
    unit: existing?.unit ?? 'vezes',
    time: existing?.time ?? null,
    remind: existing?.remind ?? false,
    notes: existing?.notes ?? '',
    ...(defaults as Partial<Draft>),
  }));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const wso = data.settings.weekStartsOn;

  const setFrequency = (f: Habit['frequency']) => {
    setD((p) => {
      if (f === 'daily') {
        const days = p.days.length ? p.days : [0, 1, 2, 3, 4, 5, 6];
        return { ...p, frequency: f, days, weeklyTarget: Math.min(p.weeklyTarget, days.length) || days.length };
      }
      return { ...p, frequency: f, weeklyTarget: Math.min(Math.max(p.weeklyTarget, 1), 14) };
    });
  };

  const setDays = (days: number[]) => {
    setD((p) => {
      if (p.frequency !== 'daily') return { ...p, days };
      // Keep goal in sync with the number of scheduled days when it used to match.
      const wasFull = p.weeklyTarget >= p.days.length;
      return { ...p, days, weeklyTarget: wasFull ? days.length : Math.min(p.weeklyTarget, days.length) };
    });
  };

  const save = async () => {
    const name = d.name.trim();
    if (!name) return setError('Dê um nome ao hábito.');
    if (d.frequency === 'daily' && d.days.length === 0) return setError('Escolha pelo menos um dia da semana.');
    const payload: Partial<Habit> = { ...d, name, weeklyTarget: Math.max(1, d.weeklyTarget), unit: d.unit.trim() || 'vezes' };
    if (payload.remind && payload.time && notificationSupport() === 'default') await requestNotificationPermission();
    if (existing) {
      actions.updateHabit(existing.id, payload);
      toast('Hábito atualizado', { tone: 'success' });
    } else {
      actions.addHabit({ ...payload, name });
      toast(`“${name}” criado`, { tone: 'success' });
    }
    onClose();
  };

  const maxTarget = d.frequency === 'daily' ? d.days.length || 7 : 14;

  return (
    <Sheet
      title={existing ? 'Editar hábito' : 'Novo hábito'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={save}>
            {existing ? 'Salvar' : 'Criar hábito'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
        <div className="row" style={{ '--gap': '12px' } as React.CSSProperties}>
          <TileIcon icon={d.icon} color={d.color} size="lg" />
          <input
            className="input input-lg"
            placeholder="Nome do hábito (ex.: Academia)"
            value={d.name}
            onChange={(e) => {
              set('name', e.target.value);
              setError(null);
            }}
            autoFocus={!existing}
            maxLength={80}
            aria-label="Nome do hábito"
          />
        </div>
        {error && <div className="field-error">{error}</div>}

        <FieldGroup label="Tipo">
          <Segmented
            block
            value={d.frequency}
            onChange={setFrequency}
            options={[
              { value: 'weekly', label: 'X vezes por semana' },
              { value: 'daily', label: 'Dias fixos' },
            ]}
          />
          <span className="field-hint">
            {d.frequency === 'weekly' ? 'Flexível: faça em qualquer dia até bater a meta (ex.: Academia 3×).' : 'Esperado em dias específicos (ex.: Dieta todos os dias, Estudo seg–sex).'}
          </span>
        </FieldGroup>

        {d.frequency === 'daily' ? (
          <FieldGroup label="Dias da semana">
            <DaysPicker value={d.days} onChange={setDays} weekStartsOn={wso} />
          </FieldGroup>
        ) : (
          <FieldGroup label="Dias preferidos (opcional)" hint="Usado só como sugestão; você pode registrar em qualquer dia.">
            <DaysPicker value={d.days} onChange={(v) => set('days', v)} weekStartsOn={wso} />
          </FieldGroup>
        )}

        <div className="form-grid">
          <FieldGroup label="Meta semanal">
            <Stepper value={Math.min(d.weeklyTarget, maxTarget)} onChange={(v) => set('weeklyTarget', v)} min={1} max={maxTarget} suffix={d.frequency === 'daily' ? 'dias' : '×'} />
          </FieldGroup>
          <FieldGroup label="Vezes por dia" hint={d.dailyTarget > 1 ? 'Ex.: copos de água' : 'Um toque = feito'}>
            <Stepper value={d.dailyTarget} onChange={(v) => set('dailyTarget', v)} min={1} max={30} />
          </FieldGroup>
        </div>

        <div className="form-grid">
          <FieldGroup
            label="Categoria"
            aside={
              <button type="button" className="link" style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 2 }} onClick={() => openSheet({ kind: 'area', onCreated: (aid) => set('areaId', aid) })}>
                <Plus size={13} /> Nova
              </button>
            }
          >
            <select className="select" value={d.areaId ?? ''} onChange={(e) => set('areaId', e.target.value || null)} aria-label="Categoria">
              <option value="">Sem categoria</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </FieldGroup>
          <Field label="Unidade" hint="Aparece nas estatísticas">
            <input className="input" value={d.unit} onChange={(e) => set('unit', e.target.value)} placeholder="treinos, dias…" maxLength={24} />
          </Field>
        </div>

        <FieldGroup label="Cor">
          <ColorPicker value={d.color} onChange={(c) => set('color', c)} />
        </FieldGroup>

        <FieldGroup label="Ícone">
          <IconPicker value={d.icon} onChange={(v) => set('icon', v)} color={d.color} />
        </FieldGroup>

        <div className="form-grid">
          <Field label="Horário (opcional)">
            <input className="input" type="time" value={d.time ?? ''} onChange={(e) => set('time', e.target.value || null)} />
          </Field>
          <FieldGroup label="Lembrar no horário">
            <div className={cx('row')} style={{ minHeight: 46 }}>
              <Switch on={d.remind && !!d.time} onChange={(v) => set('remind', v)} label="Lembrar no horário" />
              <span className="field-hint">{d.time ? (d.remind ? 'Notificação ativada' : 'Sem notificação') : 'Defina um horário'}</span>
            </div>
          </FieldGroup>
        </div>

        <Field label="Notas (opcional)">
          <textarea className="textarea" value={d.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ex.: treino A/B, meta de 2L…" rows={2} />
        </Field>
      </div>
    </Sheet>
  );
}

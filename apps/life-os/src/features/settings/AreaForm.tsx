import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ColorKey } from '../../core/types';
import { actions, useData } from '../../store/store';
import { confirmDialog, toast } from '../../store/ui';
import { ColorPicker, Field, FieldGroup, IconPicker, Sheet, TileIcon } from '../../ui/components';

export function AreaForm({ id, onCreated, onClose }: { id?: string; onCreated?: (id: string) => void; onClose: () => void }) {
  const data = useData();
  const existing = id ? data.areas[id] : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState<ColorKey>(existing?.color ?? 'aqua');
  const [icon, setIcon] = useState(existing?.icon ?? 'Tag');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const n = name.trim();
    if (!n) return setError('Dê um nome à categoria.');
    if (existing) {
      actions.updateArea(existing.id, { name: n, color, icon });
      toast('Categoria atualizada', { tone: 'success' });
    } else {
      const newId = actions.addArea({ name: n, color, icon });
      onCreated?.(newId);
      toast('Categoria criada', { tone: 'success' });
    }
    onClose();
  };

  const remove = async () => {
    if (!existing) return;
    const used = [...Object.values(data.habits), ...Object.values(data.tasks), ...Object.values(data.reminders), ...Object.values(data.events)].filter((x) => x.areaId === existing.id).length;
    const ok = await confirmDialog({
      title: `Excluir “${existing.name}”?`,
      message: used ? `${used} ${used === 1 ? 'item usa' : 'itens usam'} esta categoria e ficarão sem categoria. Nada será apagado.` : undefined,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    actions.deleteArea(existing.id);
    toast('Categoria excluída');
    onClose();
  };

  return (
    <Sheet
      title={existing ? 'Editar categoria' : 'Nova categoria'}
      onClose={onClose}
      headerExtra={
        existing && (
          <button className="icon-btn icon-btn-sm" aria-label="Excluir categoria" onClick={remove}>
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
            Salvar
          </button>
        </>
      }
    >
      <form className="stack" style={{ '--gap': '16px' } as React.CSSProperties} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="row" style={{ '--gap': '12px' } as React.CSSProperties}>
          <TileIcon icon={icon} color={color} size="lg" />
          <Field error={error} className="spacer">
            <input className="input input-lg" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="Ex.: Trabalho, Finanças, Espiritualidade" autoFocus maxLength={40} aria-label="Nome da categoria" />
          </Field>
        </div>
        <FieldGroup label="Cor">
          <ColorPicker value={color} onChange={setColor} />
        </FieldGroup>
        <FieldGroup label="Ícone">
          <IconPicker value={icon} onChange={setIcon} color={color} />
        </FieldGroup>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ColorKey } from '../../core/types';
import { actions, useData } from '../../store/store';
import { confirmDialog, toast } from '../../store/ui';
import { ColorPicker, Field, FieldGroup, Sheet } from '../../ui/components';

export function SubjectForm({ id, onCreated, onClose }: { id?: string; onCreated?: (id: string) => void; onClose: () => void }) {
  const data = useData();
  const existing = id ? data.subjects[id] : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [professor, setProfessor] = useState(existing?.professor ?? '');
  const [color, setColor] = useState<ColorKey>(existing?.color ?? 'violet');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const n = name.trim();
    if (!n) return setError('Informe o nome da disciplina.');
    if (existing) {
      actions.updateSubject(existing.id, { name: n, professor, color });
      toast('Disciplina atualizada', { tone: 'success' });
    } else {
      const newId = actions.addSubject({ name: n, professor, color });
      onCreated?.(newId);
      toast('Disciplina criada', { tone: 'success' });
    }
    onClose();
  };

  const remove = async () => {
    if (!existing) return;
    const n = Object.values(data.academic).filter((a) => a.subjectId === existing.id).length;
    const ok = await confirmDialog({
      title: `Excluir “${existing.name}”?`,
      message: n ? `${n} atividade${n > 1 ? 's' : ''} ficará${n > 1 ? 'ão' : ''} sem disciplina (não serão apagadas).` : undefined,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    actions.deleteSubject(existing.id);
    toast('Disciplina excluída');
    onClose();
  };

  return (
    <Sheet
      title={existing ? 'Editar disciplina' : 'Nova disciplina'}
      onClose={onClose}
      className="dialog"
      headerExtra={
        existing && (
          <button className="icon-btn icon-btn-sm" aria-label="Excluir disciplina" onClick={remove}>
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
        <Field label="Nome" error={error}>
          <input className="input" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="Ex.: Cálculo I" autoFocus maxLength={80} />
        </Field>
        <Field label="Professor(a) (opcional)">
          <input className="input" value={professor} onChange={(e) => setProfessor(e.target.value)} placeholder="Nome" maxLength={80} />
        </Field>
        <FieldGroup label="Cor">
          <ColorPicker value={color} onChange={setColor} />
        </FieldGroup>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

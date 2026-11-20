import { CalendarPlus, Check, Clock, Flag, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { countdownLabel, formatLongDate } from '../../core/date';
import type { AcademicStatus } from '../../core/types';
import { actions, getData, useData } from '../../store/store';
import { useToday } from '../../store/clock';
import { openSheet, replaceSheet, toastUndo, useUI } from '../../store/ui';
import { cx, Segmented, Sheet } from '../../ui/components';
import { DynIcon } from '../../ui/icons';
import { ACADEMIC_TYPES, PRIORITY_LABEL, STATUS_LABEL, URGENCY_BADGE, urgencyOf } from '../../ui/labels';
import { downloadIcs } from '../settings/backup';

export function AcademicDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const data = useData();
  const today = useToday();
  const a = data.academic[id];
  const sheetKey = useUI((s) => s.sheets.find((x) => x.kind === 'academicDetail' && x.id === id)?.key);
  if (!a) return null;
  const subj = a.subjectId ? data.subjects[a.subjectId] : null;
  const type = ACADEMIC_TYPES.find((t) => t.value === a.type)!;
  const u = urgencyOf(a, today);
  const color = subj?.color ?? 'violet';

  const edit = () => (sheetKey !== undefined ? replaceSheet(sheetKey, { kind: 'academic', id }) : openSheet({ kind: 'academic', id }));
  const remove = () => {
    const undo = actions.deleteAcademic(id);
    onClose();
    toastUndo('Atividade excluída', undo);
  };

  return (
    <Sheet
      title={
        <span className="row" style={{ '--gap': '12px' } as React.CSSProperties}>
          <span className={cx('tile-icon', `hue-${color}`)}>
            <DynIcon name={type.icon} size={19} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block' }} className="truncate">
              {a.title}
            </span>
            <span className="card-sub" style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, letterSpacing: 0 }}>
              {type.label}
              {subj ? ` · ${subj.name}` : ''}
            </span>
          </span>
        </span>
      }
      onClose={onClose}
      headerExtra={
        <button className="icon-btn icon-btn-sm" title="Adicionar ao calendário (.ics)" aria-label="Adicionar ao calendário" onClick={() => downloadIcs(getData(), a.title, { kind: 'academic', id })}>
          <CalendarPlus size={17} />
        </button>
      }
      footer={
        <>
          <button className="btn btn-outline" onClick={edit}>
            <Pencil size={16} /> Editar
          </button>
          {a.status === 'concluido' ? (
            <button className="btn btn-primary" onClick={() => actions.setAcademicStatus(id, 'pendente')}>
              <RotateCcw size={16} /> Reabrir
            </button>
          ) : (
            <button
              className="btn btn-accent"
              onClick={() => {
                const prev = a.status;
                actions.setAcademicStatus(id, 'concluido');
                toastUndo('Atividade concluída 🎓', () => actions.setAcademicStatus(id, prev), 'success');
                onClose();
              }}
            >
              <Check size={16} strokeWidth={3} /> Concluir
            </button>
          )}
        </>
      }
    >
      <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
        <div className="detail-when">
          <div>
            <div className="kpi-label">{a.type === 'prova' || a.type === 'apresentacao' ? 'Data' : 'Entrega'}</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{formatLongDate(a.date)}</div>
            <div className="row muted" style={{ '--gap': '12px', fontSize: 13, marginTop: 4 } as React.CSSProperties}>
              {a.time && (
                <span className="row" style={{ '--gap': '4px' } as React.CSSProperties}>
                  <Clock size={14} /> {a.time}
                </span>
              )}
              <span className="row" style={{ '--gap': '4px' } as React.CSSProperties}>
                <Flag size={14} className={cx('prio-flag', a.priority)} /> Prioridade {PRIORITY_LABEL[a.priority].toLowerCase()}
              </span>
            </div>
          </div>
          <span className={cx('badge', URGENCY_BADGE[u])} style={{ height: 26, fontSize: 12.5 }}>
            {u === 'done' ? 'Concluído' : countdownLabel(a.date, today)}
          </span>
        </div>

        <Segmented<AcademicStatus>
          block
          value={a.status}
          onChange={(s) => actions.setAcademicStatus(id, s)}
          options={(['pendente', 'andamento', 'concluido'] as AcademicStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        />

        {a.description && (
          <div>
            <div className="kpi-label" style={{ marginBottom: 4 }}>Descrição</div>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{a.description}</p>
          </div>
        )}
        {a.notes && (
          <div>
            <div className="kpi-label" style={{ marginBottom: 4 }}>Observações</div>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }} className="muted">
              {a.notes}
            </p>
          </div>
        )}
        {a.alerts.length > 0 && a.status !== 'concluido' && (
          <div className="faint" style={{ fontSize: 13 }}>
            Avisos: {a.alerts.map((x) => (x === 0 ? 'no dia' : x === 1 ? '1 dia antes' : x === 7 ? '1 semana antes' : `${x} dias antes`)).join(', ')}
          </div>
        )}
        <button className="btn btn-danger btn-sm" style={{ alignSelf: 'flex-start' }} onClick={remove}>
          <Trash2 size={15} /> Excluir atividade
        </button>
      </div>
    </Sheet>
  );
}

import { Check, Clock, Flag } from 'lucide-react';
import { countdownLabel, formatDayMonth, weekdayShort } from '../../core/date';
import type { AcademicItem } from '../../core/types';
import { actions, useData } from '../../store/store';
import { openSheet, toastUndo } from '../../store/ui';
import { cx } from '../../ui/components';
import { DynIcon } from '../../ui/icons';
import { ACADEMIC_TYPES, STATUS_LABEL, URGENCY_BADGE, urgencyOf } from '../../ui/labels';

export function AcademicCard({ a, today, compact }: { a: AcademicItem; today: string; compact?: boolean }) {
  const data = useData();
  const subj = a.subjectId ? data.subjects[a.subjectId] : null;
  const type = ACADEMIC_TYPES.find((t) => t.value === a.type)!;
  const u = urgencyOf(a, today);
  const color = subj?.color ?? 'violet';
  const complete = () => {
    const prev = a.status;
    if (prev === 'concluido') actions.setAcademicStatus(a.id, 'pendente');
    else {
      actions.setAcademicStatus(a.id, 'concluido');
      toastUndo('Atividade concluída 🎓', () => actions.setAcademicStatus(a.id, prev), 'success');
    }
  };
  return (
    <div className={cx('acad-card', `urg-${u}`, `hue-${color}`, compact && 'compact')}>
      <button className="acad-card-main" onClick={() => openSheet({ kind: 'academicDetail', id: a.id })}>
        <span className="tile-icon">
          <DynIcon name={type.icon} size={18} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="acad-title truncate">{a.title}</div>
          <div className="acad-sub">
            {compact && u !== 'normal' && <span className={cx('badge', URGENCY_BADGE[u])} style={{ height: 19, fontSize: 11 }}>{u === 'done' ? 'Concluído' : countdownLabel(a.date, today)}</span>}
            {compact && u === 'normal' && <span className="faint" style={{ flexShrink: 0 }}>{countdownLabel(a.date, today)} ·</span>}
            <span className="acad-type">{type.label}</span>
            {subj && (
              <>
                <span className="faint">·</span>
                <span className="truncate">{subj.name}</span>
              </>
            )}
          </div>
          {!compact && (
            <div className="acad-meta">
              <span>
                <span style={{ textTransform: 'capitalize' }}>{weekdayShort(a.date)}</span>, {formatDayMonth(a.date)}
              </span>
              {a.time && (
                <span className="row" style={{ '--gap': '3px' } as React.CSSProperties}>
                  <Clock size={12} /> {a.time}
                </span>
              )}
              {a.priority !== 'medium' && (
                <span className={cx('row prio-flag', a.priority)} style={{ '--gap': '3px' } as React.CSSProperties}>
                  <Flag size={12} /> {a.priority === 'high' ? 'Alta' : 'Baixa'}
                </span>
              )}
              {a.status === 'andamento' && <span className="badge badge-info" style={{ height: 19 }}>{STATUS_LABEL.andamento}</span>}
            </div>
          )}
        </div>
      </button>
      <div className="acad-side">
        {!compact && <span className={cx('badge', URGENCY_BADGE[u])}>{u === 'done' ? 'Concluído' : countdownLabel(a.date, today)}</span>}
        <button className={cx('check', a.status === 'concluido' && 'on')} style={{ '--hue': 'var(--success)' } as React.CSSProperties} onClick={complete} aria-label={a.status === 'concluido' ? 'Reabrir' : 'Marcar como concluído'} aria-pressed={a.status === 'concluido'}>
          <Check size={14} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}


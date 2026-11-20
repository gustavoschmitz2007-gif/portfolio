import { diffDays, type DateKey } from '../core/date';
import type { AcademicItem, AcademicStatus, AcademicType, Priority } from '../core/types';

export const ACADEMIC_TYPES: Array<{ value: AcademicType; label: string; icon: string }> = [
  { value: 'trabalho', label: 'Trabalho', icon: 'FileText' },
  { value: 'prova', label: 'Prova', icon: 'PenLine' },
  { value: 'apresentacao', label: 'Apresentação', icon: 'Presentation' },
  { value: 'atividade', label: 'Atividade', icon: 'ClipboardList' },
  { value: 'relatorio', label: 'Relatório', icon: 'NotebookPen' },
  { value: 'outro', label: 'Outro', icon: 'BookMarked' },
];
export const typeLabel = (t: AcademicType) => ACADEMIC_TYPES.find((x) => x.value === t)?.label ?? 'Atividade';

export const STATUS_LABEL: Record<AcademicStatus, string> = { pendente: 'Pendente', andamento: 'Em andamento', concluido: 'Concluído' };
export const PRIORITY_LABEL: Record<Priority, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' };
export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export type Urgency = 'done' | 'overdue' | 'today' | 'soon' | 'normal';

/** Visual deadline level: distante (normal), próximo (≤3 dias), hoje, atrasado. */
export function urgencyOf(item: Pick<AcademicItem, 'date' | 'status'>, today: DateKey): Urgency {
  if (item.status === 'concluido') return 'done';
  const d = diffDays(today, item.date);
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  if (d <= 3) return 'soon';
  return 'normal';
}

export const URGENCY_BADGE: Record<Urgency, string> = {
  done: 'badge-success',
  overdue: 'badge-danger',
  today: 'badge-accent',
  soon: 'badge-warning',
  normal: '',
};

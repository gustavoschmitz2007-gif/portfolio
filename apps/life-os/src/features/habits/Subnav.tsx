import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, formatWeekRange, isoWeekNumber, startOfWeek, type DateKey } from '../../core/date';
import { useRoute } from '../../app/router';
import { useSettings } from '../../store/store';
import { cx } from '../../ui/components';

export function HabitsSubnav() {
  const { path } = useRoute();
  return (
    <div className="subnav">
      <div className="seg">
        <a href="#/habitos" className={cx('seg-btn', path === '/habitos' && 'active')}>
          Rastreador
        </a>
        <a href="#/metas" className={cx('seg-btn', path === '/metas' && 'active')}>
          Metas semanais
        </a>
      </div>
    </div>
  );
}

export function PlannerSubnav() {
  const { path } = useRoute();
  return (
    <div className="subnav">
      <div className="seg">
        <a href="#/planejar" className={cx('seg-btn', path === '/planejar' && 'active')}>
          Tarefas do dia
        </a>
        <a href="#/lembretes" className={cx('seg-btn', path === '/lembretes' && 'active')}>
          Lembretes
        </a>
      </div>
    </div>
  );
}

export function WeekNav({ weekStart, onChange, today }: { weekStart: DateKey; onChange: (ws: DateKey) => void; today: DateKey }) {
  const { weekStartsOn } = useSettings();
  const current = startOfWeek(today, weekStartsOn);
  const isCurrent = weekStart === current;
  const rel = weekStart === addDays(current, -7) ? 'Semana passada' : weekStart === addDays(current, 7) ? 'Próxima semana' : `Semana ${isoWeekNumber(weekStart)}`;
  return (
    <div className="week-nav">
      <button className="icon-btn icon-btn-sm" onClick={() => onChange(addDays(weekStart, -7))} aria-label="Semana anterior">
        <ChevronLeft size={18} />
      </button>
      <button className="week-nav-label" onClick={() => onChange(current)} title="Voltar para esta semana">
        <span className="week-nav-title">{isCurrent ? 'Esta semana' : rel}</span>
        <span className="week-nav-range">{formatWeekRange(weekStart)}</span>
      </button>
      <button className="icon-btn icon-btn-sm" onClick={() => onChange(addDays(weekStart, 7))} aria-label="Próxima semana">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

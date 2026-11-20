import type { AgendaItem } from '../../core/agenda';
import { addDays, monthKey, orderedWeekdays, startOfMonth, startOfWeek, WEEKDAY_SHORT, type DateKey } from '../../core/date';
import { cx } from '../../ui/components';

export function MonthGrid({
  month,
  selected,
  today,
  weekStartsOn,
  byDay,
  onSelect,
  showTitles = true,
}: {
  month: DateKey;
  selected: DateKey;
  today: DateKey;
  weekStartsOn: 0 | 1;
  byDay: Map<DateKey, AgendaItem[]>;
  onSelect: (d: DateKey) => void;
  showTitles?: boolean;
}) {
  const first = startOfMonth(month);
  const gridStart = startOfWeek(first, weekStartsOn);
  const mk = monthKey(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  // Drop the last row when it's entirely in the next month.
  const visible = days.slice(35).every((d) => monthKey(d) !== mk) ? days.slice(0, 35) : days;
  return (
    <div className="month">
      <div className="month-head">
        {orderedWeekdays(weekStartsOn).map((w) => (
          <span key={w}>{WEEKDAY_SHORT[w]}</span>
        ))}
      </div>
      <div className="month-grid">
        {visible.map((d) => {
          const items = byDay.get(d) ?? [];
          const out = monthKey(d) !== mk;
          return (
            <button
              key={d}
              className={cx('mday', out && 'out', d === today && 'today', d === selected && 'selected', items.length > 0 && 'has')}
              onClick={() => onSelect(d)}
              aria-label={`${Number(d.slice(8))}, ${items.length} itens`}
              aria-pressed={d === selected}
            >
              <span className="mday-n">{Number(d.slice(8))}</span>
              {showTitles && (
                <span className="mday-items">
                  {items.slice(0, 3).map((it) => (
                    <span key={it.key} className={cx('mday-chip', `hue-${it.color}`, it.done && 'done')}>
                      {it.time && <b>{it.time}</b>} {it.title}
                    </span>
                  ))}
                  {items.length > 3 && <span className="mday-more">+{items.length - 3}</span>}
                </span>
              )}
              <span className="mday-dots">
                {items.slice(0, 4).map((it) => (
                  <i key={it.key} className={cx(`hue-${it.color}`, it.done && 'done')} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Minus, MoreHorizontal, Plus, X } from 'lucide-react';
import { COLOR_KEYS, type ColorKey } from '../core/types';
import { orderedWeekdays, WEEKDAY_SHORT } from '../core/date';
import { DynIcon, ICON_NAMES } from './icons';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

// ---------------------------------------------------------------------------
// Sheet (bottom sheet on mobile, dialog on desktop)

let openSheets = 0;

export function Sheet({
  title,
  onClose,
  children,
  footer,
  wide,
  headerExtra,
  className,
  labelledBy,
}: {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  headerExtra?: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const drag = useRef<{ y: number; dy: number } | null>(null);

  useEffect(() => {
    openSheets++;
    document.body.classList.add('sheet-open');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.activeElement as HTMLElement | null;
    // Focus the sheet for keyboard users without popping the mobile keyboard.
    ref.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      openSheets--;
      if (openSheets <= 0) document.body.classList.remove('sheet-open');
      prev?.focus?.({ preventScroll: true });
    };
  }, []);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const onPointerDown = (e: React.PointerEvent) => {
    if (window.innerWidth >= 768) return;
    drag.current = { y: e.clientY, dy: 0 };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    drag.current.dy = dy;
    ref.current.style.transform = `translateY(${dy}px)`;
    ref.current.style.transition = 'none';
  };
  const onPointerUp = () => {
    if (!drag.current || !ref.current) return;
    const { dy } = drag.current;
    drag.current = null;
    ref.current.style.transition = 'transform 220ms cubic-bezier(.2,.8,.2,1)';
    if (dy > 110) onClose();
    else ref.current.style.transform = '';
  };

  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={ref}
        className={cx('sheet', wide && 'sheet-wide', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? (title ? titleId : undefined)}
        tabIndex={-1}
      >
        <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} style={{ touchAction: 'none' }}>
          <div className="sheet-handle" />
          {(title || headerExtra) && (
            <div className="sheet-head">
              <div className="sheet-title" id={titleId}>
                {title}
              </div>
              {headerExtra}
              <button className="icon-btn icon-btn-sm icon-btn-filled" onClick={onClose} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
          )}
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Progress

export function Ring({
  value,
  size = 56,
  stroke = 6,
  hue,
  children,
  className,
  trackOpacity,
}: {
  value: number;
  size?: number;
  stroke?: number;
  hue?: string;
  children?: ReactNode;
  className?: string;
  trackOpacity?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={cx('center', className)} style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={trackOpacity ? { opacity: trackOpacity } : undefined} />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={hue ?? 'var(--hue, var(--accent))'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ opacity: v === 0 ? 0 : 1 }}
        />
      </svg>
      <div style={{ position: 'relative', textAlign: 'center' }}>{children}</div>
    </div>
  );
}

export function Bar({ value, className, thin }: { value: number; className?: string; thin?: boolean }) {
  return (
    <div className={cx('bar', thin && 'bar-thin', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function Segments({ done, total, className }: { done: number; total: number; className?: string }) {
  const n = Math.max(1, Math.min(total, 14));
  return (
    <div className={cx('bar-segments', className)} aria-label={`${done} de ${total}`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={i < done ? 'on' : ''} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inputs

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  block,
  size,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  block?: boolean;
  size?: 'sm';
}) {
  return (
    <div className={cx('seg', block && 'seg-block')} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={cx('seg-btn', value === o.value && 'active')}
          style={size === 'sm' ? { height: 28, padding: '0 10px', fontSize: 12.5 } : undefined}
          onClick={() => onChange(o.value)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={cx('switch', on && 'on')} onClick={() => onChange(!on)} />;
}

export function Stepper({ value, onChange, min = 0, max = 99, size, suffix }: { value: number; onChange: (v: number) => void; min?: number; max?: number; size?: 'sm'; suffix?: string }) {
  return (
    <div className={cx('stepper', size === 'sm' && 'stepper-sm')}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Diminuir">
        <Minus size={16} />
      </button>
      <div className="stepper-value">
        {value}
        {suffix && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginLeft: 3 }}>{suffix}</span>}
      </div>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Aumentar">
        <Plus size={16} />
      </button>
    </div>
  );
}

export function Field({ label, hint, error, children, className }: { label?: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={cx('field', className)} onClick={(e) => (e.target as HTMLElement).tagName === 'BUTTON' && e.preventDefault()}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

/** Group wrapper that is not a <label> (for groups of buttons). */
export function FieldGroup({ label, hint, children, className, aside }: { label?: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <div className={cx('field', className)}>
      {label && (
        <span className="field-label">
          {label}
          {aside && <span style={{ marginLeft: 'auto' }}>{aside}</span>}
        </span>
      )}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function DaysPicker({ value, onChange, weekStartsOn }: { value: number[]; onChange: (v: number[]) => void; weekStartsOn: 0 | 1 }) {
  return (
    <div className="days-picker">
      {orderedWeekdays(weekStartsOn).map((d) => {
        const on = value.includes(d);
        return (
          <button
            type="button"
            key={d}
            className={cx('day-btn', on && 'on')}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}
          >
            {WEEKDAY_SHORT[d].slice(0, 3)}
          </button>
        );
      })}
    </div>
  );
}

export const COLOR_NAMES: Record<ColorKey, string> = {
  blue: 'Azul',
  orange: 'Laranja',
  aqua: 'Verde-água',
  yellow: 'Amarelo',
  magenta: 'Rosa',
  green: 'Verde',
  violet: 'Violeta',
  red: 'Vermelho',
  slate: 'Cinza',
};

export function ColorPicker({ value, onChange }: { value: ColorKey; onChange: (c: ColorKey) => void }) {
  return (
    <div className="color-picker" role="radiogroup">
      {COLOR_KEYS.map((c) => (
        <button
          type="button"
          key={c}
          role="radio"
          aria-checked={value === c}
          aria-label={COLOR_NAMES[c]}
          title={COLOR_NAMES[c]}
          className={cx('swatch', `hue-${c}`, value === c && 'on')}
          onClick={() => onChange(c)}
        >
          {value === c && <Check size={16} color="#fff" style={{ position: 'absolute', inset: 0, margin: 'auto' }} />}
        </button>
      ))}
    </div>
  );
}

export function IconPicker({ value, onChange, color }: { value: string; onChange: (v: string) => void; color: ColorKey }) {
  return (
    <div className={cx('icon-picker', `hue-${color}`)} role="radiogroup">
      {ICON_NAMES.map((n) => (
        <button type="button" key={n} role="radio" aria-checked={value === n} aria-label={n} className={cx('icon-opt', value === n && 'on')} onClick={() => onChange(n)}>
          <DynIcon name={n} size={20} />
        </button>
      ))}
    </div>
  );
}

export function TileIcon({ icon, color, size, solid }: { icon: string; color: ColorKey | 'accent'; size?: 'sm' | 'lg'; solid?: boolean }) {
  const px = size === 'sm' ? 16 : size === 'lg' ? 24 : 19;
  return (
    <span className={cx('tile-icon', `hue-${color}`, size && `tile-icon-${size}`, solid && 'tile-icon-solid')}>
      <DynIcon name={icon} size={px} strokeWidth={2.1} />
    </span>
  );
}

export function Empty({ icon, title, text, action, small }: { icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode; small?: boolean }) {
  return (
    <div className={cx('empty', small && 'empty-sm')}>
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="empty-title">{title}</div>
      {text && <div className="empty-text">{text}</div>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Menu

export interface MenuAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  separator?: boolean;
}

export function Menu({ actions, label = 'Mais opções', trigger }: { actions: MenuAction[]; label?: string; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="icon-btn icon-btn-sm" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {trigger ?? <MoreHorizontal size={18} />}
      </button>
      {open && (
        <div className="menu" role="menu">
          {actions.map((a, i) => (
            <div key={i}>
              {a.separator && <div className="menu-sep" />}
              <button
                type="button"
                role="menuitem"
                className={cx('menu-item', a.danger && 'danger')}
                onClick={() => {
                  setOpen(false);
                  a.onClick();
                }}
              >
                {a.icon}
                {a.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Pct({ value }: { value: number | null }) {
  if (value === null || Number.isNaN(value)) return <>—</>;
  return <>{Math.round(value * 100)}%</>;
}

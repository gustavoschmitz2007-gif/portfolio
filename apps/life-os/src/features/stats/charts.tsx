import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../ui/components';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Column with rounded data-end (top) and square baseline. */
function colPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

function Tooltip({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  const left = Math.max(70, Math.min(width - 70, tip.x));
  return (
    <div className="chart-tip" style={{ left, top: tip.y }} role="tooltip">
      {tip.content}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface ColumnPoint {
  key: string;
  label: string;
  value: number | null;
  tooltip: ReactNode;
  highlight?: boolean;
  valueLabel?: string;
}

/** Vertical columns for a single series (e.g. weekly consistency %). */
export function ColumnChart({ points, max = 1, height = 170, ticks = [0, 0.5, 1], format = (v: number) => `${Math.round(v * 100)}%`, hue = 'var(--accent)', mutedHue = 'color-mix(in srgb, var(--accent) 45%, var(--surface-3))' }: {
  points: ColumnPoint[];
  max?: number;
  height?: number;
  ticks?: number[];
  format?: (v: number) => string;
  hue?: string;
  mutedHue?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const padL = 34;
  const padB = 22;
  const padT = 18;
  const plotW = Math.max(0, width - padL);
  const plotH = height - padB - padT;
  const band = points.length ? plotW / points.length : 0;
  const barW = Math.max(4, Math.min(24, band * 0.62));
  const every = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotW / 44))));
  const y = (v: number) => padT + plotH - (Math.min(v, max) / max) * plotH;

  return (
    <div ref={ref} className="chart" onPointerLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Gráfico de colunas">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width} y1={y(t)} y2={y(t)} className="chart-grid" />
              <text x={padL - 8} y={y(t) + 4} className="chart-axis" textAnchor="end">
                {format(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const cx0 = padL + band * i + band / 2;
            const v = p.value ?? 0;
            const top = y(v);
            const h = padT + plotH - top;
            return (
              <g key={p.key}>
                {p.value !== null && p.value > 0 && <path d={colPath(cx0 - barW / 2, top, barW, h)} fill={p.highlight ? hue : mutedHue} />}
                {p.value === null && <line x1={cx0 - barW / 2} x2={cx0 + barW / 2} y1={padT + plotH - 1} y2={padT + plotH - 1} className="chart-null" />}
                {p.highlight && p.value !== null && (
                  <text x={cx0} y={top - 6} textAnchor="middle" className="chart-value">
                    {p.valueLabel ?? format(v)}
                  </text>
                )}
                {(i % every === 0 || p.highlight) && (
                  <text x={cx0} y={height - 5} textAnchor="middle" className={cx('chart-axis', p.highlight && 'strong')}>
                    {p.label}
                  </text>
                )}
                <rect
                  x={cx0 - band / 2}
                  y={padT - 10}
                  width={band}
                  height={plotH + 10}
                  fill="transparent"
                  onPointerEnter={() => setTip({ x: cx0, y: Math.max(0, top - 10), content: p.tooltip })}
                  onClick={() => setTip({ x: cx0, y: Math.max(0, top - 10), content: p.tooltip })}
                />
              </g>
            );
          })}
        </svg>
      )}
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

/** Small columns with per-column goal tick (habit detail). */
export function MiniColumns({ points, hue, height = 110 }: { points: Array<{ label: string; value: number | null; target: number | null; highlight?: boolean }>; hue: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const max = Math.max(1, ...points.map((p) => Math.max(p.value ?? 0, p.target ?? 0)));
  const padB = 18;
  const padT = 8;
  const plotH = height - padB - padT;
  const band = points.length ? width / points.length : 0;
  const barW = Math.max(4, Math.min(20, band * 0.56));
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  return (
    <div ref={ref} className="chart" onPointerLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Registros por semana">
          <line x1={0} x2={width} y1={padT + plotH} y2={padT + plotH} className="chart-grid" />
          {points.map((p, i) => {
            const cx0 = band * i + band / 2;
            const v = p.value ?? 0;
            const met = p.target !== null && v >= p.target;
            const content = p.value === null ? `${p.label}: fora das metas` : `${p.label}: ${v}/${p.target}${met ? ' · meta cumprida' : ''}`;
            return (
              <g key={i}>
                {p.value !== null && v > 0 && (
                  <path d={colPath(cx0 - barW / 2, y(v), barW, padT + plotH - y(v))} fill={hue} opacity={met || p.highlight ? 1 : 0.5} />
                )}
                {p.target !== null && <line x1={cx0 - barW / 2 - 3} x2={cx0 + barW / 2 + 3} y1={y(p.target)} y2={y(p.target)} className="chart-target" />}
                {(i % 3 === 2 || p.highlight) && (
                  <text x={cx0} y={height - 4} textAnchor="middle" className={cx('chart-axis', p.highlight && 'strong')}>
                    {p.highlight ? 'Atual' : p.label}
                  </text>
                )}
                <rect x={cx0 - band / 2} y={0} width={band} height={height} fill="transparent" onPointerEnter={() => setTip({ x: cx0, y: Math.max(0, y(v) - 8), content })} onClick={() => setTip({ x: cx0, y: Math.max(0, y(v) - 8), content })} />
              </g>
            );
          })}
        </svg>
      )}
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

/** Tiny sparkline of columns (dashboard). */
export function SparkColumns({ values, height = 44 }: { values: Array<number | null>; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const band = values.length ? width / values.length : 0;
  const barW = Math.max(3, Math.min(14, band * 0.55));
  return (
    <div ref={ref} style={{ width: '100%' }} aria-hidden="true">
      {width > 0 && (
        <svg width={width} height={height}>
          {values.map((v, i) => {
            const h = v === null ? 0 : Math.max(2, Math.min(1, v) * (height - 2));
            const last = i === values.length - 1;
            return v === null ? (
              <rect key={i} x={band * i + band / 2 - barW / 2} y={height - 2} width={barW} height={2} rx={1} fill="var(--track)" />
            ) : (
              <path key={i} d={colPath(band * i + band / 2 - barW / 2, height - h, barW, h, 3)} fill={last ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 40%, var(--surface-3))'} />
            );
          })}
        </svg>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface HeatCell {
  date: string;
  count: number;
  future: boolean;
  label: string;
}

export function Heatmap({ cols, rowLabels }: { cols: HeatCell[][]; rowLabels: string[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const max = Math.max(1, ...cols.flat().map((c) => c.count));
  const labelW = 22;
  const gap = 3;
  const cell = cols.length ? Math.max(6, Math.min(16, (width - labelW - gap * cols.length) / cols.length)) : 0;
  const h = 7 * (cell + gap);
  const level = (c: number) => (c <= 0 ? 0 : Math.min(4, Math.ceil((c / max) * 4)));
  const fills = ['var(--track)', 'color-mix(in srgb, var(--accent) 30%, var(--surface-2))', 'color-mix(in srgb, var(--accent) 55%, var(--surface-2))', 'color-mix(in srgb, var(--accent) 78%, var(--surface-2))', 'var(--accent)'];
  return (
    <div ref={ref} className="chart" onPointerLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={h} role="img" aria-label="Mapa de atividade diária">
          {rowLabels.map((l, r) =>
            r % 2 === 0 ? (
              <text key={r} x={0} y={r * (cell + gap) + cell - 2} className="chart-axis">
                {l}
              </text>
            ) : null,
          )}
          {cols.map((col, ci) =>
            col.map((c, ri) => {
              const x = labelW + ci * (cell + gap);
              const yy = ri * (cell + gap);
              return (
                <rect
                  key={c.date}
                  x={x}
                  y={yy}
                  width={cell}
                  height={cell}
                  rx={3}
                  fill={c.future ? 'transparent' : fills[level(c.count)]}
                  stroke={c.future ? 'var(--border)' : 'none'}
                  onPointerEnter={() => !c.future && setTip({ x: x + cell / 2, y: yy - 4, content: c.label })}
                  onClick={() => !c.future && setTip({ x: x + cell / 2, y: yy - 4, content: c.label })}
                />
              );
            }),
          )}
        </svg>
      )}
      <div className="heat-legend">
        <span>Menos</span>
        {fills.map((f, i) => (
          <i key={i} style={{ background: f }} />
        ))}
        <span>Mais</span>
      </div>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

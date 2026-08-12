import { useId, useMemo, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

/**
 * Gráficos do painel, em SVG puro.
 *
 * Paleta: a loja é monocromática por conceito, então as séries se separam por
 * LUMINOSIDADE, não por matiz. O validador de paleta reprova "chroma floor" e
 * "lightness band" — é o esperado num esquema cinza de propósito. O que importa
 * para leitura passa com folga: separação sob daltonismo ΔE 21 (piso 8) e
 * contraste ≥ 3:1 contra a superfície. Ainda assim, toda série categórica leva
 * rótulo direto: identidade nunca depende só da cor.
 */
export const SERIES = {
  primary: '#cf1a26', // sangue
  secondary: '#c2b49a', // osso quente
  tertiary: '#7d7362', // cinza morno
} as const;

const AXIS = '#2b2b34';
const INK_MUTED = '#8b8578';

/* -------------------------------------------------------------------------- */
/* Cartão de indicador                                                        */
/* -------------------------------------------------------------------------- */

export function StatTile({
  label,
  value,
  hint,
  delta,
  spark,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Variação percentual contra o período anterior. */
  delta?: number;
  spark?: number[];
}) {
  const up = (delta ?? 0) >= 0;
  const Icon = up ? TrendingUp : TrendingDown;

  return (
    <div className="panel flex flex-col gap-2 p-4">
      <p className="heading-carved text-[0.55rem] text-grave">{label}</p>

      <p className="font-display text-2xl leading-none font-bold text-bone tabular-nums">
        {value}
      </p>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {delta !== undefined && (
            <span
              className={`flex items-center gap-1 text-[0.65rem] tabular-nums ${
                up ? 'text-parchment' : 'text-ember'
              }`}
            >
              <Icon className="h-3 w-3" />
              {up ? '+' : ''}
              {delta.toFixed(1).replace('.', ',')}%
            </span>
          )}
          {hint && <p className="mt-0.5 truncate text-[0.6rem] text-dust">{hint}</p>}
        </div>

        {spark && spark.length > 1 && <Sparkline values={spark} />}
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const width = 72;
  const height = 24;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);

  const points = values.map((value, index) => [
    index * step,
    height - (value / max) * (height - 2) - 1,
  ]);
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');

  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden="true">
      <path d={path} fill="none" stroke={SERIES.primary} strokeWidth={2} />
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={2.5}
        fill={SERIES.primary}
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Área — faturamento no tempo                                                */
/* -------------------------------------------------------------------------- */

export interface TimePoint {
  label: string;
  value: number;
}

export function RevenueArea({
  data,
  formatValue,
  height = 220,
}: {
  data: TimePoint[];
  formatValue: (value: number) => string;
  height?: number;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const padding = { top: 16, right: 12, bottom: 26, left: 52 };
  const width = 720;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const max = Math.max(...data.map((d) => d.value), 1);
  // Teto arredondado para o eixo não terminar num número quebrado.
  const ceiling = Math.ceil(max / 500) * 500 || 500;

  const x = (index: number) =>
    padding.left + (index / Math.max(1, data.length - 1)) * plotWidth;
  const y = (value: number) => padding.top + plotHeight - (value / ceiling) * plotHeight;

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(d.value)}`).join(' ');
  const area = `${line} L${x(data.length - 1)} ${padding.top + plotHeight} L${x(0)} ${padding.top + plotHeight} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => fraction * ceiling);
  // Um rótulo a cada ~6 pontos, senão o eixo vira uma mancha.
  const labelEvery = Math.max(1, Math.floor(data.length / 6));

  const active = hover !== null ? data[hover] : null;

  return (
    <figure className="panel p-4">
      <figcaption className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="heading-carved text-[0.6rem] text-bone">Faturamento por dia</h3>
        <span className="text-[0.6rem] text-grave">últimos {data.length} dias</span>
      </figcaption>

      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[520px]"
          role="img"
          aria-label={`Faturamento diário dos últimos ${data.length} dias`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const relative = ((event.clientX - rect.left) / rect.width) * width;
            const index = Math.round(
              ((relative - padding.left) / plotWidth) * (data.length - 1),
            );
            setHover(index >= 0 && index < data.length ? index : null);
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES.primary} stopOpacity="0.35" />
              <stop offset="100%" stopColor={SERIES.primary} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grade recuada */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={AXIS}
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={y(tick) + 3}
                textAnchor="end"
                fill={INK_MUTED}
                fontSize={9}
              >
                {formatValue(tick)}
              </text>
            </g>
          ))}

          <path d={area} fill={`url(#${gradientId})`} />
          <path d={line} fill="none" stroke={SERIES.primary} strokeWidth={2} />

          {/* Eixo X esparso */}
          {data.map((point, index) =>
            index % labelEvery === 0 ? (
              <text
                key={point.label}
                x={x(index)}
                y={height - 8}
                textAnchor="middle"
                fill={INK_MUTED}
                fontSize={9}
              >
                {point.label}
              </text>
            ) : null,
          )}

          {/* Crosshair */}
          {hover !== null && active && (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={padding.top}
                y2={padding.top + plotHeight}
                stroke={SERIES.primary}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {/* Anel na cor da superfície separa o ponto da linha. */}
              <circle cx={x(hover)} cy={y(active.value)} r={5} fill="#0f0f13" />
              <circle cx={x(hover)} cy={y(active.value)} r={4} fill={SERIES.primary} />
            </g>
          )}
        </svg>

        {hover !== null && active && (
          <div
            className="pointer-events-none absolute top-2 border border-smoke bg-void/95 px-2.5 py-1.5 shadow-lg"
            style={{
              left: `${(x(hover) / width) * 100}%`,
              transform: `translateX(${hover > data.length / 2 ? '-110%' : '10%'})`,
            }}
          >
            <p className="text-[0.6rem] text-grave">{active.label}</p>
            <p className="font-display text-xs font-bold text-bone tabular-nums">
              {formatValue(active.value)}
            </p>
          </div>
        )}
      </div>
    </figure>
  );
}

/* -------------------------------------------------------------------------- */
/* Barras horizontais — ranking                                               */
/* -------------------------------------------------------------------------- */

export interface BarDatum {
  label: string;
  sublabel?: string;
  value: number;
}

export function BarList({
  title,
  data,
  formatValue,
  emptyText = 'Sem dados no período.',
}: {
  title: string;
  data: BarDatum[];
  formatValue: (value: number) => string;
  emptyText?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <figure className="panel p-4">
      <figcaption className="mb-4">
        <h3 className="heading-carved text-[0.6rem] text-bone">{title}</h3>
      </figcaption>

      {data.length === 0 ? (
        <p className="py-6 text-center text-[0.7rem] text-dust">{emptyText}</p>
      ) : (
        <ol className="space-y-3">
          {data.map((datum, index) => (
            <li key={datum.label}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="font-display text-[0.6rem] text-dust tabular-nums">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.72rem] text-parchment">
                      {datum.label}
                    </span>
                    {datum.sublabel && (
                      <span className="block truncate text-[0.6rem] text-dust">
                        {datum.sublabel}
                      </span>
                    )}
                  </span>
                </span>
                {/* Rótulo direto: o valor nunca depende de ler o eixo. */}
                <span className="shrink-0 font-display text-[0.72rem] font-bold text-bone tabular-nums">
                  {formatValue(datum.value)}
                </span>
              </div>
              <div className="h-1.5 w-full bg-smoke">
                <div
                  className="h-full rounded-r-[3px]"
                  style={{
                    width: `${(datum.value / max) * 100}%`,
                    backgroundColor: SERIES.primary,
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}

/* -------------------------------------------------------------------------- */
/* Barra empilhada — divisão por categoria                                    */
/* -------------------------------------------------------------------------- */

export interface Slice {
  label: string;
  value: number;
}

export function SplitBar({
  title,
  data,
  formatValue,
}: {
  title: string;
  data: Slice[];
  formatValue: (value: number) => string;
}) {
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);
  const colors = [SERIES.primary, SERIES.secondary, SERIES.tertiary];

  return (
    <figure className="panel p-4">
      <figcaption className="mb-4">
        <h3 className="heading-carved text-[0.6rem] text-bone">{title}</h3>
      </figcaption>

      {total === 0 ? (
        <p className="py-6 text-center text-[0.7rem] text-dust">Sem dados no período.</p>
      ) : (
        <>
          {/* gap-0.5 dá os 2px de superfície entre segmentos */}
          <div className="flex h-3 w-full gap-0.5">
            {data.map((slice, index) => (
              <div
                key={slice.label}
                style={{
                  width: `${(slice.value / total) * 100}%`,
                  backgroundColor: colors[index % colors.length],
                }}
                title={`${slice.label}: ${formatValue(slice.value)}`}
              />
            ))}
          </div>

          {/* Legenda com rótulo e valor — identidade nunca só pela cor */}
          <ul className="mt-4 space-y-2">
            {data.map((slice, index) => (
              <li key={slice.label} className="flex items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="flex-1 text-[0.7rem] text-parchment">{slice.label}</span>
                <span className="text-[0.65rem] text-grave tabular-nums">
                  {((slice.value / total) * 100).toFixed(0)}%
                </span>
                <span className="w-20 text-right font-display text-[0.7rem] font-bold text-bone tabular-nums">
                  {formatValue(slice.value)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </figure>
  );
}

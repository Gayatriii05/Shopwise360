import { motion } from 'framer-motion';
import {
  AreaChart as TremorAreaChart,
  BarChart as TremorBarChart,
  DonutChart as TremorDonutChart,
  SparkAreaChart as TremorSparkAreaChart,
} from '@tremor/react';

/* ---------------------------------------------------------------------------
   ShopWise 360 — Tremor chart kit (muted lavender → soft sage → gentle peach)
   Every dashboard chart runs on Tremor chart components. The `colors` prop is
   always mapped to palette names so no blue/cyan/saturated color ever renders.
--------------------------------------------------------------------------- */

const HEX_TO_NAME = {
  '#C4B5FD': 'violet',
  '#A598E6': 'violet',
  '#C8BAF5': 'violet',
  '#D8CFF7': 'violet',
  '#8375C9': 'violet',
  '#A7D8B8': 'emerald',
  '#85BF9B': 'emerald',
  '#AFD8BD': 'emerald',
  '#B8DCC3': 'emerald',
  '#FFD6A5': 'orange',
  '#F5D4A2': 'orange',
  '#DCAE74': 'orange',
  '#FBE8CC': 'orange',
  '#C98DA8': 'pink',
  '#D9A6BF': 'pink',
  '#B17793': 'pink',
};

/** Map any accent hex to a Tremor palette name; never allows blue. */
export function toTremorColor(hex) {
  return HEX_TO_NAME[String(hex || '').toUpperCase()] || 'violet';
}

export const AXIS = {
  stroke: 'none',
  tick: { fontSize: 10, fill: '#A89D8E' },
  axisLine: false,
  tickLine: false,
};

export const GRID = 'rgba(54, 47, 42, 0.06)';

export const SERIES_COLORS = ['#C4B5FD', '#A7D8B8', '#FFD6A5', '#C98DA8', '#F5D4A2'];

export function TrendAreaChart({
  data = [],
  xKey = 'date',
  series = [{ key: 'revenue', label: 'Revenue', color: '#C4B5FD' }],
  height = 280,
  valueFormatter,
  className = '',
  showGrid = true,
}) {
  return (
    <div className={className} style={{ height }}>
      <TremorAreaChart
        className="h-full w-full"
        data={data}
        index={xKey}
        categories={series.map((s) => s.key)}
        colors={series.map((s) => toTremorColor(s.color))}
        valueFormatter={valueFormatter}
        showGridLines={showGrid}
        showAnimation
        animationDuration={1100}
        curveType="monotone"
        yAxisWidth={56}
      />
    </div>
  );
}

export function GradientBarChart({
  data = [],
  xKey,
  series = [{ key: 'revenue', label: 'Revenue', color: '#C4B5FD' }],
  height = 280,
  valueFormatter,
  className = '',
}) {
  return (
    <div className={className} style={{ height }}>
      <TremorBarChart
        className="h-full w-full"
        data={data}
        index={xKey}
        categories={series.map((s) => s.key)}
        colors={series.map((s) => toTremorColor(s.color))}
        valueFormatter={valueFormatter}
        showGridLines
        showAnimation
        animationDuration={950}
        yAxisWidth={56}
      />
    </div>
  );
}

export function DonutBreakdown({
  data = [],
  nameKey = 'name',
  valueKey = 'value',
  colors = SERIES_COLORS,
  height = 260,
  valueFormatter,
  centerLabel,
  centerValue,
  className = '',
  hoverIndex,
  onHover,
}) {
  const tremorColors = colors.map(toTremorColor);
  return (
    <div className={`relative ${className}`} style={{ height }}>
      <TremorDonutChart
        className="h-full w-full"
        data={data}
        index={nameKey}
        category={valueKey}
        colors={tremorColors}
        valueFormatter={valueFormatter}
        showAnimation
        variant="donut"
        onValueChange={(v) => {
          if (onHover && v) {
            const idx = data.findIndex((d) => String(d[nameKey]) === String(v));
            onHover(idx >= 0 ? idx : -1);
          }
        }}
      />
      {(centerLabel || centerValue != null) && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            {centerValue != null && (
              <div className="mono-num text-2xl font-extrabold tracking-tight text-foreground">
                {valueFormatter
                  ? valueFormatter(centerValue)
                  : Number(centerValue).toLocaleString('en-IN')}
              </div>
            )}
            {centerLabel && <div className="label-micro">{centerLabel}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function SparkAreaChart({
  data = [],
  xKey = 'date',
  series = [{ key: 'value', label: '', color: '#C4B5FD' }],
  valueFormatter,
  className = '',
}) {
  return (
    <TremorSparkAreaChart
      className={`h-full w-full ${className}`}
      data={data}
      index={xKey}
      categories={series.map((s) => s.key)}
      colors={series.map((s) => toTremorColor(s.color))}
      valueFormatter={valueFormatter}
    />
  );
}

export function RankBars({
  items = [],
  valueFormatter = (v) => Number(v).toLocaleString('en-IN'),
  color = '#C4B5FD',
  accentColors,
  className = '',
  emptyLabel = 'No data',
}) {
  if (!items.length) {
    return <p className={`py-8 text-center text-xs text-muted-foreground ${className}`}>{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((i) => Number(i.value) || 0), 1);

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item, i) => {
        const pct = Math.max(3, ((Number(item.value) || 0) / max) * 100);
        const c = accentColors?.[i % accentColors.length] || color;
        return (
          <div key={`${item.name}-${i}`} className="group/rank">
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground">
                <span className="grid size-5 shrink-0 place-items-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="truncate">{item.name}</span>
              </span>
              <span className="mono-num shrink-0 text-xs font-bold text-foreground">{valueFormatter(item.value)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${c}, ${c}99)` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
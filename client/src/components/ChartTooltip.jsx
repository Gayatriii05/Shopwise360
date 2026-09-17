export default function ChartTooltip({ active, payload, label, format, valueSuffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip border border-cream-300/70 shadow-elevated">
      {label != null && (
        <p className="text-[10px] font-bold uppercase tracking-wider text-cream-500 mb-1">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color || p.payload?.fill }} />
            <span className="text-cream-600">{p.name}:</span>
            <span className="font-bold text-cream-900 font-mono tabular-nums">
              {format ? format(p.value, p) : Number(p.value).toLocaleString('en-IN')}
              {valueSuffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
export default function ChartTooltip({ active, payload, label, format, prefix = '', valueSuffix = '', labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border-strong bg-popover/95 px-3.5 py-2.5 shadow-elevated backdrop-blur-md">
      {label != null && label !== '' && (
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-[4px]" style={{ background: p.color || p.payload?.fill }} />
            <span className="text-xs text-muted-foreground">{p.name}:</span>
            <span className="font-mono text-sm font-bold tabular-nums text-foreground">
              {prefix}
              {format ? format(p.value, p) : Number(p.value).toLocaleString('en-IN')}
              {valueSuffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
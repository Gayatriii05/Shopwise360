const MAP = {
  active: { label: 'Active', cls: 'bg-emerald-500/12 text-emerald-700 border-emerald-400/40', dot: 'bg-emerald-500' },
  success: { label: 'Success', cls: 'bg-emerald-500/12 text-emerald-700 border-emerald-400/40', dot: 'bg-emerald-500' },
  delivered: { label: 'Delivered', cls: 'bg-emerald-500/12 text-emerald-700 border-emerald-400/40', dot: 'bg-emerald-500' },
  completed: { label: 'Completed', cls: 'bg-emerald-500/12 text-emerald-700 border-emerald-400/40', dot: 'bg-emerald-500' },
  pending: { label: 'Pending', cls: 'bg-amber-500/12 text-amber-700 border-amber-400/40', dot: 'bg-amber-500' },
  warning: { label: 'Warning', cls: 'bg-amber-500/12 text-amber-700 border-amber-400/40', dot: 'bg-amber-500' },
  processing: { label: 'Processing', cls: 'bg-pink-500/12 text-pink-700 border-pink-400/40', dot: 'bg-pink-500' },
  confirmed: { label: 'Confirmed', cls: 'bg-pink-500/12 text-pink-700 border-pink-400/40', dot: 'bg-pink-500' },
  shipped: { label: 'Shipped', cls: 'bg-violet-500/12 text-violet-700 border-violet-400/40', dot: 'bg-violet-500' },
  info: { label: 'Info', cls: 'bg-violet-500/12 text-violet-700 border-violet-400/40', dot: 'bg-violet-500' },
  failed: { label: 'Failed', cls: 'bg-orange-500/12 text-orange-700 border-orange-400/40', dot: 'bg-orange-500' },
  cancelled: { label: 'Cancelled', cls: 'bg-orange-500/12 text-orange-700 border-orange-400/40', dot: 'bg-orange-500' },
  inactive: { label: 'Inactive', cls: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
};

export default function StatusPill({ status, label, className = '' }) {
  const key = String(status || '').toLowerCase();
  const meta = MAP[key] || { label: label || status || '—', cls: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize backdrop-blur-sm ${meta.cls} ${className}`}>
      <span className={`status-dot size-1.5 ${meta.dot} text-current`} />
      {label || meta.label}
    </span>
  );
}
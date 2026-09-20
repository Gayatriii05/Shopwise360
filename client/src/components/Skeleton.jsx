export function Skeleton({ className = '' }) {
  return (
    <div
      className={`shimmer rounded-xl bg-muted ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden rounded-xl bg-card ring-1 ring-border shadow-card">
      <div className="aspect-[4/3] w-full shimmer bg-muted" />
      <div className="space-y-2.5 p-4">
        <div className="h-3.5 w-3/4 rounded-md shimmer bg-muted" />
        <div className="h-3 w-1/2 rounded-md shimmer bg-muted" />
        <div className="h-3 w-5/6 rounded-md shimmer bg-muted" />
        <div className="flex items-center justify-between pt-2.5">
          <div className="h-5 w-20 rounded-md shimmer bg-muted" />
          <div className="h-4 w-12 rounded-md shimmer bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="h-3 w-20 rounded shimmer bg-muted" />
          <div className="mt-3 h-7 w-28 rounded-lg shimmer bg-muted" />
          <div className="mt-4 h-8 w-full rounded-lg shimmer bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ className = 'h-64' }) {
  return (
    <div className={`w-full rounded-xl shimmer bg-muted ${className}`} aria-hidden="true" />
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex gap-4 border-b border-border bg-muted/40 px-4 py-3">
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="h-4 flex-1 rounded shimmer bg-muted" />
        ))}
      </div>
      <div className="divide-y divide-border/60">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-4 flex-1 rounded shimmer bg-muted"
                style={{ width: `${80 - (c * 12)}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

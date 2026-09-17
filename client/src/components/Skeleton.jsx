export function Skeleton({ className = '' }) {
  return (
    <div
      className={`rounded-xl shimmer-wave bg-cream-200/70 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="glass-card rounded-2xl p-4 flex flex-col space-y-3">
      <div className="w-full h-40 rounded-xl shimmer-wave bg-cream-200/70" />
      <div className="space-y-2 pt-1">
        <div className="h-4 w-3/4 rounded-lg shimmer-wave bg-cream-200/70" />
        <div className="h-3 w-1/2 rounded-lg shimmer-wave bg-cream-200/70" />
        <div className="h-3 w-5/6 rounded-lg shimmer-wave bg-cream-200/70" />
      </div>
      <div className="pt-2 mt-auto flex items-center justify-between">
        <div className="h-5 w-20 rounded-lg shimmer-wave bg-cream-200/70" />
        <div className="h-4 w-12 rounded-lg shimmer-wave bg-cream-200/70" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="bg-cream-100 px-4 py-3 flex gap-4 border-b border-cream-300/70">
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="h-4 rounded shimmer-wave bg-cream-200/70 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-cream-300/60">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 px-4 py-3.5 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-4 rounded shimmer-wave bg-cream-200/70 flex-1"
                style={{ width: `${80 - (c * 12)}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
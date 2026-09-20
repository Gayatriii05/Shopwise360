import { Card } from './ui/card';

export default function ChartCard({ title, subtitle, right, badge, icon: Icon, children, className = '', accent = 'primary' }) {
  const accents = {
    primary: 'from-violet-500/20 to-fuchsia-400/5 text-violet-600 ring-violet-400/30',
    cyan: 'from-pink-500/20 to-rose-400/5 text-pink-600 ring-pink-400/30',
    pink: 'from-pink-500/20 to-rose-400/5 text-pink-600 ring-pink-400/30',
    emerald: 'from-emerald-500/20 to-teal-400/5 text-emerald-600 ring-emerald-400/30',
    amber: 'from-amber-500/20 to-orange-400/5 text-amber-600 ring-amber-400/30',
    coral: 'from-orange-500/20 to-pink-400/5 text-orange-600 ring-orange-400/30',
    orange: 'from-orange-500/20 to-pink-400/5 text-orange-600 ring-orange-400/30',
  };

  return (
    <Card className={`group/chart h-full gap-0 overflow-hidden py-0 ${className}`}>
      <div className="relative flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-500 group-hover/chart:opacity-100" />
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={`grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 ${accents[accent] || accents.primary}`}>
              <Icon className="size-4" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
          {badge}
        </div>
        {right && <div className="flex items-center gap-1.5">{right}</div>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </Card>
  );
}

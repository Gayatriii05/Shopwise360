import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import CountUp from './CountUp';
import Sparkline from './Sparkline';
import { CardSpotlight } from './ui/card-spotlight';
import { EASE } from '../lib/motion';

const ACCENTS = {
  primary: { chip: 'from-violet-500/20 to-fuchsia-400/5 text-violet-600 ring-violet-400/30', glow: 'bg-violet-500/12', line: '#8B5CF6', spot: 'rgba(139, 92, 246, 0.14)' },
  pink: { chip: 'from-pink-500/20 to-rose-400/5 text-pink-600 ring-pink-400/30', glow: 'bg-pink-500/12', line: '#EC4899', spot: 'rgba(236, 72, 153, 0.14)' },
  cyan: { chip: 'from-pink-500/20 to-rose-400/5 text-pink-600 ring-pink-400/30', glow: 'bg-pink-500/12', line: '#EC4899', spot: 'rgba(236, 72, 153, 0.14)' },
  emerald: { chip: 'from-emerald-500/20 to-teal-400/5 text-emerald-600 ring-emerald-400/30', glow: 'bg-emerald-500/12', line: '#10B981', spot: 'rgba(16, 185, 129, 0.14)' },
  amber: { chip: 'from-amber-500/20 to-orange-400/5 text-amber-600 ring-amber-400/30', glow: 'bg-amber-500/12', line: '#F59E0B', spot: 'rgba(245, 158, 11, 0.14)' },
  coral: { chip: 'from-orange-500/20 to-pink-400/5 text-orange-600 ring-orange-400/30', glow: 'bg-orange-500/12', line: '#F97316', spot: 'rgba(249, 115, 22, 0.14)' },
  orange: { chip: 'from-orange-500/20 to-pink-400/5 text-orange-600 ring-orange-400/30', glow: 'bg-orange-500/12', line: '#F97316', spot: 'rgba(249, 115, 22, 0.14)' },
  violet: { chip: 'from-violet-500/20 to-fuchsia-400/5 text-violet-600 ring-violet-400/30', glow: 'bg-violet-500/12', line: '#8B5CF6', spot: 'rgba(139, 92, 246, 0.14)' },
};

export default function StatCard({
  label,
  value = 0,
  prefix = '',
  suffix = '',
  decimals = 0,
  icon: Icon,
  accent = 'primary',
  delta,
  deltaSuffix = '%',
  hint,
  spark,
  delay = 0,
  className = '',
}) {
  const a = ACCENTS[accent] || ACCENTS.primary;
  const hasDelta = delta !== undefined && delta !== null && Number.isFinite(Number(delta));
  const up = Number(delta) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      whileHover={{ y: -4 }}
      className={`${className}`}
    >
      <CardSpotlight
        spotlightColor={a.spot}
        className="h-full rounded-2xl border border-border bg-card p-5 shadow-card transition-[box-shadow,border-color] duration-300 hover:border-primary/35 hover:shadow-card-hover"
      >
        <div aria-hidden className={`pointer-events-none absolute -right-10 -top-10 size-28 rounded-full blur-3xl transition-opacity duration-500 opacity-60 group-hover:opacity-100 ${a.glow}`} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-200/70 to-transparent" />

        <div className="relative flex items-start justify-between gap-3">
          <span className="label-micro">{label}</span>
          {Icon && (
            <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 transition-transform duration-300 group-hover:scale-105 ${a.chip}`}>
              <Icon className="size-4" />
            </span>
          )}
        </div>

        <div className="relative mt-3 flex items-end gap-2">
          <span className="mono-num text-3xl font-extrabold leading-none tracking-tight text-foreground">
            <CountUp value={value} prefix={prefix} suffix={suffix} decimals={decimals} delay={delay} />
          </span>
          {hasDelta && (
            <span className={`mb-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
              up ? 'bg-emerald-500/15 text-emerald-600' : 'bg-orange-500/15 text-orange-600'
            }`}>
              {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(Number(delta))}{deltaSuffix}
            </span>
          )}
        </div>

        {hint && <p className="relative mt-1.5 text-[11px] text-muted-foreground">{hint}</p>}

        {spark && spark.length > 1 && (
          <Sparkline values={spark} color={a.line} height={38} className="relative mt-3" />
        )}
      </CardSpotlight>
    </motion.div>
  );
}
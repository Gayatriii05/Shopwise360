import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import CountUp from './CountUp';
import Sparkline from './Sparkline';
import { CardSpotlight } from './ui/card-spotlight';
import { EASE } from '../lib/motion';

const ACCENTS = {
    primary: { chip: 'from-violet-500/20 to-emerald-400/5 text-violet-700 ring-violet-400/30', glow: 'bg-violet-500/12', line: '#C4B5FD', spot: 'rgba(196, 181, 253, 0.16)' },
    pink: { chip: 'from-pink-500/20 to-orange-400/5 text-pink-700 ring-pink-400/30', glow: 'bg-pink-500/12', line: '#C98DA8', spot: 'rgba(201, 141, 168, 0.16)' },
    cyan: { chip: 'from-emerald-500/20 to-teal-400/5 text-emerald-700 ring-emerald-400/30', glow: 'bg-emerald-500/12', line: '#A7D8B8', spot: 'rgba(167, 216, 184, 0.16)' },
    emerald: { chip: 'from-emerald-500/20 to-teal-400/5 text-emerald-700 ring-emerald-400/30', glow: 'bg-emerald-500/12', line: '#A7D8B8', spot: 'rgba(167, 216, 184, 0.16)' },
    amber: { chip: 'from-orange-500/20 to-amber-400/5 text-orange-700 ring-orange-400/30', glow: 'bg-orange-500/12', line: '#FFD6A5', spot: 'rgba(255, 214, 165, 0.16)' },
    coral: { chip: 'from-orange-500/20 to-amber-400/5 text-orange-700 ring-orange-400/30', glow: 'bg-orange-500/12', line: '#FFD6A5', spot: 'rgba(255, 214, 165, 0.16)' },
    orange: { chip: 'from-orange-500/20 to-amber-400/5 text-orange-700 ring-orange-400/30', glow: 'bg-orange-500/12', line: '#FFD6A5', spot: 'rgba(255, 214, 165, 0.16)' },
    violet: { chip: 'from-violet-500/20 to-fuchsia-400/5 text-violet-700 ring-violet-400/30', glow: 'bg-violet-500/12', line: '#C4B5FD', spot: 'rgba(196, 181, 253, 0.16)' },
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
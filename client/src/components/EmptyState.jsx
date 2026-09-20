import { motion } from 'framer-motion';

export default function EmptyState({
  icon = '📭',
  title = 'Nothing here yet',
  message = '',
  action = null,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center sm:px-10 sm:py-16"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,black_5%,transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 size-40 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />

      <div className="relative">
        <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-pink-500/10 text-2xl ring-1 ring-primary/25 shadow-glow-brand">
          <span className="leading-none" aria-hidden="true">{icon}</span>
        </div>
        <span aria-hidden className="absolute -inset-2 -z-10 rounded-3xl bg-primary/10 blur-xl" />
      </div>

      <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground">{title}</h3>
      {message && (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground text-balance sm:text-sm">
          {message}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}

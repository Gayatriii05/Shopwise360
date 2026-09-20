import { motion } from 'framer-motion';
import { TextGenerateEffect } from './ui/text-generate-effect';
import { EASE } from '../lib/motion';

export default function PageHeader({ eyebrow, title, subtitle, icon: Icon, actions, children, className = '', animateTitle = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div className="flex items-start gap-3.5">
        {Icon && (
          <div className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/25 to-pink-500/10 text-primary ring-1 ring-primary/25 shadow-glow-brand">
            <Icon className="size-5" />
          </div>
        )}
        <div>
          {eyebrow && <div className="label-micro mb-1">{eyebrow}</div>}
          {animateTitle && typeof title === 'string' ? (
            <TextGenerateEffect words={title} className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl" />
          ) : (
            <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          )}
          {subtitle && <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">{subtitle}</p>}
          {children}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
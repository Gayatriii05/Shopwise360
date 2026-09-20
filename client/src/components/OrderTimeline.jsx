import { motion } from 'framer-motion';
import { ClockIcon, CheckCircleIcon, TruckIcon, PackageIcon } from './Icons';

const STEPS = [
  { key: 'pending', label: 'Pending', icon: ClockIcon },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircleIcon },
  { key: 'shipped', label: 'Shipped', icon: TruckIcon },
  { key: 'delivered', label: 'Delivered', icon: PackageIcon }
];

const STATUS_META = {
  pending: { label: 'Pending', badge: 'bg-amber-500/12 text-amber-700 border border-amber-400/40', dot: 'bg-amber-500' },
  confirmed: { label: 'Confirmed', badge: 'bg-pink-500/12 text-pink-700 border border-pink-400/40', dot: 'bg-pink-500' },
  shipped: { label: 'Shipped', badge: 'bg-violet-500/12 text-violet-700 border border-violet-400/40', dot: 'bg-violet-500' },
  delivered: { label: 'Delivered', badge: 'bg-emerald-500/12 text-emerald-700 border border-emerald-400/40', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', badge: 'bg-orange-500/12 text-orange-700 border border-orange-400/40', dot: 'bg-orange-500' },
};

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || {
    label: status,
    badge: 'bg-muted text-muted-foreground border border-border',
    dot: 'bg-muted-foreground'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm ${meta.badge}`}>
      <span className={`status-dot size-1.5 ${meta.dot} text-current`} />
      {meta.label}
    </span>
  );
}

export default function OrderTimeline({ status }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-orange-400/40 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-700">
        <span className="grid size-5 place-items-center rounded-full bg-orange-500/20 font-bold text-orange-700">✕</span>
        <span>Order was cancelled</span>
      </div>
    );
  }

  const currentIdx = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="w-full py-2">
      <div className="flex w-full items-center">
        {STEPS.map((step, i) => {
          const isDone = i <= currentIdx;
          const isCurrent = i === currentIdx;
          const StepIcon = step.icon;

          return (
            <div key={step.key} className="flex flex-1 items-center last:flex-none">
              <div className="relative flex flex-col items-center">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className={`grid size-7 place-items-center rounded-full transition-all sm:size-8 ${
                    isCurrent
                      ? 'bg-gradient-to-br from-[#ff3d77] to-[#ff7a45] text-white shadow-glow-brand ring-4 ring-primary/20'
                      : isDone
                      ? 'border border-emerald-400/40 bg-emerald-500/15 text-emerald-700'
                      : 'border border-border bg-muted text-muted-foreground'
                  }`}
                >
                  <StepIcon className="size-3.5 sm:size-4" />
                </motion.div>
                <span
                  className={`mt-1.5 whitespace-nowrap text-[10px] font-medium sm:text-xs ${
                    isCurrent
                      ? 'font-bold text-foreground'
                      : isDone
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/60'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div className="-mt-4 mx-2 flex-1">
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: i < currentIdx ? 1 : 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.15 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                      style={{ originX: 0 }}
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-pink-400"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

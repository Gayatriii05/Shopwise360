import { ClockIcon, CheckCircleIcon, TruckIcon, PackageIcon } from './Icons';

const STEPS = [
  { key: 'pending', label: 'Pending', icon: ClockIcon },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircleIcon },
  { key: 'shipped', label: 'Shipped', icon: TruckIcon },
  { key: 'delivered', label: 'Delivered', icon: PackageIcon }
];

const STATUS_META = {
  pending: {
    label: 'Pending',
    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
    dot: 'bg-amber-400'
  },
  confirmed: {
    label: 'Confirmed',
    badge: 'bg-sky-50 text-sky-700 border border-sky-200',
    dot: 'bg-sky-400'
  },
  shipped: {
    label: 'Shipped',
    badge: 'bg-violet-50 text-violet-700 border border-violet-200',
    dot: 'bg-violet-500'
  },
  delivered: {
    label: 'Delivered',
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dot: 'bg-emerald-500'
  },
  cancelled: {
    label: 'Cancelled',
    badge: 'bg-coral-50 text-coral-700 border border-coral-200',
    dot: 'bg-coral-400'
  }
};

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || {
    label: status,
    badge: 'bg-cream-100 text-cream-700 border border-cream-300',
    dot: 'bg-cream-400'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${meta.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export default function OrderTimeline({ status }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 text-xs font-semibold text-coral-700 bg-coral-50 border border-coral-200 px-3 py-2 rounded-xl">
        <span className="w-5 h-5 rounded-full bg-coral-100 text-coral-600 flex items-center justify-center font-bold">✕</span>
        <span>Order was cancelled</span>
      </div>
    );
  }

  const currentIdx = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="w-full py-2">
      <div className="flex items-center w-full">
        {STEPS.map((step, i) => {
          const isDone = i <= currentIdx;
          const isCurrent = i === currentIdx;
          const StepIcon = step.icon;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center relative">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all shadow-subtle ${
                    isCurrent
                      ? 'bg-violet-600 text-white ring-4 ring-violet-100 scale-105 shadow-glow-brand'
                      : isDone
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-cream-100 text-cream-400 border border-cream-300'
                  }`}
                >
                  <StepIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <span
                  className={`text-[10px] sm:text-xs mt-1.5 whitespace-nowrap font-medium ${
                    isCurrent
                      ? 'font-bold text-violet-700'
                      : isDone
                      ? 'text-cream-600'
                      : 'text-cream-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div className="flex-1 mx-2 -mt-4">
                  <div
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i < currentIdx ? 'bg-violet-500' : 'bg-cream-300'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
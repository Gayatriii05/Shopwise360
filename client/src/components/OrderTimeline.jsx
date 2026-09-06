const STEPS = [
  { key: 'pending', label: 'Pending', icon: '🕐' },
  { key: 'confirmed', label: 'Confirmed', icon: '✅' },
  { key: 'shipped', label: 'Shipped', icon: '🚚' },
  { key: 'delivered', label: 'Delivered', icon: '📦' }
];

const STATUS_META = {
  pending: { label: 'Pending', color: 'text-slate-600 bg-slate-100 border-slate-300' },
  confirmed: { label: 'Confirmed', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  shipped: { label: 'Shipped', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  delivered: { label: 'Delivered', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  cancelled: { label: 'Cancelled', color: 'text-red-700 bg-red-50 border-red-200' }
};

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, color: 'text-slate-600 bg-slate-100 border-slate-300' };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${meta.color}`}>
      {meta.label}
    </span>
  );
}

export default function OrderTimeline({ status }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-base">✕</span>
        <span className="font-medium text-red-600">Order cancelled</span>
      </div>
    );
  }

  const currentIdx = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="w-full">
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const isDone = i <= currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors ${
                    isDone ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {isDone ? '✓' : step.icon}
                </div>
                <span className={`text-[10px] mt-1 ${isCurrent ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 -mt-4 ${i < currentIdx ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
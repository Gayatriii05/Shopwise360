export default function EmptyState({
  icon = '📭',
  title = 'Nothing here yet',
  message = '',
  action = null,
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border border-dashed border-cream-300 bg-cream-50/40 -sm shadow-subtle transition-all">
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-violet-50 border border-cream-300/70 flex items-center justify-center text-2xl sm:text-3xl mb-4 shadow-subtle">
        {icon}
      </div>
      <h3 className="font-bold text-cream-800 text-base sm:text-lg tracking-tight">
        {title}
      </h3>
      {message && (
        <p className="text-xs sm:text-sm text-cream-500 mt-1 max-w-sm text-balance">
          {message}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
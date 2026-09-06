export default function EmptyState({ icon = '📭', title = 'Nothing here yet', message = '', action }) {
  return (
    <div className="text-center py-12 rounded-lg border border-dashed border-slate-300 bg-white">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="font-semibold text-slate-700">{title}</h3>
      {message && <p className="text-sm text-slate-500 mt-1">{message}</p>}
      {action}
    </div>
  );
}
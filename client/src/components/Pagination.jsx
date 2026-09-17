import { ArrowLeftIcon, ArrowRightIcon } from './Icons';

export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (page >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', page - 1, page, page + 1, '...', totalPages];
  };

  const pages = getPageNumbers();

  return (
    <nav className="flex items-center justify-center gap-1.5 mt-8" aria-label="Pagination Navigation">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-cream-300/70 text-xs font-semibold text-cream-600 bg-cream-50 shadow-subtle hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 disabled:opacity-30 disabled:pointer-events-none transition-all"
        aria-label="Previous page"
      >
        <ArrowLeftIcon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Prev</span>
      </button>

      <div className="flex items-center gap-1">
        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`ellipsis-${idx}`} className="px-2 text-xs text-cream-400 select-none">
                …
              </span>
            );
          }
          const isCurrent = p === page;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                isCurrent
                  ? 'bg-violet-600 text-white shadow-glow-brand scale-105'
                  : 'bg-cream-50 text-cream-600 hover:bg-cream-100 hover:text-violet-700 border border-cream-300/70 shadow-subtle'
              }`}
              aria-current={isCurrent ? 'page' : undefined}
            >
              {p}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-cream-300/70 text-xs font-semibold text-cream-600 bg-cream-50 shadow-subtle hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 disabled:opacity-30 disabled:pointer-events-none transition-all"
        aria-label="Next page"
      >
        <span className="hidden sm:inline">Next</span>
        <ArrowRightIcon className="w-3.5 h-3.5" />
      </button>
    </nav>
  );
}
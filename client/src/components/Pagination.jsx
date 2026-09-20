import { ChevronLeft, ChevronRight } from 'lucide-react';

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

  const navBtn =
    'inline-flex h-9 items-center gap-1 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-muted-foreground shadow-subtle transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted hover:text-primary disabled:pointer-events-none disabled:opacity-30';

  return (
    <nav className="mt-8 flex items-center justify-center gap-1.5" aria-label="Pagination Navigation">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={navBtn}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-3.5" />
        <span className="hidden sm:inline">Prev</span>
      </button>

      <div className="flex items-center gap-1">
        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`ellipsis-${idx}`} className="px-2 text-xs text-muted-foreground select-none">
                …
              </span>
            );
          }
          const isCurrent = p === page;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`h-9 w-9 rounded-xl text-xs font-bold transition-all ${
                isCurrent
                  ? 'scale-105 bg-gradient-to-br from-[#ff3d77] to-[#ff7a45] text-primary-foreground shadow-glow-brand'
                  : 'border border-border bg-card text-muted-foreground shadow-subtle hover:border-primary/40 hover:bg-muted hover:text-primary'
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
        className={navBtn}
        aria-label="Next page"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="size-3.5" />
      </button>
    </nav>
  );
}
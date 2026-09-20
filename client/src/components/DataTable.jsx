import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { Input } from './ui/input';
import EmptyState from './EmptyState';

const ALIGN = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export default function DataTable({
  columns = [],
  rows = [],
  rowKey = (r) => r.id,
  loading = false,
  empty,
  toolbar,
  searchable = false,
  searchKeys = [],
  searchPlaceholder = 'Search…',
  initialSort = null,
  pageSize = 0,
  onRowClick,
  className = '',
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return rows;
    const q = query.trim().toLowerCase();
    const keys = searchKeys.length ? searchKeys : columns.map((c) => c.key);
    return rows.filter((r) => keys.some((k) => String(r?.[k] ?? '').toLowerCase().includes(q)));
  }, [rows, query, searchable, searchKeys, columns]);

  const sorted = useMemo(() => {
    if (!sort?.key) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col?.sortValue ? col.sortValue(a) : a?.[sort.key];
      const bv = col?.sortValue ? col.sortValue(b) : b?.[sort.key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
    });
  }, [filtered, sort, columns]);

  const paged = useMemo(() => {
    if (!pageSize || pageSize <= 0) return sorted;
    return sorted.slice((page - 1) * pageSize, page * pageSize);
  }, [sorted, pageSize, page]);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;

  const toggleSort = (col) => {
    if (!col.sortable) return;
    setSort((s) => {
      if (s?.key !== col.key) return { key: col.key, dir: col.sortDir || 'asc' };
      return { key: col.key, dir: s.dir === 'asc' ? 'desc' : 'asc' };
    });
  };

  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-card shadow-card ${className}`}>
      {(toolbar || searchable) && (
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          {toolbar || <div />}
          {searchable && (
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder={searchPlaceholder}
                className="h-9 rounded-xl pl-9 text-xs"
              />
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted/50 backdrop-blur">
              {columns.map((col) => {
                const active = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground ${ALIGN[col.align] || ALIGN.left} ${col.sortable ? 'cursor-pointer select-none transition-colors hover:text-foreground' : ''}`}
                    onClick={() => toggleSort(col)}
                  >
                    <span className={`inline-flex items-center gap-1.5 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                      {col.header}
                      {col.sortable && (
                        active
                          ? (sort.dir === 'asc' ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />)
                          : <ArrowUpDown className="size-3 opacity-50" />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, r) => (
                <tr key={r} className="border-b border-border/60">
                  {columns.map((c, ci) => (
                    <td key={c.key} className="px-4 py-3.5">
                      <div className="h-3.5 rounded shimmer bg-muted" style={{ width: `${90 - ci * 12}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  {empty || <EmptyState icon="🗂️" title="No records" message="There is nothing to display here yet." />}
                </td>
              </tr>
            ) : (
              paged.map((row, i) => (
                <motion.tr
                  key={rowKey(row, i)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3), ease: [0.22, 1, 0.36, 1] }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`group border-b border-border/60 transition-colors last:border-0 hover:bg-primary/[0.055] ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3.5 align-middle ${ALIGN[col.align] || ALIGN.left} ${col.cellClassName || ''}`}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageSize > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>Page {page} of {totalPages} · {sorted.length} rows</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-border bg-card px-3 py-1.5 font-semibold transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-border bg-card px-3 py-1.5 font-semibold transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

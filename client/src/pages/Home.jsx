import { useEffect, useState, useMemo } from 'react';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';

const DEBOUNCE_MS = 350;

export default function Home() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.get('/products/categories').then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, categoryId, sort]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get('/products', { params: { search: debouncedSearch, category_id: categoryId, sort, page, limit: 12 } })
      .then(({ data }) => {
        if (cancelled) return;
        setProducts(data.products);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      })
      .catch(() => { if (!cancelled) setError('Failed to load products'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedSearch, categoryId, sort, page]);

  const hasFilters = Boolean(searchTerm || categoryId || sort !== 'newest');
  const grid = useMemo(() => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      {loading
        ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        : products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  ), [loading, products]);

  return (
    <div>
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold text-slate-800">Welcome to ShopWise 360</h1>
        <p className="text-slate-500 mt-2">Retail Demand & Customer Analytics Platform</p>
      </div>

      <div className="bg-white border rounded-lg p-4 mb-6 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="flex-1">
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products..."
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="border rounded px-3 py-2 text-sm bg-white"
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border rounded px-3 py-2 text-sm bg-white"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low → High</option>
          <option value="price_desc">Price: High → Low</option>
          <option value="name_asc">Name (A-Z)</option>
          <option value="rating">Top rated</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => { setSearchTerm(''); setDebouncedSearch(''); setCategoryId(''); setSort('newest'); setPage(1); }}
            className="text-sm text-red-500 hover:underline whitespace-nowrap"
          >
            Clear filters
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400 mb-4">{total} product{total !== 1 ? 's' : ''}</p>

      {error ? (
        <EmptyState icon="⚠️" title="Something went wrong" message={error} />
      ) : !loading && products.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No products found"
          message="Try a different search term or category."
          action={<button onClick={() => { setSearchTerm(''); setDebouncedSearch(''); setCategoryId(''); setSort('newest'); }} className="mt-3 text-sm text-emerald-600 hover:underline">Clear filters</button>}
        />
      ) : (
        grid
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
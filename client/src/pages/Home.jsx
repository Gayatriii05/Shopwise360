import { useEffect, useState, useMemo } from 'react';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import { Stagger, StaggerItem, FadeIn } from '../components/Reveal';
import { SearchIcon, FilterIcon, SparklesIcon, TrendingUpIcon, XIcon } from '../components/Icons';

const DEBOUNCE_MS = 350;

const selectClass =
  'w-full appearance-none pl-3.5 pr-8 py-2.5 bg-cream-50 hover:bg-cream-50 border border-cream-300 rounded-xl text-sm font-medium text-cream-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all cursor-pointer';

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
    api.get('/products/categories')
      .then(({ data }) => setCategories(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryId, sort]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get('/products', {
      params: { search: debouncedSearch, category_id: categoryId, sort, page, limit: 12 }
    })
      .then(({ data }) => {
        if (cancelled) return;
        setProducts(data.products);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load products from catalog.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedSearch, categoryId, sort, page]);

  const hasFilters = Boolean(searchTerm || categoryId || sort !== 'newest');

  const clearAllFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setCategoryId('');
    setSort('newest');
    setPage(1);
  };

  const grid = useMemo(() => (
    <Stagger className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
      {loading
        ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        : products.map((p) => <StaggerItem key={p.id}><ProductCard product={p} /></StaggerItem>)}
    </Stagger>
  ), [loading, products]);

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <FadeIn>
        <section className="relative border-b border-cream-300/70 pb-10 sm:pb-12">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cream-50 text-violet-700 border border-cream-300 text-xs font-semibold">
              <SparklesIcon className="w-3.5 h-3.5 text-violet-500" />
              <span>AI-Driven Retail Platform</span>
            </div>
            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-[46px] font-bold text-cream-900 leading-[1.05]">
              Discover Quality Products with <span className="text-violet-600">Real-Time Intelligence</span>
            </h1>
            <p className="text-sm sm:text-base text-cream-600 mt-3 sm:mt-4 leading-relaxed max-w-xl">
              Explore live multi-retailer inventory, transparent pricing, verified customer reviews, and ML-recommended picks.
            </p>

            <div className="flex flex-wrap gap-4 mt-6 text-xs text-cream-600">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                <span>Multi-Retailer Inventory</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Live Demand Forecasting</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-coral-500" />
                <span>Verified Customer Reviews</span>
              </div>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Filter & Search Toolbar */}
      <FadeIn delay={0.05}>
        <div className="glass-card rounded-2xl border border-cream-300/70 p-4 sm:p-5 space-y-3 sm:space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cream-400">
                <SearchIcon className="w-4 h-4" />
              </div>
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by product name or keywords..."
                className="w-full pl-10 pr-4 py-2.5 bg-cream-50 hover:bg-cream-50 border border-cream-300 rounded-xl text-sm text-cream-800 placeholder-cream-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
              />
            </div>

            <div className="relative sm:w-48">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectClass}>
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-cream-400">
                <FilterIcon className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="relative sm:w-48">
              <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectClass}>
                <option value="newest">Sort: Newest First</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
                <option value="name_asc">Name: A to Z</option>
                <option value="rating">Highest Rated</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-cream-400">
                <TrendingUpIcon className="w-3.5 h-3.5" />
              </div>
            </div>

            {hasFilters && (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-coral-200 text-coral-700 bg-coral-50 hover:bg-coral-100 text-xs font-semibold whitespace-nowrap transition-all"
              >
                <XIcon className="w-3.5 h-3.5" />
                <span>Clear filters</span>
              </button>
            )}
          </div>

          {categories.length > 0 && (
            <div className="pt-2 border-t border-cream-300/70 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
              <span className="text-cream-400 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap mr-1">
                Categories:
              </span>
              <button
                onClick={() => setCategoryId('')}
                className={`px-3 py-1.5 rounded-full font-medium transition-all whitespace-nowrap ${
                  categoryId === ''
                    ? 'bg-violet-600 text-white shadow-glow-brand scale-105'
                    : 'bg-cream-50 hover:bg-cream-100 text-cream-600 border border-cream-300/70 shadow-subtle'
                }`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(String(c.id))}
                  className={`px-3 py-1.5 rounded-full font-medium transition-all whitespace-nowrap ${
                    categoryId === String(c.id)
                      ? 'bg-violet-600 text-white shadow-glow-brand scale-105'
                      : 'bg-cream-50 hover:bg-cream-100 text-cream-600 border border-cream-300/70 shadow-subtle'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </FadeIn>

      {/* Catalog Status Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-cream-700">Catalog Products</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 font-bold text-violet-700">
            {total}
          </span>
        </div>
        {hasFilters && (
          <span className="text-xs text-cream-400">
            Filtered view
          </span>
        )}
      </div>

      {/* Main Grid / States */}
      {error ? (
        <FadeIn delay={0.05}>
          <EmptyState
            icon="⚠️"
            title="Something went wrong"
            message={error}
            action={
              <button
                onClick={clearAllFilters}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-glow-brand hover:shadow-glow-brand hover:-translate-y-0.5"
              >
                Reset Filters
              </button>
            }
          />
        </FadeIn>
      ) : !loading && products.length === 0 ? (
        <FadeIn delay={0.05}>
          <EmptyState
            icon="🔍"
            title="No products found"
            message="We couldn't find any products matching your search or category filter."
            action={
              <button
                onClick={clearAllFilters}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-glow-brand hover:shadow-glow-brand hover:-translate-y-0.5"
              >
                Clear all filters
              </button>
            }
          />
        </FadeIn>
      ) : (
        grid
      )}

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
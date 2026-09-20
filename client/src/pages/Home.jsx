import { useEffect, useState, useMemo } from 'react';
import { Search, SlidersHorizontal, Sparkles as SparklesIcon, TrendingUp, X } from 'lucide-react';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import ProductQuickView from '../components/ProductQuickView';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import { Stagger, StaggerItem, FadeIn } from '../components/Reveal';
import CountUp from '../components/CountUp';
import { Spotlight } from '../components/ui/spotlight';
import { SparklesCore } from '../components/ui/sparkles';
import { TextGenerateEffect } from '../components/ui/text-generate-effect';
import { AuroraBackground } from '../components/ui/aurora-background';
import { Meteors } from '../components/ui/meteors';
import { CardContainer, CardBody, CardItem } from '../components/ui/3d-card';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';

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

  const [quickView, setQuickView] = useState(null);

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
    <Stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-6">
      {loading
        ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        : products.map((p) => (
            <StaggerItem key={p.id}>
              <CardContainer containerClassName="py-0 h-full" className="h-full w-full">
                <CardBody className="h-full w-full">
                  <CardItem translateZ={30} className="h-full w-full">
                    <ProductCard product={p} onQuickView={setQuickView} />
                  </CardItem>
                </CardBody>
              </CardContainer>
            </StaggerItem>
          ))}
    </Stagger>
  ), [loading, products]);

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <FadeIn y={10}>
        <AuroraBackground className="rounded-3xl border border-border/70 shadow-elevated">
          <Meteors number={24} />
          <section className="relative overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute -left-24 -top-28 size-80 rounded-full bg-primary/10 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -right-20 top-6 size-72 rounded-full bg-orange-400/15 blur-3xl" />
            <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#8B5CF6" />

          <Stagger className="relative z-10 px-6 py-12 sm:px-12 sm:py-16">
            <StaggerItem>
              <Badge variant="outline" className="w-fit gap-1.5 border-primary/25 bg-primary/5 px-3 py-1 text-[11px] font-semibold text-primary">
                <SparklesIcon className="size-3.5" />
                AI-Driven Retail Platform
              </Badge>
            </StaggerItem>

            <StaggerItem>
              <div className="relative mt-5 max-w-3xl">
                <SparklesCore
                  className="absolute inset-0 z-0 h-full w-full"
                  background="transparent"
                  particleColor="#A78BFA"
                  particleDensity={80}
                  minSize={0.6}
                  maxSize={1.4}
                  speed={1.2}
                />
                <TextGenerateEffect
                  words="Discover quality products with real-time intelligence"
                  className="relative z-10 max-w-2xl font-bold tracking-tight text-foreground [&_div]:text-4xl [&_div]:leading-[1.05] sm:[&_div]:text-5xl lg:[&_div]:text-[52px] [&_span]:text-foreground"
                />
              </div>
            </StaggerItem>

            <StaggerItem>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Explore live multi-retailer inventory, transparent pricing, verified customer reviews, and ML-recommended picks — all in one marketplace.
              </p>
            </StaggerItem>

            <StaggerItem>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="h-11 rounded-xl px-6 shadow-glow-brand hover:shadow-glow-brand hover:brightness-110">
                  <a href="#catalog">Explore the catalog</a>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-11 rounded-xl px-5">
                  <a href="/login">Sign in to your role</a>
                </Button>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
                {[
                  { dot: 'bg-primary', label: 'Multi-Retailer Inventory' },
                  { dot: 'bg-emerald-500', label: 'Live Demand Forecasting' },
                  { dot: 'bg-coral-500', label: 'Verified Customer Reviews' },
                ].map((f) => (
                  <span key={f.label} className="inline-flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full ${f.dot}`} />
                    {f.label}
                  </span>
                ))}
              </div>
            </StaggerItem>

            {/* ── Hero stats ────── */}
            <StaggerItem>
              <div className="mt-9 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
                <div className="bg-card px-6 py-5">
                  <div className="mono-num text-3xl font-black tracking-tight text-foreground">
                    <CountUp value={total} />
                  </div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Products listed
                  </div>
                </div>
                <div className="bg-card px-6 py-5">
                  <div className="mono-num text-3xl font-black tracking-tight text-foreground">
                    <CountUp value={categories.length} />
                  </div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Active categories
                  </div>
                </div>
                <div className="bg-card px-6 py-5">
                  <div className="flex items-center gap-2.5 text-2xl font-black tracking-tight text-emerald-600">
                    <span className="relative flex size-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                    </span>
                    Live
                  </div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Demand signals refreshed real-time
                  </div>
                </div>
              </div>
            </StaggerItem>
          </Stagger>
          </section>
        </AuroraBackground>
      </FadeIn>

      {/* ── Catalog ──────────────────────────────────────────── */}
      <section id="catalog" className="space-y-5 scroll-mt-24">
        <FadeIn delay={0.05} className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label-micro">Live catalog</div>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Today&apos;s picks
            </h2>
          </div>
          {!loading && (
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span className="size-2 animate-pulse rounded-full bg-emerald-500/80" />
              {total} products
            </div>
          )}
        </FadeIn>

        {/* Filter & search toolbar */}
        <FadeIn delay={0.1}>
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="space-y-3 p-4 sm:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by product name or keywords..."
                    className="h-10 rounded-xl pl-9"
                  />
                </div>

                <div className="sm:w-52">
                  <Select value={categoryId === '' ? 'all' : categoryId} onValueChange={(v) => setCategoryId(v === 'all' ? '' : v)}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SlidersHorizontal className="size-4 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:w-52">
                  <Select value={sort} onValueChange={setSort}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <TrendingUp className="size-4 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Sort: Newest first</SelectItem>
                      <SelectItem value="price_asc">Price: Low → High</SelectItem>
                      <SelectItem value="price_desc">Price: High → Low</SelectItem>
                      <SelectItem value="name_asc">Name: A to Z</SelectItem>
                      <SelectItem value="rating">Highest rated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {hasFilters && (
                  <Button
                    variant="outline"
                    onClick={clearAllFilters}
                    className="h-10 gap-1.5 rounded-xl text-xs"
                  >
                    <X className="size-3.5" />
                    Clear filters
                  </Button>
                )}
              </div>

              {categories.length > 0 && (
                <div className="scrollbar-none flex items-center gap-2 overflow-x-auto border-t border-border/60 pb-1 pt-3">
                  <span className="mr-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Categories
                  </span>
                  <Button
                    size="sm"
                    variant={categoryId === '' ? 'default' : 'outline'}
                    onClick={() => setCategoryId('')}
                    className="rounded-full px-3 text-xs"
                  >
                    All
                  </Button>
                  {categories.map((c) => (
                    <Button
                      key={c.id}
                      size="sm"
                      variant={String(c.id) === categoryId ? 'default' : 'outline'}
                      onClick={() => setCategoryId(String(c.id))}
                      className="rounded-full px-3 text-xs"
                    >
                      {c.name}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Catalog status bar */}
        <FadeIn delay={0.15}>
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              Catalog products
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[11px] tabular-nums">
                {total}
              </Badge>
            </div>
            {hasFilters && <span className="text-xs text-muted-foreground">Filtered view</span>}
          </div>
        </FadeIn>

        {/* Main grid / states */}
        {error ? (
          <FadeIn delay={0.05}>
            <EmptyState
              icon="⚠️"
              title="Something went wrong"
              message={error}
              action={
                <Button onClick={clearAllFilters} className="rounded-xl text-xs">
                  Reset filters
                </Button>
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
                <Button onClick={clearAllFilters} className="rounded-xl text-xs">
                  Clear all filters
                </Button>
              }
            />
          </FadeIn>
        ) : (
          grid
        )}

        {/* Pagination */}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </section>

      {/* Quick-view modal */}
      <ProductQuickView
        product={quickView}
        open={Boolean(quickView)}
        onOpenChange={(open) => { if (!open) setQuickView(null); }}
      />
    </div>
  );
}
import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { EASE } from '../lib/motion';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import ProductCard from '../components/ProductCard';
import ProductQuickView from '../components/ProductQuickView';
import OrderTimeline, { StatusBadge } from '../components/OrderTimeline';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import { Stagger, StaggerItem, FadeIn } from '../components/Reveal';
import { TextGenerateEffect } from '../components/ui/text-generate-effect';
import { GlowingStarsBackgroundCard, GlowingStarsTitle, GlowingStarsDescription } from '../components/ui/glowing-stars';
import { useRealtime } from '../context/RealtimeContext';
import {
  Search, SlidersHorizontal, RotateCcw, Minus, Plus, X, Trash2,
  Sparkles, ShoppingBag, ShoppingCart, Store, Package, Heart,
  CheckCircle2, AlertCircle, ArrowRight, Tag,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';

const fmtINR = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest arrivals' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top rated' },
];

const DEFAULT_FILTERS = { search: '', category: '', sort: 'newest', min: '', max: '' };

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { on, connected } = useRealtime();
  const [products, setProducts] = useState([]);
  const [knownProducts, setKnownProducts] = useState({}); // { id: product } for cart lookup
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [retailerId, setRetailerId] = useState('');
  const [cart, setCart] = useState({}); // { product_id: qty }
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [quickView, setQuickView] = useState(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponErr, setCouponErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [activeTab, setActiveTab] = useState('shop');
  const [orderMsg, setOrderMsg] = useState('');

  const loadOrders = async () => {
    try {
      const { data } = await api.get(`/orders/customer/${user.id}`);
      return data;
    } catch {
      return [];
    }
  };

  const mergeProducts = (list) => {
    setProducts(list || []);
    setKnownProducts((prev) => {
      const next = { ...prev };
      (list || []).forEach((p) => { next[p.id] = p; });
      return next;
    });
  };

  const loadProducts = async () => {
    const params = { limit: 12 };
    if (filters.search.trim()) params.search = filters.search.trim();
    if (filters.category) params.category_id = filters.category;
    if (filters.sort !== 'newest') params.sort = filters.sort;
    if (filters.min !== '') params.min_price = Number(filters.min);
    if (filters.max !== '') params.max_price = Number(filters.max);
    try {
      const { data } = await api.get('/products', { params });
      mergeProducts(data.products);
    } catch {
      mergeProducts([]);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setOrderMsg('');
    const [p, o, w, r] = await Promise.allSettled([
      api.get('/products', { params: { limit: 12 } }),
      loadOrders(),
      api.get('/wishlist/mine'),
      api.get('/retailers')
    ]);
    mergeProducts(p.status === 'fulfilled' ? p.value.data.products : []);
    setOrders(o.status === 'fulfilled' ? o.value : []);
    setWishlist(w.status === 'fulfilled' ? w.value.data : []);
    setRetailers(r.status === 'fulfilled' ? r.value.data : []);
    if (!retailerId && r.status === 'fulfilled' && r.value.data.length) setRetailerId(r.value.data[0].id);
    try {
      const rec = await api.get(`/ml/recommend/${user.id}`);
      setRecommendations(rec.data);
    } catch {
      setRecommendations([]);
    }
    api.get('/products/categories').then(({ data }) => setCategories(data)).catch(() => {});
    const failed = [p, o, w, r].filter((x) => x.status === 'rejected').length;
    if (failed) setOrderMsg(`Partially loaded — ${failed} section${failed > 1 ? 's' : ''} unavailable right now`);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  // Real-time: refresh orders instantly when status changes
  useEffect(() => {
    const unsub = on('order-status-change', (payload) => {
      setOrderMsg(`📦 Order #${payload.orderId} status updated to ${payload.status}`);
      loadOrders();
    });
    return unsub;
  }, [on]);

  const refreshProducts = async () => {
    setLoading(true);
    await loadProducts();
    setLoading(false);
  };

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const applyFilters = (e) => {
    if (e) e.preventDefault();
    refreshProducts();
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    refreshProducts();
  };

  const addToCart = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const removeFromCart = (id) => setCart((c) => {
    const next = { ...c };
    delete next[id];
    return next;
  });
  const decCart = (id) => setCart((c) => {
    const qty = (c[id] || 0) - 1;
    const next = { ...c };
    if (qty <= 0) delete next[id];
    else next[id] = qty;
    return next;
  });

  const toggleWishlist = async (pid) => {
    const inList = wishlist.some((w) => w.product_id === pid);
    try {
      if (inList) {
        await api.delete(`/wishlist/${pid}`);
        setWishlist((w) => w.filter((x) => x.product_id !== pid));
      } else {
        await api.post('/wishlist', { product_id: pid });
        setWishlist((w) => [...w, { product_id: pid }]);
        const p = knownProducts[pid];
        if (p) setWishlist((w) => w.map((x) => (x.product_id === pid ? p : x)));
      }
    } catch (err) {
      setOrderMsg(err.response?.data?.error || 'Wishlist update failed');
    }
  };

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code || !retailerId) return;
    setCouponErr('');
    try {
      const { data } = await api.post('/coupons/validate', { code, order_value: cartTotal, retailer_id: retailerId });
      setAppliedCoupon(data);
      setCouponInput('');
    } catch (err) {
      setAppliedCoupon(null);
      setCouponErr(err.response?.data?.reason || 'Coupon is not valid');
    }
  };

  const placeOrder = async () => {
    const items = Object.entries(cart).map(([product_id, quantity]) => ({ product_id: Number(product_id), quantity }));
    if (!items.length) return;
    if (!retailerId) { setOrderMsg('Please select a store to order from'); return; }
    setPlacing(true);
    setOrderMsg('');
    try {
      const { data } = await api.post('/orders', {
        retailer_id: retailerId,
        items,
        coupon_code: appliedCoupon ? appliedCoupon.code : null
      });
      setCart({});
      setAppliedCoupon(null);
      setCouponInput('');
      setOrderMsg(`Order #${data.orderId} placed successfully!${data.discount ? ` (₹${data.discount} discount applied)` : ''}`);
      await loadOrders();
      setActiveTab('orders');
    } catch (err) {
      setOrderMsg(err.response?.data?.error || 'Order failed to place');
    } finally {
      setPlacing(false);
    }
  };

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartItems = useMemo(() =>
    Object.entries(cart)
      .map(([id, qty]) => ({ product: knownProducts[id], qty }))
      .filter((x) => x.product),
  [cart, knownProducts]);
  const cartTotal = cartItems.reduce((sum, { product, qty }) => sum + product.sale_price * qty, 0);
  const cartFinalTotal = Math.max(0, cartTotal - (appliedCoupon?.discount || 0));

  const selectedStore = retailers.find((r) => r.id === retailerId);
  const addQuickView = (p) => { setQuickView(p); };

  return (
    <div className="space-y-6 pb-16">
      {/* Header Bar */}
      <FadeIn>
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-[radial-gradient(circle,rgba(255,61,119,0.14),transparent_65%)]" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/4 size-64 rounded-full bg-[radial-gradient(circle,rgba(255,122,69,0.16),transparent_65%)]" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 via-pink-500 to-orange-400 font-extrabold text-lg text-white shadow-glow-brand">
                {user?.name?.charAt(0).toUpperCase() || 'C'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                    <TextGenerateEffect words={`Hello, ${user?.name || 'Customer'}`} className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl" />
                  </h1>
                  <Badge variant="secondary" className="rounded-full border border-emerald-400/25 bg-emerald-500/12 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                    Customer
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Browse products, track active orders, and enjoy tailored ML recommendations
                </p>
              </div>
            </div>

            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
              connected
                ? 'border-emerald-400/25 bg-emerald-500/12 text-emerald-700'
                : 'border-border bg-muted text-muted-foreground'
            }`}>
              <span className={`size-2 rounded-full ${connected ? 'animate-pulse bg-emerald-500' : 'bg-muted-foreground/60'}`} />
              {connected ? 'Live Sync Active' : 'Connecting…'}
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Order Alert Banner */}
      {orderMsg && (
        <div className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-xs font-medium animate-fadeIn sm:text-sm ${
          orderMsg.includes('successfully') || orderMsg.includes('updated') || orderMsg.includes('status updated')
            ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-700'
            : 'border-destructive/25 bg-destructive/10 text-destructive'
        }`}>
          <div className="flex items-center gap-2">
            {orderMsg.includes('successfully') || orderMsg.includes('updated') ? (
              <CheckCircle2 className="size-4 flex-shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="size-4 flex-shrink-0 text-destructive" />
            )}
            <span>{orderMsg}</span>
          </div>
          <button
            onClick={() => setOrderMsg('')}
            className="p-1 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss notification"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <FadeIn>
        <div className="inline-flex rounded-2xl border border-border bg-muted/60 p-1">
          {[
            { key: 'shop', label: 'Shop Catalog', icon: ShoppingBag, count: null },
            { key: 'orders', label: 'My Orders', icon: Package, count: orders.length },
            { key: 'wishlist', label: 'Wishlist', icon: Heart, count: wishlist.length },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors sm:flex-none ${
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="customer-tab-pill"
                    transition={{ duration: 0.35, ease: EASE }}
                    className="absolute inset-0 rounded-xl bg-card shadow-sm ring-1 ring-border"
                  />
                )}
                <TabIcon className={`relative size-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="relative">{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <span className={`relative rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-border text-muted-foreground'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </FadeIn>

      {/* ════════════ TAB 1: SHOP ════════════ */}
      {activeTab === 'shop' && (
        <div className="space-y-6 animate-fadeIn">
          {/* ML Recommendations */}
          {recommendations.length > 0 && (
            <FadeIn>
              <GlowingStarsBackgroundCard>
                <div className="p-5 sm:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-pink-500 to-orange-400 text-white shadow-glow-brand">
                      <Sparkles className="size-4" />
                    </div>
                    <div>
                      <GlowingStarsTitle>Personalized for You (ML)</GlowingStarsTitle>
                      <GlowingStarsDescription>Collaborative filtering based on customer purchasing affinities</GlowingStarsDescription>
                    </div>
                  </div>

                  <div className="relative flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                    {recommendations.map((r) => {
                      const rp = knownProducts[r.product_id];
                      return (
                        <div
                          key={r.product_id}
                          className="flex w-44 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-subtle transition-all duration-300 hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/40"
                        >
                          <Link to={`/product/${r.product_id}`} className="group/img relative block h-24 overflow-hidden bg-muted">
                            {rp?.image_url ? (
                              <img
                                src={rp.image_url}
                                alt={r.name}
                                loading="lazy"
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                              />
                            ) : (
                              <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/15 to-pink/10">
                                <Sparkles className="size-5 text-primary/50" />
                              </div>
                            )}
                            <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                              {Math.round(Number(r.score) * 100)}% match
                            </span>
                          </Link>
                          <div className="flex flex-1 flex-col gap-1.5 p-3">
                            <Link to={`/product/${r.product_id}`} className="line-clamp-1 text-xs font-bold text-foreground hover:text-primary">
                              {r.name}
                            </Link>
                            <div className="mt-auto flex items-center justify-between gap-2">
                              <span className="text-sm font-extrabold tracking-tight text-foreground">
                                {rp ? `₹${fmtINR(rp.sale_price)}` : ''}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 gap-1 rounded-lg px-2 text-[11px] font-bold"
                                onClick={() => addToCart(r.product_id)}
                              >
                                <ShoppingCart className="size-3" />
                                {cart[r.product_id] ? `In cart (${cart[r.product_id]})` : 'Add'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </GlowingStarsBackgroundCard>
            </FadeIn>
          )}

          <div className="gap-6 space-y-6 lg:grid lg:grid-cols-[250px_1fr] lg:space-y-0">
            {/* ── Filter sidebar ── */}
            <FadeIn>
              <Card className="gap-0 p-5 ring-border/70 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
                <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="size-4 text-primary" />
                    <h2 className="text-sm font-bold text-foreground">Refine Results</h2>
                  </div>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary"
                  >
                    <RotateCcw className="size-3" />
                    Reset
                  </button>
                </div>

                <form onSubmit={applyFilters} className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={filters.search}
                        onChange={(e) => setFilter('search', e.target.value)}
                        placeholder="Search products…"
                        className="rounded-xl pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sort by</Label>
                    <Select
                      value={filters.sort}
                      onValueChange={(v) => { setFilter('sort', v); refreshProducts(); }}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SORT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Price range (₹)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min="0"
                        value={filters.min}
                        onChange={(e) => setFilter('min', e.target.value)}
                        placeholder="Min"
                        className="rounded-xl"
                      />
                      <Input
                        type="number"
                        min="0"
                        value={filters.max}
                        onChange={(e) => setFilter('max', e.target.value)}
                        placeholder="Max"
                        className="rounded-xl"
                      />
                    </div>
                    <Button type="submit" variant="outline" className="w-full rounded-xl text-xs font-bold">
                      Apply price
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Category</Label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setFilter('category', ''); refreshProducts(); }}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                          filters.category === ''
                            ? 'bg-primary text-white'
                            : 'bg-muted text-muted-foreground hover:bg-border'
                        }`}
                      >
                        All
                      </button>
                      {categories.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setFilter('category', String(c.id)); refreshProducts(); }}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                            filters.category === String(c.id)
                              ? 'bg-primary text-white'
                              : 'bg-muted text-muted-foreground hover:bg-border'
                          }`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              </Card>
            </FadeIn>

            {/* ── Catalog ── */}
            <section className="min-w-0 space-y-4">
              <FadeIn>
                <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-foreground sm:text-base">Shop Products</h2>
                    <p className="text-xs text-muted-foreground">Select items to purchase from your preferred local retailer</p>
                  </div>

                  {retailers.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <Store className="size-3.5 text-muted-foreground" />
                        Store:
                      </span>
                      <select
                        value={retailerId}
                        onChange={(e) => setRetailerId(Number(e.target.value))}
                        className="cursor-pointer rounded-xl border border-input bg-card px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {retailers.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.store_name} ({r.location || 'Store'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </FadeIn>

              <Stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                  : products.map((p) => (
                      <StaggerItem key={p.id}>
                        <ProductCard
                          product={p}
                          onQuickView={addQuickView}
                          footer={
                            <div className="mt-3 flex items-center gap-2">
                              <Button
                                type="button"
                                onClick={() => addToCart(p.id)}
                                className="flex-1 gap-1.5 rounded-xl text-xs font-bold"
                              >
                                <ShoppingCart className="size-3.5" />
                                Add {cart[p.id] ? `(${cart[p.id]})` : ''}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => toggleWishlist(p.id)}
                                className={`h-9 w-9 rounded-xl p-0 ${wishlist.some((w) => w.product_id === p.id) ? 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15' : 'text-muted-foreground hover:text-destructive'}`}
                                title={wishlist.some((w) => w.product_id === p.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                              >
                                <Heart className={`size-4 ${wishlist.some((w) => w.product_id === p.id) ? 'fill-destructive text-destructive' : ''}`} />
                              </Button>
                            </div>
                          }
                        />
                      </StaggerItem>
                    ))}
              </Stagger>

              {!loading && products.length === 0 && (
                <EmptyState
                  icon="🛒"
                  title="No matching products"
                  message="Try adjusting your filters or search — check back soon for freshly stocked catalog items."
                  action={
                    <Button type="button" variant="outline" className="rounded-xl text-xs font-bold" onClick={resetFilters}>
                      Clear filters
                    </Button>
                  }
                />
              )}
            </section>
          </div>

          {/* ══ Sticky Cart Breakdown Bar ══ */}
          {cartCount > 0 && (
            <div className="sticky bottom-4 z-30 animate-fadeIn rounded-2xl border border-border/70 bg-background/80 p-4 shadow-elevated backdrop-blur-xl sm:p-5">
              <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
                {/* Cart items */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <ShoppingCart className="size-3.5 text-primary" />
                      Cart breakdown · {cartCount} item{cartCount > 1 ? 's' : ''}
                    </h3>
                    <button
                      type="button"
                      onClick={() => { setCart({}); setAppliedCoupon(null); setCouponInput(''); }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                      Clear cart
                    </button>
                  </div>

                  <div className="space-y-2">
                    {cartItems.map(({ product, qty }) => (
                      <div key={product.id} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-2 pr-3">
                        <Link
                          to={`/product/${product.id}`}
                          className="relative block size-12 shrink-0 overflow-hidden rounded-lg bg-muted"
                        >
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                          ) : (
                            <span className="absolute inset-0 grid place-items-center text-[10px] font-bold text-muted-foreground">—</span>
                          )}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link to={`/product/${product.id}`} className="block truncate text-xs font-bold text-foreground hover:text-primary">
                            {product.name}
                          </Link>
                          <span className="text-[11px] text-muted-foreground">₹{fmtINR(product.sale_price)} each</span>
                        </div>
                        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-0.5">
                          <button type="button" onClick={() => decCart(product.id)} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-border hover:text-foreground" aria-label="Decrease quantity">
                            <Minus className="size-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold tabular-nums text-foreground">{qty}</span>
                          <button type="button" onClick={() => addToCart(product.id)} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-border hover:text-foreground" aria-label="Increase quantity">
                            <Plus className="size-3" />
                          </button>
                        </div>
                        <span className="w-16 text-right text-xs font-extrabold tabular-nums text-foreground">₹{fmtINR(product.sale_price * qty)}</span>
                        <button type="button" onClick={() => removeFromCart(product.id)} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Remove item">
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Order fulfilling from:{' '}
                    <strong className="text-foreground">{selectedStore?.store_name || 'Selected Retailer'}</strong>
                  </p>
                </div>

                {/* Summary */}
                <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="font-semibold tabular-nums text-foreground">₹{fmtINR(cartTotal)}</span>
                    </div>
                    {appliedCoupon && (
                      <div className="flex items-center justify-between text-emerald-700">
                        <span className="flex items-center gap-1">
                          <Tag className="size-3" />
                          Coupon {appliedCoupon.code}
                        </span>
                        <span className="font-semibold tabular-nums">−₹{fmtINR(appliedCoupon.discount)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                      <span className="font-bold text-foreground">Total</span>
                      <span className="text-lg font-extrabold tabular-nums tracking-tight text-foreground">₹{fmtINR(cartFinalTotal)}</span>
                    </div>
                  </div>

                  {/* Coupon */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Input
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder="Coupon code (e.g. SAVE10)"
                        disabled={!!appliedCoupon}
                        className="h-8 font-mono text-[11px] uppercase tracking-wider rounded-lg"
                      />
                      {appliedCoupon ? (
                        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[11px] font-bold text-destructive" onClick={() => setAppliedCoupon(null)}>
                          Remove
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-[11px] font-bold" onClick={applyCoupon}>
                          Apply
                        </Button>
                      )}
                    </div>
                    {couponErr && <p className="text-[11px] font-medium text-destructive">{couponErr}</p>}
                  </div>

                  <Button
                    type="button"
                    onClick={placeOrder}
                    disabled={placing}
                    className="mt-auto w-full gap-2 rounded-xl text-xs font-extrabold tracking-wide"
                  >
                    {placing ? (
                      <span>Placing Order…</span>
                    ) : (
                      <>
                        <span>Place Order Now</span>
                        <ArrowRight className="size-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════ TAB 2: ORDERS ════════════ */}
      {activeTab === 'orders' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground sm:text-lg">Order History &amp; Status</h2>
            <span className="text-xs text-muted-foreground">{orders.length} order{orders.length === 1 ? '' : 's'} placed</span>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-36 rounded-2xl shimmer bg-muted/60" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              icon="📦"
              title="No orders yet"
              message="You haven't placed any orders yet. Head over to the Shop tab to place your first order!"
              action={
                <Button type="button" className="rounded-xl text-xs font-bold" onClick={() => setActiveTab('shop')}>
                  Start Shopping
                </Button>
              }
            />
          ) : (
            <Stagger className="space-y-5">
              {orders.map((o) => (
                <StaggerItem key={o.id}>
                  <Card className="gap-0 space-y-4 p-5 ring-border/70 sm:p-6">
                    <div className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="mono-num text-sm font-bold tracking-tight text-foreground sm:text-base">Order #{o.id}</span>
                          <StatusBadge status={o.status} />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Placed on {new Date(o.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · Fulfilling store: <strong className="text-foreground">{o.retailer}</strong>
                        </p>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs text-muted-foreground">Total:</span>
                        <span className="text-lg font-extrabold text-foreground">₹{o.total_amount}</span>
                      </div>
                    </div>

                    <OrderTimeline status={o.status} />

                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Items ordered ({o.items?.length || 0})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {o.items?.map((it) => (
                          <Link
                            key={it.product_id}
                            to={`/product/${it.product_id}`}
                            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted px-3 py-1.5 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
                          >
                            <span className="font-bold text-foreground">{it.name}</span>
                            <span className="font-semibold text-muted-foreground">× {it.quantity}</span>
                            <span className="font-mono text-[11px] text-primary">@ ₹{it.unit_price}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </Card>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
      )}

      {/* ════════════ TAB 3: WISHLIST ════════════ */}
      {activeTab === 'wishlist' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground sm:text-lg">Saved Wishlist</h2>
            <span className="text-xs text-muted-foreground">{wishlist.length} item{wishlist.length === 1 ? '' : 's'} saved</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : wishlist.length === 0 ? (
            <EmptyState
              icon="♥"
              title="Your wishlist is empty"
              message="Tap the heart icon on any product in the catalog to save it for later."
              action={
                <Button type="button" className="rounded-xl text-xs font-bold" onClick={() => setActiveTab('shop')}>
                  Browse Products
                </Button>
              }
            />
          ) : (
            <Stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {wishlist.map((w) => (
                <StaggerItem key={w.wishlist_id || w.id}>
                  <ProductCard
                    product={w}
                    onQuickView={addQuickView}
                    footer={
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={() => addToCart(w.product_id)}
                          className="flex-1 gap-1.5 rounded-xl text-xs font-bold"
                        >
                          <ShoppingCart className="size-3.5" />
                          Add {cart[w.product_id] ? `(${cart[w.product_id]})` : ''}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => toggleWishlist(w.product_id)}
                          className="h-9 w-9 rounded-xl border-destructive/30 bg-destructive/10 p-0 text-destructive hover:bg-destructive/15"
                          title="Remove from wishlist"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    }
                  />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
      )}

      {/* Quick view dialog */}
      {quickView && (
        <ProductQuickView
          product={quickView}
          open={!!quickView}
          onOpenChange={(o) => { if (!o) setQuickView(null); }}
          onAddToCart={(p) => { addToCart(p.id); setQuickView(null); }}
        />
      )}
    </div>
  );
}
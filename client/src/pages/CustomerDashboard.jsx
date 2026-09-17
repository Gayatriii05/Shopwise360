import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import ProductCard from '../components/ProductCard';
import OrderTimeline, { StatusBadge } from '../components/OrderTimeline';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import { Stagger, StaggerItem, FadeIn } from '../components/Reveal';
import { useRealtime } from '../context/RealtimeContext';
import { ShoppingBagIcon, PackageIcon, HeartIcon, SparklesIcon, StoreIcon, ShoppingCartIcon, TagIcon, CheckCircleIcon, AlertCircleIcon, XIcon, ArrowRightIcon } from '../components/Icons';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { on, connected } = useRealtime();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [retailerId, setRetailerId] = useState('');
  const [cart, setCart] = useState({}); // { product_id: qty }
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponErr, setCouponErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [activeTab, setActiveTab] = useState('shop');
  const [orderMsg, setOrderMsg] = useState('');

  const loadOrders = () => api.get(`/orders/customer/${user.id}`).then(({ data }) => setOrders(data));

  const loadAll = async () => {
    setLoading(true);
    try {
      const [p, o, w, r] = await Promise.all([
        api.get('/products', { params: { limit: 12 } }),
        loadOrders(),
        api.get('/wishlist/mine'),
        api.get('/retailers')
      ]);
      setProducts(p.data.products);
      setOrders(o.data);
      setWishlist(w.data);
      setRetailers(r.data);
      if (!retailerId && r.data.length) setRetailerId(r.data[0].id);
      try {
        const rec = await api.get(`/ml/recommend/${user.id}`);
        setRecommendations(rec.data);
      } catch {
        setRecommendations([]);
      }
    } catch (err) {
      setOrderMsg(err.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
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

  const addToCart = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const removeFromCart = (id) => setCart((c) => {
    const next = { ...c };
    delete next[id];
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
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find((x) => x.id === Number(id));
    return sum + (p ? p.sale_price * qty : 0);
  }, 0);

  const selectedStore = retailers.find((r) => r.id === retailerId);

  return (
    <div className="space-y-8 pb-16">
      {/* Header Bar */}
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card rounded-2xl border border-cream-300/70 shadow-elevated p-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center font-extrabold text-lg text-white shadow-glow-brand">
              {user?.name?.charAt(0).toUpperCase() || 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-cream-900 tracking-tight">
                  Hello, {user?.name || 'Customer'}
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Customer
                </span>
              </div>
              <p className="text-xs text-cream-500 mt-0.5">
                Browse products, track active orders, and enjoy tailored ML recommendations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full font-medium border ${
              connected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-cream-100 text-cream-500 border-cream-300/70'
            }`}>
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-cream-400'}`} />
              <span>{connected ? 'Live Sync Active' : 'Connecting…'}</span>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Order Alert Banner */}
      {orderMsg && (
        <div className={`p-4 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-between gap-3 animate-fadeIn border ${
          orderMsg.includes('successfully') || orderMsg.includes('updated')
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-coral-50 text-coral-700 border-coral-200'
        }`}>
          <div className="flex items-center gap-2">
            {orderMsg.includes('successfully') || orderMsg.includes('updated') ? (
              <CheckCircleIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircleIcon className="w-4 h-4 text-coral-600 flex-shrink-0" />
            )}
            <span>{orderMsg}</span>
          </div>
          <button
            onClick={() => setOrderMsg('')}
            className="text-cream-400 hover:text-cream-700 p-1"
            aria-label="Dismiss notification"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <FadeIn>
        <div className="flex gap-2 p-1.5 bg-cream-100 border border-cream-300/70 rounded-2xl max-w-md">
          {[
            { key: 'shop', label: 'Shop Catalog', icon: ShoppingBagIcon, count: null },
            { key: 'orders', label: 'My Orders', icon: PackageIcon, count: orders.length },
            { key: 'wishlist', label: 'Wishlist', icon: HeartIcon, count: wishlist.length },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-glow-brand'
                    : 'text-cream-600 hover:text-cream-900 hover:bg-cream-50'
                }`}
              >
                <TabIcon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-cream-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-cream-50 text-violet-700' : 'bg-cream-200 text-cream-700'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </FadeIn>

      {/* TAB 1: SHOP */}
      {activeTab === 'shop' && (
        <div className="space-y-8 animate-fadeIn">
          {/* ML Recommendations */}
          {recommendations.length > 0 && (
            <FadeIn>
              <section className="relative overflow-hidden glass-card rounded-2xl p-5 sm:p-6 border border-cream-300/70">
                <div className="absolute inset-0 bg-aurora-violet bg-aurora-emerald bg-aurora-coral opacity-40" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center shadow-glow-brand">
                      <SparklesIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-cream-900">Personalized for You (ML)</h2>
                      <p className="text-xs text-cream-500">Collaborative filtering based on customer purchasing affinities</p>
                    </div>
                  </div>

                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                    {recommendations.map((r) => (
                      <div
                        key={r.product_id}
                        className="min-w-[200px] sm:min-w-[220px] bg-cream-50/70  rounded-2xl p-4 border border-violet-200 shadow-subtle flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                              {Math.round(Number(r.score) * 100)}% match
                            </span>
                            <Link to={`/product/${r.product_id}`} className="text-xs font-semibold text-cream-400 hover:text-violet-700">
                              View →
                            </Link>
                          </div>
                          <p className="font-bold text-xs sm:text-sm text-cream-900 line-clamp-1">{r.name}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addToCart(r.product_id)}
                          className="mt-3 w-full inline-flex items-center justify-center gap-1 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl shadow-glow-brand transition-all hover:-translate-y-0.5"
                        >
                          <ShoppingCartIcon className="w-3 h-3" />
                          <span>Add to cart {cart[r.product_id] ? `(${cart[r.product_id]})` : ''}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </FadeIn>
          )}

          {/* Catalog Section */}
          <section className="space-y-4">
            <FadeIn>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-card p-4 rounded-2xl border border-cream-300/70">
                <div>
                  <h2 className="font-bold text-cream-900 text-sm sm:text-base">Shop Products</h2>
                  <p className="text-xs text-cream-500">Select items to purchase from your preferred local retailer</p>
                </div>

                {retailers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-cream-500 flex items-center gap-1">
                      <StoreIcon className="w-3.5 h-3.5 text-cream-400" />
                      Store:
                    </span>
                    <select
                      value={retailerId}
                      onChange={(e) => setRetailerId(Number(e.target.value))}
                      className="appearance-none bg-cream-50 hover:bg-cream-50 border border-cream-300 rounded-xl px-3 py-1.5 text-xs font-bold text-cream-800 focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer transition-all"
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

            {/* Products Grid */}
            <Stagger className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
                : products.map((p) => (
                    <StaggerItem key={p.id}>
                      <ProductCard
                        product={p}
                        footer={
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => addToCart(p.id)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold py-2 rounded-xl shadow-glow-brand transition-all hover:-translate-y-0.5"
                            >
                              <ShoppingCartIcon className="w-3.5 h-3.5" />
                              <span>Add {cart[p.id] ? `(${cart[p.id]})` : ''}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleWishlist(p.id)}
                              className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                                wishlist.some((w) => w.product_id === p.id)
                                  ? 'bg-coral-50 text-coral-700 border-coral-200'
                                  : 'bg-cream-50 hover:bg-cream-100 text-cream-400 border-cream-300/70 hover:border-cream-300'
                              }`}
                              title={wishlist.some((w) => w.product_id === p.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                            >
                              <HeartIcon
                                filled={wishlist.some((w) => w.product_id === p.id)}
                                className={`w-4 h-4 ${wishlist.some((w) => w.product_id === p.id) ? 'text-coral-600' : 'text-cream-400'}`}
                              />
                            </button>
                          </div>
                        }
                      />
                    </StaggerItem>
                  ))}
            </Stagger>

            {!loading && products.length === 0 && (
              <EmptyState
                icon="🛒"
                title="No products available"
                message="Check back soon for freshly stocked catalog items."
              />
            )}
          </section>

          {/* Sticky / Docked Cart Summary Bar */}
          {cartCount > 0 && (
            <div className="sticky bottom-4 z-30 glass-strong rounded-2xl p-4 sm:p-5 shadow-elevated border border-cream-300 animate-fadeIn">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Cart Info & Coupon Apply */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 border border-violet-200 flex items-center justify-center font-bold">
                      <ShoppingCartIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold text-cream-900">{cartCount} item{cartCount > 1 ? 's' : ''} in cart</span>
                        {appliedCoupon ? (
                          <span className="text-sm font-bold text-violet-700">
                            ₹{Math.max(0, cartTotal - appliedCoupon.discount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            <span className="text-xs text-cream-400 line-through ml-1.5">₹{cartTotal.toFixed(2)}</span>
                            <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full ml-1 font-bold border border-emerald-200">
                              −₹{appliedCoupon.discount} off
                            </span>
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-cream-900">₹{cartTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-cream-500">
                        Order fulfilling from: <strong className="text-cream-800">{selectedStore?.store_name || 'Selected Retailer'}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Coupon Code Input */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder="Coupon code (e.g. SAVE10)"
                        disabled={!!appliedCoupon}
                        className={`bg-cream-50 border border-cream-300 rounded-xl px-3 py-1.5 text-xs text-cream-900 placeholder-cream-400 w-36 sm:w-44 uppercase font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
                          appliedCoupon ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : ''
                        }`}
                      />
                    </div>
                    {appliedCoupon ? (
                      <button
                        type="button"
                        onClick={() => setAppliedCoupon(null)}
                        className="text-xs text-coral-700 hover:text-coral-600 font-semibold underline"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={applyCoupon}
                        className="px-3 py-1.5 rounded-xl border border-cream-300 bg-cream-50 hover:bg-cream-100 text-xs font-semibold text-cream-700 transition-colors"
                      >
                        Apply
                      </button>
                    )}
                  </div>
                  {couponErr && <span className="text-xs text-coral-700">{couponErr}</span>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2.5 justify-end">
                  <button
                    type="button"
                    onClick={() => { setCart({}); setAppliedCoupon(null); setCouponInput(''); }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-cream-500 hover:text-coral-700 transition-colors"
                  >
                    Clear Cart
                  </button>
                  <button
                    type="button"
                    onClick={placeOrder}
                    disabled={placing}
                    className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-extrabold px-6 py-2.5 rounded-2xl text-xs tracking-wide shadow-glow-brand transition-all hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
                  >
                    {placing ? (
                      <span>Placing Order…</span>
                    ) : (
                      <>
                        <span>Place Order Now</span>
                        <ArrowRightIcon className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ORDERS */}
      {activeTab === 'orders' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-cream-900 text-base sm:text-lg">Order History & Status</h2>
            <span className="text-xs text-cream-400">{orders.length} order{orders.length === 1 ? '' : 's'} placed</span>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-36 rounded-2xl shimmer-wave bg-cream-200" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              icon="📦"
              title="No orders yet"
              message="You haven't placed any orders yet. Head over to the Shop tab to place your first order!"
              action={
                <button
                  onClick={() => setActiveTab('shop')}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-glow-brand transition-all hover:-translate-y-0.5"
                >
                  Start Shopping
                </button>
              }
            />
          ) : (
            <Stagger className="space-y-5">
              {orders.map((o) => (
                <StaggerItem
                  key={o.id}
                  className="glass-card rounded-2xl border border-cream-300/70 shadow-subtle p-5 sm:p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-cream-300/70">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm sm:text-base text-cream-900">Order #{o.id}</span>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="text-xs text-cream-500 mt-0.5">
                        Placed on {new Date(o.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · Fulfilling store: <strong className="text-cream-800">{o.retailer}</strong>
                      </p>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-xs text-cream-500">Total:</span>
                      <span className="text-lg font-extrabold text-cream-900">₹{o.total_amount}</span>
                    </div>
                  </div>

                  {/* Order Progress Stepper */}
                  <OrderTimeline status={o.status} />

                  {/* Purchased Items List */}
                  <div className="pt-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-cream-400 mb-2">
                      Items Ordered ({o.items?.length || 0})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {o.items?.map((it) => (
                        <div
                          key={it.product_id}
                          className="inline-flex items-center gap-2 bg-cream-50 border border-cream-300/70 px-3 py-1.5 rounded-xl text-xs"
                        >
                          <Link
                            to={`/product/${it.product_id}`}
                            className="font-bold text-cream-800 hover:text-violet-700 transition-colors"
                          >
                            {it.name}
                          </Link>
                          <span className="text-cream-400 font-semibold">× {it.quantity}</span>
                          <span className="text-cream-600 font-mono text-[11px]">@ ₹{it.unit_price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
      )}

      {/* TAB 3: WISHLIST */}
      {activeTab === 'wishlist' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-cream-900 text-base sm:text-lg">Saved Wishlist</h2>
            <span className="text-xs text-cream-400">{wishlist.length} item{wishlist.length === 1 ? '' : 's'} saved</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : wishlist.length === 0 ? (
            <EmptyState
              icon="♥"
              title="Your wishlist is empty"
              message="Tap the heart icon on any product in the catalog to save it for later."
              action={
                <button
                  onClick={() => setActiveTab('shop')}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-glow-brand transition-all hover:-translate-y-0.5"
                >
                  Browse Products
                </button>
              }
            />
          ) : (
            <Stagger className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
              {wishlist.map((w) => (
                <StaggerItem key={w.wishlist_id || w.id}>
                  <ProductCard
                    product={w}
                    footer={
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => addToCart(w.product_id)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold py-2 rounded-xl shadow-glow-brand transition-all hover:-translate-y-0.5"
                        >
                          <ShoppingCartIcon className="w-3.5 h-3.5" />
                          <span>Add {cart[w.product_id] ? `(${cart[w.product_id]})` : ''}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleWishlist(w.product_id)}
                          className="p-2 rounded-xl border border-coral-200 bg-coral-50 text-coral-700 hover:bg-coral-100 text-xs font-bold transition-all"
                          title="Remove from wishlist"
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
                      </div>
                    }
                  />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
      )}
    </div>
  );
}
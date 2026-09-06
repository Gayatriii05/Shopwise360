import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import ProductCard from '../components/ProductCard';
import OrderTimeline, { StatusBadge } from '../components/OrderTimeline';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import { useRealtime } from '../context/RealtimeContext';

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
      setOrderMsg(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // Real-time: refresh orders instantly when status changes
  useEffect(() => {
    const unsub = on('order-status-change', (payload) => {
      setOrderMsg(`📦 Order #${payload.orderId} is now ${payload.status}`);
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
    if (!retailerId) { setOrderMsg('Please select a store'); return; }
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
    } catch (err) {
      setOrderMsg(err.response?.data?.error || 'Order failed');
    } finally {
      setPlacing(false);
    }
  };

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find((x) => x.id === Number(id));
    return sum + (p ? p.sale_price * qty : 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Customer Dashboard</h1>
        <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${connected ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          {connected ? 'Live' : 'Offline'}
        </span>
      </div>
      {orderMsg && (
        <div className={`p-3 rounded text-sm ${orderMsg.includes('successfully') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {orderMsg}
        </div>
      )}

      <div className="flex gap-2 border-b">
        {[['shop', '🛍️ Shop'], ['orders', '📦 Orders'], ['wishlist', '♥ Wishlist']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === key ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'shop' && (
        <>
          {recommendations.length > 0 && (
            <section>
              <h2 className="font-semibold text-slate-700 mb-2">✨ Recommended for you</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {recommendations.map((r) => (
                  <div key={r.product_id} className="min-w-[170px] bg-emerald-50 border border-emerald-200 rounded p-3">
                    <p className="font-medium text-sm">{r.name}</p>
                    <p className="text-xs text-slate-500">match score {Number(r.score).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <h2 className="font-semibold text-slate-700">Shop products</h2>
              {retailers.length > 0 && (
                <label className="text-xs text-slate-500 flex items-center gap-2">
                  Order from:
                  <select
                    value={retailerId}
                    onChange={(e) => setRetailerId(Number(e.target.value))}
                    className="border rounded px-2 py-1 text-sm bg-white"
                  >
                    {retailers.map((r) => <option key={r.id} value={r.id}>{r.store_name}</option>)}
                  </select>
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
                : products.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      footer={
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => addToCart(p.id)}
                            className="flex-1 bg-slate-900 text-white text-xs py-1.5 rounded hover:bg-slate-800"
                          >
                            Add to cart {cart[p.id] ? `(${cart[p.id]})` : ''}
                          </button>
                          <button
                            onClick={() => toggleWishlist(p.id)}
                            className={`px-2 py-1.5 rounded border text-xs ${wishlist.some((w) => w.product_id === p.id) ? 'bg-rose-50 text-rose-600 border-rose-200' : 'hover:bg-slate-100 border-slate-300'}`}
                            title={wishlist.some((w) => w.product_id === p.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                          >
                            {wishlist.some((w) => w.product_id === p.id) ? '♥' : '♡'}
                          </button>
                        </div>
                      }
                    />
                  ))}
            </div>

            {!loading && products.length === 0 && (
              <EmptyState icon="🛒" title="No products available" message="Check back soon for new products." />
            )}

            {cartCount > 0 && (
              <div className="mt-6 bg-white border rounded-lg p-4 sticky bottom-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder="Coupon code"
                        disabled={!!appliedCoupon}
                        className={`border rounded px-2 py-1.5 text-sm w-36 uppercase ${appliedCoupon ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : ''}`}
                      />
                      {appliedCoupon ? (
                        <button onClick={() => setAppliedCoupon(null)} className="text-xs text-rose-600 hover:underline">remove</button>
                      ) : (
                        <button onClick={applyCoupon} className="px-2 py-1.5 rounded border text-xs text-slate-700 hover:bg-slate-50">Apply</button>
                      )}
                    </div>
                    {couponErr && <p className="text-xs text-rose-600">{couponErr}</p>}
                    <p className="text-sm font-medium text-slate-700">
                      Cart: {cartCount} item{cartCount > 1 ? 's' : ''}
                      {appliedCoupon
                        ? <> <span className="text-slate-400 line-through">₹{cartTotal.toFixed(2)}</span> → <span className="text-emerald-600 font-bold">₹{Math.max(0, cartTotal - appliedCoupon.discount).toFixed(2)}</span> <span className="text-emerald-600 text-xs">(−₹{appliedCoupon.discount})</span></>
                        : <> · ₹{cartTotal.toFixed(2)}</>}
                    </p>
                    <p className="text-xs text-slate-400">from {retailers.find((r) => r.id === retailerId)?.store_name || 'selected store'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setCart({}); setAppliedCoupon(null); setCouponInput(''); }} className="px-3 py-2 rounded border text-sm text-slate-600 hover:bg-slate-100">Clear</button>
                    <button
                      onClick={placeOrder}
                      disabled={placing}
                      className="bg-emerald-600 text-white px-4 py-2 rounded text-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {placing ? 'Placing...' : 'Place order'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === 'orders' && (
        <section>
          <h2 className="font-semibold text-slate-700 mb-3">Your orders</h2>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 bg-slate-100 animate-pulse rounded" />)}</div>
          ) : orders.length === 0 ? (
            <EmptyState icon="📦" title="No orders yet" message="Head to the shop tab and place your first order!" />
          ) : (
            <div className="space-y-4">
              {orders.map((o) => (
                <div key={o.id} className="bg-white border rounded-lg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="text-sm">
                      <span className="font-medium text-slate-800">Order #{o.id}</span>
                      <span className="text-slate-400 text-xs ml-2">{new Date(o.created_at).toLocaleDateString()}</span>
                      <span className="text-slate-400 text-xs ml-2">· {o.retailer}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-600">₹{o.total_amount}</span>
                      <StatusBadge status={o.status} />
                    </div>
                  </div>
                  <OrderTimeline status={o.status} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {o.items?.map((it) => (
                      <span key={it.product_id} className="text-xs bg-slate-100 px-2 py-1 rounded flex items-center gap-2">
                        <Link to={`/product/${it.product_id}`} className="hover:text-emerald-600">{it.name}</Link>
                        × {it.quantity}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'wishlist' && (
        <section>
          <h2 className="font-semibold text-slate-700 mb-3">Your wishlist</h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : wishlist.length === 0 ? (
            <EmptyState icon="♥" title="Wishlist is empty" message="Tap the ♡ on any product to save it for later." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {wishlist.map((w) => (
                <ProductCard
                  key={w.wishlist_id}
                  product={w}
                  footer={
                    <button
                      onClick={() => toggleWishlist(w.product_id)}
                      className="mt-3 w-full text-xs py-1.5 rounded border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100"
                    >
                      Remove
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
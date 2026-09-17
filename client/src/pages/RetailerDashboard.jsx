import { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import api, { downloadFile } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import OrderTimeline, { StatusBadge } from '../components/OrderTimeline';
import EmptyState from '../components/EmptyState';
import { Skeleton, SkeletonTable } from '../components/Skeleton';
import CountUp from '../components/CountUp';
import ChartTooltip from '../components/ChartTooltip';
import { FadeIn, Stagger, StaggerItem } from '../components/Reveal';
import { StoreIcon, TrendingUpIcon, PackageIcon, AlertCircleIcon, DownloadIcon, SparklesIcon, ArrowRightIcon, BarChartIcon } from '../components/Icons';

const CHART_COLORS = ['#7A5CC4', '#4E9C7C', '#C97354', '#5592B8', '#A184E6'];
const NEXT_STATUS = { pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' };

const AXIS = { stroke: 'none', tick: { fontSize: 10, fill: '#786F97' }, axisLine: false, tickLine: false };
const GRID = '#7A5CC414';

const inr = (v) => `₹${Number(v).toLocaleString('en-IN')}`;
const count = (v) => Number(v).toLocaleString('en-IN');

export default function RetailerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { on, connected } = useRealtime();
  const retailerId = user?.retailer?.id;

  const [summary, setSummary] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderMsg, setOrderMsg] = useState('');
  const [liveToast, setLiveToast] = useState('');

  const toast = (msg) => {
    setLiveToast(msg);
    setTimeout(() => setLiveToast(''), 5000);
  };

  const loadAll = useCallback(async (rid) => {
    if (!rid) return;
    setLoading(true);
    try {
      const [s, i, o] = await Promise.all([
        api.get(`/dashboard/retailer/${rid}/summary`),
        api.get(`/inventory/retailer/${rid}`),
        api.get(`/orders/retailer/${rid}`)
      ]);
      setSummary(s.data);
      setInventory(i.data);
      setOrders(o.data);
      api.get(`/ml/predict-demand/${rid}`).then(({ data }) => setPredictions(data)).catch(() => setPredictions([]));
    } catch (err) {
      setOrderMsg(err.response?.data?.error || 'Failed to load retailer dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && retailerId) loadAll(retailerId);
  }, [authLoading, retailerId, loadAll]);

  // Real-time subscriptions
  useEffect(() => {
    if (!retailerId) return;
    const unsubs = [
      on('new-order', (order) => {
        const name = order?.customer_name || `Order #${order?.id}`;
        toast(`🛎️ New order received${name ? ' — ' + name : ''}`);
        loadAll(retailerId);
      }),
      on('low-stock-alert', (alert) => {
        toast(`⚠️ Low stock: ${alert?.quantity} units left at threshold ${alert?.threshold}`);
        loadAll(retailerId);
      }),
      on('dashboard-update', () => loadAll(retailerId)),
      on('order-status-change', () => loadAll(retailerId))
    ];
    return () => unsubs.forEach((u) => u());
  }, [retailerId, on, loadAll]);

  const updateStock = async (id, quantity, threshold) => {
    await api.put(`/inventory/${id}`, { quantity, low_stock_threshold: threshold });
    loadAll(retailerId);
  };

  const advanceStatus = async (orderId, status) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status });
      loadAll(retailerId);
    } catch (err) {
      setOrderMsg(err.response?.data?.error || 'Failed to update order status');
    }
  };

  if (authLoading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-28 w-full" /></div>;
  if (!retailerId) {
    return (
      <EmptyState
        icon="🏬"
        title="No Retailer Store Linked"
        message="Your account currently doesn't have an associated retailer profile. Please contact an administrator."
      />
    );
  }
  if (loading && !summary) return <DashboardLoading />;

  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div className="space-y-8 pb-12">
      {/* Toast Notification */}
      {liveToast && (
        <div className="fixed top-20 right-6 z-50 glass-strong text-cream-900 text-xs font-semibold px-4 py-3 rounded-2xl shadow-elevated border border-cream-300 flex items-center gap-2.5 animate-fadeIn max-w-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>{liveToast}</span>
        </div>
      )}

      {/* Header Bar */}
      <FadeIn>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 glass-card rounded-2xl border border-cream-300/70 shadow-elevated p-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-500 flex items-center justify-center shadow-glow-brand">
              <StoreIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-cream-900 tracking-tight">
                  {user?.retailer?.store_name || 'Retailer Dashboard'}
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                  Retailer
                </span>
              </div>
              <p className="text-xs text-cream-500 mt-0.5">
                {user?.retailer?.location || 'Storefront'} · Real-time order fulfillment & stock intelligence
              </p>
            </div>
          </div>

          {/* Report Export Buttons & Live Sync */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-cream-100 p-1.5 rounded-2xl border border-cream-300/70">
              {[
                ['sales/csv', 'Sales CSV'],
                ['sales/pdf', 'Sales PDF'],
                ['inventory/csv', 'Inv CSV'],
                ['inventory/pdf', 'Inv PDF']
              ].map(([path, label]) => (
                <button
                  key={path}
                  onClick={() => downloadFile(`/reports/${path}`, label.replace(/\s/g, '-').toLowerCase())}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cream-50 hover:bg-cream-100 text-cream-700 border border-cream-300/70 text-[11px] font-bold transition-all hover:-translate-y-0.5 hover:shadow-subtle"
                  title={`Download ${label}`}
                >
                  <DownloadIcon className="w-3 h-3 text-cream-400" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border ${
              connected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-cream-100 text-cream-500 border-cream-300/70'
            }`}>
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-cream-400'}`} />
              <span>{connected ? 'Live Sync' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </FadeIn>

      {orderMsg && (
        <div className="p-4 rounded-2xl text-xs sm:text-sm font-medium bg-coral-50 text-coral-700 border border-coral-200 flex items-center gap-2">
          <AlertCircleIcon className="w-4 h-4 text-coral-600 flex-shrink-0" />
          <span>{orderMsg}</span>
        </div>
      )}

      {/* KPI Metric Cards */}
      <StaggerCard>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <StatCard
            label="Total Revenue"
            value={<CountUp value={Number(summary?.totals?.total_revenue || 0)} prefix="₹" />}
            icon={TrendingUpIcon}
            tint="text-violet-600 bg-violet-50 border-violet-200"
          />
          <StatCard
            label="Total Profit"
            value={<CountUp value={Number(summary?.totals?.total_profit || 0)} prefix="₹" />}
            icon={BarChartIcon}
            tint="text-emerald-600 bg-emerald-50 border-emerald-200"
          />
          <StatCard
            label="Total Orders"
            value={<CountUp value={summary?.totals?.total_orders || 0} />}
            icon={PackageIcon}
            tint="text-sky-600 bg-sky-50 border-sky-200"
          />
        </div>
      </StaggerCard>

      {/* Low Stock Warning Banner */}
      {summary?.lowStock?.length > 0 && (
        <FadeIn>
          <div className="glass-card rounded-2xl p-5 sm:p-6 border border-coral-200 bg-coral-50/40">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl bg-coral-500 text-white flex items-center justify-center font-bold shadow-glow-coral">
                <AlertCircleIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-coral-800">
                  Low Stock Threshold Alerts ({summary.lowStock.length})
                </h3>
                <p className="text-xs text-cream-500 mt-0.5">
                  These catalog items have fallen below your re-stock thresholds. Update quantities below to avoid stockouts.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {summary.lowStock.map((i, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cream-50 border border-coral-200 text-xs font-bold text-cream-800"
                >
                  <span>{i.name}:</span>
                  <span className="text-coral-700">{i.quantity} left</span>
                  <span className="text-cream-400 font-normal text-[11px]">(threshold {i.low_stock_threshold})</span>
                </span>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Sales Chart */}
        <FadeIn>
          <div className="glass-card rounded-2xl border border-cream-300/70 shadow-subtle p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-cream-900">Daily Sales Performance (30 Days)</h3>
              <span className="text-[11px] text-cream-400 font-semibold uppercase">Revenue & Profit</span>
            </div>
            {summary?.dailySales?.length === 0 ? (
              <EmptyState icon="📉" title="No sales data" message="Daily revenue records will appear once customer orders start coming in." />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary?.dailySales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                    <XAxis dataKey="date" {...AXIS} />
                    <YAxis {...AXIS} />
                    <Tooltip content={<ChartTooltip format={inr} />} cursor={{ stroke: '#7A5CC426' }} />
                    <Line type="monotone" dataKey="revenue" stroke="#4E9C7C" strokeWidth={2} dot={{ r: 2.5, fill: '#4E9C7C' }} activeDot={{ r: 4 }} name="Revenue" />
                    <Line type="monotone" dataKey="profit" stroke="#7A5CC4" strokeWidth={2} dot={{ r: 2, fill: '#7A5CC4' }} name="Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </FadeIn>

        {/* Top Products Bar Chart */}
        <FadeIn>
          <div className="glass-card rounded-2xl border border-cream-300/70 shadow-subtle p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-cream-900">Top Selling Products</h3>
              <span className="text-[11px] text-cream-400 font-semibold uppercase">Units Sold</span>
            </div>
            {summary?.topProducts?.length === 0 ? (
              <EmptyState icon="🏆" title="No products sold yet" message="Units sold metrics will populate after completed checkouts." />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary?.topProducts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                    <XAxis dataKey="name" {...AXIS} tick={{ fontSize: 9, fill: '#786F97' }} />
                    <YAxis {...AXIS} />
                    <Tooltip content={<ChartTooltip format={count} />} cursor={{ fill: '#7A5CC410' }} />
                    <Bar dataKey="units_sold" fill="#4E9C7C" radius={[3, 3, 0, 0]} name="Units Sold" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </FadeIn>

        {/* Revenue by Category Pie Chart */}
        <FadeIn>
          <div className="glass-card rounded-2xl border border-cream-300/70 shadow-subtle p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-cream-900">Revenue by Category</h3>
              <span className="text-[11px] text-cream-400 font-semibold uppercase">Category Mix</span>
            </div>
            {summary?.categoryBreakdown?.length === 0 ? (
              <EmptyState icon="📊" title="No category data" message="Category proportions will render here." />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary?.categoryBreakdown}
                      dataKey="revenue"
                      nameKey="category"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      stroke="#F0EDFA"
                    >
                      {summary?.categoryBreakdown.map((entry, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip format={inr} />} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px', color: '#786F97' }} formatter={(v) => <span style={{ color: '#786F97' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </FadeIn>

        {/* 7-Day Demand Forecast (ML) */}
        <FadeIn>
          <div className="glass-card rounded-2xl border border-cream-300/70 shadow-subtle p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-cream-900">7-Day Demand Forecast (ML)</h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                  <SparklesIcon className="w-3 h-3 text-violet-600" />
                  AI Linear Model
                </span>
              </div>
            </div>
            {predictions?.length === 0 ? (
              <EmptyState icon="🔮" title="No forecast available" message="Forecasts compute automatically once sales history is established." />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={predictions} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                    <XAxis dataKey="name" {...AXIS} tick={{ fontSize: 9, fill: '#786F97' }} />
                    <YAxis {...AXIS} />
                    <Tooltip content={<ChartTooltip format={count} />} cursor={{ fill: '#7A5CC410' }} />
                    <Bar dataKey="predicted_demand" fill="#8B6FD6" radius={[3, 3, 0, 0]} name="Predicted Units" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </FadeIn>
      </div>

      {/* Orders Management Section */}
      <section className="space-y-4">
        <FadeIn>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <h2 className="font-extrabold text-cream-900 text-base sm:text-lg">Customer Orders</h2>
              {pendingCount > 0 && (
                <span className="text-xs font-bold bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200">
                  {pendingCount} Pending Action
                </span>
              )}
            </div>
            <span className="text-xs text-cream-400">{orders.length} total</span>
          </div>
        </FadeIn>

        {loading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : orders.length === 0 ? (
          <EmptyState icon="📦" title="No orders received yet" message="Incoming orders will show up here in real time without refreshing." />
        ) : (
          <Stagger className="space-y-4">
            {orders.map((o) => (
              <StaggerItem key={o.id} className="glass-card rounded-2xl border border-cream-300/70 shadow-subtle p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-cream-300/70">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-cream-900">Order #{o.id}</span>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="text-xs text-cream-500 mt-0.5">
                      Customer: <strong className="text-cream-800">{o.customer_name}</strong> ({o.customer_email}) · {new Date(o.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-cream-500">Total:</span>
                    <span className="text-lg font-extrabold text-cream-900">₹{o.total_amount}</span>
                  </div>
                </div>

                <OrderTimeline status={o.status} />

                {/* Items */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {o.items?.map((it) => (
                    <span key={it.product_id} className="text-xs bg-cream-50 border border-cream-300/70 px-2.5 py-1 rounded-xl text-cream-700 font-medium">
                      {it.name} <strong className="text-cream-900">× {it.quantity}</strong> @ ₹{it.unit_price}
                    </span>
                  ))}
                </div>

                {NEXT_STATUS[o.status] && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => advanceStatus(o.id, NEXT_STATUS[o.status])}
                      className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-glow-brand transition-all hover:-translate-y-0.5"
                    >
                      <span>Mark as {NEXT_STATUS[o.status]}</span>
                      <ArrowRightIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      {/* Inventory Management Section */}
      <section className="space-y-4">
        <FadeIn>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-cream-900 text-base sm:text-lg">Store Inventory</h2>
              <p className="text-xs text-cream-500">Adjust stock counts and set low-stock alert thresholds</p>
            </div>
            <span className="text-xs text-cream-400">{inventory.length} items</span>
          </div>
        </FadeIn>

        {loading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : inventory.length === 0 ? (
          <EmptyState icon="📦" title="No inventory assigned" message="Products added to your store will appear here." />
        ) : (
          <div className="glass-card rounded-2xl border border-cream-300/70 shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left">
                <thead className="bg-cream-100 border-b border-cream-300/70 text-cream-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5 sm:p-4">Product</th>
                    <th className="p-3.5 sm:p-4">Category</th>
                    <th className="p-3.5 sm:p-4">In Stock</th>
                    <th className="p-3.5 sm:p-4">Low Alert Threshold</th>
                    <th className="p-3.5 sm:p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-300/60 font-medium">
                  {inventory.map((i) => (
                    <InventoryRow key={i.id} item={i} onUpdate={updateStock} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function StaggerCard({ children }) {
  return <FadeIn>{children}</FadeIn>;
}

function StatCard({ label, value, icon: Icon, tint }) {
  return (
    <div className="glass-card rounded-2xl border border-cream-300/70 shadow-subtle p-5 sm:p-6 flex items-center justify-between hover:border-cream-300 hover:-translate-y-0.5 transition-all duration-300">
      <div>
        <p className="label-micro">{label}</p>
        <p className="font-serif font-bold text-2xl sm:text-3xl text-cream-900 mt-1 tabular-nums leading-none">{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-2xl ${tint} border flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
}

function InventoryRow({ item, onUpdate }) {
  const [qty, setQty] = useState(item.quantity);
  const [threshold, setThreshold] = useState(item.low_stock_threshold);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await onUpdate(item.id, qty, threshold);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isLow = qty <= threshold;
  const inputClass = 'border rounded-xl px-2.5 py-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/30 bg-cream-50 text-cream-800';

  return (
    <tr className="hover:bg-cream-50 transition-colors">
      <td className="p-3.5 sm:p-4">
        <span className="font-bold text-cream-900 block">{item.name}</span>
        {isLow && (
          <span className="inline-flex items-center gap-1 text-[10px] text-coral-700 font-bold mt-0.5">
            ● Low stock warning
          </span>
        )}
      </td>
      <td className="p-3.5 sm:p-4">
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cream-100 text-cream-700 border border-cream-300/70">
          {item.category || 'General'}
        </span>
      </td>
      <td className="p-3.5 sm:p-4">
        <input
          type="number"
          min="0"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          className={`w-20 ${inputClass} ${isLow ? 'text-coral-700 border-coral-200' : 'border-cream-300'}`}
        />
      </td>
      <td className="p-3.5 sm:p-4">
        <input
          type="number"
          min="0"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className={`w-20 ${inputClass} border-cream-300`}
        />
      </td>
      <td className="p-3.5 sm:p-4 text-right">
        <button
          type="button"
          onClick={handleSave}
          className={`text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all hover:-translate-y-0.5 ${
            saved
              ? 'bg-emerald-600 text-white shadow-subtle'
              : 'bg-violet-600 hover:bg-violet-500 text-white shadow-glow-brand'
          }`}
        >
          {saved ? 'Saved!' : 'Save'}
        </button>
      </td>
    </tr>
  );
}

function DashboardLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-12 w-72 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
      </div>
    </div>
  );
}
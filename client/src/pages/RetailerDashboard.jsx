import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, Wallet, Package, AlertCircle, Sparkles, Download, Store, ArrowRight, Trophy, Boxes, PieChart as PieChartIcon } from 'lucide-react';
import api, { downloadFile } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import OrderTimeline, { StatusBadge } from '../components/OrderTimeline';
import EmptyState from '../components/EmptyState';
import { Skeleton, SkeletonStats, SkeletonTable } from '../components/Skeleton';
import CountUp from '../components/CountUp';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import RadialGauge from '../components/RadialGauge';
import { TrendAreaChart, RankBars, DonutBreakdown, SERIES_COLORS } from '../components/charts';
import { FadeIn, Stagger, StaggerItem } from '../components/Reveal';
import { TextGenerateEffect } from '../components/ui/text-generate-effect';
import { GlowingStarsBackgroundCard } from '../components/ui/glowing-stars';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

const NEXT_STATUS = { pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' };

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

  if (authLoading) return <div className="space-y-4 p-6"><Skeleton className="h-8 w-64 rounded-lg" /><Skeleton className="h-28 w-full rounded-2xl" /></div>;
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

  const revenue = Number(summary?.totals?.total_revenue || 0);
  const profit = Number(summary?.totals?.total_profit || 0);
  const ordersTotal = Number(summary?.totals?.total_orders || 0);
  const lowStock = summary?.lowStock || [];
  const dailySales = summary?.dailySales || [];
  const topProducts = summary?.topProducts || [];
  const categories = summary?.categoryBreakdown || [];
  const totalCat = categories.reduce((a, b) => a + Number(b.revenue || 0), 0);
  const stockLines = inventory || [];
  const stockHealthy = stockLines.filter((i) => Number(i.quantity) > Number(i.low_stock_threshold)).length;
  const stockPct = stockLines.length ? Math.round((stockHealthy / stockLines.length) * 100) : 0;

  return (
    <div className="space-y-8 pb-14">
      {liveToast && (
        <div className="fixed right-6 top-20 z-50 flex max-w-sm animate-fadeIn items-center gap-2.5 rounded-2xl border border-border bg-card/95 px-4 py-3 text-xs font-semibold text-foreground shadow-elevated backdrop-blur-xl">
          <span className="status-dot size-2 bg-emerald-500 text-emerald-500" />
          <span>{liveToast}</span>
        </div>
      )}

      {/* Header Bar */}
      <FadeIn y={12}>
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-[radial-gradient(circle,rgba(255,61,119,0.16),transparent_65%)]" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/4 size-64 rounded-full bg-[radial-gradient(circle,rgba(255,122,69,0.18),transparent_65%)]" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#ff3d77] via-[#ff7a45] to-[#ffc145] font-extrabold text-white shadow-glow-brand">
                <Store className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                    <TextGenerateEffect words={user?.retailer?.store_name || 'Retailer Dashboard'} className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl" />
                  </h1>
                  <Badge variant="secondary" className="rounded-full border border-pink-400/40 bg-pink-500/12 px-2.5 py-0.5 text-[10px] font-bold text-pink-700">
                    Retailer
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {user?.retailer?.location || 'Storefront'} · Real-time order fulfillment &amp; stock intelligence
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-muted/40 p-1.5">
                {[
                  ['sales/csv', 'Sales CSV'],
                  ['sales/pdf', 'Sales PDF'],
                  ['inventory/csv', 'Inv CSV'],
                  ['inventory/pdf', 'Inv PDF']
                ].map(([path, label]) => (
                  <button
                    key={path}
                    onClick={() => downloadFile(`/reports/${path}`, label.replace(/\s/g, '-').toLowerCase())}
                    className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    title={`Download ${label}`}
                  >
                    <Download className="size-3" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                connected
                  ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-700'
                  : 'border-border bg-muted text-muted-foreground'
              }`}>
                <span className={`status-dot size-2 text-current ${connected ? 'bg-emerald-500' : 'bg-muted-foreground/60'}`} />
                {connected ? 'Live Sync' : 'Offline'}
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      {orderMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 p-4 text-xs font-medium text-destructive sm:text-sm">
          <AlertCircle className="size-4 flex-shrink-0 text-destructive" />
          <span>{orderMsg}</span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={revenue}
          prefix="₹"
          icon={TrendingUp}
          accent="primary"
          hint="30-day net · all channels"
          spark={dailySales.map((d) => d.revenue)}
          delay={0}
        />
        <StatCard
          label="Net Profit"
          value={profit}
          prefix="₹"
          icon={Wallet}
          accent="emerald"
          hint="Margin after cost of goods"
          spark={dailySales.map((d) => d.profit)}
          delay={0.05}
        />
        <StatCard
          label="Total Orders"
          value={ordersTotal}
          icon={Package}
          accent="cyan"
          delta={pendingCount ? -pendingCount : undefined}
          deltaSuffix=" pending"
          hint={pendingCount ? `${pendingCount} awaiting fulfillment` : 'All orders fulfilled'}
          delay={0.1}
        />
        <StatCard
          label="Low Stock Alerts"
          value={lowStock.length}
          icon={AlertCircle}
          accent="coral"
          hint={lowStock.length ? 'Items below restock threshold' : 'All catalog items healthy'}
          delay={0.15}
        />
      </div>

      {/* Primary charts row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <FadeIn className="lg:col-span-2" delay={0.05}>
          <ChartCard
            title="Daily Sales Performance"
            subtitle="30-day revenue & profit trend"
            icon={TrendingUp}
            accent="emerald"
            right={
              <Badge variant="outline" className="rounded-full border-border bg-muted/40 text-[10px] font-semibold text-muted-foreground">
                Revenue &amp; Profit
              </Badge>
            }
          >
            {dailySales.length === 0 ? (
              <EmptyState icon="📉" title="No sales data" message="Daily revenue records will appear once customer orders start coming in." />
            ) : (
              <TrendAreaChart
                data={dailySales}
                xKey="date"
                valueFormatter={inr}
                height={300}
                series={[
                  { key: 'revenue', label: 'Revenue', color: '#FF7A45' },
                  { key: 'profit', label: 'Profit', color: '#FF3D77' },
                ]}
              />
            )}
          </ChartCard>
        </FadeIn>

        <FadeIn delay={0.1}>
          <ChartCard
            title="Stock Health"
            subtitle="Restock coverage gauge"
            icon={Boxes}
            accent="emerald"
          >
            <GlowingStarsBackgroundCard className="p-4">
              <div className="flex h-full flex-col items-center justify-center">
                <RadialGauge id="retStock" value={stockPct} size={172} stroke={13} from="#7ED957" to="#7ED957" track="#FFE0C2">
                  <div className="text-center">
                    <div className="mono-num text-4xl font-black tabular-nums text-foreground">
                      <CountUp value={stockPct} />
                      <span className="text-xl text-muted-foreground">%</span>
                    </div>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Healthy</p>
                  </div>
                </RadialGauge>
              </div>
            </GlowingStarsBackgroundCard>
            <div className="mt-2 space-y-2.5">
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
                <span className="text-[11px] font-semibold text-muted-foreground">Above restock threshold</span>
                <span className="mono-num text-base font-bold tabular-nums text-foreground">
                  {stockHealthy}<span className="text-muted-foreground">/ {stockLines.length}</span>
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-destructive/25 bg-destructive/[0.06] px-3.5 py-2.5">
                <span className="text-[11px] font-semibold text-destructive">Items needing restock</span>
                <span className="mono-num text-base font-bold tabular-nums text-destructive">{lowStock.length}</span>
              </div>
            </div>
          </ChartCard>
        </FadeIn>
      </div>

      {/* Secondary charts row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <FadeIn delay={0.05}>
          <ChartCard title="Top Sellers" subtitle="Units sold per product" icon={Trophy} accent="amber">
            {topProducts.length === 0 ? (
              <EmptyState icon="🏆" title="No products sold yet" message="Units sold metrics will populate after completed checkouts." />
            ) : (
              <RankBars
                items={topProducts.slice(0, 6).map((p) => ({ name: p.name, value: Number(p.units_sold || 0) }))}
                valueFormatter={count}
                accentColors={SERIES_COLORS}
                className="mt-1"
              />
            )}
          </ChartCard>
        </FadeIn>

        <FadeIn delay={0.1}>
          <ChartCard
            title="7-Day Demand Forecast"
            subtitle="Predicted units per product"
            icon={Sparkles}
            accent="primary"
            right={
              <Badge className="border border-primary/25 bg-primary/12 text-[10px] font-bold text-primary">
                <Sparkles className="size-3" />
                AI Model
              </Badge>
            }
          >
            {predictions?.length === 0 ? (
              <EmptyState icon="🔮" title="No forecast available" message="Forecasts compute automatically once sales history is established." />
            ) : (
              <RankBars
                items={predictions.map((p) => ({ name: p.name, value: Number(p.predicted_demand || 0) }))}
                valueFormatter={count}
                color="#FFC145"
                className="mt-1"
              />
            )}
          </ChartCard>
        </FadeIn>

        <FadeIn delay={0.15}>
          <ChartCard title="Revenue by Category" subtitle="Share of revenue per category" icon={PieChartIcon} accent="cyan">
            {categories.length === 0 ? (
              <EmptyState icon="📊" title="No category data" message="Category proportions will render here." />
            ) : (
              <div className="flex flex-col items-center">
                <DonutBreakdown
                  data={categories.map((c) => ({ name: c.category, value: Number(c.revenue || 0) }))}
                  valueFormatter={inr}
                  height={230}
                />
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Total {inr(totalCat)}</p>
              </div>
            )}
          </ChartCard>
        </FadeIn>
      </div>

      {/* Orders Management Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-pink-500/10 text-primary ring-1 ring-primary/25">
              <Package className="size-4" />
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">Customer Orders</h2>
              <p className="text-xs text-muted-foreground">Advance fulfillment status in real time</p>
            </div>
            {pendingCount > 0 && (
              <Badge variant="outline" className="rounded-full border-amber-400/40 bg-amber-500/12 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                {pendingCount} Pending Action
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{orders.length} total</span>
        </div>

        {loading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : orders.length === 0 ? (
          <EmptyState icon="📦" title="No orders received yet" message="Incoming orders will show up here in real time without refreshing." />
        ) : (
          <Stagger className="space-y-4">
            {orders.map((o) => (
              <StaggerItem key={o.id}>
                <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/25 sm:p-6">
                  <div className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="mono-num text-sm font-bold text-foreground">Order #{o.id}</span>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Customer: <strong className="text-foreground">{o.customer_name}</strong> ({o.customer_email}) · {new Date(o.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs text-muted-foreground">Total:</span>
                      <span className="mono-num text-lg font-extrabold text-foreground">₹{o.total_amount}</span>
                    </div>
                  </div>

                  <OrderTimeline status={o.status} />

                  <div className="flex flex-wrap gap-2 pt-1">
                    {o.items?.map((it) => (
                      <span key={it.product_id} className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {it.name} <strong className="text-foreground">× {it.quantity}</strong> @ ₹{it.unit_price}
                      </span>
                    ))}
                  </div>

                  {NEXT_STATUS[o.status] && (
                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        onClick={() => advanceStatus(o.id, NEXT_STATUS[o.status])}
                        className="group gap-1.5 rounded-xl text-xs font-bold"
                      >
                        <span>Mark as {NEXT_STATUS[o.status]}</span>
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      {/* Inventory Management Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500/25 to-pink-500/10 text-emerald-700 ring-1 ring-emerald-400/40">
              <Boxes className="size-4" />
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">Store Inventory</h2>
              <p className="text-xs text-muted-foreground">Adjust stock counts and set low-stock alert thresholds</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{inventory.length} items</span>
        </div>

        {loading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : inventory.length === 0 ? (
          <EmptyState icon="📦" title="No inventory assigned" message="Products added to your store will appear here." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border bg-muted/50 backdrop-blur">
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Product</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Category</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">In Stock</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Low Alert Threshold</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
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
  const inputClass = 'w-20 rounded-xl border px-2.5 py-1 text-xs font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 bg-card transition-colors';

  return (
    <tr className="border-b border-border/60 transition-colors last:border-0 hover:bg-primary/[0.055]">
      <td className="px-4 py-3.5">
        <span className="block font-bold text-foreground">{item.name}</span>
        {isLow && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-destructive">
            <span className="status-dot size-1.5 bg-orange-500 text-orange-500" /> Low stock warning
          </span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <span className="inline-block rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
          {item.category || 'General'}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <input
          type="number"
          min="0"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          className={`${inputClass} ${isLow ? 'border-destructive/30 text-destructive' : 'border-input'}`}
        />
      </td>
      <td className="px-4 py-3.5">
        <input
          type="number"
          min="0"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className={`${inputClass} border-input`}
        />
      </td>
      <td className="px-4 py-3.5 text-right">
        <Button
          type="button"
          onClick={handleSave}
          className={`rounded-xl text-xs font-bold ${saved ? 'bg-emerald-500 from-emerald-500 to-emerald-500 text-white' : ''}`}
        >
          {saved ? 'Saved!' : 'Save'}
        </Button>
      </td>
    </tr>
  );
}

function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-3xl" />
      <SkeletonStats count={4} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <SkeletonTable rows={5} cols={5} />
    </div>
  );
}

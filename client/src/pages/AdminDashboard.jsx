import { useEffect, useState } from 'react';
import { Shield, TrendingUp, BarChart3, Package, Brain, Sparkles, RefreshCw, Download, Tag, Store, Trophy } from 'lucide-react';
import api, { downloadFile } from '../api/client';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { Skeleton, SkeletonTable } from '../components/Skeleton';
import CountUp from '../components/CountUp';
import RadialGauge from '../components/RadialGauge';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import { GradientBarChart, DonutBreakdown, SERIES_COLORS } from '../components/charts';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import { FadeIn } from '../components/Reveal';
import { TextGenerateEffect } from '../components/ui/text-generate-effect';
import { GlowingStarsBackgroundCard } from '../components/ui/glowing-stars';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

const fmtAgo = (s) => (s < 0 ? '—' : s < 60 ? `${Math.round(s)}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`);
const fmtDate = (s) => (s ? new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const AUDIT_ACTIONS = ['', 'coupon.create', 'coupon.delete', 'product.create', 'product.delete', 'order.status', 'model.retrain'];

const ACTION_COLORS = {
  'coupon.create': 'bg-primary/12 text-primary border-primary/25',
  'coupon.delete': 'bg-destructive/12 text-destructive border-destructive/25',
  'product.create': 'bg-pink-500/12 text-pink-700 border-pink-400/40',
  'product.delete': 'bg-destructive/12 text-destructive border-destructive/25',
  'order.status': 'bg-amber-500/12 text-amber-700 border-amber-400/40',
  'model.retrain': 'bg-emerald-500/12 text-emerald-700 border-emerald-400/40',
};

const inr = (v) => `₹${Number(v).toLocaleString('en-IN')}`;
const count = (v) => Number(v).toLocaleString('en-IN');

const inputClass =
  'w-full rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [retraining, setRetraining] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [couponForm, setCouponForm] = useState({ code: '', description: '', discount_type: 'percent', discount_value: '', min_order_value: '', max_discount: '', usage_limit: '' });
  const [couponMsg, setCouponMsg] = useState('');
  const [audit, setAudit] = useState([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPages, setAuditPages] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditFilter, setAuditFilter] = useState('');
  const [auditLoading, setAuditLoading] = useState(true);
  const [userHover, setUserHover] = useState(-1);

  useEffect(() => {
    api.get('/dashboard/admin/summary')
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadHealth = () => api.get('/ml/model-health').then(({ data }) => setHealth(data)).catch(() => setHealth(null));
  useEffect(() => { loadHealth(); }, []);

  const loadCoupons = () => api.get('/coupons').then(({ data }) => setCoupons(data)).catch(() => setCoupons([]));
  useEffect(() => { loadCoupons(); }, []);

  const loadAudit = (page = 1) => {
    setAuditLoading(true);
    api.get('/audit', { params: { page, limit: 10, ...(auditFilter ? { action: auditFilter } : {}) } })
      .then(({ data }) => {
        setAudit(data.items);
        setAuditPage(data.page);
        setAuditPages(data.totalPages);
        setAuditTotal(data.total);
      })
      .catch(() => setAudit([]))
      .finally(() => setAuditLoading(false));
  };
  useEffect(() => { loadAudit(1); }, [auditFilter]);

  const retrain = async () => {
    setRetraining(true);
    try {
      await api.post('/ml/retrain', { target: 'all' });
      await loadHealth();
    } finally {
      setRetraining(false);
    }
  };

  const toggleCoupon = async (id) => {
    const c = coupons.find((x) => x.id === id);
    try {
      await api.put(`/coupons/${id}`, { active: 0 + !c.active });
      await loadCoupons();
    } catch (err) {
      setCouponMsg(err.response?.data?.error || 'Update failed');
    }
  };

  const deleteCoupon = async (id) => {
    try {
      await api.delete(`/coupons/${id}`);
      setCoupons((list) => list.filter((x) => x.id !== id));
    } catch (err) {
      setCouponMsg(err.response?.data?.error || 'Delete failed');
    }
  };

  const createCoupon = async (e) => {
    e.preventDefault();
    try {
      const payload = {};
      for (const [k, v] of Object.entries(couponForm)) {
        payload[k] = v === '' ? null : v;
      }
      await api.post('/coupons', payload);
      setCouponForm({ code: '', description: '', discount_type: 'percent', discount_value: '', min_order_value: '', max_discount: '', usage_limit: '' });
      setCouponMsg('Coupon created successfully');
      await loadCoupons();
    } catch (err) {
      setCouponMsg(err.response?.data?.error || 'Failed to create coupon');
    }
  };

  if (loading) return <AdminLoading />;
  if (!data) {
    return (
      <EmptyState
        icon="⚠️"
        title="Admin Service Unavailable"
        message="Could not load platform administrator summaries. Please verify backend server status."
      />
    );
  }

  const couponsUsed = coupons.reduce((a, c) => a + Number(c.used_count || 0), 0);
  const couponsLimit = coupons.reduce((a, c) => a + (Number(c.usage_limit) || 0), 0);
  const couponUsage = couponsLimit ? Math.min(100, Math.round((couponsUsed / couponsLimit) * 100)) : 0;

  const couponColumns = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      render: (c) => (
        <span className="rounded-lg border border-border bg-muted px-2 py-0.5 font-mono text-xs font-extrabold text-foreground">{c.code}</span>
      ),
    },
    { key: 'discount_type', header: 'Type', render: (c) => <span className="capitalize text-muted-foreground">{c.discount_type}</span> },
    {
      key: 'discount_value',
      header: 'Value',
      align: 'right',
      sortable: true,
      sortValue: (c) => Number(c.discount_value),
      render: (c) => (
        <span className="mono-num font-bold text-primary">
          {c.discount_type === 'percent' ? `${Number(c.discount_value)}%` : `₹${Number(c.discount_value)}`}
        </span>
      ),
    },
    { key: 'min_order_value', header: 'Min Order', align: 'right', render: (c) => <span className="mono-num text-muted-foreground">₹{Number(c.min_order_value || 0)}</span> },
    { key: 'max_discount', header: 'Max Cap', align: 'right', render: (c) => <span className="mono-num text-muted-foreground">{c.max_discount == null ? '—' : `₹${c.max_discount}`}</span> },
    { key: 'used_count', header: 'Used / Limit', align: 'right', render: (c) => <span className="mono-num text-muted-foreground">{c.used_count} / {c.usage_limit ?? '∞'}</span> },
    { key: 'active', header: 'Status', render: (c) => <StatusPill status={c.active ? 'active' : 'inactive'} label={c.active ? 'Active' : 'Disabled'} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => toggleCoupon(c.id)} className="text-xs font-bold text-primary hover:text-primary/70">
            {c.active ? 'Disable' : 'Enable'}
          </button>
          <button type="button" onClick={() => deleteCoupon(c.id)} className="text-xs font-bold text-destructive hover:text-destructive/70">
            Delete
          </button>
        </div>
      ),
    },
  ];

  const topProductColumns = [
    {
      key: 'name',
      header: 'Product Name',
      render: (p) => <span className="font-bold text-foreground">{p.name}</span>,
    },
    { key: 'units_sold', header: 'Units Sold', align: 'right', sortable: true, render: (p) => <span className="mono-num text-muted-foreground">{p.units_sold} units</span> },
    { key: 'revenue', header: 'Total Revenue', align: 'right', sortable: true, render: (p) => <span className="mono-num font-bold text-primary">₹{p.revenue}</span> },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Header Bar */}
      <FadeIn y={12}>
        <Card className="relative gap-0 overflow-hidden p-5 sm:p-6">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-[radial-gradient(circle,rgba(255,61,119,0.18),transparent_65%)]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#ff3d77] via-[#ff7a45] to-[#ffc145] font-extrabold text-white shadow-glow-brand">
                <Shield className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                    <TextGenerateEffect words="Platform Administration" className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl" />
                  </h1>
                  <Badge variant="secondary" className="rounded-full border border-primary/25 bg-primary/12 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                    Super Admin
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Platform-wide analytics, ML telemetry, coupon lifecycle, and audit logs
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-muted/40 p-1.5">
              {[
                ['sales/csv', 'Sales CSV'],
                ['sales/pdf', 'Sales PDF'],
                ['inventory/csv', 'Inv CSV'],
                ['inventory/pdf', 'Inv PDF']
              ].map(([path, label]) => (
                <button
                  key={path}
                  onClick={() => downloadFile(`/reports/${path}`, label.replace(/\s/g, '-').toLowerCase() + '-platform')}
                  className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  title={`Export Platform ${label}`}
                >
                  <Download className="size-3" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Platform Revenue" value={Number(data?.totals?.platform_revenue || 0)} prefix="₹" icon={TrendingUp} accent="primary" hint="Gross merchandise value" />
        <StatCard label="Platform Net Profit" value={Number(data?.totals?.platform_profit || 0)} prefix="₹" icon={BarChart3} accent="emerald" hint="After fulfillment costs" delay={0.05} />
        <StatCard label="Total Platform Orders" value={Number(data?.totals?.total_orders || 0)} icon={Package} accent="cyan" hint="Across all storefronts" delay={0.1} />
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FadeIn>
          <ChartCard
            title="Platform Revenue by Storefront"
            subtitle="Gross revenue contributed by each retail partner"
            icon={Store}
            accent="primary"
            right={
              <Badge variant="outline" className="rounded-full border-border bg-muted/40 text-[10px] font-semibold text-muted-foreground">
                Retail Partners
              </Badge>
            }
          >
            {data?.byRetailer?.length === 0 ? (
              <EmptyState icon="📊" title="No revenue data" message="Store revenues will appear here once transactions occur." />
            ) : (
              <GradientBarChart
                data={data?.byRetailer}
                xKey="store_name"
                valueFormatter={inr}
                height={264}
                series={[{ key: 'revenue', label: 'Store Revenue (₹)', color: '#FF7A45' }]}
              />
            )}
          </ChartCard>
        </FadeIn>

        <FadeIn delay={0.05}>
          <ChartCard
            title="Platform User Distribution"
            subtitle="Registered accounts by role"
            icon={Package}
            accent="cyan"
            right={
              <Badge variant="outline" className="rounded-full border-border bg-muted/40 text-[10px] font-semibold text-muted-foreground">
                Registered Accounts
              </Badge>
            }
          >
            {data?.userCounts?.length === 0 ? (
              <EmptyState icon="👥" title="No users registered yet" />
            ) : (
              <DonutBreakdown
                data={(data?.userCounts || []).map((u) => ({ name: u.role, value: u.count }))}
                valueFormatter={count}
                height={264}
                colors={SERIES_COLORS}
                hoverIndex={userHover}
                onHover={setUserHover}
              />
            )}
          </ChartCard>
        </FadeIn>
      </div>

      {/* ML Model Health Panel */}
      <FadeIn>
        <GlowingStarsBackgroundCard>
          <div className="space-y-6 p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-2xl border border-emerald-400/40 bg-emerald-500/12 text-emerald-700">
                <Brain className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                    ML Model Registry &amp; Telemetry
                  </h2>
                  <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/12 text-[10px] font-bold text-primary">
                    Joblib Persistent Store
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Evaluates holdout MAE and precision@k metrics; lazy 12-hour TTL cache refresh
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={retrain}
              disabled={retraining}
              className="gap-2 rounded-xl text-xs font-bold"
            >
              <RefreshCw className={`size-3.5 ${retraining ? 'animate-spin' : ''}`} />
              {retraining ? 'Re-training Models…' : 'Force Re-train All'}
            </Button>
          </div>

          {!health ? (
            <EmptyState icon="🧠" title="ML service telemetry unreachable" message="Ensure python ML microservice is up on port 6000." />
          ) : (
            <ModelHealth health={health} />
          )}
          </div>
        </GlowingStarsBackgroundCard>
      </FadeIn>

      {/* Coupon Management Section */}
      <FadeIn>
        <Card className="gap-0 space-y-6 p-5 sm:p-6">
          <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-2xl border border-primary/25 bg-primary/12 text-primary">
                <Tag className="size-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground sm:text-lg">Promotions &amp; Coupons</h2>
                <p className="text-xs text-muted-foreground">Manage promotional discount codes across platform orders</p>
              </div>
            </div>
            {couponMsg && (
              <span className={`rounded-xl border px-3 py-1 text-xs font-semibold ${
                couponMsg.includes('success') ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-700' : 'border-destructive/25 bg-destructive/10 text-destructive'
              }`}>
                {couponMsg}
              </span>
            )}
          </div>

          <form onSubmit={createCoupon} className="grid grid-cols-1 gap-3.5 rounded-2xl border border-border bg-muted/30 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label-micro mb-1 block text-primary">Code *</label>
              <input
                required
                placeholder="e.g. SAVE20"
                value={couponForm.code}
                onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                className={`${inputClass} font-mono font-bold uppercase`}
              />
            </div>

            <div>
              <label className="label-micro mb-1 block">Description</label>
              <input
                placeholder="e.g. Summer special 20% off"
                value={couponForm.description}
                onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className="label-micro mb-1 block">Type</label>
              <select
                value={couponForm.discount_type}
                onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })}
                className={`${inputClass} cursor-pointer font-bold`}
              >
                <option value="percent">Percent Discount (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>

            <div>
              <label className="label-micro mb-1 block">Discount Value *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                placeholder={couponForm.discount_type === 'percent' ? 'e.g. 15 (%)' : 'e.g. 100 (₹)'}
                value={couponForm.discount_value}
                onChange={(e) => setCouponForm({ ...couponForm, discount_value: Number(e.target.value) })}
                className={`${inputClass} font-bold`}
              />
            </div>

            <div>
              <label className="label-micro mb-1 block">Min Order Value (₹)</label>
              <input
                type="number"
                min="0"
                placeholder="0 (optional)"
                value={couponForm.min_order_value}
                onChange={(e) => setCouponForm({ ...couponForm, min_order_value: Number(e.target.value) })}
                className={inputClass}
              />
            </div>

            <div>
              <label className="label-micro mb-1 block">Max Discount Cap (₹)</label>
              <input
                type="number"
                min="0"
                placeholder="No cap (optional)"
                value={couponForm.max_discount}
                onChange={(e) => setCouponForm({ ...couponForm, max_discount: Number(e.target.value) })}
                className={inputClass}
              />
            </div>

            <div>
              <label className="label-micro mb-1 block">Usage Limit</label>
              <input
                type="number"
                min="0"
                placeholder="Unlimited (optional)"
                value={couponForm.usage_limit}
                onChange={(e) => setCouponForm({ ...couponForm, usage_limit: Number(e.target.value) })}
                className={inputClass}
              />
            </div>

            <div className="flex items-end">
              <Button type="submit" className="w-full rounded-xl text-xs font-bold">
                + Create Coupon
              </Button>
            </div>
          </form>

          {coupons.length > 0 && (
            <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-border bg-muted/30 p-4">
              <RadialGauge id="couponUse" value={couponUsage} size={120} stroke={11} from="#FFC145" to="#FF3D77" track="#FFE0C2" glow={false}>
                <div className="text-center">
                  <div className="mono-num text-2xl font-black tabular-nums text-foreground">
                    <CountUp value={couponUsage} />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Redeemed</p>
                </div>
              </RadialGauge>
              <div>
                <p className="label-micro text-primary">Coupon Utilization</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {couponsUsed} of {couponsLimit || '∞'} tracked redemptions across {coupons.length} codes
                </p>
              </div>
            </div>
          )}

          {coupons.length === 0 ? (
            <EmptyState icon="🎟️" title="No coupons issued" message="Create your first promotional discount above." />
          ) : (
            <DataTable
              columns={couponColumns}
              rows={coupons}
              searchable
              searchKeys={['code', 'description']}
              searchPlaceholder="Search coupons…"
              initialSort={{ key: 'code', dir: 'asc' }}
              pageSize={8}
              className="border-0 shadow-none"
            />
          )}
        </Card>
      </FadeIn>

      {/* Admin Audit Log Section */}
      <FadeIn>
        <Card className="gap-0 space-y-6 p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground sm:text-lg">Security &amp; Operational Audit Log</h2>
                <Badge variant="outline" className="rounded-full border-border bg-muted text-[10px] font-bold text-muted-foreground">
                  {auditTotal} event{auditTotal === 1 ? '' : 's'}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">Immutable audit trail of administrator and system mutation actions</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Filter action:</span>
              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="cursor-pointer rounded-xl border border-input bg-card px-3 py-1.5 text-xs font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                aria-label="Filter audit log by action"
              >
                {AUDIT_ACTIONS.map((a) => (
                  <option key={a || 'all'} value={a}>{a || 'All Actions'}</option>
                ))}
              </select>
            </div>
          </div>

          {auditLoading ? (
            <SkeletonTable rows={5} cols={6} />
          ) : audit.length === 0 ? (
            <EmptyState
              icon="📜"
              title="No audit events found"
              message="Recorded actions (coupons, products, orders, ML retrain) will appear here."
            />
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-border bg-muted/50 backdrop-blur">
                        {['Timestamp', 'Actor', 'Role', 'Action', 'Target Entity', 'Payload Details'].map((h, i) => (
                          <th key={h} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground ${i === 5 ? 'text-right' : ''}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {audit.map((e) => (
                        <tr key={e.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-primary/[0.055]">
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-muted-foreground">{fmtDate(e.created_at)}</td>
                          <td className="px-4 py-3 font-bold text-foreground">{e.actor_name || `#${e.actor_id}`}</td>
                          <td className="px-4 py-3">
                            <span className="inline-block rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {e.actor_role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-lg border px-2 py-0.5 font-mono text-[11px] font-bold ${ACTION_COLORS[e.action] || 'border-border bg-muted text-muted-foreground'}`}>
                              {e.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-muted-foreground">
                            {e.entity_type} {e.entity_id != null ? `#${e.entity_id}` : ''}
                          </td>
                          <td className="max-w-xs truncate px-4 py-3 text-right font-mono text-[11px] text-muted-foreground">
                            {JSON.stringify(e.details || {})}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {auditPages > 1 && (
                <Pagination page={auditPage} totalPages={auditPages} onPageChange={loadAudit} />
              )}
            </div>
          )}
        </Card>
      </FadeIn>

      {/* Top Products Platform-Wide Table */}
      <section className="space-y-4">
        <FadeIn>
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-amber-500/25 to-orange-500/10 text-amber-700 ring-1 ring-amber-400/40">
              <Trophy className="size-4" />
            </span>
            <div>
              <h3 className="text-base font-bold tracking-tight text-foreground">Top Performing Products</h3>
              <p className="text-xs text-muted-foreground">Total volume and revenue across all affiliated retailer inventory</p>
            </div>
          </div>
        </FadeIn>

        {data?.topProductsPlatform?.length === 0 ? (
          <EmptyState icon="🏆" title="No platform sales recorded yet" />
        ) : (
          <DataTable
            columns={topProductColumns}
            rows={data?.topProductsPlatform || []}
            initialSort={{ key: 'revenue', dir: 'desc' }}
            pageSize={8}
          />
        )}
      </section>
    </div>
  );
}

function MetricChip({ label, value, fresh }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-subtle">
      <p className="label-micro">{label}</p>
      <p className="mono-num mt-0.5 text-sm font-extrabold tabular-nums text-foreground sm:text-base">{value}</p>
      {fresh != null && (
        <p className={`mt-1 flex items-center gap-1 text-[10px] font-bold ${fresh ? 'text-emerald-700' : 'text-amber-700'}`}>
          <span className={`status-dot size-1.5 text-current ${fresh ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {fresh ? 'Fresh Artifact' : 'Retrain Stale Due'}
        </p>
      )}
    </div>
  );
}

function ModelHealth({ health }) {
  const { recommend, demand, max_age_seconds } = health;
  const models = [recommend, ...(demand.models || [])];
  const freshCount = models.filter((m) => m?.fresh).length;
  const freshPct = models.length ? Math.round((freshCount / models.length) * 100) : 0;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-border bg-muted/30 p-4">
        <RadialGauge id="modelFresh" value={freshPct} size={120} stroke={11} from="#7ED957" to="#7ED957" track="#FFE0C2">
          <div className="text-center">
            <div className="mono-num text-2xl font-black tabular-nums text-foreground">
              <CountUp value={freshPct} />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Fresh</p>
          </div>
        </RadialGauge>
        <div>
          <p className="label-micro text-primary">Model Freshness</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {freshCount} of {models.length} artifacts within {(max_age_seconds || 43200) / 3600}h TTL
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
              <Sparkles className="size-3.5 text-primary" />
              Recommendation Engine
            </p>
            <span className="text-[10px] font-semibold text-muted-foreground">Cosine Interaction Matrix</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <MetricChip label="Precision@K (Eval)" value={recommend.metrics?.precision_at_k ?? '—'} fresh={recommend.fresh} />
            <MetricChip label="Evaluated Users" value={recommend.metrics?.eval_customers ?? '—'} />
            <MetricChip label="Model Age" value={fmtAgo(recommend.age_seconds)} fresh={recommend.fresh} />
            <MetricChip label="Matrix Shape" value={`${recommend.meta?.customers ?? '—'} u × ${recommend.meta?.products ?? '—'} p`} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
              <TrendingUp className="size-3.5 text-emerald-700" />
              Demand Forecast Regressors
            </p>
            <span className="text-[10px] font-semibold text-muted-foreground">7-Day Horizon</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <MetricChip label="Retailer Models" value={demand.models?.length ?? 0} />
            <MetricChip label="Holdout MAE (Units)" value={demand.models?.[0]?.metrics?.mae ?? '—'} fresh={demand.models?.[0]?.fresh} />
            <MetricChip label="Model Age" value={fmtAgo(demand.models?.[0]?.age_seconds)} fresh={demand.models?.[0]?.fresh} />
            <MetricChip label="Freshness TTL" value={`${(max_age_seconds || 43200) / 3600} Hours`} />
          </div>
          {demand.models?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {demand.models.map((m) => (
                <span
                  key={m.retailer_id}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    m.fresh ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-700' : 'border-amber-400/40 bg-amber-500/12 text-amber-700'
                  }`}
                >
                  Store #{m.retailer_id} · MAE {m.metrics?.mae ?? '—'} · {fmtAgo(m.age_seconds)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-3xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[1, 2].map((i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
      </div>
      <SkeletonTable rows={5} cols={4} />
    </div>
  );
}

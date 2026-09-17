import { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import api, { downloadFile } from '../api/client';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { Skeleton, SkeletonTable } from '../components/Skeleton';
import CountUp from '../components/CountUp';
import ChartTooltip from '../components/ChartTooltip';
import { FadeIn } from '../components/Reveal';
import { ShieldIcon, TrendingUpIcon, BarChartIcon, PackageIcon, BrainIcon, SparklesIcon, RefreshCwIcon, DownloadIcon, TagIcon } from '../components/Icons';

const CHART_COLORS = ['#7A5CC4', '#4E9C7C', '#C97354', '#5592B8', '#A184E6'];
const fmtAgo = (s) => (s < 0 ? '—' : s < 60 ? `${Math.round(s)}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`);
const fmtDate = (s) => (s ? new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const AUDIT_ACTIONS = ['', 'coupon.create', 'coupon.delete', 'product.create', 'product.delete', 'order.status', 'model.retrain'];

const ACTION_COLORS = {
  'coupon.create': 'bg-violet-50 text-violet-700 border-violet-200',
  'coupon.delete': 'bg-coral-50 text-coral-700 border-coral-200',
  'product.create': 'bg-sky-50 text-sky-700 border-sky-200',
  'product.delete': 'bg-coral-50 text-coral-700 border-coral-200',
  'order.status': 'bg-amber-50 text-amber-800 border-amber-200',
  'model.retrain': 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const AXIS = { stroke: 'none', tick: { fontSize: 10, fill: '#786F97' }, axisLine: false, tickLine: false };
const GRID = '#7A5CC414';
const inr = (v) => `₹${Number(v).toLocaleString('en-IN')}`;
const count = (v) => Number(v).toLocaleString('en-IN');

const inputClass =
  'w-full bg-cream-50 hover:bg-cream-50 border border-cream-300 hover:border-cream-400 rounded-xl px-3 py-2 text-xs text-cream-800 placeholder-cream-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all';

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

  return (
    <div className="space-y-8 pb-16">
      {/* Header Bar */}
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card rounded-2xl border border-cream-300/70 shadow-elevated p-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center shadow-glow-brand">
              <ShieldIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-cream-900 tracking-tight">
                  Platform Administration
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-cream-500 mt-0.5">
                Platform-wide analytics, ML telemetry, coupon lifecycle, and audit logs
              </p>
            </div>
          </div>

          {/* Platform Reports Quick Export */}
          <div className="flex flex-wrap items-center gap-1.5 bg-cream-100 p-1.5 rounded-2xl border border-cream-300/70">
            {[
              ['sales/csv', 'Sales CSV'],
              ['sales/pdf', 'Sales PDF'],
              ['inventory/csv', 'Inv CSV'],
              ['inventory/pdf', 'Inv PDF']
            ].map(([path, label]) => (
              <button
                key={path}
                onClick={() => downloadFile(`/reports/${path}`, label.replace(/\s/g, '-').toLowerCase() + '-platform')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cream-50 hover:bg-cream-100 text-cream-700 border border-cream-300/70 text-[11px] font-bold transition-all hover:-translate-y-0.5 hover:shadow-subtle"
                title={`Export Platform ${label}`}
              >
                <DownloadIcon className="w-3 h-3 text-cream-400" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* KPI Stat Cards */}
      <FadeIn>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <StatCard
            label="Platform Revenue"
            value={<CountUp value={Number(data?.totals?.platform_revenue || 0)} prefix="₹" />}
            icon={TrendingUpIcon}
            tint="text-violet-600 bg-violet-50 border-violet-200"
          />
          <StatCard
            label="Platform Net Profit"
            value={<CountUp value={Number(data?.totals?.platform_profit || 0)} prefix="₹" />}
            icon={BarChartIcon}
            tint="text-emerald-600 bg-emerald-50 border-emerald-200"
          />
          <StatCard
            label="Total Platform Orders"
            value={<CountUp value={data?.totals?.total_orders || 0} />}
            icon={PackageIcon}
            tint="text-sky-600 bg-sky-50 border-sky-200"
          />
        </div>
      </FadeIn>

      {/* 🧠 Machine Learning Model Health Panel */}
      <FadeIn>
        <section className="glass-card rounded-2xl border border-cream-300/70 shadow-subtle p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cream-300/70 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold border border-emerald-200">
                <BrainIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-extrabold text-cream-900 tracking-tight">
                    ML Model Registry & Telemetry
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                    Joblib Persistent Store
                  </span>
                </div>
                <p className="text-xs text-cream-500 mt-0.5">
                  Evaluates holdout MAE and precision@k metrics; lazy 12-hour TTL cache refresh
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={retrain}
              disabled={retraining}
              className="inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-glow-brand transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              <RefreshCwIcon className={`w-3.5 h-3.5 ${retraining ? 'animate-spin' : ''}`} />
              <span>{retraining ? 'Re-training Models…' : 'Force Re-train All'}</span>
            </button>
          </div>

          {!health ? (
            <EmptyState icon="🧠" title="ML service telemetry unreachable" message="Ensure python ML microservice is up on port 6000." />
          ) : (
            <ModelHealth health={health} />
          )}
        </section>
      </FadeIn>

      {/* 🎟️ Coupon Management Section */}
      <FadeIn>
        <section className="glass-card rounded-2xl border border-cream-300/70 shadow-subtle p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cream-300/70 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-200">
                <TagIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-extrabold text-cream-900 text-base sm:text-lg">Promotions & Coupons</h2>
                <p className="text-xs text-cream-500">Manage promotional discount codes across platform orders</p>
              </div>
            </div>
            {couponMsg && (
              <span className={`text-xs font-semibold px-3 py-1 rounded-xl border ${
                couponMsg.includes('success') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-coral-50 text-coral-700 border-coral-200'
              }`}>
                {couponMsg}
              </span>
            )}
          </div>

          {/* Create Coupon Form */}
          <form onSubmit={createCoupon} className="bg-cream-50 border border-cream-300/70 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-cream-500 mb-1">Code *</label>
              <input
                required
                placeholder="e.g. SAVE20"
                value={couponForm.code}
                onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                className={`${inputClass} font-mono font-bold uppercase`}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-cream-500 mb-1">Description</label>
              <input
                placeholder="e.g. Summer special 20% off"
                value={couponForm.description}
                onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-cream-500 mb-1">Type</label>
              <select
                value={couponForm.discount_type}
                onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })}
                className={`${inputClass} font-bold cursor-pointer`}
              >
                <option value="percent">Percent Discount (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-cream-500 mb-1">Discount Value *</label>
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
              <label className="block text-[10px] font-bold uppercase tracking-wider text-cream-500 mb-1">Min Order Value (₹)</label>
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
              <label className="block text-[10px] font-bold uppercase tracking-wider text-cream-500 mb-1">Max Discount Cap (₹)</label>
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
              <label className="block text-[10px] font-bold uppercase tracking-wider text-cream-500 mb-1">Usage Limit</label>
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
              <button
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-glow-brand transition-all hover:-translate-y-0.5"
              >
                + Create Coupon
              </button>
            </div>
          </form>

          {/* Coupons Table */}
          {coupons.length === 0 ? (
            <EmptyState icon="🎟️" title="No coupons issued" message="Create your first promotional discount above." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-cream-300/70">
              <table className="w-full text-xs text-left">
                <thead className="bg-cream-100 border-b border-cream-300/70 text-cream-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3 sm:p-3.5">Code</th>
                    <th className="p-3 sm:p-3.5">Type</th>
                    <th className="p-3 sm:p-3.5">Value</th>
                    <th className="p-3 sm:p-3.5">Min Order</th>
                    <th className="p-3 sm:p-3.5">Max Cap</th>
                    <th className="p-3 sm:p-3.5">Used / Limit</th>
                    <th className="p-3 sm:p-3.5">Status</th>
                    <th className="p-3 sm:p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-300/60 font-medium">
                  {coupons.map((c) => (
                    <tr key={c.id} className="hover:bg-cream-50 transition-colors">
                      <td className="p-3 sm:p-3.5">
                        <span className="font-mono font-extrabold px-2 py-0.5 rounded-lg bg-cream-100 text-cream-800 border border-cream-300/70">
                          {c.code}
                        </span>
                      </td>
                      <td className="p-3 sm:p-3.5 capitalize text-cream-700">{c.discount_type}</td>
                      <td className="p-3 sm:p-3.5 font-bold text-violet-700">
                        {c.discount_type === 'percent' ? `${Number(c.discount_value)}%` : `₹${Number(c.discount_value)}`}
                      </td>
                      <td className="p-3 sm:p-3.5 text-cream-700">₹{Number(c.min_order_value || 0)}</td>
                      <td className="p-3 sm:p-3.5 text-cream-700">{c.max_discount == null ? '—' : `₹${c.max_discount}`}</td>
                      <td className="p-3 sm:p-3.5 font-mono text-cream-700">{c.used_count} / {c.usage_limit ?? '∞'}</td>
                      <td className="p-3 sm:p-3.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          c.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-cream-100 text-cream-500 border-cream-300/70'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.active ? 'bg-emerald-500' : 'bg-cream-400'}`} />
                          {c.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="p-3 sm:p-3.5 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleCoupon(c.id)}
                          className="text-xs font-bold text-violet-700 hover:text-violet-600 underline"
                        >
                          {c.active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCoupon(c.id)}
                          className="text-xs font-bold text-coral-700 hover:text-coral-600 underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </FadeIn>

      {/* 📜 Admin Audit Log Section */}
      <FadeIn>
        <section className="glass-card rounded-2xl border border-cream-300/70 shadow-subtle p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cream-300/70 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-cream-900 text-base sm:text-lg">Security & Operational Audit Log</h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-cream-100 text-cream-700 border border-cream-300/70">
                  {auditTotal} event{auditTotal === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-cream-500 mt-0.5">Immutable audit trail of administrator and system mutation actions</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-cream-500">Filter action:</span>
              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="bg-cream-50 border border-cream-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-cream-800 hover:bg-cream-50 focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer"
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
              <div className="overflow-x-auto rounded-2xl border border-cream-300/70">
                <table className="w-full text-xs text-left">
                  <thead className="bg-cream-100 border-b border-cream-300/70 text-cream-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3 sm:p-3.5">Timestamp</th>
                      <th className="p-3 sm:p-3.5">Actor</th>
                      <th className="p-3 sm:p-3.5">Role</th>
                      <th className="p-3 sm:p-3.5">Action</th>
                      <th className="p-3 sm:p-3.5">Target Entity</th>
                      <th className="p-3 sm:p-3.5">Payload Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-300/60 font-medium">
                    {audit.map((e) => (
                      <tr key={e.id} className="hover:bg-cream-50 transition-colors">
                        <td className="p-3 sm:p-3.5 whitespace-nowrap text-cream-500 font-mono text-[11px]">
                          {fmtDate(e.created_at)}
                        </td>
                        <td className="p-3 sm:p-3.5 font-bold text-cream-900">
                          {e.actor_name || `#${e.actor_id}`}
                        </td>
                        <td className="p-3 sm:p-3.5">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cream-100 text-cream-700 border border-cream-300/70">
                            {e.actor_role}
                          </span>
                        </td>
                        <td className="p-3 sm:p-3.5">
                          <span className={`inline-block px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold border ${
                            ACTION_COLORS[e.action] || 'bg-cream-100 text-cream-700 border-cream-300/70'
                          }`}>
                            {e.action}
                          </span>
                        </td>
                        <td className="p-3 sm:p-3.5 text-cream-700 font-medium">
                          {e.entity_type} {e.entity_id != null ? `#${e.entity_id}` : ''}
                        </td>
                        <td className="p-3 sm:p-3.5 text-cream-500 font-mono text-[11px] max-w-xs truncate">
                          {JSON.stringify(e.details || {})}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {auditPages > 1 && (
                <Pagination page={auditPage} totalPages={auditPages} onPageChange={loadAudit} />
              )}
            </div>
          )}
        </section>
      </FadeIn>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revenue by Retailer */}
        <FadeIn>
          <div className="glass-card rounded-2xl border border-cream-300/70 shadow-subtle p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-cream-900">Platform Revenue by Storefront</h3>
              <span className="text-[11px] text-cream-400 font-semibold uppercase">Retail Partners</span>
            </div>
            {data?.byRetailer?.length === 0 ? (
              <EmptyState icon="📊" title="No revenue data" message="Store revenues will appear here once transactions occur." />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.byRetailer} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                    <XAxis dataKey="store_name" {...AXIS} tick={{ fontSize: 9, fill: '#786F97' }} />
                    <YAxis {...AXIS} />
                    <Tooltip content={<ChartTooltip format={inr} />} cursor={{ fill: '#7A5CC410' }} />
                    <Bar dataKey="revenue" fill="#4E9C7C" radius={[3, 3, 0, 0]} name="Store Revenue (₹)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </FadeIn>

        {/* Users by Role */}
        <FadeIn>
          <div className="glass-card rounded-2xl border border-cream-300/70 shadow-subtle p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-cream-900">Platform User Distribution</h3>
              <span className="text-[11px] text-cream-400 font-semibold uppercase">Registered Accounts</span>
            </div>
            {data?.userCounts?.length === 0 ? (
              <EmptyState icon="👥" title="No users registered yet" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.userCounts}
                      dataKey="count"
                      nameKey="role"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      stroke="#F0EDFA"
                    >
                      {data?.userCounts?.map((entry, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip format={count} />} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px', color: '#786F97' }} formatter={(v) => <span style={{ color: '#786F97' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </FadeIn>
      </div>

      {/* Top Products Platform-Wide Table */}
      <section className="space-y-4">
        <FadeIn>
          <div>
            <h3 className="font-bold text-cream-900 text-base">Top Performing Products (Platform-Wide)</h3>
            <p className="text-xs text-cream-500">Total volume and revenue across all affiliated retailer inventory</p>
          </div>
        </FadeIn>

        {data?.topProductsPlatform?.length === 0 ? (
          <EmptyState icon="🏆" title="No platform sales recorded yet" />
        ) : (
          <div className="glass-card rounded-2xl border border-cream-300/70 shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left">
                <thead className="bg-cream-100 border-b border-cream-300/70 text-cream-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5 sm:p-4">Product Name</th>
                    <th className="p-3.5 sm:p-4">Units Sold</th>
                    <th className="p-3.5 sm:p-4">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-300/60 font-medium">
                  {data?.topProductsPlatform?.map((p, idx) => (
                    <tr key={idx} className="hover:bg-cream-50 transition-colors">
                      <td className="p-3.5 sm:p-4 font-bold text-cream-900">{p.name}</td>
                      <td className="p-3.5 sm:p-4 font-mono font-bold text-cream-700">{p.units_sold} units</td>
                      <td className="p-3.5 sm:p-4 font-mono font-bold text-violet-700">₹{p.revenue}</td>
                    </tr>
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

function MetricChip({ label, value, fresh }) {
  return (
    <div className="rounded-2xl border border-cream-300/70 p-3.5 bg-cream-50">
      <p className="text-[10px] text-cream-500 font-bold uppercase tracking-wider">{label}</p>
      <p className="text-sm sm:text-base font-extrabold text-cream-900 mt-0.5 tabular-nums">{value}</p>
      {fresh != null && (
        <p className={`text-[10px] font-bold mt-1 flex items-center gap-1 ${fresh ? 'text-emerald-700' : 'text-amber-800'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${fresh ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {fresh ? 'Fresh Artifact' : 'Retrain Stale Due'}
        </p>
      )}
    </div>
  );
}

function ModelHealth({ health }) {
  const { recommend, demand, max_age_seconds } = health;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Recommend Model */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-cream-800 uppercase tracking-wider flex items-center gap-1.5">
            <SparklesIcon className="w-3.5 h-3.5 text-violet-600" />
            Recommendation Engine
          </p>
          <span className="text-[10px] font-semibold text-cream-400">Cosine Interaction Matrix</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <MetricChip label="Precision@K (Eval)" value={recommend.metrics?.precision_at_k ?? '—'} fresh={recommend.fresh} />
          <MetricChip label="Evaluated Users" value={recommend.metrics?.eval_customers ?? '—'} />
          <MetricChip label="Model Age" value={fmtAgo(recommend.age_seconds)} fresh={recommend.fresh} />
          <MetricChip label="Matrix Shape" value={`${recommend.meta?.customers ?? '—'} u × ${recommend.meta?.products ?? '—'} p`} />
        </div>
      </div>

      {/* Demand Model */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-cream-800 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUpIcon className="w-3.5 h-3.5 text-emerald-600" />
            Demand Forecast Regressors
          </p>
          <span className="text-[10px] font-semibold text-cream-400">7-Day Horizon Horizon</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <MetricChip label="Retailer Models" value={demand.models?.length ?? 0} />
          <MetricChip label="Holdout MAE (Units)" value={demand.models?.[0]?.metrics?.mae ?? '—'} fresh={demand.models?.[0]?.fresh} />
          <MetricChip label="Model Age" value={fmtAgo(demand.models?.[0]?.age_seconds)} fresh={demand.models?.[0]?.fresh} />
          <MetricChip label="Freshness TTL" value={`${(max_age_seconds || 43200) / 3600} Hours`} />
        </div>
        {demand.models?.length > 0 && (
          <div className="pt-1 flex flex-wrap gap-1.5">
            {demand.models.map((m) => (
              <span
                key={m.retailer_id}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  m.fresh ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                Store #{m.retailer_id} · MAE {m.metrics?.mae ?? '—'} · {fmtAgo(m.age_seconds)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
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

function AdminLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-12 w-72 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
      </div>
      <SkeletonTable rows={5} cols={4} />
    </div>
  );
}
import { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import api, { downloadFile } from '../api/client';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { Skeleton, SkeletonTable } from '../components/Skeleton';

const COLORS = ['#0f172a', '#059669', '#f59e0b', '#dc2626'];
const fmtAgo = (s) => (s < 0 ? '—' : s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`);
const fmtDate = (s) => (s ? new Date(s).toLocaleString() : '—');
const AUDIT_ACTIONS = ['', 'coupon.create', 'coupon.delete', 'product.create', 'product.delete', 'order.status', 'model.retrain'];

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
      setCouponMsg('Coupon created');
      await loadCoupons();
    } catch (err) {
      setCouponMsg(err.response?.data?.error || 'Create failed');
    }
  };

  if (loading) return <AdminLoading />;
  if (!data) return <EmptyState icon="⚠️" title="Failed to load" message="Could not load admin dashboard." />;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Platform Revenue" value={`₹${data.totals.platform_revenue}`} />
        <StatCard label="Platform Profit" value={`₹${data.totals.platform_profit}`} />
        <StatCard label="Total Orders" value={data.totals.total_orders} />
      </div>

      <section className="bg-white border rounded p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h3 className="font-semibold text-slate-700">🧠 Model Health</h3>
          <button
            onClick={retrain}
            disabled={retraining}
            className="bg-slate-900 text-white text-xs px-3 py-1.5 rounded hover:bg-slate-800 disabled:opacity-50"
          >
            {retraining ? 'Retraining…' : '🔄 Retrain models'}
          </button>
        </div>
        {!health ? (
          <EmptyState icon="🧠" title="ML service unreachable" message="Status unavailable right now." />
        ) : (
          <ModelHealth health={health} />
        )}
      </section>

      <section className="bg-white border rounded p-4">
        <h3 className="font-semibold text-slate-700 mb-2">📊 Reports</h3>
        <div className="flex flex-wrap gap-2">
          {[['sales/csv', 'Sales CSV'], ['sales/pdf', 'Sales PDF'], ['inventory/csv', 'Inventory CSV'], ['inventory/pdf', 'Inventory PDF']].map(([path, label]) => (
            <button
              key={path}
              onClick={() => downloadFile(`/reports/${path}`, label.replace(' ', '-').toLowerCase()+'-report')}
              className="px-3 py-1.5 rounded border text-sm text-slate-700 hover:bg-slate-50"
            >
              {label} ⬇
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-700">🎟️ Coupons</h3>
          {couponMsg && <span className="text-xs text-slate-600">{couponMsg}</span>}
        </div>
        <form onSubmit={createCoupon} className="bg-white border rounded p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <input required placeholder="Code (e.g. SAVE10)" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} className="border rounded px-2 py-1.5 text-sm" />
          <input placeholder="Description" value={couponForm.description} onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })} className="border rounded px-2 py-1.5 text-sm" />
          <select value={couponForm.discount_type} onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })} className="border rounded px-2 py-1.5 text-sm bg-white">
            <option value="percent">Percent %</option>
            <option value="flat">Flat ₹</option>
          </select>
          <input required type="number" step="0.01" min="0" placeholder={couponForm.discount_type === 'percent' ? 'Percent off' : 'Amount off'} value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: Number(e.target.value) })} className="border rounded px-2 py-1.5 text-sm" />
          <input type="number" min="0" placeholder="Min order value" value={couponForm.min_order_value} onChange={(e) => setCouponForm({ ...couponForm, min_order_value: Number(e.target.value) })} className="border rounded px-2 py-1.5 text-sm" />
          <input type="number" min="0" placeholder="Max discount (percent: cap ₹)" value={couponForm.max_discount} onChange={(e) => setCouponForm({ ...couponForm, max_discount: Number(e.target.value) })} className="border rounded px-2 py-1.5 text-sm" />
          <input type="number" min="0" placeholder="Usage limit" value={couponForm.usage_limit} onChange={(e) => setCouponForm({ ...couponForm, usage_limit: Number(e.target.value) })} className="border rounded px-2 py-1.5 text-sm" />
          <button className="bg-emerald-600 text-white text-sm px-3 py-1.5 rounded hover:bg-emerald-700">Create</button>
        </form>
        {coupons.length === 0 ? (
          <EmptyState icon="🎟️" title="No coupons yet" message="Create one to start offering discounts." />
        ) : (
          <table className="w-full text-sm bg-white border rounded">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left">Code</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Value</th>
                <th className="p-2 text-left">Min order</th>
                <th className="p-2 text-left">Max disc</th>
                <th className="p-2 text-left">Used/Limit</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-2 font-medium">{c.code}</td>
                  <td className="p-2">{c.discount_type}</td>
                  <td className="p-2">{c.discount_type === 'percent' ? `${Number(c.discount_value)}%` : `₹${Number(c.discount_value)}`}</td>
                  <td className="p-2">{Number(c.min_order_value)}</td>
                  <td className="p-2">{c.max_discount == null ? '—' : `₹${c.max_discount}`}</td>
                  <td className="p-2">{c.used_count}/{c.usage_limit ?? '∞'}</td>
                  <td className="p-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                      {c.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="p-2 flex gap-2">
                    <button onClick={() => toggleCoupon(c.id)} className="text-xs text-slate-600 hover:underline">{c.active ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => deleteCoupon(c.id)} className="text-xs text-rose-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-700">📜 Audit Log</h3>
            <span className="text-xs text-slate-400">{auditTotal} event{auditTotal === 1 ? '' : 's'}</span>
          </div>
          <select
            value={auditFilter}
            onChange={(e) => setAuditFilter(e.target.value)}
            className="border rounded px-2 py-1.5 text-xs bg-white"
            aria-label="Filter audit log by action"
          >
            {AUDIT_ACTIONS.map((a) => (
              <option key={a || 'all'} value={a}>{a || 'All actions'}</option>
            ))}
          </select>
        </div>
        {auditLoading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : audit.length === 0 ? (
          <EmptyState icon="📜" title="No audit events yet" message="Admin actions (coupon/product/order/model) appear here." />
        ) : (
          <div className="bg-white border rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left">When</th>
                  <th className="p-2 text-left">Actor</th>
                  <th className="p-2 text-left">Role</th>
                  <th className="p-2 text-left">Action</th>
                  <th className="p-2 text-left">Entity</th>
                  <th className="p-2 text-left">Details</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-2 whitespace-nowrap text-slate-500">{fmtDate(e.created_at)}</td>
                    <td className="p-2">{e.actor_name || `#${e.actor_id}`}</td>
                    <td className="p-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{e.actor_role}</span>
                    </td>
                    <td className="p-2 font-mono text-[12px] text-slate-700">{e.action}</td>
                    <td className="p-2">{e.entity_type}{e.entity_id != null ? ` #${e.entity_id}` : ' —'}</td>
                    <td className="p-2 text-slate-500 text-[12px]">{JSON.stringify(e.details || {})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {auditPages > 1 && (
              <div className="p-3">
                <Pagination page={auditPage} totalPages={auditPages} onPageChange={loadAudit} />
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border rounded p-4">
          <h3 className="font-semibold text-slate-700 mb-2">Revenue by Retailer</h3>
          {data.byRetailer.length === 0 ? (
            <EmptyState icon="📊" title="No revenue yet" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.byRetailer}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="store_name" tick={{ fontSize: 9 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#059669" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border rounded p-4">
          <h3 className="font-semibold text-slate-700 mb-2">Users by Role</h3>
          {data.userCounts.length === 0 ? (
            <EmptyState icon="👥" title="No users yet" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={data.userCounts} dataKey="count" nameKey="role" outerRadius={90} label>
                  {data.userCounts.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <section>
        <h3 className="font-semibold text-slate-700 mb-2">Top Products (Platform-wide)</h3>
        {data.topProductsPlatform.length === 0 ? (
          <EmptyState icon="🏆" title="No product sales yet" />
        ) : (
          <table className="w-full text-sm bg-white border rounded">
            <thead className="bg-slate-100">
              <tr><th className="p-2 text-left">Product</th><th className="p-2 text-left">Units Sold</th><th className="p-2 text-left">Revenue</th></tr>
            </thead>
            <tbody>
              {data.topProductsPlatform.map((p, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">{p.name}</td>
                  <td className="p-2">{p.units_sold}</td>
                  <td className="p-2">₹{p.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function MetricChip({ label, value, fresh }) {
  return (
    <div className="rounded border p-3 bg-slate-50">
      <p className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
      {fresh != null && (
        <p className={`text-[11px] ${fresh ? 'text-emerald-600' : 'text-amber-600'}`}>{fresh ? '● fresh' : `● retrain due`}</p>
      )}
    </div>
  );
}

function ModelHealth({ health }) {
  const { recommend, demand, max_age_seconds } = health;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Recommendations</p>
        <div className="grid grid-cols-2 gap-2">
          <MetricChip label="Precision@k" value={recommend.metrics?.precision_at_k ?? '—'} fresh={recommend.fresh} />
          <MetricChip label="Eval customers" value={recommend.metrics?.eval_customers ?? '—'} />
          <MetricChip label="Trained at" value={fmtAgo(recommend.age_seconds)} fresh={recommend.fresh} />
          <MetricChip label="Customers/Products" value={`${recommend.meta?.customers ?? '—'}/${recommend.meta?.products ?? '—'}`} />
        </div>
      </div>
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Demand Forecasts</p>
        <div className="grid grid-cols-2 gap-2">
          <MetricChip label="Models (retailers)" value={demand.models.length} />
          <MetricChip label="MAE (units)" value={demand.models[0]?.metrics?.mae ?? '—'} fresh={demand.models[0]?.fresh} />
          <MetricChip label="Trained at" value={fmtAgo(demand.models[0]?.age_seconds)} fresh={demand.models[0]?.fresh} />
          <MetricChip label="Freshness TTL" value={`${(max_age_seconds || 43200) / 3600}h`} />
        </div>
        {demand.models.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {demand.models.map((m) => (
              <span key={m.retailer_id} className={`text-[11px] px-2 py-0.5 rounded-full border ${m.fresh ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                store #{m.retailer_id} · MAE {m.metrics?.mae ?? '—'} · {fmtAgo(m.age_seconds)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => <Skeleton key={i} className="h-64" />)}
      </div>
      <SkeletonTable rows={5} cols={3} />
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white border rounded p-4 text-center">
      <p className="text-slate-400 text-xs">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}
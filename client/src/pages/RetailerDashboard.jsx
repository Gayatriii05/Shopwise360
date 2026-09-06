import { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import api, { downloadFile } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import OrderTimeline, { StatusBadge } from '../components/OrderTimeline';
import EmptyState from '../components/EmptyState';
import { Skeleton, SkeletonTable } from '../components/Skeleton';

const COLORS = ['#0f172a', '#059669', '#f59e0b', '#dc2626', '#6366f1'];
const NEXT_STATUS = { pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' };

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
      setOrderMsg(err.response?.data?.error || 'Failed to load dashboard');
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
      setOrderMsg(err.response?.data?.error || 'Failed to update order');
    }
  };

  if (authLoading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-28 w-full" /></div>;
  if (!retailerId) return <EmptyState icon="🏬" title="No store linked to your account" message="Contact your admin to link a retailer profile." />;
  if (loading && !summary) return <DashboardLoading />;

  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Retailer Dashboard</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {[['sales/csv', 'Sales CSV'], ['sales/pdf', 'Sales PDF'], ['inventory/csv', 'Inv CSV'], ['inventory/pdf', 'Inv PDF']].map(([path, label]) => (
              <button
                key={path}
                onClick={() => downloadFile(`/reports/${path}`, label.replace(/\s/g, '-').toLowerCase())}
                className="px-2.5 py-1.5 rounded border text-xs text-slate-700 hover:bg-slate-50"
                title={`Download ${label}`}
              >
                {label} ⬇
              </button>
            ))}
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${connected ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            {connected ? 'Live' : 'Offline'}
          </span>
          {user && <p className="text-sm text-slate-500">{user.retailer?.store_name} · {user.retailer?.location}</p>}
        </div>
      </div>
      {orderMsg && <div className="p-3 rounded text-sm bg-red-50 text-red-600 border border-red-200">{orderMsg}</div>}
      {liveToast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg animate-pulse max-w-xs">
          {liveToast}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Revenue" value={`₹${summary.totals.total_revenue}`} />
        <StatCard label="Total Profit" value={`₹${summary.totals.total_profit}`} />
        <StatCard label="Total Orders" value={summary.totals.total_orders} />
      </div>

      {summary.lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <h3 className="font-semibold text-red-700 mb-2">⚠ {summary.lowStock.length} Low Stock Alert{summary.lowStock.length > 1 ? 's' : ''}</h3>
          <ul className="text-sm text-red-600 list-disc pl-5">
            {summary.lowStock.map((i, idx) => (
              <li key={idx}>{i.name}: {i.quantity} left (threshold {i.low_stock_threshold})</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border rounded p-4">
          <h3 className="font-semibold text-slate-700 mb-2">Daily Sales (30 days)</h3>
          {summary.dailySales.length === 0 ? (
            <EmptyState icon="📉" title="No sales data" message="Sales will appear once orders come in." />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={summary.dailySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#059669" name="Revenue" />
                <Line type="monotone" dataKey="profit" stroke="#0f172a" name="Profit" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border rounded p-4">
          <h3 className="font-semibold text-slate-700 mb-2">Top Products</h3>
          {summary.topProducts.length === 0 ? (
            <EmptyState icon="🏆" title="No products sold yet" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={summary.topProducts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="units_sold" fill="#059669" name="Units Sold" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border rounded p-4">
          <h3 className="font-semibold text-slate-700 mb-2">Revenue by Category</h3>
          {summary.categoryBreakdown.length === 0 ? (
            <EmptyState icon="📊" title="No category data" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={summary.categoryBreakdown} dataKey="revenue" nameKey="category" outerRadius={90} label>
                  {summary.categoryBreakdown.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border rounded p-4">
          <h3 className="font-semibold text-slate-700 mb-2">7-Day Demand Forecast (ML)</h3>
          {predictions.length === 0 ? (
            <EmptyState icon="🔮" title="No forecast available" message="Forecasts appear once there is sales history." />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={predictions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="predicted_demand" fill="#6366f1" name="Predicted Units" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-700">Orders</h3>
          {pendingCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">{pendingCount} pending</span>
          )}
        </div>
        {loading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : orders.length === 0 ? (
          <EmptyState icon="📦" title="No orders yet" message="New orders will appear here in real time." />
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="bg-white border rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="text-sm">
                    <span className="font-medium text-slate-800">Order #{o.id}</span>
                    <span className="text-slate-400 text-xs ml-2">{new Date(o.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-600">₹{o.total_amount}</span>
                    <StatusBadge status={o.status} />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  {o.customer_name} ({o.customer_email})
                </p>
                <OrderTimeline status={o.status} />
                <div className="mt-3 flex flex-wrap gap-2">
                  {o.items?.map((it) => (
                    <span key={it.product_id} className="text-xs bg-slate-100 px-2 py-1 rounded">
                      {it.name} × {it.quantity} @ ₹{it.unit_price}
                    </span>
                  ))}
                </div>
                {NEXT_STATUS[o.status] && (
                  <button
                    onClick={() => advanceStatus(o.id, NEXT_STATUS[o.status])}
                    className="mt-3 bg-slate-900 text-white text-xs px-3 py-1.5 rounded hover:bg-slate-800"
                  >
                    Mark as {NEXT_STATUS[o.status]}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-semibold text-slate-700 mb-2">Inventory Management</h3>
        {loading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : inventory.length === 0 ? (
          <EmptyState icon="📦" title="No inventory" message="Add products to your store inventory." />
        ) : (
          <table className="w-full text-sm bg-white border rounded">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-left">Category</th>
                <th className="p-2 text-left">Qty</th>
                <th className="p-2 text-left">Threshold</th>
                <th className="p-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((i) => (
                <InventoryRow key={i.id} item={i} onUpdate={updateStock} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64" />)}
      </div>
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

function InventoryRow({ item, onUpdate }) {
  const [qty, setQty] = useState(item.quantity);
  const [threshold, setThreshold] = useState(item.low_stock_threshold);

  return (
    <tr className="border-t">
      <td className="p-2">{item.name}</td>
      <td className="p-2">{item.category}</td>
      <td className="p-2">
        <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))}
          className="w-16 border rounded px-1" />
      </td>
      <td className="p-2">
        <input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}
          className="w-16 border rounded px-1" />
      </td>
      <td className="p-2">
        <button onClick={() => onUpdate(item.id, qty, threshold)} className="bg-slate-900 text-white text-xs px-3 py-1 rounded">
          Save
        </button>
      </td>
    </tr>
  );
}
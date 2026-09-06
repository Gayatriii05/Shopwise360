import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';
import { Skeleton, SkeletonTable } from '../components/Skeleton';
import SupplierProducts from '../components/SupplierProducts';

export default function SupplierDashboard() {
  const { user, loading: authLoading } = useAuth();
  const supplierId = user?.supplier?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analytics');

  useEffect(() => {
    if (!authLoading && supplierId) {
      setLoading(true);
      api.get(`/dashboard/supplier/${supplierId}/summary`)
        .then(({ data }) => setData(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, supplierId]);

  if (authLoading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-72 w-full" /></div>;
  if (!supplierId) return <EmptyState icon="🏭" title="No supplier profile linked" message="Contact your admin to link a supplier profile." />;
  if (loading) return <SupplierLoading />;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Supplier Dashboard</h1>
        {user && <p className="text-sm text-slate-500">{user.supplier?.company_name}</p>}
      </div>

      <div className="flex gap-2 border-b">
        {[['analytics', '📊 Analytics'], ['products', '🏷️ Products']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === key ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'analytics' && (
        <>
          <div className="bg-white border rounded p-4">
            <h3 className="font-semibold text-slate-700 mb-2">Product Performance</h3>
            {data.productPerformance.length === 0 ? (
              <EmptyState icon="📊" title="No product performance data" message="Your products' sales will appear here once they are sold." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.productPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#059669" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <section>
            <h3 className="font-semibold text-slate-700 mb-2">Stock Across Retailers</h3>
            {data.stockAcrossRetailers.length === 0 ? (
              <EmptyState icon="🏬" title="No stock records" message="Retailers have not stocked your products yet." />
            ) : (
              <table className="w-full text-sm bg-white border rounded">
                <thead className="bg-slate-100">
                  <tr><th className="p-2 text-left">Product</th><th className="p-2 text-left">Retailer</th><th className="p-2 text-left">Qty</th></tr>
                </thead>
                <tbody>
                  {data.stockAcrossRetailers.map((r, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{r.name}</td>
                      <td className="p-2">{r.store_name}</td>
                      <td className="p-2">{r.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {activeTab === 'products' && <SupplierProducts supplierId={supplierId} />}
    </div>
  );
}

function SupplierLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-72 w-full" />
      <SkeletonTable rows={4} cols={3} />
    </div>
  );
}
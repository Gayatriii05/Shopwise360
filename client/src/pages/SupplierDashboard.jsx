import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';
import { Skeleton, SkeletonTable } from '../components/Skeleton';
import ChartTooltip from '../components/ChartTooltip';
import { FadeIn } from '../components/Reveal';
import SupplierProducts from '../components/SupplierProducts';
import { FactoryIcon, BarChartIcon, PackageIcon } from '../components/Icons';

const AXIS = { stroke: 'none', tick: { fontSize: 10, fill: '#786F97' }, axisLine: false, tickLine: false };
const GRID = '#7A5CC414';
const inr = (v) => `₹${Number(v).toLocaleString('en-IN')}`;

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
  if (!supplierId) {
    return (
      <EmptyState
        icon="🏭"
        title="No Supplier Profile Linked"
        message="Your account currently doesn't have an associated supplier profile. Please contact an administrator."
      />
    );
  }
  if (loading) return <SupplierLoading />;

  return (
    <div className="space-y-8 pb-12">
      {/* Header Bar */}
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card rounded-2xl border border-cream-300/70 shadow-elevated p-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center shadow-glow-coral">
              <FactoryIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-cream-900 tracking-tight">
                  {user?.supplier?.company_name || 'Supplier Dashboard'}
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  Supplier
                </span>
              </div>
              <p className="text-xs text-cream-500 mt-0.5">
                Product line distribution, sales performance, and catalog inventory control
              </p>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Tabs Navigation */}
      <FadeIn>
        <div className="flex gap-2 p-1.5 bg-cream-100 border border-cream-300/70 rounded-2xl max-w-xs">
          {[
            { key: 'analytics', label: 'Analytics & Stock', icon: BarChartIcon },
            { key: 'products', label: 'Product Catalog', icon: PackageIcon }
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-amber-500 text-white shadow-glow-coral'
                    : 'text-cream-600 hover:text-cream-900 hover:bg-cream-50'
                }`}
              >
                <TabIcon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-cream-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </FadeIn>

      {/* TAB 1: ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Revenue Performance Chart */}
          <FadeIn>
            <div className="glass-card rounded-2xl border border-cream-300/70 shadow-subtle p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-cream-900">Product Revenue Performance</h3>
                  <p className="text-xs text-cream-500">Total sales volume achieved across all retail partners</p>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Live Sales
                </span>
              </div>

              {data?.productPerformance?.length === 0 ? (
                <EmptyState
                  icon="📊"
                  title="No product performance data"
                  message="Sales revenue from retailers will appear here once orders are fulfilled."
                />
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.productPerformance} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                      <XAxis dataKey="name" {...AXIS} />
                      <YAxis {...AXIS} />
                      <Tooltip content={<ChartTooltip format={inr} />} cursor={{ fill: '#7A5CC410' }} />
                      <Bar dataKey="revenue" fill="#C97354" radius={[3, 3, 0, 0]} name="Gross Revenue (₹)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </FadeIn>

          {/* Stock Across Retailers Table */}
          <section className="space-y-4">
            <FadeIn>
              <div>
                <h3 className="font-bold text-cream-900 text-sm sm:text-base">Stock Held Across Retailers</h3>
                <p className="text-xs text-cream-500">Current quantities of your products stocked in retail storefronts</p>
              </div>
            </FadeIn>

            {data?.stockAcrossRetailers?.length === 0 ? (
              <EmptyState
                icon="🏬"
                title="No retailer stock records"
                message="Retail stores have not stocked your products in inventory yet."
              />
            ) : (
              <div className="glass-card rounded-2xl border border-cream-300/70 shadow-subtle overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm text-left">
                    <thead className="bg-cream-100 border-b border-cream-300/70 text-cream-500 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3.5 sm:p-4">Product Name</th>
                        <th className="p-3.5 sm:p-4">Retailer Store</th>
                        <th className="p-3.5 sm:p-4">Quantity Available</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cream-300/60 font-medium">
                      {data?.stockAcrossRetailers?.map((r, idx) => (
                        <tr key={idx} className="hover:bg-cream-50 transition-colors">
                          <td className="p-3.5 sm:p-4 font-bold text-cream-900">{r.name}</td>
                          <td className="p-3.5 sm:p-4 text-cream-700">{r.store_name}</td>
                          <td className="p-3.5 sm:p-4">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {r.quantity} units
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: PRODUCTS */}
      {activeTab === 'products' && (
        <div className="animate-fadeIn">
          <SupplierProducts supplierId={supplierId} />
        </div>
      )}
    </div>
  );
}

function SupplierLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-12 w-72 rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
      <SkeletonTable rows={4} cols={3} />
    </div>
  );
}
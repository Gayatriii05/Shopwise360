import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Factory, BarChart3, Package, TrendingUp, Layers, Store as StoreIcon, Trophy } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';
import { Skeleton, SkeletonStats, SkeletonTable } from '../components/Skeleton';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import DataTable from '../components/DataTable';
import { GradientBarChart, SERIES_COLORS } from '../components/charts';
import { FadeIn } from '../components/Reveal';
import { TextGenerateEffect } from '../components/ui/text-generate-effect';
import { GlowingStarsBackgroundCard, GlowingStarsTitle, GlowingStarsDescription } from '../components/ui/glowing-stars';
import { Badge } from '../components/ui/badge';
import { EASE } from '../lib/motion';
import SupplierProducts from '../components/SupplierProducts';

const inr = (v) => `₹${Number(v).toLocaleString('en-IN')}`;
const count = (v) => Number(v).toLocaleString('en-IN');

const TABS = [
  { key: 'analytics', label: 'Analytics & Stock', icon: BarChart3 },
  { key: 'products', label: 'Product Catalog', icon: Package },
];

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

  if (authLoading) return <div className="space-y-4 p-6"><Skeleton className="h-8 w-64 rounded-lg" /><Skeleton className="h-72 w-full rounded-2xl" /></div>;
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

  const performance = data?.productPerformance || [];
  const stockRows = data?.stockAcrossRetailers || [];
  const totalRevenue = performance.reduce((a, p) => a + Number(p.revenue || 0), 0);
  const totalUnits = performance.reduce((a, p) => a + Number(p.units_sold || 0), 0);

  return (
    <div className="space-y-8 pb-14">
      {/* Header Bar */}
      <FadeIn y={12}>
        <GlowingStarsBackgroundCard>
          <div className="relative flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 via-pink-500 to-orange-400 font-extrabold text-white shadow-glow-brand">
                <Factory className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                    <TextGenerateEffect words={user?.supplier?.company_name || 'Supplier Dashboard'} className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl" />
                  </h1>
                  <Badge variant="secondary" className="rounded-full border border-amber-400/40 bg-amber-500/12 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                    Supplier
                  </Badge>
                </div>
                <GlowingStarsDescription className="mt-0.5 !text-xs">
                  Product line distribution, sales performance, and catalog inventory control
                </GlowingStarsDescription>
              </div>
            </div>

            <div className="relative flex flex-wrap items-center gap-2.5">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white/70 px-3.5 py-2 backdrop-blur-sm">
                <span className="grid size-7 place-items-center rounded-lg bg-amber-500/15 text-amber-700 ring-1 ring-amber-400/40">
                  <StoreIcon className="size-3.5" />
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Supplying <strong className="text-foreground">{performance.length}</strong> products across{' '}
                  <strong className="text-foreground">{stockRows.length}</strong> retail locations
                </span>
              </div>
            </div>
          </div>
        </GlowingStarsBackgroundCard>
      </FadeIn>

      {/* Tabs Navigation */}
      <FadeIn>
        <div className="inline-flex rounded-2xl border border-border bg-muted/60 p-1">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors ${
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="supplier-tab-pill"
                    transition={{ duration: 0.35, ease: EASE }}
                    className="absolute inset-0 rounded-xl bg-card shadow-sm ring-1 ring-border"
                  />
                )}
                <TabIcon className={`relative size-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="relative">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </FadeIn>

      {/* TAB 1: ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fadeIn">
          {/* KPI Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Gross Revenue"
              value={totalRevenue}
              prefix="₹"
              icon={TrendingUp}
              accent="primary"
              hint="Summed across all retail partners"
              delay={0}
            />
            <StatCard
              label="Units Sold"
              value={totalUnits}
              icon={Trophy}
              accent="emerald"
              hint="Volume from sales transactions"
              delay={0.05}
            />
            <StatCard
              label="Products on Offer"
              value={performance.length}
              icon={Layers}
              accent="cyan"
              hint="Catalog items with tracked sales"
              delay={0.1}
            />
            <StatCard
              label="Stock Records"
              value={stockRows.length}
              icon={StoreIcon}
              accent="amber"
              hint="Product quantities across storefronts"
              delay={0.15}
            />
          </div>

          {/* Revenue Performance Chart */}
          <FadeIn delay={0.05}>
            <ChartCard
              title="Product Revenue Performance"
              subtitle="Total sales volume achieved across all retail partners"
              icon={BarChart3}
              right={
                <Badge variant="outline" className="rounded-full border-emerald-400/40 bg-emerald-500/10 text-[10px] font-bold text-emerald-700">
                  <span className="status-dot size-1.5 bg-emerald-500 text-emerald-500" />
                  Live Sales
                </Badge>
              }
            >
              {performance.length === 0 ? (
                <EmptyState
                  icon="📊"
                  title="No product performance data"
                  message="Sales revenue from retailers will appear here once orders are fulfilled."
                />
              ) : (
                <GradientBarChart
                  data={performance}
                  xKey="name"
                  valueFormatter={inr}
                  height={280}
                  series={[{ key: 'revenue', label: 'Gross Revenue (₹)', color: SERIES_COLORS[2] }]}
                  interval={0}
                />
              )}
            </ChartCard>
          </FadeIn>

          {/* Stock Across Retailers Table */}
          <section className="space-y-4">
            <FadeIn delay={0.05}>
              <div>
                <h3 className="text-base font-bold tracking-tight text-foreground sm:text-lg">Stock Held Across Retailers</h3>
                <p className="text-xs text-muted-foreground">Current quantities of your products stocked in retail storefronts</p>
              </div>
            </FadeIn>

            {stockRows.length === 0 ? (
              <EmptyState
                icon="🏬"
                title="No retailer stock records"
                message="Retail stores have not stocked your products in inventory yet."
              />
            ) : (
              <DataTable
                rows={stockRows}
                rowKey={(r, i) => `${r.name}-${r.store_name}-${i}`}
                searchable
                searchKeys={['name', 'store_name']}
                searchPlaceholder="Search product or store…"
                pageSize={8}
                columns={[
                  {
                    key: 'name',
                    header: 'Product Name',
                    sortable: true,
                    render: (r) => <span className="font-bold text-foreground">{r.name}</span>,
                  },
                  {
                    key: 'store_name',
                    header: 'Retailer Store',
                    sortable: true,
                    render: (r) => <span className="text-muted-foreground">{r.store_name}</span>,
                  },
                  {
                    key: 'quantity',
                    header: 'Quantity Available',
                    align: 'right',
                    sortable: true,
                    render: (r) => (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/12 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                        <span className="status-dot size-1.5 bg-emerald-500 text-emerald-500" />
                        {r.quantity} units
                      </span>
                    ),
                  },
                ]}
              />
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
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-3xl" />
      <SkeletonStats count={4} />
      <Skeleton className="h-80 w-full rounded-2xl" />
      <SkeletonTable rows={4} cols={3} />
    </div>
  );
}
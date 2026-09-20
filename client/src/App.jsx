import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import AmbientBackground from './components/AmbientBackground';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ProductDetail from './pages/ProductDetail';
import CustomerDashboard from './pages/CustomerDashboard';
import RetailerDashboard from './pages/RetailerDashboard';
import SupplierDashboard from './pages/SupplierDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { PageTransition } from './components/Reveal';
import { ArrowLeftIcon } from './components/Icons';

function NotFound() {
  return (
    <div className="relative flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)]" />
      <div className="glass-strong relative mb-5 grid size-20 place-items-center rounded-2xl">
        <span className="text-gradient text-2xl font-black tracking-tight">404</span>
      </div>
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-foreground">Page not found</h1>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground text-balance">
        The page you are looking for may have been moved, renamed, or is temporarily unavailable.
      </p>
      <Link
        to="/"
        className="group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-extrabold text-primary-foreground shadow-glow-brand transition-all hover:-translate-y-0.5 hover:brightness-110"
      >
        <ArrowLeftIcon className="size-4 transition-transform group-hover:-translate-x-0.5" />
        Back to marketplace
      </Link>
    </div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex min-h-screen flex-col font-sans text-foreground">
      <AmbientBackground />
      <Navbar />
      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={location.pathname}>
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/dashboard/customer" element={<ProtectedRoute allowedRoles={['customer']}><CustomerDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/retailer" element={<ProtectedRoute allowedRoles={['retailer']}><RetailerDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/supplier" element={<ProtectedRoute allowedRoles={['supplier']}><SupplierDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PageTransition>
        </AnimatePresence>
      </main>

      <footer className="relative z-10 mt-16 border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-[#8b5cf6] text-[11px] font-black text-primary-foreground shadow-glow-brand">
              S
            </span>
            <div>
              <p className="text-xs font-bold text-foreground">ShopWise 360</p>
              <p className="text-[11px] text-muted-foreground">© {new Date().getFullYear()} · Intelligent Retail Analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="status-dot size-1.5 bg-emerald-400 text-emerald-400" />
              All systems operational
            </span>
            <span className="text-border">·</span>
            <span>Customer</span>
            <span className="text-border">·</span>
            <span>Retailer</span>
            <span className="text-border">·</span>
            <span>Supplier</span>
            <span className="text-border">·</span>
            <span>Admin</span>
          </div>
        </div>
      </footer>
      </div>
    </MotionConfig>
  );
}

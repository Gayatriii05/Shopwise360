import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
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
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-16">
      <div className="w-20 h-20 rounded-2xl bg-cream-50 flex items-center justify-center text-3xl font-black text-violet-600 mb-4 shadow-card border border-cream-300/70">
        404
      </div>
      <h1 className="text-2xl font-extrabold text-cream-900 tracking-tight mb-2">Page Not Found</h1>
      <p className="text-sm text-cream-500 max-w-sm mb-6">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-extrabold transition-all shadow-glow-brand hover:shadow-glow-brand hover:-translate-y-0.5"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Marketplace
      </Link>
    </div>
  );
}

function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-20">
      <div className="absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-violet-100/60 via-violet-50/25 to-transparent" />
      <div className="absolute inset-x-0 border-t border-cream-300/40" />
    </div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col font-sans text-cream-800 relative">
      <AmbientBackground />
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10">
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

<footer className="relative z-10 border-t border-cream-300/60 bg-cream-50 py-6 mt-12 text-center text-xs text-cream-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-cream-600">© {new Date().getFullYear()} ShopWise 360 Inc. All rights reserved.</p>
          <div className="flex items-center gap-4 text-cream-400">
            <span>Customer</span>
            <span>•</span>
            <span>Retailer</span>
            <span>•</span>
            <span>Supplier</span>
            <span>•</span>
            <span>Admin</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
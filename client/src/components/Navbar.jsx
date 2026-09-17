import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { LogoIcon, UserIcon, ShieldIcon, StoreIcon, FactoryIcon, LogOutIcon, MenuIcon, XIcon, ArrowRightIcon } from './Icons';

const ROLE_CONFIG = {
  admin: { label: 'Admin', color: 'bg-violet-50 text-violet-700 border border-violet-200', icon: ShieldIcon },
  retailer: { label: 'Retailer', color: 'bg-sky-50 text-sky-700 border border-sky-200', icon: StoreIcon },
  supplier: { label: 'Supplier', color: 'bg-amber-50 text-amber-700 border border-amber-200', icon: FactoryIcon },
  customer: { label: 'Customer', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: UserIcon },
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const dashboardPath = user ? `/dashboard/${user.role}` : '/login';
  const roleMeta = user?.role ? (ROLE_CONFIG[user.role] || ROLE_CONFIG.customer) : null;
  const RoleIcon = roleMeta?.icon || UserIcon;

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-cream-300/70 bg-cream-100/95 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center text-white shadow-glow-brand group-hover:-translate-y-0.5 transition-transform duration-200">
              <LogoIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif font-bold text-xl tracking-tight text-cream-900 leading-none">
                ShopWise<span className="text-violet-600 ml-0.5">360</span>
              </span>
              <span className="label-micro text-[9px] mt-1">
                Retail Intelligence
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-cream-100 border border-cream-300/70 text-xs">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${roleMeta.color}`}>
                    <RoleIcon className="w-3 h-3" />
                    {roleMeta.label}
                  </span>
                  <span className="font-medium text-cream-700 max-w-[140px] truncate">{user.name}</span>
                </div>

                <Link
                  to={dashboardPath}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-cream-600 hover:text-violet-700 bg-cream-50 hover:bg-violet-50 border border-cream-300/70 hover:border-violet-200 rounded-xl transition-all shadow-subtle hover:shadow-card-hover hover:-translate-y-0.5"
                >
                  Dashboard
                  <ArrowRightIcon className="w-3 h-3" />
                </Link>

                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cream-400 hover:text-coral-600 hover:bg-coral-50 rounded-xl transition-colors"
                  title="Log out"
                >
                  <LogOutIcon className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Logout</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="px-4 py-2 text-xs font-semibold text-cream-600 hover:text-violet-700 transition-colors">
                  Sign In
                </Link>
                <Link to="/register" className="px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl shadow-glow-brand hover:shadow-glow-brand hover:-translate-y-0.5 transition-all">
                  Create Account
                </Link>
              </div>
            )}
          </div>

          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-cream-600 hover:text-violet-700 rounded-xl hover:bg-violet-50 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
className="md:hidden border-t border-cream-300/70 bg-cream-100 px-4 pt-3 pb-5 space-y-3 shadow-elevated"
          >
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-cream-300/70">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-cream-900">{user.name}</span>
                    <span className="text-xs text-cream-500">{user.email}</span>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleMeta.color}`}>
                    <RoleIcon className="w-3 h-3" />
                    {roleMeta.label}
                  </span>
                </div>

                <Link
                  to={dashboardPath}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-cream-800 bg-cream-100 hover:bg-cream-200 rounded-xl border border-cream-300/70 transition-colors"
                >
                  <span>Go to {roleMeta.label} Dashboard</span>
                  <ArrowRightIcon className="w-4 h-4" />
                </Link>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-coral-600 hover:bg-coral-50 rounded-xl transition-colors"
                >
                  <LogOutIcon className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="w-full text-center py-2.5 text-sm font-semibold text-cream-700 bg-cream-100 hover:bg-cream-200 rounded-xl border border-cream-300/70">
                  Sign In
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="w-full text-center py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl shadow-glow-brand">
                  Create Account
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
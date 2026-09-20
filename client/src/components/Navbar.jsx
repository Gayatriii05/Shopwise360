import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { LogoIcon, UserIcon, ShieldIcon, StoreIcon, FactoryIcon, LogOutIcon, MenuIcon, XIcon, ArrowRightIcon } from './Icons';

const ROLE_CONFIG = {
  admin: { label: 'Admin', color: 'bg-violet-500/10 text-violet-700 border-violet-300', dot: 'bg-violet-500', icon: ShieldIcon },
  retailer: { label: 'Retailer', color: 'bg-pink-500/10 text-pink-700 border-pink-300', dot: 'bg-pink-500', icon: StoreIcon },
  supplier: { label: 'Supplier', color: 'bg-amber-500/10 text-amber-700 border-amber-300', dot: 'bg-amber-500', icon: FactoryIcon },
  customer: { label: 'Customer', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500', icon: UserIcon },
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const dashboardPath = user ? `/dashboard/${user.role}` : '/login';
  const roleMeta = user?.role ? (ROLE_CONFIG[user.role] || ROLE_CONFIG.customer) : null;
  const RoleIcon = roleMeta?.icon || UserIcon;
  const onMarketplace = location.pathname === '/';

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/70 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="group flex items-center gap-2.5">
            <div className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#ff3d77] via-[#ff7a45] to-[#ffc145] text-primary-foreground shadow-glow-brand transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-3">
              <LogoIcon className="size-5" />
              <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold leading-none tracking-tight text-foreground">
                ShopWise<span className="text-gradient-primary ml-0.5">360</span>
              </span>
              <span className="label-micro mt-1 text-[9px]">Retail Intelligence</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link
              to="/"
              className={`relative rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${onMarketplace ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {onMarketplace && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 -z-10 rounded-lg bg-muted ring-1 ring-border"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              Marketplace
            </Link>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <>
                <div className="flex items-center gap-2.5 rounded-full border border-border bg-muted/40 py-1.5 pl-1.5 pr-3 text-xs">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-semibold ${roleMeta.color}`}>
                    <span className={`status-dot size-1.5 ${roleMeta.dot} text-current`} />
                    <RoleIcon className="size-3" />
                    {roleMeta.label}
                  </span>
                  <span className="max-w-[140px] truncate font-medium text-foreground">{user.name}</span>
                </div>

                <Link
                  to={dashboardPath}
                  className="group inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-subtle transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground hover:shadow-card-hover"
                >
                  Dashboard
                  <ArrowRightIcon className="size-3 transition-transform group-hover:translate-x-0.5" />
                </Link>

                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="Log out"
                >
                  <LogOutIcon className="size-3.5" />
                  <span className="hidden lg:inline">Logout</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow-brand transition-all hover:-translate-y-0.5 hover:brightness-110"
                >
                  Create account
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            {user && <span className={`status-dot size-2 ${roleMeta.dot} text-current`} />}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <XIcon className="size-6" /> : <MenuIcon className="size-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-border/70 bg-background/95 backdrop-blur-xl md:hidden"
          >
            <div className="space-y-3 px-4 pb-5 pt-3">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${roleMeta.color}`}>
                      <RoleIcon className="size-3" />
                      {roleMeta.label}
                    </span>
                  </div>

                  <Link
                    to={dashboardPath}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    <span>Go to {roleMeta.label} dashboard</span>
                    <ArrowRightIcon className="size-4" />
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOutIcon className="size-4" />
                    <span>Log out</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full rounded-xl border border-border bg-card py-2.5 text-center text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground shadow-glow-brand"
                  >
                    Create account
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

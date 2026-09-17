import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FadeIn } from '../components/Reveal';
import { LogoIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon, ArrowRightIcon, ShieldIcon, StoreIcon, FactoryIcon, UserIcon, AlertCircleIcon } from '../components/Icons';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@shopwise.com', icon: ShieldIcon, color: 'hover:border-violet-300 hover:bg-violet-50 text-violet-700' },
  { role: 'Retailer', email: 'retailer@shopwise.com', icon: StoreIcon, color: 'hover:border-sky-300 hover:bg-sky-50 text-sky-700' },
  { role: 'Supplier', email: 'supplier@shopwise.com', icon: FactoryIcon, color: 'hover:border-amber-300 hover:bg-amber-50 text-amber-700' },
  { role: 'Customer', email: 'customer@shopwise.com', icon: UserIcon, color: 'hover:border-emerald-300 hover:bg-emerald-50 text-emerald-700' },
];

const inputClass =
  'w-full pl-10 pr-4 py-2.5 bg-cream-50 hover:bg-cream-50 border border-cream-300 rounded-xl text-sm text-cream-800 placeholder-cream-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(`/dashboard/${user.role}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Password123');
    setError('');
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-8 px-4 sm:px-6">
      <FadeIn className="w-full max-w-md">
        <div className="glass-card rounded-2xl border border-cream-300/70 shadow-elevated p-8 sm:p-10 transition-all">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-violet-600 mx-auto flex items-center justify-center text-white shadow-glow-brand mb-3">
              <LogoIcon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-cream-900 tracking-tight">
              Welcome back
            </h1>
            <p className="text-xs sm:text-sm text-cream-500 mt-1">
              Sign in to access your ShopWise 360 workspace
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-2xl bg-coral-50 border border-coral-200 text-coral-700 text-xs flex items-center gap-2.5 animate-fadeIn">
              <AlertCircleIcon className="w-4 h-4 flex-shrink-0 text-coral-600" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-cream-600 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cream-400">
                  <MailIcon className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-cream-600 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cream-400">
                  <LockIcon className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-10`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-cream-400 hover:text-cream-700 focus:outline-none"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold py-2.5 px-4 rounded-xl text-sm shadow-glow-brand hover:shadow-glow-brand hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRightIcon className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-cream-300/70">
            <p className="text-[11px] font-bold uppercase tracking-wider text-cream-400 text-center mb-2.5">
              Quick-Fill Demo Accounts
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const AccIcon = acc.icon;
                return (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => fillDemo(acc.email)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-cream-300/70 bg-cream-50 text-xs font-semibold text-cream-600 transition-all hover:-translate-y-0.5 hover:shadow-subtle ${acc.color}`}
                  >
                    <AccIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{acc.role}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-cream-400 text-center mt-2">
              Password: <code className="bg-cream-100 px-1 py-0.5 rounded font-mono text-cream-700">Password123</code>
            </p>
          </div>

          <p className="text-center text-xs text-cream-500 mt-6">
            Don't have an account yet?{' '}
            <Link to="/register" className="font-bold text-violet-700 hover:text-violet-600 hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </FadeIn>
    </div>
  );
}
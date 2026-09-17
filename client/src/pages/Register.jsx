import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FadeIn } from '../components/Reveal';
import { LogoIcon, UserIcon, MailIcon, LockIcon, ShieldIcon, StoreIcon, FactoryIcon, ArrowRightIcon, AlertCircleIcon } from '../components/Icons';

const ROLE_OPTIONS = [
  { id: 'customer', label: 'Customer', desc: 'Shop products & review', icon: UserIcon, active: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  { id: 'retailer', label: 'Retailer', desc: 'Manage stock & orders', icon: StoreIcon, active: 'border-sky-300 bg-sky-50 text-sky-800' },
  { id: 'supplier', label: 'Supplier', desc: 'Catalog & performance', icon: FactoryIcon, active: 'border-amber-300 bg-amber-50 text-amber-800' },
  { id: 'admin', label: 'Admin', desc: 'Full analytics & control', icon: ShieldIcon, active: 'border-violet-300 bg-violet-50 text-violet-800' },
];

const inputClass =
  'w-full pl-10 pr-4 py-2.5 bg-cream-50 hover:bg-cream-50 border border-cream-300 rounded-xl text-sm text-cream-800 placeholder-cream-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register(form);
      navigate(`/dashboard/${user.role}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-8 px-4 sm:px-6">
      <FadeIn className="w-full max-w-lg">
        <div className="glass-card rounded-2xl border border-cream-300/70 shadow-elevated p-8 sm:p-10 transition-all">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-violet-600 mx-auto flex items-center justify-center text-white shadow-glow-brand mb-3">
              <LogoIcon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-cream-900 tracking-tight">
              Create an Account
            </h1>
            <p className="text-xs sm:text-sm text-cream-500 mt-1">
              Join ShopWise 360 to start shopping, selling, or analyzing
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
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cream-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  name="name"
                  placeholder="Jane Doe"
                  value={form.name}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-cream-600 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cream-400">
                  <MailIcon className="w-4 h-4" />
                </div>
                <input
                  name="email"
                  type="email"
                  placeholder="jane@example.com"
                  value={form.email}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-cream-600 uppercase tracking-wider mb-1.5">
                Password (min 6 characters)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cream-400">
                  <LockIcon className="w-4 h-4" />
                </div>
                <input
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  className={inputClass}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-cream-600 uppercase tracking-wider mb-2">
                Select Your Role
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {ROLE_OPTIONS.map((opt) => {
                  const RoleOptIcon = opt.icon;
                  const isSelected = form.role === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className={`cursor-pointer rounded-2xl border p-3 flex flex-col items-start gap-1.5 transition-all hover:-translate-y-0.5 hover:shadow-card ${
                        isSelected
                          ? `${opt.active} shadow-subtle`
                          : 'border-cream-300/70 bg-cream-50 hover:bg-cream-100 text-cream-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={opt.id}
                        checked={isSelected}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-2">
                        <RoleOptIcon className={`w-4 h-4 ${isSelected ? 'text-current' : 'text-cream-400'}`} />
                        <span className="font-bold text-xs">{opt.label}</span>
                      </div>
                      <span className={`text-[10px] leading-tight ${isSelected ? 'opacity-70' : 'text-cream-400'}`}>
                        {opt.desc}
                      </span>
                    </label>
                  );
                })}
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
                  Creating account...
                </span>
              ) : (
                <>
                  <span>Create account</span>
                  <ArrowRightIcon className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-cream-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-violet-700 hover:text-violet-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </FadeIn>
    </div>
  );
}
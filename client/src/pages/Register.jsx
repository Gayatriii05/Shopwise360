import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FadeIn } from '../components/Reveal';
import { TextGenerateEffect } from '../components/ui/text-generate-effect';
import { LogoIcon, UserIcon, MailIcon, LockIcon, ShieldIcon, StoreIcon, FactoryIcon, ArrowRightIcon, AlertCircleIcon } from '../components/Icons';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const ROLE_OPTIONS = [
  { id: 'customer', label: 'Customer', desc: 'Shop products & review', icon: UserIcon, active: 'border-emerald-400/60 bg-emerald-500/10 text-emerald-700' },
  { id: 'retailer', label: 'Retailer', desc: 'Manage stock & orders', icon: StoreIcon, active: 'border-pink-400/60 bg-pink-500/10 text-pink-700' },
  { id: 'supplier', label: 'Supplier', desc: 'Catalog & performance', icon: FactoryIcon, active: 'border-amber-400/60 bg-amber-500/10 text-amber-700' },
  { id: 'admin', label: 'Admin', desc: 'Full analytics & control', icon: ShieldIcon, active: 'border-violet-400/60 bg-violet-500/10 text-violet-700' },
];

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
        <Card className="gap-0 py-0 shadow-elevated ring-border/70">
          <CardContent className="p-8 sm:p-10">
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#c4b5fd] to-[#a7d8b8] mx-auto flex items-center justify-center text-primary-foreground shadow-glow-brand mb-3">
                <LogoIcon className="w-6 h-6 text-white" />
              </div>
              <TextGenerateEffect words="Create an Account" className="text-2xl font-extrabold tracking-tight text-foreground" />
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Join ShopWise 360 to start shopping, selling, or analyzing
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3.5 rounded-2xl bg-destructive/10 border border-destructive/25 text-destructive text-xs flex items-center gap-2.5 animate-fadeIn">
                <AlertCircleIcon className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Full Name
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Jane Doe"
                    value={form.name}
                    onChange={handleChange}
                    className="h-11 rounded-xl pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Email Address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <MailIcon className="w-4 h-4" />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="jane@example.com"
                    value={form.email}
                    onChange={handleChange}
                    className="h-11 rounded-xl pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Password (min 6 characters)
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <LockIcon className="w-4 h-4" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    className="h-11 rounded-xl pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div>
                <Label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Select Your Role
                </Label>
                <div className="grid grid-cols-2 gap-2.5">
                  {ROLE_OPTIONS.map((opt) => {
                    const RoleOptIcon = opt.icon;
                    const isSelected = form.role === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={`cursor-pointer rounded-2xl border p-3 flex flex-col items-start gap-1.5 transition-all hover:-translate-y-0.5 hover:shadow-elevated ${
                          isSelected
                            ? `${opt.active} ring-2 ring-primary/25 shadow-subtle`
                            : 'border-border bg-card hover:bg-muted text-muted-foreground'
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
                          <RoleOptIcon className={`w-4 h-4 ${isSelected ? 'text-current' : 'text-muted-foreground'}`} />
                          <span className="font-bold text-xs">{opt.label}</span>
                        </div>
                        <span className={`text-[10px] leading-tight ${isSelected ? 'opacity-70' : 'text-muted-foreground/80'}`}>
                          {opt.desc}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 h-11 w-full rounded-xl text-sm font-bold shadow-glow-brand hover:shadow-glow-brand hover:brightness-110"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  <>
                    <span>Create account</span>
                    <ArrowRightIcon className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground mt-6">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-primary hover:text-primary/80 hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
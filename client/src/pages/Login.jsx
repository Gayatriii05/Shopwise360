import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FadeIn } from '../components/Reveal';
import { TextGenerateEffect } from '../components/ui/text-generate-effect';
import { LogoIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon, ArrowRightIcon, ShieldIcon, StoreIcon, FactoryIcon, UserIcon, AlertCircleIcon } from '../components/Icons';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@shopwise.com', icon: ShieldIcon, color: 'text-violet-600' },
  { role: 'Retailer', email: 'retailer@shopwise.com', icon: StoreIcon, color: 'text-pink-600' },
  { role: 'Supplier', email: 'supplier@shopwise.com', icon: FactoryIcon, color: 'text-amber-600' },
  { role: 'Customer', email: 'customer@shopwise.com', icon: UserIcon, color: 'text-emerald-600' },
];

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
        <Card className="gap-0 py-0 shadow-elevated ring-border/70">
          <CardContent className="p-8 sm:p-10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#c4b5fd] to-[#a7d8b8] mx-auto flex items-center justify-center text-primary-foreground shadow-glow-brand mb-3">
                <LogoIcon className="w-6 h-6 text-white" />
              </div>
              <TextGenerateEffect words="Welcome back" className="text-2xl font-extrabold tracking-tight text-foreground" />
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Sign in to access your ShopWise 360 workspace
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
                <Label htmlFor="email" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Email Address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <MailIcon className="w-4 h-4" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Password
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <LockIcon className="w-4 h-4" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-xl pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground focus:outline-none"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
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
                    Signing in...
                  </span>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRightIcon className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center mb-2.5">
                Quick-Fill Demo Accounts
              </p>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((acc) => {
                  const AccIcon = acc.icon;
                  return (
                    <Button
                      key={acc.role}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fillDemo(acc.email)}
                      className="justify-start gap-2 rounded-xl px-3 text-xs font-semibold"
                    >
                      <AccIcon className={`w-3.5 h-3.5 flex-shrink-0 ${acc.color}`} />
                      <span>{acc.role}</span>
                    </Button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Password: <code className="bg-muted px-1 py-0.5 rounded font-mono text-foreground">Password123</code>
              </p>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-6">
              Don&apos;t have an account yet?{' '}
              <Link to="/register" className="font-bold text-primary hover:text-primary/80 hover:underline">
                Create account
              </Link>
            </p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
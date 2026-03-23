'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Droplets, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

const demoAccounts = [
  { email: 'demo-operator1@aquavera.app', role: 'Project Operator', org: 'Colorado Water Trust', name: 'Sarah Mitchell' },
  { email: 'demo-operator2@aquavera.app', role: 'Project Operator', org: 'Mumbai AquaCycle Industries', name: 'Rajesh Patel' },
  { email: 'demo-operator3@aquavera.app', role: 'Project Operator', org: 'Kenya RainHarvest Foundation', name: 'Amina Odhiambo' },
  { email: 'demo-buyer1@aquavera.app', role: 'Corporate Buyer', org: 'TechNova Semiconductors', name: 'James Chen' },
  { email: 'demo-buyer2@aquavera.app', role: 'Corporate Buyer', org: 'GreenBev Drinks Co.', name: 'Maria Santos' },
  { email: 'demo-verifier@aquavera.app', role: 'Verifier', org: 'EcoAudit Global', name: 'Dr. Henrik Larsson' },
];

const DEMO_PASSWORD = 'AquaDemo2025!';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      toast.error(result.error);
    } else {
      router.push('/dashboard');
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError('');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-light-gray px-4 py-12 relative">
      {/* Back to Home */}
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-teal transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <Droplets className="h-8 w-8 text-teal" />
          <span className="text-2xl font-bold text-deep-blue">AquaVera</span>
        </Link>

        {/* Login Card */}
        <div className="card">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Sign in</h1>
          <p className="text-sm text-gray-500 mb-6">Enter your credentials to access the platform</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="submit" loading={loading} className="w-full">
              <LogIn className="h-4 w-4" />
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-teal hover:text-teal-600 font-medium">
              Register
            </Link>
          </p>
        </div>

        {/* Demo Accounts */}
        <div className="card mt-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Demo Accounts</h2>
          <p className="text-xs text-gray-500 mb-3">
            Password for all: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-teal font-mono">{DEMO_PASSWORD}</code>
          </p>
          <div className="space-y-2">
            {demoAccounts.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => fillDemo(acc.email)}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded-lg border border-gray-200 hover:border-teal hover:bg-teal-50/50 transition-colors"
              >
                <div>
                  <span className="font-medium text-gray-900">{acc.name}</span>
                  <span className="block text-xs text-gray-500">{acc.org} · {acc.email}</span>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {acc.role}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Droplets,
  Waves,
  Building2,
  ShieldCheck,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';

const roles = [
  {
    key: 'project_operator',
    label: 'Project Operator',
    description: 'Manage water conservation projects, monitor sensors, and mint WSC credits.',
    icon: Waves,
    color: 'from-teal to-emerald-600',
    borderColor: 'border-teal/30 hover:border-teal',
    bgHover: 'hover:bg-teal-50/50',
  },
  {
    key: 'corporate_buyer',
    label: 'Corporate Buyer',
    description: 'Purchase water credits, offset your footprint, and earn stewardship certificates.',
    icon: Building2,
    color: 'from-deep-blue to-blue-700',
    borderColor: 'border-deep-blue/30 hover:border-deep-blue',
    bgHover: 'hover:bg-blue-50/50',
  },
  {
    key: 'verifier',
    label: 'Verifier',
    description: 'Review and verify water projects, audit sensor data, and approve MRV compliance.',
    icon: ShieldCheck,
    color: 'from-emerald-600 to-green-700',
    borderColor: 'border-green-400/30 hover:border-green-500',
    bgHover: 'hover:bg-green-50/50',
  },
];

export default function ExplorePage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSelect(roleKey: string) {
    setLoading(roleKey);
    // Fetch demo users for this role
    const res = await api.get<{ email: string }[]>(`/explore/users?role=${roleKey}`);
    if (res.success && res.data && res.data.length > 0) {
      // Auto-login as the first user of this role
      const email = res.data[0].email;
      const loginRes = await api.post<{ user: unknown; accessToken: string }>('/auth/login', {
        email,
        password: 'AquaDemo2025!',
      });
      if (loginRes.success && loginRes.data) {
        // Store token and explore flag, then redirect to dashboard
        const token = loginRes.data.accessToken;
        localStorage.setItem('aquavera_token', token);
        localStorage.setItem('aquavera_explore', 'true');
        // Force a full page load so AuthProvider picks up the token
        window.location.href = '/dashboard';
        return;
      }
    }
    setLoading(null);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-teal-50/30">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-deep-blue transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-teal" />
            <span className="font-semibold text-deep-blue">AquaVera</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal/10 text-teal text-sm font-medium mb-6">
            <Waves className="h-4 w-4" />
            Demo Mode
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Explore AquaVera
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Experience the platform through the eyes of different stakeholders.
            Choose a role to explore with real demo data.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {roles.map((role) => {
            const Icon = role.icon;
            const isLoading = loading === role.key;
            const isDisabled = loading !== null && !isLoading;

            return (
              <button
                key={role.key}
                onClick={() => handleSelect(role.key)}
                disabled={loading !== null}
                className={`group relative flex flex-col items-center text-center p-8 rounded-2xl border-2 ${role.borderColor} ${role.bgHover} bg-white transition-all duration-200 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${isLoading ? 'ring-2 ring-teal ring-offset-2' : ''}`}
              >
                {/* Icon */}
                <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${role.color} shadow-lg`}>
                  {isLoading ? (
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                  ) : (
                    <Icon className="h-8 w-8 text-white" />
                  )}
                </div>

                {/* Text */}
                <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-teal transition-colors">
                  {role.label}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {role.description}
                </p>

                {/* Arrow indicator */}
                <div className="mt-5 text-xs font-medium text-teal opacity-0 group-hover:opacity-100 transition-opacity">
                  {isLoading ? 'Signing in...' : 'Click to explore →'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Info footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-400">
            All data shown is demo data on Hedera Testnet. No real transactions are made.
          </p>
          <div className="mt-4 flex items-center justify-center gap-6 text-sm">
            <Link href="/login" className="text-teal hover:text-teal/80 font-medium">
              Sign in with your account →
            </Link>
            <Link href="/register" className="text-gray-500 hover:text-gray-700 font-medium">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

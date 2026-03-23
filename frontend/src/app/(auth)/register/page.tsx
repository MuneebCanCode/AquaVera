'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Droplets, UserPlus, Wallet } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useWallet } from '@/lib/wallet';
import { truncateAddress } from '@/lib/wallet-utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { toast } from 'sonner';

const registerSchema = z
  .object({
    email: z.string().email('Valid email required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    full_name: z.string().min(2, 'Full name required'),
    organization_name: z.string().min(2, 'Organization name required'),
    role: z.enum(['project_operator', 'corporate_buyer', 'verifier', 'admin'], {
      required_error: 'Select a role',
    }),
    industry: z.string().optional(),
    water_footprint_liters_annual: z.coerce.number().positive().optional(),
  })
  .refine(
    (data) => {
      if (data.role === 'corporate_buyer') {
        return !!data.industry && data.industry.length > 0;
      }
      return true;
    },
    { message: 'Industry is required for Corporate Buyers', path: ['industry'] }
  )
  .refine(
    (data) => {
      if (data.role === 'corporate_buyer') {
        return data.water_footprint_liters_annual != null && data.water_footprint_liters_annual > 0;
      }
      return true;
    },
    { message: 'Annual water footprint is required for Corporate Buyers', path: ['water_footprint_liters_annual'] }
  );

type RegisterFormData = z.infer<typeof registerSchema>;

const roleOptions = [
  { value: 'project_operator', label: 'Project Operator' },
  { value: 'corporate_buyer', label: 'Corporate Buyer' },
  { value: 'verifier', label: 'Verifier' },
  { value: 'admin', label: 'Admin' },
];

export default function RegisterPage() {
  const router = useRouter();
  const { register: authRegister } = useAuth();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: undefined },
  });

  const selectedRole = watch('role');

  async function handleConnectWallet() {
    setWalletError(null);
    const result = await wallet.connect();
    if ('error' in result) {
      setWalletError(result.error);
      toast.error(result.error);
    } else {
      setWalletAddress(result.evmAddress);
      toast.success('Wallet connected!');
    }
  }

  async function handleDisconnectWallet() {
    await wallet.disconnect();
    setWalletAddress(null);
    setWalletError(null);
  }

  async function onSubmit(data: RegisterFormData) {
    setLoading(true);
    const result = await authRegister({
      email: data.email,
      password: data.password,
      full_name: data.full_name,
      organization_name: data.organization_name,
      role: data.role,
      industry: data.industry,
      water_footprint_liters_annual: data.water_footprint_liters_annual,
      evm_address: walletAddress || undefined,
    });
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Account created! Welcome to AquaVera.');
      router.push('/dashboard');
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-light-gray px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <Droplets className="h-8 w-8 text-teal" />
          <span className="text-2xl font-bold text-deep-blue">AquaVera</span>
        </Link>

        <div className="card">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Create an account</h1>
          <p className="text-sm text-gray-500 mb-6">Join the water stewardship marketplace</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Full Name"
              {...register('full_name')}
              error={errors.full_name?.message}
              placeholder="Jane Doe"
            />
            <Input
              label="Email"
              type="email"
              {...register('email')}
              error={errors.email?.message}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              {...register('password')}
              error={errors.password?.message}
              placeholder="Min 8 characters"
              autoComplete="new-password"
            />
            <Input
              label="Organization Name"
              {...register('organization_name')}
              error={errors.organization_name?.message}
              placeholder="Your organization"
            />
            <Select
              label="Role"
              {...register('role')}
              error={errors.role?.message}
              options={roleOptions}
              placeholder="Select your role"
            />

            {/* Wallet Connection Section */}
            <div className="border border-gray-200 rounded-lg p-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                MetaMask Wallet <span className="text-gray-400 font-normal">(optional)</span>
              </label>

              {!wallet.isMetaMaskInstalled ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Wallet className="h-4 w-4" />
                  <span>MetaMask not detected.</span>
                  <a
                    href="https://metamask.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal hover:text-teal-600 font-medium"
                  >
                    Install MetaMask
                  </a>
                </div>
              ) : walletAddress ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-sm font-mono text-gray-700">
                      {truncateAddress(walletAddress)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnectWallet}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    loading={wallet.status === 'connecting'}
                    onClick={handleConnectWallet}
                  >
                    <Wallet className="h-4 w-4" />
                    Connect Wallet
                  </Button>
                  {walletError && (
                    <p className="mt-2 text-xs text-red-500">
                      {walletError}{' '}
                      <button
                        type="button"
                        className="text-teal hover:text-teal-600 font-medium"
                        onClick={handleConnectWallet}
                      >
                        Retry
                      </button>
                    </p>
                  )}
                </div>
              )}
            </div>

            {selectedRole === 'corporate_buyer' && (
              <>
                <Input
                  label="Industry"
                  {...register('industry')}
                  error={errors.industry?.message}
                  placeholder="e.g. Semiconductor Manufacturing"
                />
                <Input
                  label="Annual Water Footprint (liters)"
                  type="number"
                  {...register('water_footprint_liters_annual')}
                  error={errors.water_footprint_liters_annual?.message}
                  placeholder="e.g. 500000000"
                />
              </>
            )}

            <Button type="submit" loading={loading} className="w-full">
              <UserPlus className="h-4 w-4" />
              Create Account
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-teal hover:text-teal-600 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

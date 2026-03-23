'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Leaf, Award, CheckCircle, Droplets } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatNumber, formatLiters, formatHbar } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { HashScanLink } from '@/components/ui/HashScanLink';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { toast } from 'sonner';
import type { WaterProject, Retirement } from '@/types';

const retireSchema = z.object({
  quantity_wsc: z.coerce.number().positive('Quantity must be positive'),
  purpose: z.string().min(1, 'Purpose is required').max(2000),
  facility_name: z.string().max(300).optional(),
  compliance_framework: z.enum(['GRI 303', 'CDP Water Security', 'CSRD', 'ISSB S2', 'Custom'], { required_error: 'Select a framework' }),
  source_project_id: z.string().uuid('Select a source project'),
});

type RetireFormData = z.infer<typeof retireSchema>;

const frameworkOptions = [
  { value: 'GRI 303', label: 'GRI 303 — Water & Effluents' },
  { value: 'CDP Water Security', label: 'CDP Water Security' },
  { value: 'CSRD', label: 'CSRD Water Disclosure' },
  { value: 'ISSB S2', label: 'ISSB S2 Water' },
  { value: 'Custom', label: 'Custom Framework' },
];

export default function RetirePage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<WaterProject[]>([]);
  const [wscBalance, setWscBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Retirement | null>(null);

  const { register, handleSubmit, watch, setError: setFormError, formState: { errors } } = useForm<RetireFormData>({
    resolver: zodResolver(retireSchema),
  });

  const quantityWsc = watch('quantity_wsc') || 0;

  useEffect(() => {
    Promise.all([
      api.get<WaterProject[]>('/projects'),
      user?.hedera_account_id
        ? api.get<{ hbarBalance: number; tokenBalances: { tokenId: string; balance: number }[] }>(`/hedera/balance/${user.hedera_account_id}`)
        : Promise.resolve(null),
    ]).then(([projRes, balRes]) => {
      if (projRes.success && projRes.data) {
        setProjects(projRes.data.filter((p) => p.status === 'active'));
      }
      if (balRes && 'success' in balRes && balRes.success && balRes.data) {
        const wscToken = (balRes.data as { tokenBalances: { tokenId: string; balance: number }[] }).tokenBalances?.find(
          (t) => t.balance > 0
        );
        if (wscToken) setWscBalance(wscToken.balance);
      }
    }).finally(() => setLoading(false));
  }, [user]);

  async function onSubmit(data: RetireFormData) {
    if (data.quantity_wsc > wscBalance) {
      setFormError('quantity_wsc', { message: `Exceeds available balance (${wscBalance} WSC)` });
      return;
    }
    setSubmitting(true);
    const res = await api.post<Retirement>('/retire', data);
    setSubmitting(false);
    if (res.success && res.data) {
      setResult(res.data);
      toast.success(`Retired ${formatNumber(data.quantity_wsc)} WSC — AVIC NFT minted`);
    } else {
      toast.error(res.error?.message || 'Retirement failed');
    }
  }

  if (loading) return <LoadingSpinner size="lg" label="Loading retirement page..." />;

  if (result) {
    return (
      <Card className="max-w-lg mx-auto text-center">
        <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Credits Retired Successfully</h2>
        <p className="text-sm text-gray-500 mb-4">
          {formatNumber(result.quantity_wsc_retired)} WSC retired — {formatLiters(result.equivalent_liters)} offset
        </p>
        <div className="bg-teal-50/30 border border-teal/20 rounded-lg p-4 mb-4 space-y-2 text-sm text-left">
          <div className="flex justify-between"><span className="text-gray-500">NFT Serial</span><span className="font-medium">#{result.nft_certificate_serial}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">VC ID</span><span className="font-medium text-xs">{result.verifiable_credential_id}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Framework</span><span className="font-medium">{result.compliance_framework}</span></div>
          {result.hedera_burn_transaction_id && (
            <div className="flex justify-between items-center"><span className="text-gray-500">Burn Tx</span><HashScanLink entityType="transaction" entityId={result.hedera_burn_transaction_id} /></div>
          )}
          {result.nft_certificate_token_id && (
            <div className="flex justify-between items-center"><span className="text-gray-500">NFT Token</span><HashScanLink entityType="token" entityId={result.nft_certificate_token_id} /></div>
          )}
        </div>
        <div className="flex justify-center gap-3">
          <Button onClick={() => setResult(null)}>Retire More</Button>
          <Button variant="outline" onClick={() => window.location.href = '/certificates'}>View Certificates</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard icon={Leaf} label="WSC Balance" value={formatNumber(wscBalance)} />
        <StatCard icon={Droplets} label="Equivalent Liters" value={formatLiters(quantityWsc * 1000)} />
      </div>

      <Card className="max-w-2xl">
        <CardTitle>Retire Water Credits</CardTitle>
        <p className="text-sm text-gray-500 mb-6">Burn WSC tokens to permanently offset your water footprint and receive an AVIC NFT Impact Certificate.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Source Project"
            {...register('source_project_id')}
            error={errors.source_project_id?.message}
            options={projects.map((p) => ({ value: p.id, label: `${p.project_name} (${p.watershed_name})` }))}
            placeholder="Select project"
          />
          <Input
            label={`Quantity WSC to Retire (Balance: ${formatNumber(wscBalance)})`}
            type="number"
            min={1}
            {...register('quantity_wsc')}
            error={errors.quantity_wsc?.message}
            placeholder="e.g. 100"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
            <textarea
              {...register('purpose')}
              rows={3}
              className="input-field"
              placeholder="Describe why you are retiring these credits..."
            />
            {errors.purpose && <p className="mt-1 text-sm text-danger">{errors.purpose.message}</p>}
          </div>
          <Input
            label="Facility Name (optional)"
            {...register('facility_name')}
            error={errors.facility_name?.message}
            placeholder="e.g. Austin Manufacturing Plant"
          />
          <Select
            label="Compliance Framework"
            {...register('compliance_framework')}
            error={errors.compliance_framework?.message}
            options={frameworkOptions}
            placeholder="Select framework"
          />

          {/* Preview */}
          {quantityWsc > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Credits to Retire</span><span className="font-medium">{formatNumber(quantityWsc)} WSC</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Equivalent Water Offset</span><span className="font-medium">{formatLiters(quantityWsc * 1000)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">You Will Receive</span><span className="font-medium text-teal">1 AVIC NFT Certificate</span></div>
            </div>
          )}

          <Button type="submit" loading={submitting} className="w-full" disabled={quantityWsc <= 0}>
            <Award className="h-4 w-4" /> Retire Credits & Mint NFT
          </Button>
        </form>
      </Card>
    </div>
  );
}

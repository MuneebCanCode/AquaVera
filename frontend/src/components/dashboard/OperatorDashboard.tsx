'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { LazyLineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from '@/components/ui/LazyChart';
import { Coins, Droplets, Users, Activity, Plus, Zap, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNumber, formatHbar } from '@/lib/utils';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardTitle } from '@/components/ui/Card';
import { ChartWrapper } from '@/components/ui/ChartWrapper';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { HashScanLink } from '@/components/ui/HashScanLink';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import type { User, WaterProject, SensorReading } from '@/types';
import { withExplore } from '@/lib/explore';
import { useWallet } from '@/lib/wallet';

interface Props { user: User }

export function OperatorDashboard({ user }: Props) {
  const [projects, setProjects] = useState<WaterProject[]>([]);
  const [chartData, setChartData] = useState<{ date: string; flow_rate: number }[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [bulkSimulating, setBulkSimulating] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, unknown> | null>(null);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const wallet = useWallet();
  const walletFetched = useRef(false);

  useEffect(() => {
    Promise.all([
      api.get<WaterProject[]>(withExplore('/projects')),
      api.get<Record<string, unknown>>(withExplore('/dashboard/stats')),
    ]).then(([projRes, statsRes]) => {
      const loadedProjects = projRes.success && projRes.data ? projRes.data : [];
      setProjects(loadedProjects);
      if (statsRes.success && statsRes.data) setStats(statsRes.data as Record<string, number>);

      // Fetch sensor chart data for first project in parallel (avoid waterfall)
      if (loadedProjects.length > 0) {
        api.get<{ data: SensorReading[] }>(`/sensors/${loadedProjects[0].id}?limit=200`)
          .then((res) => {
            if (res.success && res.data) {
              const readings = Array.isArray(res.data) ? res.data : res.data.data || [];
              const grouped = readings.reduce<Record<string, number[]>>((acc, r) => {
                const day = r.reading_timestamp.slice(0, 10);
                if (!acc[day]) acc[day] = [];
                acc[day].push(r.flow_rate_liters_per_min);
                return acc;
              }, {});
              const chart = Object.entries(grouped)
                .map(([date, vals]) => ({
                  date,
                  flow_rate: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100,
                }))
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(-30);
              setChartData(chart);
            }
          });
      }
    }).finally(() => setLoading(false));
  }, []);

  // Fetch real WSC balance from wallet endpoint when wallet is connected (once)
  useEffect(() => {
    if (wallet.status === 'connected' && !walletFetched.current) {
      walletFetched.current = true;
      api.get<{ wscBalance: number; hbarBalance: number }>('/wallet/balance')
        .then((res) => {
          if (res.success && res.data) {
            setWalletBalance(res.data.wscBalance);
          }
        });
    } else if (wallet.status !== 'connected') {
      walletFetched.current = false;
      setWalletBalance(null);
    }
  }, [wallet.status]);

  async function handleSimulate(projectId: string) {
    setSimulating(projectId);
    const res = await api.post<SensorReading>(`/sensors/simulate/${projectId}`);
    setSimulating(null);
    if (res.success) {
      toast.success('Sensor reading simulated and logged to HCS');
    } else {
      toast.error(res.error?.message || 'Simulation failed');
    }
  }

  async function handleBulkSimulate(projectId: string) {
    setBulkSimulating(projectId);
    const res = await api.post<{ count: number; message: string }>(`/sensors/bulk-simulate/${projectId}`, { days: 30 });
    setBulkSimulating(null);
    if (res.success && res.data) {
      toast.success(res.data.message);
    } else {
      toast.error(res.error?.message || 'Bulk simulation failed');
    }
  }

  async function handleVerify(projectId: string) {
    setVerifying(projectId);
    const periodEnd = new Date().toISOString();
    const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();
    const res = await api.post<{ verification: Record<string, unknown>; minting: Record<string, unknown> | null }>('/sensors/verify', {
      project_id: projectId,
      period_start: periodStart,
      period_end: periodEnd,
      quality_tier: 'tier_1',
    });
    setVerifying(null);
    if (res.success && res.data) {
      setVerifyResult(res.data as Record<string, unknown>);
      setVerifyModalOpen(true);
      const v = res.data.verification as Record<string, unknown>;
      if (v?.passed) {
        toast.success('Guardian MRV verification passed');
      } else {
        toast.error(`Verification failed: ${v?.reason || 'Unknown'}`);
      }
    } else {
      toast.error(res.error?.message || 'Verification failed');
    }
  }

  if (loading) return <LoadingSpinner size="lg" label="Loading dashboard..." />;

  const totalMinted = projects.reduce((sum, p) => sum + p.total_wsc_minted, 0);
  const wscAvailable = walletBalance !== null ? walletBalance : totalMinted - (stats.myWscSold || 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Droplets} label="My Projects" value={projects.length} />
        <StatCard icon={Coins} label="Total WSC Minted" value={formatNumber(totalMinted)} />
        <StatCard icon={Activity} label={walletBalance !== null ? 'WSC Balance (live)' : 'WSC Available to Sell'} value={formatNumber(wscAvailable)} />
        <StatCard icon={Users} label="Community Rewards" value={formatHbar(stats.communityRewardsEarned || 0)} />
      </div>

      {/* Sensor Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardTitle>Flow Rate — Last 30 Days</CardTitle>
          <ChartWrapper height={280}>
            <LazyLineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="flow_rate" stroke="#0D9488" strokeWidth={2} dot={false} />
            </LazyLineChart>
          </ChartWrapper>
        </Card>
      )}

      {/* Projects List */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>My Water Projects</CardTitle>
          <Link href="/projects/register">
            <Button size="sm"><Plus className="h-4 w-4" /> Register Project</Button>
          </Link>
        </div>
        <div className="space-y-3">
          {projects.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-teal/30 transition-colors">
              <div>
                <Link href={`/projects/${p.id}`} className="font-medium text-gray-900 hover:text-teal">
                  {p.project_name}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={p.status} />
                  <StatusBadge status={p.project_type} />
                  <StatusBadge status={p.water_stress_zone} />
                </div>
                <p className="text-xs text-gray-500 mt-1">{p.location_name} · {formatNumber(p.total_wsc_minted)} WSC minted</p>
              </div>
              {p.status === 'active' && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    loading={verifying === p.id}
                    onClick={() => handleVerify(p.id)}
                  >
                    <ShieldCheck className="h-3 w-3" /> Verify
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={bulkSimulating === p.id}
                    onClick={() => handleBulkSimulate(p.id)}
                  >
                    <Zap className="h-3 w-3" /> Bulk Simulate (30d)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={simulating === p.id}
                    onClick={() => handleSimulate(p.id)}
                  >
                    <Zap className="h-3 w-3" /> Simulate
                  </Button>
                </div>
              )}
            </div>
          ))}
          {projects.length === 0 && (
            <p className="text-center text-gray-400 py-8">No projects yet. Register your first water project.</p>
          )}
        </div>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardTitle>Recent Activity</CardTitle>
        <div className="mt-3 space-y-2">
          {projects.slice(0, 3).map((p) => (
            <div key={p.id} className="flex items-center gap-3 text-sm text-gray-600">
              <Activity className="h-4 w-4 text-teal flex-shrink-0" />
              <span>{p.project_name} — {formatNumber(p.total_wsc_minted)} WSC minted</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Verification Result Modal */}
      <Modal open={verifyModalOpen} onClose={() => setVerifyModalOpen(false)} title="Guardian MRV Verification Result">
        {verifyResult && (() => {
          const v = verifyResult.verification as Record<string, unknown> | undefined;
          const m = verifyResult.minting as Record<string, unknown> | null | undefined;
          if (!v) return <p className="text-gray-500">No verification data.</p>;
          const passed = v.passed as boolean;
          return (
            <div className="space-y-4">
              <div className={`flex items-center gap-2 p-3 rounded-lg ${passed ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                <ShieldCheck className="h-5 w-5" />
                <span className="font-semibold">{passed ? 'Verification Passed' : 'Verification Failed'}</span>
              </div>
              <p className="text-sm text-gray-600">{v.reason as string}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-500">Verified Readings</p>
                  <p className="font-semibold">{formatNumber(v.verifiedReadings as number)} / {formatNumber(v.totalReadings as number)}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-500">Data Completeness</p>
                  <p className="font-semibold">{Math.min(100, v.data_completeness_percentage as number)?.toFixed(1)}%</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-500">Anomaly Rate</p>
                  <p className="font-semibold">{(v.anomaly_rate_percentage as number)?.toFixed(1)}% <span className="text-xs text-gray-400">(max 5%)</span></p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-500">Hash Mismatches</p>
                  <p className="font-semibold">{v.hashMismatches as number}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-500">Quality Tier</p>
                  <p className="font-semibold">{v.quality_tier as string} (×{v.quality_multiplier as number})</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-500">Stress Multiplier</p>
                  <p className="font-semibold">×{v.stress_multiplier as number}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                  <p className="text-gray-500">Base Credits → Final WSC</p>
                  <p className="font-semibold">{formatNumber(v.base_credits as number)} → {formatNumber(v.final_wsc_minted as number)} WSC</p>
                </div>
              </div>
              {m && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-sm font-medium text-teal">WSC Tokens Minted</p>
                  <p className="text-xs text-gray-500 mt-1 break-all">TX: {String(m.hedera_transaction_id)}</p>
                </div>
              )}
              {!m && passed && (
                <div className="border-t pt-3 mt-3 bg-amber-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-amber-800">Minting Skipped</p>
                  <p className="text-xs text-amber-600 mt-1">{String(verifyResult.mintingSkipped || 'No Hedera account linked to this user. Tokens will be minted once a Hedera account is provisioned.')}</p>
                </div>
              )}
              {/* Hedera Proof Links */}
              {(!!v.hcs_topic_id || !!v.guardian_policy_file_id) && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-sm font-medium text-gray-800 mb-2">Hedera On-Chain Proof</p>
                  <div className="space-y-1.5 text-xs">
                    {!!v.hcs_topic_id && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 w-32">HCS Audit Topic:</span>
                        <HashScanLink entityType="topic" entityId={String(v.hcs_topic_id)} />
                      </div>
                    )}
                    {!!v.hcs_consensus_timestamp && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 w-32">Verification TX:</span>
                        <HashScanLink entityType="transaction" entityId={String(v.hcs_consensus_timestamp)} />
                      </div>
                    )}
                    {!!v.guardian_policy_file_id && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 w-32">MRV Policy (HFS):</span>
                        <HashScanLink entityType="file" entityId={String(v.guardian_policy_file_id)} label={`File ${String(v.guardian_policy_file_id)}`} />
                      </div>
                    )}
                    {!!(m && m.hedera_transaction_id) && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 w-32">Minting TX:</span>
                        <HashScanLink entityType="transaction" entityId={String(m!.hedera_transaction_id)} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

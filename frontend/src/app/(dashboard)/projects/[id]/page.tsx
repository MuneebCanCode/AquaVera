'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { LazyLineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from '@/components/ui/LazyChart';
import { MapPin, Droplets, Coins, ShieldCheck, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNumber, formatLiters } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Card, CardTitle } from '@/components/ui/Card';
import { ChartWrapper } from '@/components/ui/ChartWrapper';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { HashScanLink } from '@/components/ui/HashScanLink';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import type { WaterProject, SensorReading, WscMintingEvent } from '@/types';

type TabKey = 'overview' | 'sensors' | 'verification' | 'wsc' | 'audit';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<WaterProject | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [mintEvents] = useState<WscMintingEvent[]>([]);
  const [auditMessages, setAuditMessages] = useState<{ consensus_timestamp: string; message: string }[]>([]);
  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [bulkSimulating, setBulkSimulating] = useState(false);
  const [verifyResult, setVerifyResult] = useState<Record<string, unknown> | null>(null);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<WaterProject>(`/projects/${id}`),
      api.get<{ data: SensorReading[] }>(`/sensors/${id}?limit=100`),
    ]).then(([projRes, sensorRes]) => {
      if (projRes.success && projRes.data) setProject(projRes.data);
      if (sensorRes.success && sensorRes.data) {
        const data = Array.isArray(sensorRes.data) ? sensorRes.data : sensorRes.data.data || [];
        setReadings(data);
      }
    }).finally(() => setLoading(false));
  }, [id]);

  // Load audit trail on tab switch
  useEffect(() => {
    if (tab === 'audit' && project?.hcs_topic_id) {
      api.get<{ consensus_timestamp: string; message: string }[]>(`/projects/${id}/audit-trail`)
        .then((res) => { if (res.success && res.data) setAuditMessages(res.data); });
    }
  }, [tab, project, id]);

  async function handleSimulate() {
    if (!project) return;
    setSimulating(true);
    const res = await api.post<SensorReading>(`/sensors/simulate/${project.id}`);
    setSimulating(false);
    if (res.success && res.data) {
      toast.success(`Sensor reading simulated${res.data.is_anomaly ? ' (ANOMALY detected)' : ''}`);
      setReadings((prev) => [res.data!, ...prev]);
    } else {
      toast.error(res.error?.message || 'Simulation failed');
    }
  }

  async function handleVerify() {
    if (!project) return;
    setVerifying(true);
    const periodEnd = new Date().toISOString();
    const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();
    const res = await api.post<{ verification: Record<string, unknown>; minting: Record<string, unknown> | null }>('/sensors/verify', {
      project_id: project.id,
      period_start: periodStart,
      period_end: periodEnd,
      quality_tier: 'tier_1',
    });
    setVerifying(false);
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

  async function handleBulkSimulate() {
    if (!project) return;
    setBulkSimulating(true);
    const res = await api.post<{ count: number; message: string }>(`/sensors/bulk-simulate/${project.id}`, { days: 30 });
    setBulkSimulating(false);
    if (res.success && res.data) {
      toast.success(res.data.message);
      // Refresh readings
      const sensorRes = await api.get<{ data: SensorReading[] }>(`/sensors/${project.id}?limit=100`);
      if (sensorRes.success && sensorRes.data) {
        const data = Array.isArray(sensorRes.data) ? sensorRes.data : sensorRes.data.data || [];
        setReadings(data);
      }
    } else {
      toast.error(res.error?.message || 'Bulk simulation failed');
    }
  }

  if (loading) return <LoadingSpinner size="lg" label="Loading project..." />;
  if (!project) return <div className="text-center py-12 text-gray-400">Project not found.</div>;

  const isOwner = user?.id === project.owner_id;
  const chartData = readings
    .slice()
    .sort((a, b) => a.reading_timestamp.localeCompare(b.reading_timestamp))
    .reduce<Record<string, { flow: number[]; ph: number[]; reservoir: number[] }>>((acc, r) => {
      const day = r.reading_timestamp.slice(0, 10);
      if (!acc[day]) acc[day] = { flow: [], ph: [], reservoir: [] };
      acc[day].flow.push(r.flow_rate_liters_per_min);
      acc[day].ph.push(r.water_quality_ph);
      acc[day].reservoir.push(r.reservoir_level_percent);
      return acc;
    }, {});
  const lineData = Object.entries(chartData)
    .map(([date, v]) => ({
      date,
      flow_rate: Math.round(v.flow.reduce((a, b) => a + b, 0) / v.flow.length * 100) / 100,
      ph: Math.round(v.ph.reduce((a, b) => a + b, 0) / v.ph.length * 100) / 100,
      reservoir: Math.round(v.reservoir.reduce((a, b) => a + b, 0) / v.reservoir.length * 100) / 100,
    }))
    .slice(-30);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'sensors', label: 'Sensor Data' },
    { key: 'verification', label: 'Verification' },
    { key: 'wsc', label: 'WSC History' },
    { key: 'audit', label: 'Audit Trail' },
  ];

  const sensorColumns: Column<SensorReading>[] = [
    { key: 'reading_timestamp', header: 'Time', render: (r) => new Date(r.reading_timestamp).toLocaleString() },
    { key: 'flow_rate_liters_per_min', header: 'Flow (L/min)', render: (r) => r.flow_rate_liters_per_min.toFixed(2) },
    { key: 'water_quality_ph', header: 'pH', render: (r) => r.water_quality_ph.toFixed(2) },
    { key: 'water_quality_tds', header: 'TDS', render: (r) => r.water_quality_tds.toFixed(1) },
    { key: 'water_quality_turbidity', header: 'Turbidity', render: (r) => r.water_quality_turbidity.toFixed(2) },
    { key: 'reservoir_level_percent', header: 'Reservoir %', render: (r) => `${r.reservoir_level_percent.toFixed(1)}%` },
    { key: 'is_anomaly', header: 'Anomaly', render: (r) => r.is_anomaly ? <Badge variant="danger">Yes</Badge> : <Badge variant="success">No</Badge> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{project.project_name}</h2>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status={project.status} />
            <StatusBadge status={project.project_type} />
            <StatusBadge status={project.water_stress_zone} />
          </div>
        </div>
        {isOwner && project.status === 'active' && (
          <div className="flex items-center gap-2">
            <Button variant="outline" loading={verifying} onClick={handleVerify}>
              <ShieldCheck className="h-4 w-4" /> Verify & Mint
            </Button>
            <Button loading={simulating} onClick={handleSimulate}>
              <Zap className="h-4 w-4" /> Simulate Sensor Reading
            </Button>
            <Button variant="outline" loading={bulkSimulating} onClick={handleBulkSimulate}>
              <Zap className="h-4 w-4" /> Bulk Simulate (30d)
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key ? 'border-teal text-teal' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Coins} label="WSC Minted" value={formatNumber(project.total_wsc_minted)} />
            <StatCard icon={Droplets} label="Baseline (L/day)" value={formatNumber(project.baseline_daily_liters)} />
            <StatCard icon={MapPin} label="Location" value={project.location_name} />
            <StatCard icon={ShieldCheck} label="Watershed" value={project.watershed_name} />
          </div>
          <Card>
            <CardTitle>Description</CardTitle>
            <p className="text-sm text-gray-600 mt-2">{project.description}</p>
          </Card>
          <Card>
            <CardTitle>Details</CardTitle>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-3 text-sm">
              <div><dt className="text-gray-500">Coordinates</dt><dd className="font-medium">{project.latitude}, {project.longitude}</dd></div>
              <div><dt className="text-gray-500">Sensor Types</dt><dd className="font-medium">{project.sensor_types.join(', ')}</dd></div>
              <div><dt className="text-gray-500">Created</dt><dd className="font-medium">{new Date(project.created_at).toLocaleDateString()}</dd></div>
              {project.verification_date && <div><dt className="text-gray-500">Verified</dt><dd className="font-medium">{new Date(project.verification_date).toLocaleDateString()}</dd></div>}
              {project.hcs_topic_id && <div><dt className="text-gray-500">HCS Topic</dt><dd><HashScanLink entityType="topic" entityId={project.hcs_topic_id} /></dd></div>}
            </dl>
          </Card>
        </div>
      )}

      {tab === 'sensors' && (
        <div className="space-y-6">
          {lineData.length > 0 && (
            <Card>
              <CardTitle>Flow Rate — Last 30 Days</CardTitle>
              <ChartWrapper height={280}>
                <LazyLineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="flow_rate" stroke="#0D9488" strokeWidth={2} dot={false} name="Flow Rate" />
                </LazyLineChart>
              </ChartWrapper>
            </Card>
          )}
          <Card noPadding>
            <div className="p-4 border-b border-gray-200">
              <CardTitle>Sensor Readings</CardTitle>
              <p className="text-xs text-gray-500 mt-1">{readings.length} readings · {readings.filter((r) => r.is_anomaly).length} anomalies</p>
            </div>
            <DataTable columns={sensorColumns} data={readings} keyExtractor={(r) => r.id} />
          </Card>
        </div>
      )}

      {tab === 'verification' && (
        <Card>
          <CardTitle>Guardian MRV Verification</CardTitle>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-3 text-sm">
            <div><dt className="text-gray-500">Status</dt><dd><StatusBadge status={project.status} /></dd></div>
            <div><dt className="text-gray-500">Quality Tier</dt><dd><StatusBadge status="tier_1" /> (1.0x multiplier)</dd></div>
            <div><dt className="text-gray-500">Stress Zone</dt><dd><StatusBadge status={project.water_stress_zone} /></dd></div>
            {project.verification_notes && <div className="sm:col-span-2"><dt className="text-gray-500">Notes</dt><dd className="font-medium">{project.verification_notes}</dd></div>}
            {project.guardian_policy_id && <div><dt className="text-gray-500">Guardian Policy</dt><dd><HashScanLink entityType="file" entityId={project.guardian_policy_id} label="View Policy" /></dd></div>}
          </dl>
        </Card>
      )}

      {tab === 'wsc' && (
        <Card>
          <CardTitle>WSC Minting History</CardTitle>
          <p className="text-sm text-gray-500 mt-2">Total minted: {formatNumber(project.total_wsc_minted)} WSC ({formatLiters(project.total_wsc_minted * 1000)} verified)</p>
        </Card>
      )}

      {tab === 'audit' && (
        <Card>
          <CardTitle>HCS Audit Trail</CardTitle>
          {auditMessages.length > 0 ? (
            <div className="space-y-2 mt-3">
              {auditMessages.map((msg, i) => (
                <div key={i} className="p-3 rounded-lg bg-gray-50 text-xs font-mono text-gray-600 break-all">
                  <span className="text-gray-400">{msg.consensus_timestamp}</span>
                  <br />{msg.message}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm mt-3">No audit messages found for this project.</p>
          )}
        </Card>
      )}

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

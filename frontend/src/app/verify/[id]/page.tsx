'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ShieldCheck, ShieldAlert, Droplets, Leaf, FileText, Activity,
  ExternalLink, Clock, MapPin, Award, Hash,
} from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { HashScanLink } from '@/components/ui/HashScanLink';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatNumber, formatLiters, hashScanUrl } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface VerificationData {
  retirement: {
    id: string;
    quantity_wsc_retired: number;
    equivalent_liters: number;
    purpose: string;
    facility_name: string | null;
    compliance_framework: string;
    hedera_burn_transaction_id: string;
    hcs_retirement_message_id: string;
    nft_certificate_token_id: string;
    nft_certificate_serial: number;
    nft_metadata_hfs_file_id: string;
    verifiable_credential_id: string;
    created_at: string;
  };
  project: {
    project_name: string;
    project_type: string;
    location_name: string;
    watershed_name: string;
    water_stress_zone: string;
    quality_tier: string;
    hcs_topic_id: string;
  };
  sensorSummary: {
    totalReadings: number;
    anomalyCount: number;
    avgPh: number;
    avgTds: number;
    avgTurbidity: number;
  };
  auditTrail: { timestamp: string; message: string; sequenceNumber: number }[];
  mirrorNodeVerification: {
    burnConfirmed: boolean;
    nftExists: boolean;
    hcsMessageFound: boolean;
  };
  stewardshipLevel?: string;
}

function VerifyBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
      {ok ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
      {label}: {ok ? 'Verified' : 'Not Verified'}
    </div>
  );
}

export default function PublicVerifyPage() {
  const params = useParams();
  const retirementId = params.id as string;
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/verify/${retirementId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.error?.message || 'Retirement not found');
        }
      } catch {
        setError('Failed to connect to verification service');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [retirementId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" label="Verifying retirement on Hedera..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md text-center">
          <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">Verification Failed</h2>
          <p className="text-sm text-gray-500">{error || 'Unable to verify this retirement.'}</p>
        </Card>
      </div>
    );
  }

  const { retirement: r, project: p, sensorSummary: s, auditTrail, mirrorNodeVerification: mv, stewardshipLevel } = data;
  const allVerified = mv.burnConfirmed && mv.nftExists && mv.hcsMessageFound;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={`${allVerified ? 'bg-green-600' : 'bg-red-600'} text-white`}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            {allVerified ? <ShieldCheck className="h-8 w-8" /> : <ShieldAlert className="h-8 w-8" />}
            <h1 className="text-2xl font-bold">{allVerified ? 'Verified Water Impact' : 'Verification Incomplete'}</h1>
          </div>
          <p className="text-sm opacity-90">
            AquaVera Impact Certificate — independently verifiable on Hedera Testnet
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Mirror Node Cross-Check */}
        <Card>
          <CardTitle>Hedera Mirror Node Verification</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <VerifyBadge ok={mv.burnConfirmed} label="Token Burn" />
            <VerifyBadge ok={mv.nftExists} label="NFT Certificate" />
            <VerifyBadge ok={mv.hcsMessageFound} label="HCS Audit Log" />
          </div>
        </Card>

        {/* Retirement Details */}
        <Card>
          <CardTitle>Retirement Details</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 text-sm">
            <div className="flex items-start gap-2">
              <Droplets className="h-4 w-4 text-teal mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-gray-500">Credits Retired</p>
                <p className="font-bold text-gray-900">{formatNumber(r.quantity_wsc_retired)} WSC</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Droplets className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-gray-500">Equivalent Water Impact</p>
                <p className="font-bold text-gray-900">{formatLiters(r.equivalent_liters)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Leaf className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-gray-500">Purpose</p>
                <p className="font-medium text-gray-900">{r.purpose}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-gray-500">Compliance Framework</p>
                <p className="font-medium text-gray-900">{r.compliance_framework}</p>
              </div>
            </div>
            {r.facility_name && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-500">Facility</p>
                  <p className="font-medium text-gray-900">{r.facility_name}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-gray-500">Retired On</p>
                <p className="font-medium text-gray-900">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Source Project */}
        <Card>
          <CardTitle>Source Water Project</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 text-sm">
            <div>
              <p className="text-gray-500">Project Name</p>
              <p className="font-medium text-gray-900">{p.project_name}</p>
            </div>
            <div>
              <p className="text-gray-500">Type</p>
              <Badge>{p.project_type}</Badge>
            </div>
            <div>
              <p className="text-gray-500">Location</p>
              <p className="font-medium text-gray-900">{p.location_name}</p>
            </div>
            <div>
              <p className="text-gray-500">Watershed</p>
              <p className="font-medium text-gray-900">{p.watershed_name}</p>
            </div>
            <div>
              <p className="text-gray-500">Water Stress Zone</p>
              <Badge variant={p.water_stress_zone === 'extreme' ? 'danger' : p.water_stress_zone === 'high' ? 'warning' : 'default'}>
                {p.water_stress_zone}
              </Badge>
            </div>
            <div>
              <p className="text-gray-500">Quality Tier</p>
              <Badge variant={p.quality_tier === 'tier_1' ? 'success' : p.quality_tier === 'tier_2' ? 'info' : 'default'}>
                {p.quality_tier?.replace('_', ' ') || '—'}
              </Badge>
            </div>
            <div>
              <p className="text-gray-500">HCS Topic</p>
              <HashScanLink entityType="topic" entityId={p.hcs_topic_id} />
            </div>
          </div>
        </Card>

        {/* AVIC NFT & VC */}
        <Card>
          <CardTitle>Impact Certificate (AVIC NFT)</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 text-sm">
            <div>
              <p className="text-gray-500">NFT Token</p>
              <HashScanLink entityType="token" entityId={r.nft_certificate_token_id} />
            </div>
            <div className="flex items-start gap-2">
              <Award className="h-4 w-4 text-teal mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-gray-500">Serial Number</p>
                <p className="font-bold text-gray-900">#{r.nft_certificate_serial}</p>
              </div>
            </div>
            <div>
              <p className="text-gray-500">Metadata (HFS)</p>
              <span className="font-mono text-xs text-gray-700">{r.nft_metadata_hfs_file_id}</span>
            </div>
            <div className="flex items-start gap-2">
              <Hash className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-gray-500">Verifiable Credential ID</p>
                <p className="font-mono text-xs text-gray-700 break-all">{r.verifiable_credential_id}</p>
              </div>
            </div>
            {stewardshipLevel && (
              <div className="flex items-start gap-2">
                <Award className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-500">Stewardship Level</p>
                  <Badge variant={stewardshipLevel === 'Platinum' ? 'info' : stewardshipLevel === 'Gold' ? 'warning' : 'success'}>
                    {stewardshipLevel}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Sensor Summary */}
        <Card>
          <CardTitle>Sensor Data Summary</CardTitle>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-3 text-sm text-center">
            <div>
              <p className="text-gray-500">Readings</p>
              <p className="font-bold text-gray-900">{formatNumber(s.totalReadings)}</p>
            </div>
            <div>
              <p className="text-gray-500">Anomalies</p>
              <p className={`font-bold ${s.anomalyCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{s.anomalyCount}</p>
            </div>
            <div>
              <p className="text-gray-500">Avg pH</p>
              <p className="font-bold text-gray-900">{s.avgPh.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-500">Avg TDS</p>
              <p className="font-bold text-gray-900">{s.avgTds.toFixed(0)} ppm</p>
            </div>
            <div>
              <p className="text-gray-500">Avg Turbidity</p>
              <p className="font-bold text-gray-900">{s.avgTurbidity.toFixed(2)} NTU</p>
            </div>
          </div>
        </Card>

        {/* HCS Audit Trail */}
        {auditTrail.length > 0 && (
          <Card>
            <CardTitle>HCS Audit Trail</CardTitle>
            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {auditTrail.map((entry, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded bg-gray-50 text-xs">
                  <Activity className="h-3.5 w-3.5 text-teal mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700 break-all">{entry.message}</p>
                    <p className="text-gray-400 mt-0.5">Seq #{entry.sequenceNumber} · {new Date(entry.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Hedera Links */}
        <Card>
          <CardTitle>Verify on Hedera</CardTitle>
          <div className="flex flex-wrap gap-3 mt-3">
            <a
              href={hashScanUrl('transaction', r.hedera_burn_transaction_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#162d4a] transition-colors"
            >
              <ExternalLink className="h-4 w-4" /> Burn Transaction
            </a>
            <a
              href={hashScanUrl('token', r.nft_certificate_token_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal text-white text-sm font-medium hover:bg-teal-600 transition-colors"
            >
              <ExternalLink className="h-4 w-4" /> NFT Certificate
            </a>
            <HashScanLink entityType="topic" entityId={p.hcs_topic_id} label="HCS Topic" className="px-4 py-2 rounded-lg border border-gray-200 hover:border-teal/30 text-sm" />
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 py-4">
          <p>AquaVera — Tokenized Water Stewardship Credits on Hedera</p>
          <p className="mt-1">All data independently verifiable via Hedera Mirror Node</p>
        </div>
      </div>
    </div>
  );
}

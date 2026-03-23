'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, Droplets, FileText, AlertTriangle, Gauge,
  Clock, CheckCircle, ArrowLeft, Layers,
} from 'lucide-react';

interface PolicyData {
  source: string;
  file_id: string;
  network: string;
  policy: Record<string, any>;
}

const fieldLabels: Record<string, string> = {
  flow_rate_liters_per_min: 'Flow Rate (L/min)',
  total_volume_liters: 'Total Volume (L)',
  water_quality_ph: 'Water Quality pH',
  water_quality_tds: 'Total Dissolved Solids',
  water_quality_turbidity: 'Turbidity (NTU)',
  reservoir_level_percent: 'Reservoir Level (%)',
  gps_latitude: 'GPS Latitude',
  gps_longitude: 'GPS Longitude',
};

const anomalyLabels: Record<string, string> = {
  flow_rate_deviation_factor: 'Flow Rate Deviation Factor',
  ph_min: 'pH Minimum',
  ph_max: 'pH Maximum',
  tds_max: 'TDS Maximum',
  turbidity_max: 'Turbidity Maximum (NTU)',
};

const projectTypeIcons: Record<string, string> = {
  conservation: '💧',
  restoration: '🌿',
  recycling: '♻️',
  access: '🚰',
  efficiency: '⚡',
};

/**
 * Normalize the policy object to handle both HFS-stored and default policy structures.
 * HFS uses slightly different field names than getDefaultPolicy().
 */
function normalizePolicy(raw: Record<string, any>) {
  const p = raw;

  // Version: HFS uses "version", default uses "policyVersion"
  const policyVersion = p.policyVersion || p.version || '1.0.0';

  // Credit calculation normalization
  const cc = p.creditCalculation || {};
  const baseRate = cc.baseRate || cc.formula || '';
  const litersPerWSC = cc.litersPerWSC || 1000;

  // qualityTierMultipliers: default is flat {tier_1: 1.0}, HFS is {tier_1: {description, multiplier}}
  let qualityTierMultipliers: Record<string, number> = {};
  const qSource = cc.qualityTierMultipliers || cc.qualityTiers || {};
  for (const [key, val] of Object.entries(qSource)) {
    qualityTierMultipliers[key] = typeof val === 'number' ? val : (val as any)?.multiplier ?? 1;
  }

  // waterStressZoneMultipliers: same in both structures
  const waterStressZoneMultipliers: Record<string, number> = cc.waterStressZoneMultipliers || {};

  // minimumDataCompleteness / maximumAnomalyRate: HFS nests inside dataRequirements
  const dr = p.dataRequirements || {};
  const minimumDataCompleteness = p.minimumDataCompleteness ?? dr.minimumDataCompleteness ?? 80;
  const maximumAnomalyRate = p.maximumAnomalyRate ?? (dr.maximumAnomalyRate != null ? dr.maximumAnomalyRate * 100 : 5);

  return {
    policyName: p.policyName || 'Guardian MRV Policy',
    policyVersion,
    description: p.description || '',
    standardsAlignment: p.standardsAlignment || [],
    projectTypes: p.projectTypes || {},
    dataRequirements: {
      minimumReadingsPerDay: dr.minimumReadingsPerDay || 24,
      requiredFields: dr.requiredFields || [],
      optionalFields: dr.optionalFields || [],
      frequency: dr.frequency || 'hourly',
    },
    anomalyDetection: p.anomalyDetection || {},
    creditCalculation: {
      baseRate,
      litersPerWSC,
      qualityTierMultipliers,
      waterStressZoneMultipliers,
    },
    minimumDataCompleteness,
    maximumAnomalyRate,
    verificationPeriod: p.verificationPeriod || { minimum: '7 days', recommended: '30 days', maximum: '365 days' },
    baselineComparison: p.baselineComparison || null,
  };
}

export default function GuardianPolicyPage() {
  const [data, setData] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    fetch(`${apiBase}/guardian/policy`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => setError('Failed to load Guardian MRV Policy'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="h-6 w-6 border-2 border-teal border-t-transparent rounded-full animate-spin" />
          Loading Guardian MRV Policy...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <p className="text-gray-600">{error || 'Policy not found'}</p>
          <Link href="/dashboard" className="text-teal hover:underline text-sm mt-2 inline-block">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const { file_id, network, source } = data;
  const policy = normalizePolicy(data.policy);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1E3A5F] to-[#0D9488] text-white">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-white/70 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{policy.policyName}</h1>
              <p className="text-white/80 mt-1 text-sm max-w-2xl">{policy.description}</p>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-white/60">
                <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Version {policy.policyVersion}</span>
                <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> HFS File: {file_id}</span>
                <span className="flex items-center gap-1"><Droplets className="h-3 w-3" /> Network: {network}</span>
                <span>Source: {source?.replace(/_/g, ' ') || 'unknown'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Standards Alignment */}
        {policy.standardsAlignment.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <CheckCircle className="h-5 w-5 text-teal" /> Standards Alignment
            </h2>
            <div className="flex flex-wrap gap-2">
              {policy.standardsAlignment.map((std: string) => (
                <span key={std} className="px-3 py-1.5 rounded-full bg-teal/10 text-teal text-sm font-medium">{std}</span>
              ))}
            </div>
          </section>
        )}

        {/* Project Types */}
        {Object.keys(policy.projectTypes).length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Droplets className="h-5 w-5 text-teal" /> Eligible Project Types
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(policy.projectTypes).map(([key, val]: [string, any]) => (
                <div key={key} className="p-4 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{projectTypeIcons[key] || '📋'}</span>
                    <span className="font-medium text-gray-900 capitalize">{key}</span>
                  </div>
                  <p className="text-xs text-gray-500">{val?.description || ''}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Data Requirements */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Gauge className="h-5 w-5 text-teal" /> Data Requirements
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div className="text-center p-4 rounded-lg bg-teal/5 border border-teal/10">
              <p className="text-2xl font-bold text-teal">{policy.dataRequirements.minimumReadingsPerDay}</p>
              <p className="text-xs text-gray-500 mt-1">Readings per Day</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-teal/5 border border-teal/10">
              <p className="text-2xl font-bold text-teal capitalize">{policy.dataRequirements.frequency}</p>
              <p className="text-xs text-gray-500 mt-1">Frequency</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-teal/5 border border-teal/10">
              <p className="text-2xl font-bold text-teal">{policy.dataRequirements.requiredFields.length}</p>
              <p className="text-xs text-gray-500 mt-1">Required Fields</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Required Fields</h3>
              <div className="space-y-1.5">
                {policy.dataRequirements.requiredFields.map((f: string) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{fieldLabels[f] || f}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Optional Fields</h3>
              <div className="space-y-1.5">
                {policy.dataRequirements.optionalFields.map((f: string) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    <span className="text-gray-500">{fieldLabels[f] || f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Verification Thresholds */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Anomaly Detection */}
          {Object.keys(policy.anomalyDetection).length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Anomaly Detection
              </h2>
              <div className="space-y-3">
                {Object.entries(policy.anomalyDetection).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600">{anomalyLabels[key] || key}</span>
                    <span className="font-mono text-sm font-medium text-gray-900">{String(val)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <p className="text-xs text-amber-700">Max anomaly rate: <span className="font-bold">{policy.maximumAnomalyRate}%</span></p>
                <p className="text-xs text-amber-700 mt-0.5">Min data completeness: <span className="font-bold">{policy.minimumDataCompleteness}%</span></p>
              </div>
            </section>
          )}

          {/* Verification Period */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-teal" /> Verification Period
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Minimum</span>
                <span className="font-medium text-gray-900">{policy.verificationPeriod.minimum}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Recommended</span>
                <span className="font-medium text-teal">{policy.verificationPeriod.recommended}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">Maximum</span>
                <span className="font-medium text-gray-900">{policy.verificationPeriod.maximum}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Credit Calculation */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-teal" /> Credit Calculation Formula
          </h2>
          <div className="p-4 rounded-lg bg-gray-900 text-green-400 font-mono text-sm mb-5">
            <p>WSC = (net_water_impact_liters / {policy.creditCalculation.litersPerWSC}) × quality_multiplier × stress_multiplier</p>
            {policy.creditCalculation.baseRate && (
              <p className="text-gray-500 mt-1">// {policy.creditCalculation.baseRate}</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {Object.keys(policy.creditCalculation.qualityTierMultipliers).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Quality Tier Multipliers</h3>
                <div className="space-y-2">
                  {Object.entries(policy.creditCalculation.qualityTierMultipliers).map(([tier, mult]) => (
                    <div key={tier} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <span className="text-sm text-gray-700 capitalize">{tier.replace(/_/g, ' ')}</span>
                      <span className="font-bold text-teal">×{String(mult)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Object.keys(policy.creditCalculation.waterStressZoneMultipliers).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Water Stress Zone Multipliers</h3>
                <div className="space-y-2">
                  {Object.entries(policy.creditCalculation.waterStressZoneMultipliers).map(([zone, mult]) => (
                    <div key={zone} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <span className="text-sm text-gray-700 capitalize">{zone}</span>
                      <span className="font-bold text-teal">×{String(mult)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Baseline Comparison (only if present in HFS policy) */}
        {policy.baselineComparison && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Gauge className="h-5 w-5 text-teal" /> Baseline Comparison
            </h2>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 rounded-full bg-teal/10 text-teal text-sm font-medium capitalize">
                {policy.baselineComparison.method?.replace(/_/g, ' ') || 'N/A'}
              </span>
              <span className="text-sm text-gray-600">{policy.baselineComparison.description || ''}</span>
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 py-4">
          This policy is stored on the Hedera File Service (HFS) and verified on-chain.
          <br />File ID: {file_id} · Network: {network}
        </div>
      </div>
    </div>
  );
}

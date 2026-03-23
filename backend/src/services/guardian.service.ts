import { getSupabase } from './supabase';
import { readFile } from '../hedera/hfs.service';
import { submitMessage } from '../hedera/hcs.service';
import { hashData } from '../utils/hashing';
import { ANOMALY_THRESHOLDS, QUALITY_MULTIPLIERS, STRESS_MULTIPLIERS, LITERS_PER_WSC } from '../utils/constants';
import type { SensorReading, WaterProject } from '../types';
import type { QualityTier, WaterStressZone } from '../types/enums';

export interface VerificationResult {
  passed: boolean;
  reason: string;
  verifiedReadings: number;
  totalReadings: number;
  anomalyCount: number;
  anomalyRate: number;
  hashMismatches: number;
  completenessPercent: number;
  netWaterImpactLiters: number;
  base_credits: number;
  quality_tier: string;
  quality_multiplier: number;
  stress_multiplier: number;
  final_wsc_minted: number;
  data_completeness_percentage: number;
  anomaly_rate_percentage: number;
  hcs_topic_id: string | null;
  hcs_message_id: string | null;
  hcs_consensus_timestamp: string | null;
  guardian_policy_file_id: string | null;
}

/**
 * Perform Guardian MRV policy verification on a project's sensor readings.
 * Validates: data integrity (hash check), anomaly rate (<= 5%), completeness (>= 80%).
 */
export async function verifyProjectData(
  projectId: string,
  periodStart: string,
  periodEnd: string,
  baselineDailyLiters: number,
  qualityTier: QualityTier = 'tier_1',
  waterStressZone: WaterStressZone = 'high'
): Promise<VerificationResult> {
  const supabase = getSupabase();

  // Fetch unverified readings for the period
  const { data: readings, error } = await supabase
    .from('sensor_readings')
    .select('*')
    .eq('project_id', projectId)
    .gte('reading_timestamp', periodStart)
    .lte('reading_timestamp', periodEnd)
    .order('reading_timestamp', { ascending: true });

  if (error) throw new Error(error.message);
  const allReadings = (readings || []) as SensorReading[];

  if (allReadings.length === 0) {
    return {
      passed: false,
      reason: 'No sensor readings found for the verification period',
      verifiedReadings: 0,
      totalReadings: 0,
      anomalyCount: 0,
      anomalyRate: 0,
      hashMismatches: 0,
      completenessPercent: 0,
      netWaterImpactLiters: 0,
      base_credits: 0,
      quality_tier: qualityTier,
      quality_multiplier: QUALITY_MULTIPLIERS[qualityTier],
      stress_multiplier: STRESS_MULTIPLIERS[waterStressZone],
      final_wsc_minted: 0,
      data_completeness_percentage: 0,
      anomaly_rate_percentage: 0,
      hcs_topic_id: null,
      hcs_message_id: null,
      hcs_consensus_timestamp: null,
      guardian_policy_file_id: process.env.GUARDIAN_POLICY_FILE_ID || null,
    };
  }

  // Calculate expected readings (hourly for the period)
  const periodMs = new Date(periodEnd).getTime() - new Date(periodStart).getTime();
  const expectedReadings = Math.max(1, Math.floor(periodMs / (60 * 60 * 1000)));

  // Check data completeness
  const completenessPercent = (allReadings.length / expectedReadings) * 100;

  // Verify data hashes
  let hashMismatches = 0;
  for (const reading of allReadings) {
    const dataFields = {
      flow_rate_liters_per_min: reading.flow_rate_liters_per_min,
      total_volume_liters: reading.total_volume_liters,
      water_quality_ph: reading.water_quality_ph,
      water_quality_tds: reading.water_quality_tds,
      water_quality_turbidity: reading.water_quality_turbidity,
      reservoir_level_percent: reading.reservoir_level_percent,
      gps_latitude: reading.gps_latitude,
      gps_longitude: reading.gps_longitude,
      reading_timestamp: reading.reading_timestamp,
    };
    const computedHash = hashData(dataFields);
    if (computedHash !== reading.data_hash) hashMismatches++;
  }

  // Count anomalies
  const anomalyCount = allReadings.filter((r) => r.is_anomaly).length;
  const anomalyRate = (anomalyCount / allReadings.length) * 100;

  // Calculate net water impact
  const totalVolume = allReadings.reduce((sum, r) => sum + r.total_volume_liters, 0);
  const periodDays = periodMs / (24 * 60 * 60 * 1000);
  const baselineForPeriod = baselineDailyLiters * periodDays;
  const netWaterImpactLiters = Math.max(0, totalVolume - baselineForPeriod);

  // Determine pass/fail
  const reasons: string[] = [];
  if (hashMismatches > 0) reasons.push(`${hashMismatches} hash mismatches detected`);
  if (anomalyRate > 5) reasons.push(`Anomaly rate ${anomalyRate.toFixed(1)}% exceeds 5% threshold`);
  if (completenessPercent < 80) reasons.push(`Data completeness ${completenessPercent.toFixed(1)}% below 80% threshold`);

  const passed = reasons.length === 0;

  // Calculate credit amounts (only meaningful if passed, but always compute for reporting)
  const baseCredits = netWaterImpactLiters / LITERS_PER_WSC;
  const qualityMultiplier = QUALITY_MULTIPLIERS[qualityTier];
  const stressMultiplier = STRESS_MULTIPLIERS[waterStressZone];
  const finalWscMinted = passed ? parseFloat((baseCredits * qualityMultiplier * stressMultiplier).toFixed(2)) : 0;

  const result: VerificationResult = {
    passed,
    reason: passed ? 'All verification checks passed' : reasons.join('; '),
    verifiedReadings: allReadings.length,
    totalReadings: expectedReadings,
    anomalyCount,
    anomalyRate,
    hashMismatches,
    completenessPercent,
    netWaterImpactLiters,
    base_credits: parseFloat(baseCredits.toFixed(2)),
    quality_tier: qualityTier,
    quality_multiplier: qualityMultiplier,
    stress_multiplier: stressMultiplier,
    final_wsc_minted: finalWscMinted,
    data_completeness_percentage: parseFloat(completenessPercent.toFixed(2)),
    anomaly_rate_percentage: parseFloat(anomalyRate.toFixed(2)),
    hcs_topic_id: null,
    hcs_message_id: null,
    hcs_consensus_timestamp: null,
    guardian_policy_file_id: process.env.GUARDIAN_POLICY_FILE_ID || null,
  };

  // Log verification result to HCS main topic
  const mainTopicId = process.env.HCS_MAIN_TOPIC_ID;
  if (mainTopicId) {
    const hcsResult = await submitMessage(mainTopicId, {
      event_type: passed ? 'guardian_verification_passed' : 'guardian_verification_failed',
      timestamp: new Date().toISOString(),
      entity_id: projectId,
      actor_did: '',
      data_hash: hashData(result),
      metadata: {
        result: passed ? 'passed' : 'failed',
        reason: result.reason,
        verified_readings: result.verifiedReadings,
        anomaly_rate: result.anomalyRate,
        completeness_percent: result.completenessPercent,
        hash_mismatches: result.hashMismatches,
        guardian_policy_file_id: process.env.GUARDIAN_POLICY_FILE_ID || '',
      },
    });
    result.hcs_topic_id = mainTopicId;
    result.hcs_message_id = hcsResult.messageId;
    result.hcs_consensus_timestamp = hcsResult.consensusTimestamp;
  }

  return result;
}

/**
 * Fetch the Guardian MRV policy from HFS (or return cached version).
 */
export async function getGuardianPolicy(): Promise<Record<string, unknown>> {
  const fileId = process.env.GUARDIAN_POLICY_FILE_ID;
  if (!fileId) {
    // Return default policy for demo
    return getDefaultPolicy();
  }

  try {
    const content = await readFile(fileId);
    return JSON.parse(content);
  } catch {
    return getDefaultPolicy();
  }
}

function getDefaultPolicy(): Record<string, unknown> {
  return {
    policyName: 'AquaVera Water Stewardship MRV Policy',
    policyVersion: '1.0.0',
    description: 'Measurement, Reporting, and Verification policy for water stewardship credits on the AquaVera platform.',
    standardsAlignment: ['AWS', 'GRI 303', 'UN SDG 6', 'CDP Water Security'],
    projectTypes: {
      conservation: { description: 'Water conservation and efficiency projects' },
      restoration: { description: 'Watershed and habitat restoration projects' },
      recycling: { description: 'Industrial water recycling and reuse projects' },
      access: { description: 'Community water access and harvesting projects' },
      efficiency: { description: 'Water use efficiency improvement projects' },
    },
    dataRequirements: {
      minimumReadingsPerDay: 24,
      requiredFields: ['flow_rate_liters_per_min', 'total_volume_liters', 'water_quality_ph', 'water_quality_tds', 'water_quality_turbidity', 'reservoir_level_percent'],
      optionalFields: ['gps_latitude', 'gps_longitude'],
      frequency: 'hourly',
    },
    anomalyDetection: {
      flow_rate_deviation_factor: ANOMALY_THRESHOLDS.flow_rate_deviation_factor,
      ph_min: ANOMALY_THRESHOLDS.ph_min,
      ph_max: ANOMALY_THRESHOLDS.ph_max,
      tds_max: ANOMALY_THRESHOLDS.tds_max,
      turbidity_max: ANOMALY_THRESHOLDS.turbidity_max,
    },
    creditCalculation: {
      baseRate: '1 WSC per 1000 liters',
      litersPerWSC: LITERS_PER_WSC,
      qualityTierMultipliers: QUALITY_MULTIPLIERS,
      waterStressZoneMultipliers: STRESS_MULTIPLIERS,
    },
    minimumDataCompleteness: 80,
    maximumAnomalyRate: 5,
    verificationPeriod: {
      minimum: '7 days',
      recommended: '30 days',
      maximum: '365 days',
    },
  };
}

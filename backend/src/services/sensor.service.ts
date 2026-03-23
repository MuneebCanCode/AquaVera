import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from './supabase';
import { submitMessage } from '../hedera/hcs.service';
import { hashData } from '../utils/hashing';
import { SENSOR_RANGES, ANOMALY_THRESHOLDS } from '../utils/constants';
import type { SensorReading, WaterProject } from '../types';

/**
 * Generate a mock sensor reading with realistic values.
 */
export function generateMockReading(project: WaterProject): Omit<SensorReading, 'id' | 'data_hash' | 'is_anomaly' | 'hcs_message_id' | 'hcs_consensus_timestamp' | 'created_at'> {
  const rand = (min: number, max: number) => min + Math.random() * (max - min);

  const flowRate = rand(5, 50);
  const totalVolume = flowRate * 60; // 1 hour of flow

  return {
    project_id: project.id,
    flow_rate_liters_per_min: parseFloat(flowRate.toFixed(2)),
    total_volume_liters: parseFloat(totalVolume.toFixed(2)),
    water_quality_ph: parseFloat(rand(SENSOR_RANGES.ph.min, SENSOR_RANGES.ph.max).toFixed(2)),
    water_quality_tds: parseFloat(rand(SENSOR_RANGES.tds.min, SENSOR_RANGES.tds.max).toFixed(1)),
    water_quality_turbidity: parseFloat(rand(SENSOR_RANGES.turbidity.min, SENSOR_RANGES.turbidity.max).toFixed(2)),
    reservoir_level_percent: parseFloat(rand(SENSOR_RANGES.reservoir_level.min, SENSOR_RANGES.reservoir_level.max).toFixed(1)),
    gps_latitude: project.latitude,
    gps_longitude: project.longitude,
    is_verified: false,
    reading_timestamp: new Date().toISOString(),
  };
}

/**
 * Detect if a sensor reading is anomalous based on thresholds.
 */
export function detectAnomaly(
  reading: Pick<SensorReading, 'flow_rate_liters_per_min' | 'water_quality_ph' | 'water_quality_tds' | 'water_quality_turbidity'>,
  avgFlowRate?: number
): boolean {
  if (reading.water_quality_ph < ANOMALY_THRESHOLDS.ph_min || reading.water_quality_ph > ANOMALY_THRESHOLDS.ph_max) return true;
  if (reading.water_quality_tds > ANOMALY_THRESHOLDS.tds_max) return true;
  if (reading.water_quality_turbidity > ANOMALY_THRESHOLDS.turbidity_max) return true;
  if (avgFlowRate && Math.abs(reading.flow_rate_liters_per_min - avgFlowRate) > avgFlowRate * ANOMALY_THRESHOLDS.flow_rate_deviation_factor) return true;
  return false;
}


/**
 * Simulate a sensor reading: generate, hash, detect anomaly, store in DB, submit to HCS.
 */
export async function simulateSensorReading(project: WaterProject): Promise<SensorReading> {
  const supabase = getSupabase();

  // Get average flow rate for anomaly detection
  const { data: recentReadings } = await supabase
    .from('sensor_readings')
    .select('flow_rate_liters_per_min')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const avgFlowRate = recentReadings && recentReadings.length > 0
    ? recentReadings.reduce((sum: number, r: { flow_rate_liters_per_min: number }) => sum + r.flow_rate_liters_per_min, 0) / recentReadings.length
    : undefined;

  // Generate mock reading
  const mockData = generateMockReading(project);

  // Compute hash of reading data
  const dataFields = {
    flow_rate_liters_per_min: mockData.flow_rate_liters_per_min,
    total_volume_liters: mockData.total_volume_liters,
    water_quality_ph: mockData.water_quality_ph,
    water_quality_tds: mockData.water_quality_tds,
    water_quality_turbidity: mockData.water_quality_turbidity,
    reservoir_level_percent: mockData.reservoir_level_percent,
    gps_latitude: mockData.gps_latitude,
    gps_longitude: mockData.gps_longitude,
    reading_timestamp: mockData.reading_timestamp,
  };
  const dataHash = hashData(dataFields);

  // Detect anomaly
  const isAnomaly = detectAnomaly(mockData, avgFlowRate);

  // Submit hash to project's HCS topic
  let hcsMessageId: string | null = null;
  let hcsConsensusTimestamp: string | null = null;

  const isValidTopicId = project.hcs_topic_id && /^0\.0\.\d+$/.test(project.hcs_topic_id);

  if (isValidTopicId) {
    const hcsResult = await submitMessage(project.hcs_topic_id!, {
      event_type: 'sensor_data_submission',
      timestamp: mockData.reading_timestamp,
      entity_id: project.id,
      actor_did: '',
      data_hash: dataHash,
      metadata: { is_anomaly: isAnomaly },
    });
    hcsMessageId = hcsResult.messageId;
    hcsConsensusTimestamp = hcsResult.consensusTimestamp;
  }

  // Store in database
  const reading: SensorReading = {
    id: uuidv4(),
    ...mockData,
    data_hash: dataHash,
    is_anomaly: isAnomaly,
    hcs_message_id: hcsMessageId,
    hcs_consensus_timestamp: hcsConsensusTimestamp,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('sensor_readings').insert(reading);
  if (error) throw new Error(error.message);

  return reading;
}

/**
 * Bulk-simulate sensor readings for a project (fills a given number of days with hourly data).
 * Skips HCS submission for speed. Useful for testing the full verify & mint flow.
 */
export async function bulkSimulateReadings(
  project: WaterProject,
  days: number = 30
): Promise<{ count: number }> {
  const supabase = getSupabase();
  const now = Date.now();

  // Clear existing readings for this project to avoid stacking duplicates
  await supabase.from('sensor_readings').delete().eq('project_id', project.id);

  const avgFlowRate = project.baseline_daily_liters / (24 * 60);
  // Generate readings ~30% above baseline to simulate real water stewardship impact
  // (baseline is the pre-project usage; actual readings should exceed it to earn credits)
  const impactFlowRate = avgFlowRate * 1.3;
  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  let count = 0;

  for (let hour = 0; hour < days * 24; hour++) {
    const ts = new Date(now - (days * 24 - hour) * 3600000);
    const flowRate = rand(impactFlowRate * 0.85, impactFlowRate * 1.15);
    const totalVolume = flowRate * 60;

    const mockData = {
      project_id: project.id,
      flow_rate_liters_per_min: parseFloat(flowRate.toFixed(2)),
      total_volume_liters: parseFloat(totalVolume.toFixed(2)),
      water_quality_ph: parseFloat(rand(SENSOR_RANGES.ph.min, SENSOR_RANGES.ph.max).toFixed(2)),
      water_quality_tds: parseFloat(rand(SENSOR_RANGES.tds.min, SENSOR_RANGES.tds.max).toFixed(1)),
      water_quality_turbidity: parseFloat(rand(SENSOR_RANGES.turbidity.min, SENSOR_RANGES.turbidity.max).toFixed(2)),
      reservoir_level_percent: parseFloat(rand(SENSOR_RANGES.reservoir_level.min, SENSOR_RANGES.reservoir_level.max).toFixed(1)),
      gps_latitude: project.latitude,
      gps_longitude: project.longitude,
      is_verified: true,
      reading_timestamp: ts.toISOString(),
    };

    const dataHash = hashData({
      flow_rate_liters_per_min: mockData.flow_rate_liters_per_min,
      total_volume_liters: mockData.total_volume_liters,
      water_quality_ph: mockData.water_quality_ph,
      water_quality_tds: mockData.water_quality_tds,
      water_quality_turbidity: mockData.water_quality_turbidity,
      reservoir_level_percent: mockData.reservoir_level_percent,
      gps_latitude: mockData.gps_latitude,
      gps_longitude: mockData.gps_longitude,
      reading_timestamp: mockData.reading_timestamp,
    });

    const isAnomaly = detectAnomaly(mockData, avgFlowRate);

    const reading: SensorReading = {
      id: uuidv4(),
      ...mockData,
      data_hash: dataHash,
      is_anomaly: isAnomaly,
      hcs_message_id: null,
      hcs_consensus_timestamp: null,
      created_at: ts.toISOString(),
    };

    const { error } = await supabase.from('sensor_readings').insert(reading);
    if (!error) count++;
  }

  return { count };
}

/**
 * Get sensor readings for a project with pagination.
 */
export async function getReadings(
  projectId: string,
  page: number = 1,
  limit: number = 10
): Promise<{ readings: SensorReading[]; total: number }> {
  const supabase = getSupabase();
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('sensor_readings')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .order('reading_timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);
  return { readings: (data || []) as SensorReading[], total: count || 0 };
}

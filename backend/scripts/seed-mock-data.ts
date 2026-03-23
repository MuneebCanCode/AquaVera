/**
 * seed-mock-data.ts
 *
 * LEGACY SCRIPT — Data is now seeded automatically on server startup via seed.ts.
 * This script is kept for reference but is no longer required.
 * If you need to seed Hedera on-chain data, use seed-hedera.ts instead.
 *
 * Original purpose: Seeds the data store with demo data:
 *   1. 6 demo user accounts
 *   2. 3 water projects (status: active)
 *   3. ~6,480 sensor readings (90 days hourly × 3 projects, ~2-3% anomalies)
 *   4. 8 marketplace listings (4 active, 2 partially_filled, 2 sold)
 *   5. 5 completed trades with revenue split
 *   6. 3 retirements
 *   7. Community rewards for all 5 trades
 *   8. Notifications for all demo users
 *
 * Run: npx ts-node scripts/seed-mock-data.ts
 */

import 'dotenv/config';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '../src/services/supabase';
import { REVENUE_SPLIT, SENSOR_RANGES, ANOMALY_THRESHOLDS, LITERS_PER_WSC } from '../src/utils/constants';
import { deterministicJsonSerialize } from '../src/hedera/hcs.service';

const supabase = getSupabase();

// ─── Demo Account Definitions ────────────────────────────────────────────────

const DEMO_PASSWORD = 'AquaDemo2025!';

interface DemoAccount {
  email: string;
  full_name: string;
  organization_name: string;
  role: string;
  industry: string | null;
  water_footprint_liters_annual: number | null;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'demo-operator1@aquavera.app',
    full_name: 'Sarah Mitchell',
    organization_name: 'Colorado Water Trust',
    role: 'project_operator',
    industry: null,
    water_footprint_liters_annual: null,
  },
  {
    email: 'demo-operator2@aquavera.app',
    full_name: 'Rajesh Patel',
    organization_name: 'Mumbai AquaCycle Industries',
    role: 'project_operator',
    industry: null,
    water_footprint_liters_annual: null,
  },
  {
    email: 'demo-operator3@aquavera.app',
    full_name: 'Amina Odhiambo',
    organization_name: 'Kenya RainHarvest Foundation',
    role: 'project_operator',
    industry: null,
    water_footprint_liters_annual: null,
  },
  {
    email: 'demo-buyer1@aquavera.app',
    full_name: 'James Chen',
    organization_name: 'TechNova Semiconductors',
    role: 'corporate_buyer',
    industry: 'Semiconductor Manufacturing',
    water_footprint_liters_annual: 12400000000,
  },
  {
    email: 'demo-buyer2@aquavera.app',
    full_name: 'Maria Santos',
    organization_name: 'GreenBev Drinks Co.',
    role: 'corporate_buyer',
    industry: 'Beverage Manufacturing',
    water_footprint_liters_annual: 5600000000,
  },
  {
    email: 'demo-verifier@aquavera.app',
    full_name: 'Dr. Henrik Larsson',
    organization_name: 'EcoAudit Global',
    role: 'verifier',
    industry: null,
    water_footprint_liters_annual: null,
  },
];

// ─── Demo Project Definitions ────────────────────────────────────────────────

interface DemoProject {
  project_name: string;
  owner_index: number; // index into DEMO_ACCOUNTS
  project_type: string;
  description: string;
  location_name: string;
  latitude: number;
  longitude: number;
  watershed_name: string;
  water_stress_zone: string;
  baseline_daily_liters: number;
  sensor_types: string[];
  total_wsc_minted: number;
}

const DEMO_PROJECTS: DemoProject[] = [
  {
    project_name: 'Colorado River Watershed Restoration',
    owner_index: 0,
    project_type: 'restoration',
    description:
      'Large-scale watershed restoration project along the Colorado River, focusing on riparian habitat recovery, sediment reduction, and water flow optimization through natural infrastructure.',
    location_name: 'Grand Junction, Colorado, USA',
    latitude: 39.0639,
    longitude: -108.5506,
    watershed_name: 'Colorado River Basin',
    water_stress_zone: 'high',
    baseline_daily_liters: 50000,
    sensor_types: ['flow_meter', 'quality_sensor', 'level_sensor'],
    total_wsc_minted: 2400,
  },
  {
    project_name: 'Industrial Water Recycling Plant',
    owner_index: 1,
    project_type: 'recycling',
    description:
      'State-of-the-art industrial water recycling facility in Mumbai that treats and recycles wastewater from textile and chemical manufacturing, reducing freshwater withdrawal by 80%.',
    location_name: 'Mumbai, Maharashtra, India',
    latitude: 19.076,
    longitude: 72.8777,
    watershed_name: 'Mithi River Basin',
    water_stress_zone: 'extreme',
    baseline_daily_liters: 80000,
    sensor_types: ['flow_meter', 'quality_sensor'],
    total_wsc_minted: 3600,
  },
  {
    project_name: 'Community Rainwater Harvesting Network',
    owner_index: 2,
    project_type: 'access',
    description:
      'Network of community-managed rainwater harvesting systems across peri-urban Nairobi, providing clean water access to 15,000 households and reducing reliance on depleted groundwater.',
    location_name: 'Nairobi, Kenya',
    latitude: -1.2921,
    longitude: 36.8219,
    watershed_name: 'Athi River Basin',
    water_stress_zone: 'extreme',
    baseline_daily_liters: 30000,
    sensor_types: ['flow_meter', 'level_sensor'],
    total_wsc_minted: 1800,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function hashSensorData(data: Record<string, unknown>): string {
  const serialized = deterministicJsonSerialize(data);
  return createHash('sha256').update(serialized, 'utf8').digest('hex');
}

function isAnomaly(reading: {
  flow_rate_liters_per_min: number;
  water_quality_ph: number;
  water_quality_tds: number;
  water_quality_turbidity: number;
  avgFlowRate: number;
}): boolean {
  if (Math.abs(reading.flow_rate_liters_per_min - reading.avgFlowRate) > ANOMALY_THRESHOLDS.flow_rate_deviation_factor * reading.avgFlowRate) return true;
  if (reading.water_quality_ph < ANOMALY_THRESHOLDS.ph_min || reading.water_quality_ph > ANOMALY_THRESHOLDS.ph_max) return true;
  if (reading.water_quality_tds > ANOMALY_THRESHOLDS.tds_max) return true;
  if (reading.water_quality_turbidity > ANOMALY_THRESHOLDS.turbidity_max) return true;
  return false;
}

// ─── Step 1: Create Demo Accounts ────────────────────────────────────────────

async function createDemoAccounts(): Promise<string[]> {
  console.log('Step 1/7: Creating 6 demo accounts...');
  const userIds: string[] = [];

  for (const account of DEMO_ACCOUNTS) {
    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: account.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });

    if (authError) {
      // If user already exists, fetch their ID
      if (authError.message?.includes('already') || authError.message?.includes('duplicate')) {
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existing = existingUsers?.users?.find((u) => u.email === account.email);
        if (existing) {
          console.log(`  ⚠ ${account.email} already exists, reusing.`);
          userIds.push(existing.id);
          continue;
        }
      }
      throw new Error(`Failed to create auth user ${account.email}: ${authError.message}`);
    }

    const userId = authData.user.id;

    // Insert into users table
    const { error: insertError } = await supabase.from('users').upsert({
      id: userId,
      email: account.email,
      full_name: account.full_name,
      organization_name: account.organization_name,
      role: account.role,
      industry: account.industry,
      water_footprint_liters_annual: account.water_footprint_liters_annual,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) throw new Error(`Failed to insert user ${account.email}: ${insertError.message}`);

    userIds.push(userId);
    console.log(`  ✓ ${account.full_name} (${account.role}) — ${account.email}`);
  }

  console.log('');
  return userIds;
}

// ─── Step 2: Create Demo Projects ────────────────────────────────────────────

async function createDemoProjects(userIds: string[]): Promise<string[]> {
  console.log('Step 2/7: Creating 3 water projects...');
  const projectIds: string[] = [];
  const verifierId = userIds[5]; // Dr. Henrik Larsson

  for (let i = 0; i < DEMO_PROJECTS.length; i++) {
    const proj = DEMO_PROJECTS[i];
    const projectId = uuidv4();
    const ownerId = userIds[proj.owner_index];

    const { error } = await supabase.from('water_projects').upsert({
      id: projectId,
      owner_id: ownerId,
      project_name: proj.project_name,
      project_type: proj.project_type,
      description: proj.description,
      location_name: proj.location_name,
      latitude: proj.latitude,
      longitude: proj.longitude,
      watershed_name: proj.watershed_name,
      water_stress_zone: proj.water_stress_zone,
      baseline_daily_liters: proj.baseline_daily_liters,
      sensor_types: proj.sensor_types,
      status: 'active',
      verifier_id: verifierId,
      verification_date: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString(),
      verification_notes: 'All sensor data verified. Project meets MRV policy requirements.',
      hcs_topic_id: process.env[`HCS_PROJECT_TOPIC_${i + 1}`] || `placeholder-topic-${i + 1}`,
      total_wsc_minted: proj.total_wsc_minted,
      guardian_policy_id: process.env.GUARDIAN_POLICY_FILE_ID || 'placeholder-policy',
      created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) throw new Error(`Failed to create project ${proj.project_name}: ${error.message}`);

    projectIds.push(projectId);
    console.log(`  ✓ ${proj.project_name} (${proj.project_type}, ${proj.water_stress_zone})`);
  }

  console.log('');
  return projectIds;
}

// ─── Step 3: Generate Sensor Readings ────────────────────────────────────────

async function generateSensorReadings(projectIds: string[]): Promise<void> {
  console.log('Step 3/7: Generating ~6,480 sensor readings (90 days × 24h × 3 projects)...');

  const now = Date.now();
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

  for (let pIdx = 0; pIdx < DEMO_PROJECTS.length; pIdx++) {
    const proj = DEMO_PROJECTS[pIdx];
    const projectId = projectIds[pIdx];
    const readings: Record<string, unknown>[] = [];

    // Average flow rate for anomaly detection baseline
    const avgFlowRate = proj.baseline_daily_liters / (24 * 60); // liters per minute

    for (let hour = 0; hour < 90 * 24; hour++) {
      const timestamp = new Date(ninetyDaysAgo + hour * 60 * 60 * 1000);

      // Decide if this reading should be an anomaly (~2.5% chance)
      const forceAnomaly = Math.random() < 0.025;

      let flow_rate: number;
      let ph: number;
      let tds: number;
      let turbidity: number;
      let reservoir: number;

      if (forceAnomaly) {
        // Generate anomalous values
        const anomalyType = Math.floor(Math.random() * 4);
        flow_rate = anomalyType === 0 ? avgFlowRate * (4 + Math.random() * 3) : roundTo(randomInRange(avgFlowRate * 0.7, avgFlowRate * 1.3), 2);
        ph = anomalyType === 1 ? roundTo(randomInRange(3.0, 4.5), 2) : roundTo(randomInRange(SENSOR_RANGES.ph.min, SENSOR_RANGES.ph.max), 2);
        tds = anomalyType === 2 ? roundTo(randomInRange(2500, 4000), 1) : roundTo(randomInRange(SENSOR_RANGES.tds.min, SENSOR_RANGES.tds.max), 1);
        turbidity = anomalyType === 3 ? roundTo(randomInRange(12.0, 25.0), 2) : roundTo(randomInRange(SENSOR_RANGES.turbidity.min, SENSOR_RANGES.turbidity.max), 2);
        reservoir = roundTo(randomInRange(SENSOR_RANGES.reservoir_level.min, SENSOR_RANGES.reservoir_level.max), 1);
      } else {
        // Normal values with small natural variation
        flow_rate = roundTo(randomInRange(avgFlowRate * 0.8, avgFlowRate * 1.2), 2);
        ph = roundTo(randomInRange(SENSOR_RANGES.ph.min, SENSOR_RANGES.ph.max), 2);
        tds = roundTo(randomInRange(SENSOR_RANGES.tds.min, SENSOR_RANGES.tds.max), 1);
        turbidity = roundTo(randomInRange(SENSOR_RANGES.turbidity.min, SENSOR_RANGES.turbidity.max), 2);
        reservoir = roundTo(randomInRange(SENSOR_RANGES.reservoir_level.min, SENSOR_RANGES.reservoir_level.max), 1);
      }

      flow_rate = roundTo(flow_rate, 2);
      const total_volume = roundTo(flow_rate * 60, 2); // 1 hour of flow

      const sensorData = {
        flow_rate_liters_per_min: flow_rate,
        total_volume_liters: total_volume,
        water_quality_ph: ph,
        water_quality_tds: tds,
        water_quality_turbidity: turbidity,
        reservoir_level_percent: reservoir,
        gps_latitude: proj.latitude,
        gps_longitude: proj.longitude,
      };

      const data_hash = hashSensorData(sensorData);
      const anomalyFlag = isAnomaly({
        flow_rate_liters_per_min: flow_rate,
        water_quality_ph: ph,
        water_quality_tds: tds,
        water_quality_turbidity: turbidity,
        avgFlowRate,
      });

      readings.push({
        id: uuidv4(),
        project_id: projectId,
        ...sensorData,
        data_hash,
        is_anomaly: anomalyFlag,
        is_verified: true,
        reading_timestamp: timestamp.toISOString(),
        created_at: timestamp.toISOString(),
      });

      // Batch insert every 500 readings to avoid payload limits
      if (readings.length >= 500) {
        const { error } = await supabase.from('sensor_readings').insert(readings);
        if (error) throw new Error(`Failed to insert sensor readings: ${error.message}`);
        readings.length = 0;
      }
    }

    // Insert remaining readings
    if (readings.length > 0) {
      const { error } = await supabase.from('sensor_readings').insert(readings);
      if (error) throw new Error(`Failed to insert sensor readings: ${error.message}`);
    }

    console.log(`  ✓ Project ${pIdx + 1}: 2,160 readings generated`);
  }

  console.log('');
}

// ─── Step 4: Create Minting Events ──────────────────────────────────────────

async function createMintingEvents(projectIds: string[]): Promise<void> {
  console.log('Step 4/7: Creating WSC minting events...');

  const mintingData = [
    { projectIdx: 0, final_wsc_minted: 2400, quality_tier: 'tier_1', stress_zone: 'high' },
    { projectIdx: 1, final_wsc_minted: 3600, quality_tier: 'tier_1', stress_zone: 'extreme' },
    { projectIdx: 2, final_wsc_minted: 1800, quality_tier: 'tier_1', stress_zone: 'extreme' },
  ];

  const qualityMultipliers: Record<string, number> = { tier_1: 1.0, tier_2: 1.2, tier_3: 1.5 };
  const stressMultipliers: Record<string, number> = { low: 1.0, medium: 1.3, high: 1.5, extreme: 2.0 };

  for (const mint of mintingData) {
    const qm = qualityMultipliers[mint.quality_tier];
    const sm = stressMultipliers[mint.stress_zone];
    const base_credits = mint.final_wsc_minted / (qm * sm);
    const net_water_impact = base_credits * LITERS_PER_WSC;

    const periodEnd = new Date();
    const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const { error } = await supabase.from('wsc_minting_events').insert({
      id: uuidv4(),
      project_id: projectIds[mint.projectIdx],
      verification_period_start: periodStart.toISOString(),
      verification_period_end: periodEnd.toISOString(),
      net_water_impact_liters: Math.round(net_water_impact),
      base_credits: roundTo(base_credits, 2),
      quality_tier: mint.quality_tier,
      quality_multiplier: qm,
      stress_multiplier: sm,
      final_wsc_minted: mint.final_wsc_minted,
      hedera_transaction_id: 'pending-hedera-seed',
      hcs_message_id: 'pending-hedera-seed',
      guardian_verification_ref: process.env.GUARDIAN_POLICY_FILE_ID || 'placeholder-policy',
      created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (error) throw new Error(`Failed to create minting event: ${error.message}`);
    console.log(`  ✓ Project ${mint.projectIdx + 1}: ${mint.final_wsc_minted} WSC minted (${mint.quality_tier}, ${mint.stress_zone})`);
  }

  console.log('');
}

// ─── Step 5: Create Marketplace Listings & Trades ────────────────────────────

async function createListingsAndTrades(
  userIds: string[],
  projectIds: string[]
): Promise<{ listingIds: string[]; tradeIds: string[] }> {
  console.log('Step 5/7: Creating 8 listings and 5 trades...');

  const operator1 = userIds[0]; // Sarah Mitchell
  const operator2 = userIds[1]; // Rajesh Patel
  const operator3 = userIds[2]; // Amina Odhiambo
  const buyer1 = userIds[3];    // James Chen
  const buyer2 = userIds[4];    // Maria Santos
  const verifier = userIds[5];  // Dr. Henrik Larsson

  // 8 listings: 4 active, 2 partially_filled, 2 sold
  const listings = [
    // Active listings
    { seller: operator1, project: 0, qty: 200, price: 12.5, remaining: 200, status: 'active', credit_type: 'restoration' },
    { seller: operator1, project: 0, qty: 300, price: 13.0, remaining: 300, status: 'active', credit_type: 'restoration' },
    { seller: operator2, project: 1, qty: 500, price: 15.0, remaining: 500, status: 'active', credit_type: 'recycling' },
    { seller: operator3, project: 2, qty: 150, price: 18.0, remaining: 150, status: 'active', credit_type: 'access' },
    // Partially filled
    { seller: operator1, project: 0, qty: 400, price: 11.0, remaining: 150, status: 'partially_filled', credit_type: 'restoration' },
    { seller: operator2, project: 1, qty: 600, price: 14.0, remaining: 200, status: 'partially_filled', credit_type: 'recycling' },
    // Sold
    { seller: operator2, project: 1, qty: 300, price: 13.5, remaining: 0, status: 'sold', credit_type: 'recycling' },
    { seller: operator3, project: 2, qty: 200, price: 16.0, remaining: 0, status: 'sold', credit_type: 'access' },
  ];

  const listingIds: string[] = [];
  for (const l of listings) {
    const listingId = uuidv4();
    const proj = DEMO_PROJECTS[l.project];

    const { error } = await supabase.from('marketplace_listings').insert({
      id: listingId,
      seller_id: l.seller,
      project_id: projectIds[l.project],
      quantity_wsc: l.qty,
      price_per_wsc_hbar: l.price,
      credit_type: l.credit_type,
      quality_tier: 'tier_1',
      watershed_name: proj.watershed_name,
      water_stress_zone: proj.water_stress_zone,
      quantity_remaining: l.remaining,
      status: l.status,
      created_at: new Date(Date.now() - Math.floor(Math.random() * 15 + 5) * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) throw new Error(`Failed to create listing: ${error.message}`);
    listingIds.push(listingId);
  }
  console.log(`  ✓ 8 marketplace listings created`);

  // 5 trades (matching the partially_filled and sold listings)
  const trades = [
    { listing: 4, buyer: buyer1, seller: operator1, project: 0, qty: 250, price: 11.0 },  // partial fill of listing 4
    { listing: 5, buyer: buyer2, seller: operator2, project: 1, qty: 400, price: 14.0 },  // partial fill of listing 5
    { listing: 6, buyer: buyer1, seller: operator2, project: 1, qty: 300, price: 13.5 },  // sold listing 6
    { listing: 7, buyer: buyer2, seller: operator3, project: 2, qty: 200, price: 16.0 },  // sold listing 7
    { listing: 5, buyer: buyer1, seller: operator2, project: 1, qty: 100, price: 14.0 },  // another partial of listing 5 (total 500 of 600 → 100 remaining → but we set 200 remaining, so this is 400 from first trade)
  ];

  const tradeIds: string[] = [];
  for (const t of trades) {
    const tradeId = uuidv4();
    const total_hbar = t.qty * t.price;
    const seller_receives = roundTo(total_hbar * REVENUE_SPLIT.SELLER, 2);
    const community_fund = roundTo(total_hbar * REVENUE_SPLIT.COMMUNITY, 2);
    const verifier_fee = roundTo(total_hbar * REVENUE_SPLIT.VERIFIER, 2);
    const platform_fee = roundTo(total_hbar * REVENUE_SPLIT.PLATFORM, 2);

    const { error } = await supabase.from('trades').insert({
      id: tradeId,
      listing_id: listingIds[t.listing],
      buyer_id: t.buyer,
      seller_id: t.seller,
      project_id: projectIds[t.project],
      quantity_wsc: t.qty,
      price_per_wsc_hbar: t.price,
      total_hbar,
      platform_fee_hbar: platform_fee,
      community_fund_hbar: community_fund,
      verifier_fee_hbar: verifier_fee,
      seller_receives_hbar: seller_receives,
      payment_method: 'hbar',
      settlement_method: 'atomic_transfer',
      hedera_transaction_id: 'pending-hedera-seed',
      hcs_message_id: 'pending-hedera-seed',
      status: 'completed',
      created_at: new Date(Date.now() - Math.floor(Math.random() * 10 + 1) * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (error) throw new Error(`Failed to create trade: ${error.message}`);
    tradeIds.push(tradeId);
  }
  console.log(`  ✓ 5 completed trades created\n`);

  return { listingIds, tradeIds };
}

// ─── Step 6: Create Retirements ──────────────────────────────────────────────

async function createRetirements(
  userIds: string[],
  projectIds: string[]
): Promise<string[]> {
  console.log('Step 6/7: Creating 3 retirements...');

  const retirements = [
    {
      buyer: userIds[3], // James Chen — TechNova
      qty: 500,
      purpose: 'Offsetting semiconductor fabrication water usage for Q3 2025',
      facility_name: 'TechNova Austin Fab',
      project: 0,
      framework: 'GRI 303',
    },
    {
      buyer: userIds[3], // James Chen — TechNova
      qty: 300,
      purpose: 'Annual corporate water stewardship commitment',
      facility_name: 'TechNova Global HQ',
      project: 1,
      framework: 'CDP Water Security',
    },
    {
      buyer: userIds[4], // Maria Santos — GreenBev
      qty: 200,
      purpose: 'Beverage production water neutrality program',
      facility_name: null,
      project: 2,
      framework: 'CSRD',
    },
  ];

  const retirementIds: string[] = [];
  for (const r of retirements) {
    const retirementId = uuidv4();
    const proj = DEMO_PROJECTS[r.project];

    const { error } = await supabase.from('retirements').insert({
      id: retirementId,
      buyer_id: r.buyer,
      quantity_wsc_retired: r.qty,
      equivalent_liters: r.qty * LITERS_PER_WSC,
      purpose: r.purpose,
      facility_name: r.facility_name,
      source_project_id: projectIds[r.project],
      source_watershed: proj.watershed_name,
      compliance_framework: r.framework,
      hedera_burn_transaction_id: 'pending-hedera-seed',
      hcs_retirement_message_id: 'pending-hedera-seed',
      nft_certificate_token_id: process.env.NFT_CERTIFICATE_TOKEN_ID || 'pending-hedera-seed',
      nft_certificate_serial: 0,
      nft_metadata_hfs_file_id: 'pending-hedera-seed',
      verifiable_credential_id: 'pending-hedera-seed',
      created_at: new Date(Date.now() - Math.floor(Math.random() * 7 + 1) * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (error) throw new Error(`Failed to create retirement: ${error.message}`);
    retirementIds.push(retirementId);
    console.log(`  ✓ ${r.qty} WSC retired by ${DEMO_ACCOUNTS[r.buyer === userIds[3] ? 3 : 4].organization_name} (${r.framework})`);
  }

  console.log('');
  return retirementIds;
}

// ─── Step 7: Create Community Rewards & Notifications ────────────────────────

async function createRewardsAndNotifications(
  userIds: string[],
  projectIds: string[],
  tradeIds: string[]
): Promise<void> {
  console.log('Step 7/7: Creating community rewards and notifications...');

  // Community rewards for all 5 trades
  const tradeProjectMap = [0, 1, 1, 2, 1]; // which project each trade belongs to
  const tradeAmounts = [250 * 11.0, 400 * 14.0, 300 * 13.5, 200 * 16.0, 100 * 14.0];

  for (let i = 0; i < tradeIds.length; i++) {
    const rewardAmount = roundTo(tradeAmounts[i] * REVENUE_SPLIT.COMMUNITY, 2);
    const projectIdx = tradeProjectMap[i];

    const { error } = await supabase.from('community_rewards').insert({
      id: uuidv4(),
      project_id: projectIds[projectIdx],
      trade_id: tradeIds[i],
      reward_amount_hbar: rewardAmount,
      recipient_hedera_account_id: 'pending-hedera-seed',
      hedera_transaction_id: 'pending-hedera-seed',
      hcs_message_id: 'pending-hedera-seed',
      created_at: new Date(Date.now() - (5 - i) * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (error) throw new Error(`Failed to create community reward: ${error.message}`);
  }
  console.log(`  ✓ 5 community rewards created`);

  // Notifications for all demo users
  const notifications = [
    // Trade notifications for buyers
    { user: userIds[3], type: 'trade', title: 'Trade Completed', message: 'You purchased 250 WSC from Colorado Water Trust for 2,750 HBAR.' },
    { user: userIds[3], type: 'trade', title: 'Trade Completed', message: 'You purchased 300 WSC from Mumbai AquaCycle Industries for 4,050 HBAR.' },
    { user: userIds[3], type: 'trade', title: 'Trade Completed', message: 'You purchased 100 WSC from Mumbai AquaCycle Industries for 1,400 HBAR.' },
    { user: userIds[4], type: 'trade', title: 'Trade Completed', message: 'You purchased 400 WSC from Mumbai AquaCycle Industries for 5,600 HBAR.' },
    { user: userIds[4], type: 'trade', title: 'Trade Completed', message: 'You purchased 200 WSC from Kenya RainHarvest Foundation for 3,200 HBAR.' },
    // Trade notifications for sellers
    { user: userIds[0], type: 'trade', title: 'Credits Sold', message: 'You sold 250 WSC to TechNova Semiconductors. You received 1,925 HBAR.' },
    { user: userIds[1], type: 'trade', title: 'Credits Sold', message: 'You sold 400 WSC to GreenBev Drinks Co. You received 3,920 HBAR.' },
    { user: userIds[1], type: 'trade', title: 'Credits Sold', message: 'You sold 300 WSC to TechNova Semiconductors. You received 2,835 HBAR.' },
    { user: userIds[2], type: 'trade', title: 'Credits Sold', message: 'You sold 200 WSC to GreenBev Drinks Co. You received 2,240 HBAR.' },
    { user: userIds[1], type: 'trade', title: 'Credits Sold', message: 'You sold 100 WSC to TechNova Semiconductors. You received 980 HBAR.' },
    // Verification notifications
    { user: userIds[0], type: 'verification', title: 'Project Verified', message: 'Colorado River Watershed Restoration has been verified by EcoAudit Global.' },
    { user: userIds[1], type: 'verification', title: 'Project Verified', message: 'Industrial Water Recycling Plant has been verified by EcoAudit Global.' },
    { user: userIds[2], type: 'verification', title: 'Project Verified', message: 'Community Rainwater Harvesting Network has been verified by EcoAudit Global.' },
    // Minting notifications
    { user: userIds[0], type: 'minting', title: 'WSC Tokens Minted', message: '2,400 WSC minted for Colorado River Watershed Restoration (tier_1, high stress zone, 1.5x multiplier).' },
    { user: userIds[1], type: 'minting', title: 'WSC Tokens Minted', message: '3,600 WSC minted for Industrial Water Recycling Plant (tier_1, extreme stress zone, 2.0x multiplier).' },
    { user: userIds[2], type: 'minting', title: 'WSC Tokens Minted', message: '1,800 WSC minted for Community Rainwater Harvesting Network (tier_1, extreme stress zone, 2.0x multiplier).' },
    // Retirement notifications
    { user: userIds[3], type: 'retirement', title: 'Credits Retired', message: 'You retired 500 WSC (500,000 liters offset). AVIC NFT certificate issued.' },
    { user: userIds[3], type: 'retirement', title: 'Credits Retired', message: 'You retired 300 WSC (300,000 liters offset). AVIC NFT certificate issued.' },
    { user: userIds[4], type: 'retirement', title: 'Credits Retired', message: 'You retired 200 WSC (200,000 liters offset). AVIC NFT certificate issued.' },
    // Community reward notifications
    { user: userIds[0], type: 'reward', title: 'Community Reward', message: 'Your community received 412.50 HBAR from a WSC trade.' },
    { user: userIds[1], type: 'reward', title: 'Community Reward', message: 'Your community received 840.00 HBAR from a WSC trade.' },
    { user: userIds[2], type: 'reward', title: 'Community Reward', message: 'Your community received 480.00 HBAR from a WSC trade.' },
  ];

  for (const n of notifications) {
    const { error } = await supabase.from('notifications').insert({
      id: uuidv4(),
      user_id: n.user,
      type: n.type,
      title: n.title,
      message: n.message,
      is_read: Math.random() > 0.6, // ~40% unread
      created_at: new Date(Date.now() - Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (error) throw new Error(`Failed to create notification: ${error.message}`);
  }
  console.log(`  ✓ ${notifications.length} notifications created\n`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║       AquaVera — Seed Mock Data Script                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const userIds = await createDemoAccounts();
  const projectIds = await createDemoProjects(userIds);
  await generateSensorReadings(projectIds);
  await createMintingEvents(projectIds);
  const { tradeIds } = await createListingsAndTrades(userIds, projectIds);
  await createRetirements(userIds, projectIds);
  await createRewardsAndNotifications(userIds, projectIds, tradeIds);

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                  Seed Data Complete!                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log('Summary:');
  console.log('  • 6 demo accounts created');
  console.log('  • 3 water projects created (active)');
  console.log('  • ~6,480 sensor readings generated');
  console.log('  • 3 minting events created');
  console.log('  • 8 marketplace listings created');
  console.log('  • 5 completed trades created');
  console.log('  • 3 retirements created');
  console.log('  • 5 community rewards created');
  console.log('  • 22 notifications created');
  console.log('\nNext: Run `npm run seed-hedera` to create Hedera on-chain data.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

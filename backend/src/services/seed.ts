/**
 * In-memory seed data — runs on server startup.
 * Populates the store with 6 demo users, 3 projects, ~6,480 sensor readings,
 * 8 listings, 5 trades, 3 retirements, community rewards, and notifications.
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getTable, getPasswordStore, loadFromDisk, saveToDisk } from './store';
import { hashData } from '../utils/hashing';
import { REVENUE_SPLIT, SENSOR_RANGES, ANOMALY_THRESHOLDS, LITERS_PER_WSC } from '../utils/constants';

const DEMO_PASSWORD = 'AquaDemo2025!';

function simpleHash(str: string): string {
  return createHash('sha256').update(str).digest('hex');
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ─── Demo Data Definitions ───────────────────────────────────────────────────

const DEMO_ACCOUNTS = [
  { email: 'demo-operator1@aquavera.app', full_name: 'Sarah Mitchell', organization_name: 'Colorado Water Trust', role: 'project_operator', industry: null, water_footprint_liters_annual: null },
  { email: 'demo-operator2@aquavera.app', full_name: 'Rajesh Patel', organization_name: 'Mumbai AquaCycle Industries', role: 'project_operator', industry: null, water_footprint_liters_annual: null },
  { email: 'demo-operator3@aquavera.app', full_name: 'Amina Odhiambo', organization_name: 'Kenya RainHarvest Foundation', role: 'project_operator', industry: null, water_footprint_liters_annual: null },
  { email: 'demo-buyer1@aquavera.app', full_name: 'James Chen', organization_name: 'TechNova Semiconductors', role: 'corporate_buyer', industry: 'Semiconductor Manufacturing', water_footprint_liters_annual: 12400000000 },
  { email: 'demo-buyer2@aquavera.app', full_name: 'Maria Santos', organization_name: 'GreenBev Drinks Co.', role: 'corporate_buyer', industry: 'Beverage Manufacturing', water_footprint_liters_annual: 5600000000 },
  { email: 'demo-verifier@aquavera.app', full_name: 'Dr. Henrik Larsson', organization_name: 'EcoAudit Global', role: 'verifier', industry: null, water_footprint_liters_annual: null },
];

const DEMO_PROJECTS = [
  { project_name: 'Colorado River Watershed Restoration', owner_index: 0, project_type: 'restoration', description: 'Large-scale watershed restoration project along the Colorado River.', location_name: 'Grand Junction, Colorado, USA', latitude: 39.0639, longitude: -108.5506, watershed_name: 'Colorado River Basin', water_stress_zone: 'high', baseline_daily_liters: 50000, sensor_types: ['flow_meter', 'quality_sensor', 'level_sensor'], total_wsc_minted: 2400 },
  { project_name: 'Industrial Water Recycling Plant', owner_index: 1, project_type: 'recycling', description: 'State-of-the-art industrial water recycling facility in Mumbai.', location_name: 'Mumbai, Maharashtra, India', latitude: 19.076, longitude: 72.8777, watershed_name: 'Mithi River Basin', water_stress_zone: 'extreme', baseline_daily_liters: 80000, sensor_types: ['flow_meter', 'quality_sensor'], total_wsc_minted: 3600 },
  { project_name: 'Community Rainwater Harvesting Network', owner_index: 2, project_type: 'access', description: 'Network of community-managed rainwater harvesting systems across peri-urban Nairobi.', location_name: 'Nairobi, Kenya', latitude: -1.2921, longitude: 36.8219, watershed_name: 'Athi River Basin', water_stress_zone: 'extreme', baseline_daily_liters: 30000, sensor_types: ['flow_meter', 'level_sensor'], total_wsc_minted: 1800 },
];

// ─── Seed Function ───────────────────────────────────────────────────────────

export function seedData(): void {
  // Try loading persisted data from disk first
  const loaded = loadFromDisk();
  if (loaded) {
    const users = getTable<Record<string, unknown>>('users');
    const readings = getTable<Record<string, unknown>>('sensor_readings');
    console.log(`Loaded persisted data from disk: ${users.length} users, ${readings.length} readings, and more.`);
    console.log('  ℹ To reset to fresh demo data, delete backend/data/store.json and restart.');
    return;
  }

  console.log('No persisted data found. Seeding in-memory data store...');
  const passwords = getPasswordStore();
  const users = getTable<Record<string, unknown>>('users');
  const projects = getTable<Record<string, unknown>>('water_projects');
  const readings = getTable<Record<string, unknown>>('sensor_readings');
  const mintingEvents = getTable<Record<string, unknown>>('wsc_minting_events');
  const listings = getTable<Record<string, unknown>>('marketplace_listings');
  const trades = getTable<Record<string, unknown>>('trades');
  const retirements = getTable<Record<string, unknown>>('retirements');
  const rewards = getTable<Record<string, unknown>>('community_rewards');
  const notifications = getTable<Record<string, unknown>>('notifications');

  // ── Step 1: Users ──
  const userIds: string[] = [];
  for (const acct of DEMO_ACCOUNTS) {
    const id = uuidv4();
    passwords.set(acct.email, simpleHash(DEMO_PASSWORD));
    users.push({
      id, email: acct.email, full_name: acct.full_name, organization_name: acct.organization_name,
      role: acct.role, industry: acct.industry, water_footprint_liters_annual: acct.water_footprint_liters_annual,
      hedera_account_id: null, hedera_private_key_encrypted: null, hedera_public_key: null, hedera_did: null,
      evm_address: null, profile_image_url: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    userIds.push(id);
  }
  console.log(`  ✓ 6 demo users created`);

  // ── Step 2: Projects ──
  const projectIds: string[] = [];
  const verifierId = userIds[5];
  for (let i = 0; i < DEMO_PROJECTS.length; i++) {
    const p = DEMO_PROJECTS[i];
    const id = uuidv4();
    projects.push({
      id, owner_id: userIds[p.owner_index], project_name: p.project_name, project_type: p.project_type,
      description: p.description, location_name: p.location_name, latitude: p.latitude, longitude: p.longitude,
      watershed_name: p.watershed_name, water_stress_zone: p.water_stress_zone, baseline_daily_liters: p.baseline_daily_liters,
      sensor_types: p.sensor_types, status: 'active', verifier_id: verifierId,
      verification_date: new Date(Date.now() - 85 * 86400000).toISOString(),
      verification_notes: 'All sensor data verified. Project meets MRV policy requirements.',
      hcs_topic_id: process.env[`HCS_PROJECT_TOPIC_${i + 1}`] || `placeholder-topic-${i + 1}`,
      total_wsc_minted: p.total_wsc_minted,
      guardian_policy_id: process.env.GUARDIAN_POLICY_FILE_ID || 'placeholder-policy',
      supporting_documents: [],
      created_at: new Date(Date.now() - 90 * 86400000).toISOString(), updated_at: new Date().toISOString(),
    });
    projectIds.push(id);
  }
  console.log(`  ✓ 3 water projects created`);

  // ── Step 3: Sensor Readings (~6,480) ──
  const now = Date.now();
  const ninetyDaysAgo = now - 90 * 86400000;
  for (let pIdx = 0; pIdx < DEMO_PROJECTS.length; pIdx++) {
    const proj = DEMO_PROJECTS[pIdx];
    const avgFlowRate = proj.baseline_daily_liters / (24 * 60);
    for (let hour = 0; hour < 90 * 24; hour++) {
      const ts = new Date(ninetyDaysAgo + hour * 3600000);
      const forceAnomaly = Math.random() < 0.025;
      let flow: number, ph: number, tds: number, turb: number, reservoir: number;
      if (forceAnomaly) {
        const t = Math.floor(Math.random() * 4);
        flow = t === 0 ? avgFlowRate * (4 + Math.random() * 3) : roundTo(randomInRange(avgFlowRate * 0.7, avgFlowRate * 1.3), 2);
        ph = t === 1 ? roundTo(randomInRange(3.0, 4.5), 2) : roundTo(randomInRange(SENSOR_RANGES.ph.min, SENSOR_RANGES.ph.max), 2);
        tds = t === 2 ? roundTo(randomInRange(2500, 4000), 1) : roundTo(randomInRange(SENSOR_RANGES.tds.min, SENSOR_RANGES.tds.max), 1);
        turb = t === 3 ? roundTo(randomInRange(12.0, 25.0), 2) : roundTo(randomInRange(SENSOR_RANGES.turbidity.min, SENSOR_RANGES.turbidity.max), 2);
        reservoir = roundTo(randomInRange(SENSOR_RANGES.reservoir_level.min, SENSOR_RANGES.reservoir_level.max), 1);
      } else {
        flow = roundTo(randomInRange(avgFlowRate * 0.8, avgFlowRate * 1.2), 2);
        ph = roundTo(randomInRange(SENSOR_RANGES.ph.min, SENSOR_RANGES.ph.max), 2);
        tds = roundTo(randomInRange(SENSOR_RANGES.tds.min, SENSOR_RANGES.tds.max), 1);
        turb = roundTo(randomInRange(SENSOR_RANGES.turbidity.min, SENSOR_RANGES.turbidity.max), 2);
        reservoir = roundTo(randomInRange(SENSOR_RANGES.reservoir_level.min, SENSOR_RANGES.reservoir_level.max), 1);
      }
      flow = roundTo(flow, 2);
      const sensorData = {
        flow_rate_liters_per_min: flow, total_volume_liters: roundTo(flow * 60, 2),
        water_quality_ph: ph, water_quality_tds: tds, water_quality_turbidity: turb,
        reservoir_level_percent: reservoir, gps_latitude: proj.latitude, gps_longitude: proj.longitude,
      };
      const readingTimestamp = ts.toISOString();
      const anomalyFlag = Math.abs(flow - avgFlowRate) > ANOMALY_THRESHOLDS.flow_rate_deviation_factor * avgFlowRate
        || ph < ANOMALY_THRESHOLDS.ph_min || ph > ANOMALY_THRESHOLDS.ph_max
        || tds > ANOMALY_THRESHOLDS.tds_max || turb > ANOMALY_THRESHOLDS.turbidity_max;
      readings.push({
        id: uuidv4(), project_id: projectIds[pIdx], ...sensorData,
        data_hash: hashData({ ...sensorData, reading_timestamp: readingTimestamp }), is_anomaly: anomalyFlag, is_verified: true,
        reading_timestamp: readingTimestamp, created_at: readingTimestamp,
      });
    }
  }
  console.log(`  ✓ ${readings.length} sensor readings generated`);

  // ── Step 4: Minting Events ──
  const mintData = [
    { pIdx: 0, wsc: 2400, tier: 'tier_1', zone: 'high' },
    { pIdx: 1, wsc: 3600, tier: 'tier_1', zone: 'extreme' },
    { pIdx: 2, wsc: 1800, tier: 'tier_1', zone: 'extreme' },
  ];
  const qm: Record<string, number> = { tier_1: 1.0, tier_2: 1.2, tier_3: 1.5 };
  const sm: Record<string, number> = { low: 1.0, medium: 1.3, high: 1.5, extreme: 2.0 };
  for (const m of mintData) {
    const base = m.wsc / (qm[m.tier] * sm[m.zone]);
    mintingEvents.push({
      id: uuidv4(), project_id: projectIds[m.pIdx],
      verification_period_start: new Date(Date.now() - 30 * 86400000).toISOString(),
      verification_period_end: new Date().toISOString(),
      net_water_impact_liters: Math.round(base * LITERS_PER_WSC),
      base_credits: roundTo(base, 2), quality_tier: m.tier, quality_multiplier: qm[m.tier],
      stress_multiplier: sm[m.zone], final_wsc_minted: m.wsc,
      hedera_transaction_id: 'pending-hedera-seed', hcs_message_id: 'pending-hedera-seed', guardian_verification_ref: 'pending-hedera-seed',
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    });
  }
  console.log(`  ✓ 3 minting events created`);

  // ── Step 5: Listings & Trades ──
  const [op1, op2, op3, b1, b2] = userIds;
  const listingDefs = [
    { seller: op1, pIdx: 0, qty: 200, price: 12.5, remaining: 200, status: 'active', credit_type: 'restoration' },
    { seller: op1, pIdx: 0, qty: 300, price: 13.0, remaining: 300, status: 'active', credit_type: 'restoration' },
    { seller: op2, pIdx: 1, qty: 500, price: 15.0, remaining: 500, status: 'active', credit_type: 'recycling' },
    { seller: op3, pIdx: 2, qty: 150, price: 18.0, remaining: 150, status: 'active', credit_type: 'access' },
    { seller: op1, pIdx: 0, qty: 400, price: 11.0, remaining: 150, status: 'partially_filled', credit_type: 'restoration' },
    { seller: op2, pIdx: 1, qty: 600, price: 14.0, remaining: 200, status: 'partially_filled', credit_type: 'recycling' },
    { seller: op2, pIdx: 1, qty: 300, price: 13.5, remaining: 0, status: 'sold', credit_type: 'recycling' },
    { seller: op3, pIdx: 2, qty: 200, price: 16.0, remaining: 0, status: 'sold', credit_type: 'access' },
  ];
  const listingIds: string[] = [];
  for (const l of listingDefs) {
    const id = uuidv4();
    const proj = DEMO_PROJECTS[l.pIdx];
    listings.push({
      id, seller_id: l.seller, project_id: projectIds[l.pIdx], quantity_wsc: l.qty,
      price_per_wsc_hbar: l.price, credit_type: l.credit_type, quality_tier: 'tier_1',
      watershed_name: proj.watershed_name, water_stress_zone: proj.water_stress_zone,
      quantity_remaining: l.remaining, status: l.status,
      created_at: new Date(Date.now() - (Math.random() * 15 + 5) * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    });
    listingIds.push(id);
  }
  console.log(`  ✓ 8 marketplace listings created`);

  const tradeDefs = [
    { lIdx: 4, buyer: b1, seller: op1, pIdx: 0, qty: 250, price: 11.0 },
    { lIdx: 5, buyer: b2, seller: op2, pIdx: 1, qty: 400, price: 14.0 },
    { lIdx: 6, buyer: b1, seller: op2, pIdx: 1, qty: 300, price: 13.5 },
    { lIdx: 7, buyer: b2, seller: op3, pIdx: 2, qty: 200, price: 16.0 },
    { lIdx: 5, buyer: b1, seller: op2, pIdx: 1, qty: 100, price: 14.0 },
  ];
  const tradeIds: string[] = [];
  for (const t of tradeDefs) {
    const id = uuidv4();
    const total = t.qty * t.price;
    trades.push({
      id, listing_id: listingIds[t.lIdx], buyer_id: t.buyer, seller_id: t.seller,
      project_id: projectIds[t.pIdx], quantity_wsc: t.qty, price_per_wsc_hbar: t.price,
      total_hbar: total, platform_fee_hbar: roundTo(total * REVENUE_SPLIT.PLATFORM, 2),
      community_fund_hbar: roundTo(total * REVENUE_SPLIT.COMMUNITY, 2),
      verifier_fee_hbar: roundTo(total * REVENUE_SPLIT.VERIFIER, 2),
      seller_receives_hbar: roundTo(total * REVENUE_SPLIT.SELLER, 2),
      payment_method: 'hbar', settlement_method: 'atomic_transfer',
      hedera_transaction_id: 'pending-hedera-seed', hcs_message_id: 'pending-hedera-seed', status: 'completed',
      settlement_tx_hash: null,
      created_at: new Date(Date.now() - (Math.random() * 10 + 1) * 86400000).toISOString(),
    });
    tradeIds.push(id);
  }
  console.log(`  ✓ 5 trades created`);

  // ── Step 6: Retirements ──
  const retirementDefs = [
    { buyer: b1, qty: 500, purpose: 'Offsetting semiconductor fabrication water usage for Q3 2025', facility_name: 'TechNova Austin Fab', pIdx: 0, framework: 'GRI 303' },
    { buyer: b1, qty: 300, purpose: 'Annual corporate water stewardship commitment', facility_name: 'TechNova Global HQ', pIdx: 1, framework: 'CDP Water Security' },
    { buyer: b2, qty: 200, purpose: 'Beverage production water neutrality program', facility_name: null, pIdx: 2, framework: 'CSRD' },
  ];
  const retirementIds: string[] = [];
  for (const r of retirementDefs) {
    const id = uuidv4();
    const proj = DEMO_PROJECTS[r.pIdx];
    retirements.push({
      id, buyer_id: r.buyer, quantity_wsc_retired: r.qty, equivalent_liters: r.qty * LITERS_PER_WSC,
      purpose: r.purpose, facility_name: r.facility_name, source_project_id: projectIds[r.pIdx],
      source_watershed: proj.watershed_name, compliance_framework: r.framework,
      hedera_burn_transaction_id: 'pending-hedera-seed', hcs_retirement_message_id: 'pending-hedera-seed',
      nft_certificate_token_id: 'pending-hedera-seed', nft_certificate_serial: retirementIds.length + 1,
      nft_metadata_hfs_file_id: 'pending-hedera-seed', verifiable_credential_id: 'pending-hedera-seed',
      created_at: new Date(Date.now() - (Math.random() * 7 + 1) * 86400000).toISOString(),
    });
    retirementIds.push(id);
  }
  console.log(`  ✓ 3 retirements created`);

  // ── Step 7: Community Rewards ──
  const tradeProjectMap = [0, 1, 1, 2, 1];
  const tradeAmounts = [250 * 11.0, 400 * 14.0, 300 * 13.5, 200 * 16.0, 100 * 14.0];
  for (let i = 0; i < tradeIds.length; i++) {
    rewards.push({
      id: uuidv4(), project_id: projectIds[tradeProjectMap[i]], trade_id: tradeIds[i],
      reward_amount_hbar: roundTo(tradeAmounts[i] * REVENUE_SPLIT.COMMUNITY, 2),
      recipient_hedera_account_id: 'pending-hedera-seed', hedera_transaction_id: 'pending-hedera-seed', hcs_message_id: 'pending-hedera-seed',
      created_at: new Date(Date.now() - (5 - i) * 86400000).toISOString(),
    });
  }
  console.log(`  ✓ 5 community rewards created`);

  // ── Step 8: Notifications ──
  const notifDefs = [
    { user: b1, type: 'trade', title: 'Trade Completed', message: 'You purchased 250 WSC from Colorado Water Trust for 2,750 HBAR.' },
    { user: b1, type: 'trade', title: 'Trade Completed', message: 'You purchased 300 WSC from Mumbai AquaCycle Industries for 4,050 HBAR.' },
    { user: b1, type: 'trade', title: 'Trade Completed', message: 'You purchased 100 WSC from Mumbai AquaCycle Industries for 1,400 HBAR.' },
    { user: b2, type: 'trade', title: 'Trade Completed', message: 'You purchased 400 WSC from Mumbai AquaCycle Industries for 5,600 HBAR.' },
    { user: b2, type: 'trade', title: 'Trade Completed', message: 'You purchased 200 WSC from Kenya RainHarvest Foundation for 3,200 HBAR.' },
    { user: op1, type: 'trade', title: 'Credits Sold', message: 'You sold 250 WSC to TechNova Semiconductors. You received 1,925 HBAR.' },
    { user: op2, type: 'trade', title: 'Credits Sold', message: 'You sold 400 WSC to GreenBev Drinks Co. You received 3,920 HBAR.' },
    { user: op2, type: 'trade', title: 'Credits Sold', message: 'You sold 300 WSC to TechNova Semiconductors. You received 2,835 HBAR.' },
    { user: op3, type: 'trade', title: 'Credits Sold', message: 'You sold 200 WSC to GreenBev Drinks Co. You received 2,240 HBAR.' },
    { user: op2, type: 'trade', title: 'Credits Sold', message: 'You sold 100 WSC to TechNova Semiconductors. You received 980 HBAR.' },
    { user: op1, type: 'verification', title: 'Project Verified', message: 'Colorado River Watershed Restoration has been verified by EcoAudit Global.' },
    { user: op2, type: 'verification', title: 'Project Verified', message: 'Industrial Water Recycling Plant has been verified by EcoAudit Global.' },
    { user: op3, type: 'verification', title: 'Project Verified', message: 'Community Rainwater Harvesting Network has been verified by EcoAudit Global.' },
    { user: op1, type: 'minting', title: 'WSC Tokens Minted', message: '2,400 WSC minted for Colorado River Watershed Restoration.' },
    { user: op2, type: 'minting', title: 'WSC Tokens Minted', message: '3,600 WSC minted for Industrial Water Recycling Plant.' },
    { user: op3, type: 'minting', title: 'WSC Tokens Minted', message: '1,800 WSC minted for Community Rainwater Harvesting Network.' },
    { user: b1, type: 'retirement', title: 'Credits Retired', message: 'You retired 500 WSC (500,000 liters offset). AVIC NFT certificate issued.' },
    { user: b1, type: 'retirement', title: 'Credits Retired', message: 'You retired 300 WSC (300,000 liters offset). AVIC NFT certificate issued.' },
    { user: b2, type: 'retirement', title: 'Credits Retired', message: 'You retired 200 WSC (200,000 liters offset). AVIC NFT certificate issued.' },
    { user: op1, type: 'reward', title: 'Community Reward', message: 'Your community received 412.50 HBAR from a WSC trade.' },
    { user: op2, type: 'reward', title: 'Community Reward', message: 'Your community received 840.00 HBAR from a WSC trade.' },
    { user: op3, type: 'reward', title: 'Community Reward', message: 'Your community received 480.00 HBAR from a WSC trade.' },
  ];
  for (const n of notifDefs) {
    notifications.push({
      id: uuidv4(), user_id: n.user, type: n.type, title: n.title, message: n.message,
      is_read: Math.random() > 0.6,
      created_at: new Date(Date.now() - Math.floor(Math.random() * 14) * 86400000).toISOString(),
    });
  }
  console.log(`  ✓ ${notifDefs.length} notifications created`);

  // ── Step 9: Apply real Hedera IDs if available ──
  const hederaIdsPath = join(__dirname, '../../data/hedera-ids.json');
  if (existsSync(hederaIdsPath)) {
    try {
      const hederaIds = JSON.parse(readFileSync(hederaIdsPath, 'utf-8'));
      console.log('  Loading real Hedera transaction IDs from hedera-ids.json...');

      // Apply user Hedera accounts
      if (hederaIds.users) {
        for (const hu of hederaIds.users) {
          const user = users.find((u: Record<string, unknown>) => u.email === hu.email);
          if (user) {
            user.hedera_account_id = hu.accountId;
            user.hedera_public_key = hu.publicKey;
            user.hedera_private_key_encrypted = hu.encryptedKey;
            user.hedera_did = hu.did;
          }
        }
      }

      // Apply project HCS topic IDs
      if (hederaIds.projectTopics) {
        for (let i = 0; i < hederaIds.projectTopics.length && i < projects.length; i++) {
          (projects[i] as Record<string, unknown>).hcs_topic_id = hederaIds.projectTopics[i];
        }
      }

      // Apply minting event transaction IDs
      if (hederaIds.mintingTxIds) {
        for (let i = 0; i < hederaIds.mintingTxIds.length && i < mintingEvents.length; i++) {
          (mintingEvents[i] as Record<string, unknown>).hedera_transaction_id = hederaIds.mintingTxIds[i];
        }
      }

      // Apply trade transaction IDs
      if (hederaIds.tradeTxIds) {
        for (let i = 0; i < hederaIds.tradeTxIds.length && i < trades.length; i++) {
          (trades[i] as Record<string, unknown>).hedera_transaction_id = hederaIds.tradeTxIds[i];
        }
      }

      // Apply retirement Hedera IDs
      if (hederaIds.retirements) {
        for (let i = 0; i < hederaIds.retirements.length && i < retirements.length; i++) {
          const r = retirements[i] as Record<string, unknown>;
          const hr = hederaIds.retirements[i];
          r.hedera_burn_transaction_id = hr.burnTxId;
          r.hcs_retirement_message_id = hr.hcsMessageId;
          r.nft_certificate_token_id = hr.nftTokenId;
          r.nft_certificate_serial = hr.nftSerial;
          r.nft_metadata_hfs_file_id = hr.hfsFileId;
          r.verifiable_credential_id = hr.vcId;
        }
      }

      // Apply community reward Hedera IDs
      if (hederaIds.communityRewards) {
        for (let i = 0; i < hederaIds.communityRewards.length && i < rewards.length; i++) {
          const rw = rewards[i] as Record<string, unknown>;
          const hr = hederaIds.communityRewards[i];
          rw.recipient_hedera_account_id = hr.recipientAccount;
          rw.hedera_transaction_id = hr.txId;
        }
      }

      console.log('  ✓ Real Hedera IDs applied to seed data');
    } catch (err) {
      console.warn('  ⚠ Failed to load hedera-ids.json, using placeholders:', (err as Error).message);
    }
  } else {
    console.log('  ℹ No hedera-ids.json found — using placeholder Hedera IDs. Run seed-hedera.ts to create real ones.');
  }

  console.log(`Seed complete. Total records: ${users.length + projects.length + readings.length + mintingEvents.length + listings.length + trades.length + retirements.length + rewards.length + notifications.length}`);

  // Persist the freshly seeded data to disk
  saveToDisk();
  console.log('  ✓ Data persisted to backend/data/store.json');
}

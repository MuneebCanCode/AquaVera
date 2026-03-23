/**
 * setup-hedera.ts
 *
 * Creates all Hedera Testnet resources needed by AquaVera:
 *   1. WSC fungible token (Water Stewardship Credit)
 *   2. AVIC NFT collection (AquaVera Impact Certificate)
 *   3. AVUSD stablecoin (AquaVera USD)
 *   4. Main HCS topic + 3 project HCS topics
 *   5. Guardian MRV policy JSON on HFS
 *   6. AquaVeraEscrow smart contract deployment
 *
 * Run: npx ts-node scripts/setup-hedera.ts
 * Must run BEFORE seed-mock-data.ts and seed-hedera.ts.
 */

import 'dotenv/config';
import { getOperatorAccountId } from '../src/hedera/client';
import { createFungibleToken, createNFTCollection } from '../src/hedera/hts.service';
import { createAVUSD } from '../src/hedera/stablecoin.service';
import { createTopic } from '../src/hedera/hcs.service';
import { createFile } from '../src/hedera/hfs.service';
import { deployContract } from '../src/hedera/hscs.service';
import { createDID } from '../src/hedera/did.service';

// ─── Guardian MRV Policy Schema ──────────────────────────────────────────────

const GUARDIAN_MRV_POLICY = {
  policyName: 'AquaVera Water Stewardship MRV Policy',
  version: '1.0.0',
  description:
    'Measurement, Reporting, and Verification policy for water stewardship credits on the AquaVera platform.',
  standardsAlignment: ['AWS International Water Stewardship Standard', 'GRI 303', 'UN SDG 6', 'CDP Water Security'],
  dataRequirements: {
    requiredFields: [
      'flow_rate_liters_per_min',
      'total_volume_liters',
      'water_quality_ph',
      'water_quality_tds',
      'water_quality_turbidity',
      'reservoir_level_percent',
    ],
    optionalFields: ['gps_latitude', 'gps_longitude'],
    frequency: 'hourly',
    minimumReadingsPerDay: 24,
    minimumCompletenessThreshold: 0.8,
    minimumDataCompleteness: 80,
    maximumAnomalyRate: 0.05,
  },
  anomalyDetection: {
    flow_rate_deviation_factor: 3,
    ph_min: 5.0,
    ph_max: 9.5,
    tds_max: 2000,
    turbidity_max: 10.0,
  },
  projectTypes: {
    conservation: { description: 'Water conservation and efficiency projects' },
    restoration: { description: 'Watershed and habitat restoration projects' },
    recycling: { description: 'Industrial water recycling and reuse projects' },
    access: { description: 'Community water access and harvesting projects' },
    efficiency: { description: 'Water use efficiency improvement projects' },
  },
  creditCalculation: {
    formula: 'base_credits = net_water_impact_liters / 1000',
    litersPerWSC: 1000,
    qualityTiers: {
      tier_1: { description: 'IoT sensor verified only', multiplier: 1.0 },
      tier_2: { description: 'Sensor + lab verified', multiplier: 1.2 },
      tier_3: { description: 'Sensor + lab + site audit', multiplier: 1.5 },
    },
    waterStressZoneMultipliers: {
      low: 1.0,
      medium: 1.3,
      high: 1.5,
      extreme: 2.0,
    },
  },
  baselineComparison: {
    method: 'daily_average',
    description: 'Net impact = total volume collected minus baseline daily usage for the same period.',
  },
  verificationPeriod: {
    minimum: '7 days',
    recommended: '30 days',
    maximum: '365 days',
  },
};

// ─── Compiled Solidity Bytecode (placeholder for Hedera Testnet demo) ────────
// In production, this would come from solc compilation.
// For the hackathon demo, we use a minimal placeholder bytecode that deploys
// successfully on Hedera. The actual contract logic is in AquaVeraEscrow.sol.
const ESCROW_BYTECODE =
  '608060405234801561001057600080fd5b50610001806100206000396000f3fe' +
  '6080604052600080fdfea164736f6c6343000813000a';

// ─── Main Setup ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        AquaVera — Hedera Testnet Setup Script           ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const operatorAccountId = getOperatorAccountId();
  console.log(`Operator Account: ${operatorAccountId.toString()}\n`);

  // ── Step 1: Create WSC Fungible Token ────────────────────────────────
  console.log('Step 1/6: Creating WSC fungible token...');
  const wsc = await createFungibleToken({
    name: 'Water Stewardship Credit',
    symbol: 'WSC',
    decimals: 2,
    initialSupply: 0,
    treasuryAccountId: operatorAccountId,
  });
  console.log(`  ✓ WSC Token ID: ${wsc.tokenId}\n`);

  // ── Step 2: Create AVIC NFT Collection ───────────────────────────────
  console.log('Step 2/6: Creating AVIC NFT collection...');
  const avic = await createNFTCollection({
    name: 'AquaVera Impact Certificate',
    symbol: 'AVIC',
    treasuryAccountId: operatorAccountId,
  });
  console.log(`  ✓ AVIC Token ID: ${avic.tokenId}\n`);

  // ── Step 3: Create AVUSD Stablecoin ──────────────────────────────────
  console.log('Step 3/6: Creating AVUSD stablecoin...');
  const avusd = await createAVUSD();
  console.log(`  ✓ AVUSD Token ID: ${avusd.tokenId}\n`);

  // ── Step 4: Create HCS Topics ────────────────────────────────────────
  console.log('Step 4/6: Creating HCS topics...');
  const mainTopic = await createTopic('AquaVera Platform Audit Log');
  console.log(`  ✓ Main Topic ID: ${mainTopic.topicId}`);

  const projectTopic1 = await createTopic('AquaVera Project 1 — Colorado River Watershed Restoration');
  console.log(`  ✓ Project 1 Topic ID: ${projectTopic1.topicId}`);

  const projectTopic2 = await createTopic('AquaVera Project 2 — Industrial Water Recycling Plant');
  console.log(`  ✓ Project 2 Topic ID: ${projectTopic2.topicId}`);

  const projectTopic3 = await createTopic('AquaVera Project 3 — Community Rainwater Harvesting Network');
  console.log(`  ✓ Project 3 Topic ID: ${projectTopic3.topicId}\n`);

  // ── Step 5: Store Guardian MRV Policy on HFS ─────────────────────────
  console.log('Step 5/6: Storing Guardian MRV policy on HFS...');
  const policyJson = JSON.stringify(GUARDIAN_MRV_POLICY, null, 2);
  const policyFile = await createFile(policyJson);
  console.log(`  ✓ Guardian Policy File ID: ${policyFile.fileId}\n`);

  // ── Step 6: Deploy AquaVeraEscrow Smart Contract ─────────────────────
  console.log('Step 6/6: Deploying AquaVeraEscrow smart contract...');
  const contract = await deployContract(ESCROW_BYTECODE, 200000);
  console.log(`  ✓ Escrow Contract ID: ${contract.contractId}\n`);

  // ── Platform DID ─────────────────────────────────────────────────────
  const platformDID = createDID(operatorAccountId.toString());

  // ── Output Summary ───────────────────────────────────────────────────
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                    Setup Complete!                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log('Add the following to your backend/.env file:\n');
  console.log(`WSC_TOKEN_ID=${wsc.tokenId}`);
  console.log(`NFT_CERTIFICATE_TOKEN_ID=${avic.tokenId}`);
  console.log(`AVUSD_TOKEN_ID=${avusd.tokenId}`);
  console.log(`HCS_MAIN_TOPIC_ID=${mainTopic.topicId}`);
  console.log(`HCS_PROJECT_TOPIC_1=${projectTopic1.topicId}`);
  console.log(`HCS_PROJECT_TOPIC_2=${projectTopic2.topicId}`);
  console.log(`HCS_PROJECT_TOPIC_3=${projectTopic3.topicId}`);
  console.log(`GUARDIAN_POLICY_FILE_ID=${policyFile.fileId}`);
  console.log(`ESCROW_CONTRACT_ID=${contract.contractId}`);
  console.log(`PLATFORM_DID=${platformDID}`);
  console.log(`PLATFORM_PRIVATE_KEY=<same as HEDERA_OPERATOR_KEY for testnet>`);
  console.log(`COMMUNITY_FUND_ACCOUNT_ID=<create or use operator: ${operatorAccountId.toString()}>`);
  console.log(`PLATFORM_TREASURY_ACCOUNT_ID=<create or use operator: ${operatorAccountId.toString()}>`);
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});

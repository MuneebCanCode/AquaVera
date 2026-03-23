/**
 * recreate-policy-file.ts
 *
 * Re-creates the Guardian MRV policy file on HFS (the old one expired).
 * Updates GUARDIAN_POLICY_FILE_ID in .env automatically.
 *
 * Run: npx ts-node scripts/recreate-policy-file.ts
 */

import 'dotenv/config';
import {
  FileCreateTransaction,
  Hbar,
} from '@hashgraph/sdk';
import { getHederaClient } from '../src/hedera/client';

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

async function main() {
  console.log('Re-creating Guardian MRV policy file on HFS...\n');

  const client = getHederaClient();
  const policyJson = JSON.stringify(GUARDIAN_MRV_POLICY, null, 2);
  const fileData = new TextEncoder().encode(policyJson);

  // Use default expiration (Hedera testnet allows 30-90 days)
  const tx = new FileCreateTransaction()
    .setContents(fileData)
    .setMaxTransactionFee(new Hbar(5));

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const newFileId = receipt.fileId!.toString();

  console.log(`✓ New Guardian Policy File ID: ${newFileId}\n`);

  // Update .env file
  const fs = await import('fs');
  const envPath = require('path').resolve(__dirname, '../.env');
  let envContent = fs.readFileSync(envPath, 'utf-8');
  envContent = envContent.replace(
    /GUARDIAN_POLICY_FILE_ID=.*/,
    `GUARDIAN_POLICY_FILE_ID=${newFileId}`
  );
  fs.writeFileSync(envPath, envContent);
  console.log(`✓ Updated .env with GUARDIAN_POLICY_FILE_ID=${newFileId}`);
  console.log('\nDone! Restart your backend to pick up the new file ID.');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});

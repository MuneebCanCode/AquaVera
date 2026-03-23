/**
 * seed-hedera.ts
 *
 * Creates Hedera on-chain data for the 6 demo users and 3 projects:
 *   1. Creates Hedera accounts + DIDs for all 6 demo users
 *   2. Associates WSC, AVIC, and AVUSD tokens with each account
 *   3. Submits 10-20 sample HCS messages per project
 *   4. Mints initial WSC tokens (2400/3600/1800)
 *   5. Executes sample atomic transfers for 5 trades
 *   6. Burns tokens for 3 retirements, mints 3 AVIC NFTs
 *   7. Mints and distributes AVUSD to corporate buyers
 *   8. Logs all events to HCS
 *   9. Updates in-memory records with Hedera IDs
 *
 * Run: npx ts-node scripts/seed-hedera.ts
 * Must run AFTER setup-hedera.ts. The server must be running (data is in-memory).
 * Alternatively, import seedData() before running this script.
 */

import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PrivateKey } from '@hashgraph/sdk';
import { getOperatorAccountId, getOperatorPrivateKey, parsePrivateKey } from '../src/hedera/client';
import { createAccount } from '../src/hedera/has.service';
import { createDID } from '../src/hedera/did.service';
import {
  associateTokens,
  mintFungibleTokens,
  transferTokens,
  burnTokens,
  mintNFT,
  transferNFT,
  atomicTransfer,
} from '../src/hedera/hts.service';
import { submitMessage } from '../src/hedera/hcs.service';
import { createFile } from '../src/hedera/hfs.service';
import { mintAVUSD, distributeAVUSD } from '../src/hedera/stablecoin.service';
import { createVerifiableCredential } from '../src/hedera/vc.service';
import { encrypt } from '../src/utils/encryption';
import { hashData } from '../src/utils/hashing';
import { getSupabase } from '../src/services/supabase';
import { seedData } from '../src/services/seed';
import { REVENUE_SPLIT, LITERS_PER_WSC } from '../src/utils/constants';
import { v4 as uuidv4 } from 'uuid';
import type { StewardshipLevel } from '../src/types/enums';

// Self-seed the in-memory store so we have data to work with
seedData();

const supabase = getSupabase();

// Collected Hedera IDs to write to JSON at the end
const collectedIds: Record<string, unknown> = {
  users: [] as unknown[],
  projectTopics: [] as string[],
  mintingTxIds: [] as string[],
  tradeTxIds: [] as string[],
  retirements: [] as unknown[],
  communityRewards: [] as unknown[],
};

// ─── Environment Helpers ─────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

interface UserHederaInfo {
  accountId: string;
  privateKey: string;
  publicKey: string;
  did: string;
}

// ─── Step 1: Create Hedera Accounts + DIDs ───────────────────────────────────

async function createUserAccounts(): Promise<UserHederaInfo[]> {
  console.log('Step 1/8: Creating Hedera accounts and DIDs for 6 demo users...');

  const users: UserHederaInfo[] = [];
  const emails = [
    'demo-operator1@aquavera.app',
    'demo-operator2@aquavera.app',
    'demo-operator3@aquavera.app',
    'demo-buyer1@aquavera.app',
    'demo-buyer2@aquavera.app',
    'demo-verifier@aquavera.app',
  ];

  for (const email of emails) {
    const account = await createAccount(50); // 50 HBAR initial balance for demo
    const did = createDID(account.accountId);

    users.push({
      accountId: account.accountId,
      privateKey: account.privateKey,
      publicKey: account.publicKey,
      did,
    });

    // Update Supabase user record
    const encryptedKey = encrypt(account.privateKey);
    const { error } = await supabase
      .from('users')
      .update({
        hedera_account_id: account.accountId,
        hedera_private_key_encrypted: encryptedKey,
        hedera_public_key: account.publicKey,
        hedera_did: did,
        updated_at: new Date().toISOString(),
      })
      .eq('email', email);

    if (error) throw new Error(`Failed to update user ${email}: ${error.message}`);
    console.log(`  ✓ ${email} → ${account.accountId} (${did})`);

    // Collect for hedera-ids.json
    (collectedIds.users as unknown[]).push({
      email,
      accountId: account.accountId,
      publicKey: account.publicKey,
      encryptedKey: encryptedKey,
      did,
    });
  }

  console.log('');
  return users;
}

// ─── Step 2: Associate Tokens ────────────────────────────────────────────────

async function associateUserTokens(users: UserHederaInfo[]): Promise<void> {
  console.log('Step 2/8: Associating WSC, AVIC, and AVUSD tokens with user accounts...');

  const wscTokenId = requireEnv('WSC_TOKEN_ID');
  const avicTokenId = requireEnv('NFT_CERTIFICATE_TOKEN_ID');
  const avusdTokenId = requireEnv('AVUSD_TOKEN_ID');

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const userKey = parsePrivateKey(user.privateKey);

    await associateTokens(user.accountId, [wscTokenId, avicTokenId, avusdTokenId], userKey);
    console.log(`  ✓ User ${i + 1} (${user.accountId}): tokens associated`);
  }

  console.log('');
}

// ─── Step 3: Submit Sample HCS Messages ──────────────────────────────────────

async function submitSampleHCSMessages(users: UserHederaInfo[]): Promise<void> {
  console.log('Step 3/8: Submitting sample HCS messages (10-20 per project)...');

  const mainTopicId = requireEnv('HCS_MAIN_TOPIC_ID');
  const projectTopics = [
    requireEnv('HCS_PROJECT_TOPIC_1'),
    requireEnv('HCS_PROJECT_TOPIC_2'),
    requireEnv('HCS_PROJECT_TOPIC_3'),
  ];

  // Collect project topics for hedera-ids.json
  (collectedIds.projectTopics as string[]).push(...projectTopics);

  // Fetch project IDs from Supabase
  const { data: projects } = await supabase
    .from('water_projects')
    .select('id, project_name, owner_id')
    .order('created_at');

  if (!projects || projects.length < 3) throw new Error('Projects not found in Supabase');

  for (let pIdx = 0; pIdx < 3; pIdx++) {
    const project = projects[pIdx];
    const operatorDID = users[pIdx].did;
    const messageCount = 10 + Math.floor(Math.random() * 11); // 10-20

    // Fetch a batch of sensor_readings for this project to link with HCS messages
    const { data: sensorReadings } = await supabase
      .from('sensor_readings')
      .select('id')
      .eq('project_id', project.id)
      .is('hcs_message_id', null)
      .order('reading_timestamp', { ascending: true })
      .limit(messageCount);

    // Submit sensor data hashes to project topic
    for (let m = 0; m < messageCount; m++) {
      const sensorHash = hashData({ project: project.id, reading: m, timestamp: Date.now() });
      const hcsResult = await submitMessage(projectTopics[pIdx], {
        event_type: 'sensor_data_submission',
        timestamp: new Date(Date.now() - (messageCount - m) * 60 * 60 * 1000).toISOString(),
        entity_id: project.id,
        actor_did: operatorDID,
        data_hash: sensorHash,
        metadata: { reading_index: m },
      });

      // Update the corresponding sensor_reading record with HCS message ID (Req 12.4 / Property 16)
      if (sensorReadings && sensorReadings[m]) {
        await supabase
          .from('sensor_readings')
          .update({
            hcs_message_id: hcsResult.messageId,
            hcs_consensus_timestamp: hcsResult.consensusTimestamp,
          })
          .eq('id', sensorReadings[m].id);
      }
    }

    // Log project registration to main topic
    await submitMessage(mainTopicId, {
      event_type: 'project_registration',
      timestamp: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      entity_id: project.id,
      actor_did: operatorDID,
      data_hash: hashData({ project_id: project.id }),
      metadata: { project_name: project.project_name },
    });

    // Log verification to main topic
    await submitMessage(mainTopicId, {
      event_type: 'project_verification',
      timestamp: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString(),
      entity_id: project.id,
      actor_did: users[5].did, // verifier
      data_hash: hashData({ project_id: project.id, result: 'pass' }),
      metadata: { result: 'pass', verifier: 'EcoAudit Global' },
    });

    console.log(`  ✓ Project ${pIdx + 1}: ${messageCount} sensor messages + 2 platform messages`);
  }

  console.log('');
}

// ─── Step 4: Mint Initial WSC Tokens ─────────────────────────────────────────

async function mintInitialWSC(users: UserHederaInfo[]): Promise<void> {
  console.log('Step 4/8: Minting initial WSC tokens...');

  const wscTokenId = requireEnv('WSC_TOKEN_ID');
  const mainTopicId = requireEnv('HCS_MAIN_TOPIC_ID');
  const operatorKey = getOperatorPrivateKey();
  const operatorId = getOperatorAccountId().toString();

  const mintAmounts = [
    { userIdx: 0, amount: 240000, display: 2400 }, // 2400 WSC (2 decimals = 240000)
    { userIdx: 1, amount: 360000, display: 3600 }, // 3600 WSC
    { userIdx: 2, amount: 180000, display: 1800 }, // 1800 WSC
  ];

  for (const m of mintAmounts) {
    // Mint to treasury
    const mintResult = await mintFungibleTokens(wscTokenId, m.amount);

    // Transfer to operator's account
    await transferTokens(wscTokenId, operatorId, users[m.userIdx].accountId, m.amount, operatorKey);

    // Log minting event to HCS
    await submitMessage(mainTopicId, {
      event_type: 'wsc_minting',
      timestamp: new Date().toISOString(),
      entity_id: wscTokenId,
      actor_did: users[m.userIdx].did,
      data_hash: hashData({ amount: m.display, user: users[m.userIdx].accountId }),
      metadata: { amount: m.display, hedera_transaction_id: mintResult.transactionId },
    });

    // Update minting event in Supabase
    const { data: projects } = await supabase
      .from('water_projects')
      .select('id')
      .eq('owner_id', (await supabase.from('users').select('id').eq('hedera_account_id', users[m.userIdx].accountId).single()).data?.id)
      .limit(1);

    if (projects && projects.length > 0) {
      await supabase
        .from('wsc_minting_events')
        .update({ hedera_transaction_id: mintResult.transactionId })
        .eq('project_id', projects[0].id)
        .eq('hedera_transaction_id', 'pending-hedera-seed');
    }

    console.log(`  ✓ Minted ${m.display} WSC → ${users[m.userIdx].accountId} (tx: ${mintResult.transactionId})`);

    // Collect for hedera-ids.json
    (collectedIds.mintingTxIds as string[]).push(mintResult.transactionId);
  }

  console.log('');
}

// ─── Step 5: Execute Sample Atomic Transfers (5 Trades) ──────────────────────

async function executeSampleTrades(users: UserHederaInfo[]): Promise<void> {
  console.log('Step 5/8: Executing 5 sample atomic transfers...');

  const wscTokenId = requireEnv('WSC_TOKEN_ID');
  const mainTopicId = requireEnv('HCS_MAIN_TOPIC_ID');

  // Trade definitions matching seed-mock-data trades
  // Note: amounts are in smallest unit (2 decimals), so 250 WSC = 25000
  const trades = [
    { seller: 0, buyer: 3, wscAmount: 25000, pricePerWSC: 11.0, qty: 250 },
    { seller: 1, buyer: 4, wscAmount: 40000, pricePerWSC: 14.0, qty: 400 },
    { seller: 1, buyer: 3, wscAmount: 30000, pricePerWSC: 13.5, qty: 300 },
    { seller: 2, buyer: 4, wscAmount: 20000, pricePerWSC: 16.0, qty: 200 },
    { seller: 1, buyer: 3, wscAmount: 10000, pricePerWSC: 14.0, qty: 100 },
  ];

  // Use operator account as community fund, verifier fee recipient, and platform treasury for demo
  const operatorId = getOperatorAccountId().toString();
  const communityAccountId = process.env.COMMUNITY_FUND_ACCOUNT_ID || operatorId;
  const platformAccountId = process.env.PLATFORM_TREASURY_ACCOUNT_ID || operatorId;
  const verifierAccountId = users[5].accountId; // Dr. Henrik Larsson

  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    const totalHbar = t.qty * t.pricePerWSC;
    // Convert HBAR to tinybars (1 HBAR = 100_000_000 tinybars)
    const totalTinybars = Math.round(totalHbar * 100_000_000);
    const sellerPayment = Math.round(totalTinybars * REVENUE_SPLIT.SELLER);
    const communityPayment = Math.round(totalTinybars * REVENUE_SPLIT.COMMUNITY);
    const verifierPayment = Math.round(totalTinybars * REVENUE_SPLIT.VERIFIER);
    const platformPayment = totalTinybars - sellerPayment - communityPayment - verifierPayment; // remainder to platform

    const result = await atomicTransfer({
      wscTokenId,
      paymentTokenId: null, // HBAR
      sellerAccountId: users[t.seller].accountId,
      buyerAccountId: users[t.buyer].accountId,
      communityAccountId,
      verifierAccountId,
      platformAccountId,
      wscAmount: t.wscAmount,
      sellerPayment,
      communityPayment,
      verifierPayment,
      platformPayment,
      sellerKey: parsePrivateKey(users[t.seller].privateKey),
      buyerKey: parsePrivateKey(users[t.buyer].privateKey),
    });

    // Log trade to HCS
    await submitMessage(mainTopicId, {
      event_type: 'trade_completed',
      timestamp: new Date().toISOString(),
      entity_id: `trade-${i + 1}`,
      actor_did: users[t.buyer].did,
      data_hash: hashData({ trade: i, qty: t.qty, price: t.pricePerWSC }),
      metadata: {
        buyer_did: users[t.buyer].did,
        seller_did: users[t.seller].did,
        quantity_wsc: t.qty,
        total_hbar: totalHbar,
        hedera_transaction_id: result.transactionId,
      },
    });

    // Update trade record in Supabase
    const { data: tradeRecords } = await supabase
      .from('trades')
      .select('id')
      .eq('hedera_transaction_id', 'pending-hedera-seed')
      .eq('quantity_wsc', t.qty)
      .eq('price_per_wsc_hbar', t.pricePerWSC)
      .limit(1);

    if (tradeRecords && tradeRecords.length > 0) {
      await supabase
        .from('trades')
        .update({ hedera_transaction_id: result.transactionId })
        .eq('id', tradeRecords[0].id);
    }

    console.log(`  ✓ Trade ${i + 1}: ${t.qty} WSC @ ${t.pricePerWSC} HBAR (tx: ${result.transactionId})`);

    // Collect for hedera-ids.json
    (collectedIds.tradeTxIds as string[]).push(result.transactionId);
  }

  console.log('');
}

// ─── Step 6: Burn Tokens for Retirements ─────────────────────────────────────

async function executeRetirements(users: UserHederaInfo[]): Promise<void> {
  console.log('Step 6/8: Burning tokens for 3 retirements and minting AVIC NFTs...');

  const wscTokenId = requireEnv('WSC_TOKEN_ID');
  const avicTokenId = requireEnv('NFT_CERTIFICATE_TOKEN_ID');
  const mainTopicId = requireEnv('HCS_MAIN_TOPIC_ID');
  const operatorKey = getOperatorPrivateKey();
  const operatorId = getOperatorAccountId().toString();

  const retirements = [
    { buyerIdx: 3, qty: 500, qtySmallest: 50000, purpose: 'Offsetting semiconductor fabrication water usage for Q3 2025', framework: 'GRI 303', projectIdx: 0 },
    { buyerIdx: 3, qty: 300, qtySmallest: 30000, purpose: 'Annual corporate water stewardship commitment', framework: 'CDP Water Security', projectIdx: 1 },
    { buyerIdx: 4, qty: 200, qtySmallest: 20000, purpose: 'Beverage production water neutrality program', framework: 'CSRD', projectIdx: 2 },
  ];

  const projectNames = [
    'Colorado River Watershed Restoration',
    'Industrial Water Recycling Plant',
    'Community Rainwater Harvesting Network',
  ];
  const watersheds = ['Colorado River Basin', 'Mithi River Basin', 'Athi River Basin'];
  const orgNames = ['TechNova Semiconductors', 'TechNova Semiconductors', 'GreenBev Drinks Co.'];

  for (let i = 0; i < retirements.length; i++) {
    const r = retirements[i];
    const buyer = users[r.buyerIdx];
    const buyerKey = parsePrivateKey(buyer.privateKey);

    // Transfer WSC from buyer to treasury for burning
    await transferTokens(wscTokenId, buyer.accountId, operatorId, r.qtySmallest, buyerKey);

    // Burn WSC tokens
    const burnResult = await burnTokens(wscTokenId, r.qtySmallest);

    // Create NFT metadata and store on HFS
    const certId = uuidv4();
    const metadata = {
      certificateId: certId,
      issuedTo: orgNames[i],
      issuedToDID: buyer.did,
      quantityRetired: r.qty,
      equivalentLiters: r.qty * LITERS_PER_WSC,
      sourceProject: projectNames[r.projectIdx],
      sourceProjectId: `project-${r.projectIdx + 1}`,
      watershed: watersheds[r.projectIdx],
      qualityTier: 'tier_1',
      waterStressZone: r.projectIdx === 0 ? 'high' : 'extreme',
      retirementDate: new Date().toISOString(),
      purpose: r.purpose,
      complianceFramework: r.framework,
      guardianVerificationRef: process.env.GUARDIAN_POLICY_FILE_ID || 'placeholder',
      hcsRetirementMessageId: 'pending',
      verificationURL: `https://aquavera.app/verify/${certId}`,
    };

    const hfsResult = await createFile(JSON.stringify(metadata, null, 2));

    // Mint AVIC NFT
    const nftMetadataBytes = new TextEncoder().encode(hfsResult.fileId);
    const nftResult = await mintNFT(avicTokenId, nftMetadataBytes);

    // Transfer NFT to buyer
    await transferNFT(avicTokenId, nftResult.serialNumber, operatorId, buyer.accountId, operatorKey);

    // Issue Verifiable Credential
    const stewardshipLevel: StewardshipLevel = r.buyerIdx === 3 ? 'Silver' : 'Bronze';
    const vc = createVerifiableCredential({
      organizationName: orgNames[i],
      organizationDID: buyer.did,
      quantityRetired: r.qty,
      equivalentLiters: r.qty * LITERS_PER_WSC,
      stewardshipLevel,
      verificationYear: new Date().getFullYear(),
      sourceWatershed: watersheds[r.projectIdx],
      complianceFramework: r.framework,
    });

    // Log retirement to HCS
    const hcsResult = await submitMessage(mainTopicId, {
      event_type: 'credit_retirement',
      timestamp: new Date().toISOString(),
      entity_id: certId,
      actor_did: buyer.did,
      data_hash: hashData({ qty: r.qty, purpose: r.purpose }),
      metadata: {
        quantity_retired: r.qty,
        equivalent_liters: r.qty * LITERS_PER_WSC,
        nft_serial: nftResult.serialNumber,
        burn_transaction_id: burnResult.transactionId,
      },
    });

    // Update retirement record in Supabase
    const { data: retirementRecords } = await supabase
      .from('retirements')
      .select('id')
      .eq('hedera_burn_transaction_id', 'pending-hedera-seed')
      .eq('quantity_wsc_retired', r.qty)
      .eq('compliance_framework', r.framework)
      .limit(1);

    if (retirementRecords && retirementRecords.length > 0) {
      await supabase
        .from('retirements')
        .update({
          hedera_burn_transaction_id: burnResult.transactionId,
          hcs_retirement_message_id: hcsResult.messageId,
          nft_certificate_token_id: avicTokenId,
          nft_certificate_serial: nftResult.serialNumber,
          nft_metadata_hfs_file_id: hfsResult.fileId,
          verifiable_credential_id: vc.id,
        })
        .eq('id', retirementRecords[0].id);
    }

    console.log(`  ✓ Retirement ${i + 1}: ${r.qty} WSC burned, AVIC #${nftResult.serialNumber} minted → ${buyer.accountId}`);

    // Collect for hedera-ids.json
    (collectedIds.retirements as unknown[]).push({
      burnTxId: burnResult.transactionId,
      hcsMessageId: hcsResult.messageId,
      nftTokenId: avicTokenId,
      nftSerial: nftResult.serialNumber,
      hfsFileId: hfsResult.fileId,
      vcId: vc.id,
    });
  }

  console.log('');
}

// ─── Step 7: Mint and Distribute AVUSD ───────────────────────────────────────

async function distributeAVUSDTokens(users: UserHederaInfo[]): Promise<void> {
  console.log('Step 7/8: Minting and distributing AVUSD to corporate buyers...');

  const avusdTokenId = requireEnv('AVUSD_TOKEN_ID');
  const operatorKey = getOperatorPrivateKey();

  // Mint 1,000,000 AVUSD (2 decimals = 100_000_000 smallest units)
  await mintAVUSD(avusdTokenId, 100_000_000);
  console.log('  ✓ Minted 1,000,000 AVUSD to treasury');

  // Distribute to corporate buyers
  const buyerDistributions = [
    { userIdx: 3, amount: 50_000_000, display: '500,000' }, // James Chen
    { userIdx: 4, amount: 30_000_000, display: '300,000' }, // Maria Santos
  ];

  for (const dist of buyerDistributions) {
    await distributeAVUSD(avusdTokenId, users[dist.userIdx].accountId, dist.amount, operatorKey);
    console.log(`  ✓ Distributed ${dist.display} AVUSD → ${users[dist.userIdx].accountId}`);
  }

  console.log('');
}

// ─── Step 8: Update Community Rewards with Hedera IDs ────────────────────────

async function updateCommunityRewards(users: UserHederaInfo[]): Promise<void> {
  console.log('Step 8/8: Updating community rewards with Hedera account IDs...');

  // Update community rewards with the operator accounts as recipients
  const { data: rewards, error } = await supabase
    .from('community_rewards')
    .select('id, project_id')
    .eq('recipient_hedera_account_id', 'pending-hedera-seed');

  if (error) throw new Error(`Failed to fetch community rewards: ${error.message}`);

  if (rewards) {
    // Get project-to-owner mapping
    const { data: projects } = await supabase
      .from('water_projects')
      .select('id, owner_id');

    const ownerMap = new Map<string, string>();
    if (projects) {
      for (const p of projects) {
        // Find the user's Hedera account
        const { data: user } = await supabase
          .from('users')
          .select('hedera_account_id')
          .eq('id', p.owner_id)
          .single();

        if (user?.hedera_account_id) {
          ownerMap.set(p.id, user.hedera_account_id);
        }
      }
    }

    for (const reward of rewards) {
      const recipientAccount = ownerMap.get(reward.project_id) || users[0].accountId;
      await supabase
        .from('community_rewards')
        .update({
          recipient_hedera_account_id: recipientAccount,
          hedera_transaction_id: 'demo-community-reward',
        })
        .eq('id', reward.id);

      // Collect for hedera-ids.json
      (collectedIds.communityRewards as unknown[]).push({
        recipientAccount,
        txId: recipientAccount, // Use account ID as reference since no real HBAR transfer for community rewards in demo
      });
    }
  }

  console.log(`  ✓ ${rewards?.length || 0} community rewards updated\n`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║       AquaVera — Seed Hedera On-Chain Data              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const operatorId = getOperatorAccountId();
  console.log(`Operator Account: ${operatorId.toString()}\n`);

  const users = await createUserAccounts();
  await associateUserTokens(users);
  await submitSampleHCSMessages(users);
  await mintInitialWSC(users);
  await executeSampleTrades(users);
  await executeRetirements(users);
  await distributeAVUSDTokens(users);
  await updateCommunityRewards(users);

  // Write collected Hedera IDs to JSON file for seed.ts to load
  const dataDir = join(__dirname, '..', 'data');
  mkdirSync(dataDir, { recursive: true });
  const outputPath = join(dataDir, 'hedera-ids.json');
  writeFileSync(outputPath, JSON.stringify(collectedIds, null, 2));
  console.log(`Hedera IDs saved to: ${outputPath}\n`);

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║              Hedera Seed Data Complete!                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log('Summary:');
  console.log('  • 6 Hedera accounts created with DIDs');
  console.log('  • WSC, AVIC, AVUSD tokens associated');
  console.log('  • 30-60 HCS messages submitted across project topics');
  console.log('  • 7,800 WSC minted and distributed (2400 + 3600 + 1800)');
  console.log('  • 5 atomic transfers executed');
  console.log('  • 1,000 WSC burned across 3 retirements');
  console.log('  • 3 AVIC NFTs minted and transferred');
  console.log('  • 800,000 AVUSD distributed to corporate buyers');
  console.log('  • All in-memory records updated with Hedera IDs');
  console.log('  • hedera-ids.json written — restart backend to use real IDs');
}

main().catch((err) => {
  console.error('Hedera seed failed:', err);
  process.exit(1);
});

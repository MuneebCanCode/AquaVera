import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from './supabase';
import { transferTokens, burnTokens, mintNFT, transferNFT } from '../hedera/hts.service';
import { createFile } from '../hedera/hfs.service';
import { submitMessage } from '../hedera/hcs.service';
import { createVerifiableCredential, type VCSubject } from '../hedera/vc.service';
import { getTokenBalance } from '../hedera/mirror.service';
import { getPlatformDID } from '../hedera/did.service';
import { hashData } from '../utils/hashing';
import { decrypt } from '../utils/encryption';
import { LITERS_PER_WSC, STEWARDSHIP_THRESHOLDS } from '../utils/constants';
import { createRetirementNotification } from './notification.service';
import { PrivateKey } from '@hashgraph/sdk';
import { parsePrivateKey } from '../hedera/client';
import type { Retirement, NftCertificateMetadata } from '../types';
import type { StewardshipLevel } from '../types/enums';
import type { RetirementRequestInput } from '../utils/validation';

/**
 * Calculate stewardship level from offset percentage.
 */
export function getStewardshipLevel(offsetPercent: number): StewardshipLevel {
  if (offsetPercent >= STEWARDSHIP_THRESHOLDS.Platinum.min) return 'Platinum';
  if (offsetPercent >= STEWARDSHIP_THRESHOLDS.Gold.min) return 'Gold';
  if (offsetPercent >= STEWARDSHIP_THRESHOLDS.Silver.min) return 'Silver';
  return 'Bronze';
}

/**
 * Retire WSC tokens: burn → HFS metadata → mint AVIC NFT → issue VC.
 * Treated as a single logical operation with rollback on failure.
 */
export async function retireCredits(
  buyerId: string,
  buyerHederaAccountId: string,
  buyerEncryptedKey: string,
  buyerDid: string,
  buyerOrgName: string,
  buyerWaterFootprint: number | null,
  input: RetirementRequestInput
): Promise<Retirement> {
  const supabase = getSupabase();
  const wscTokenId = process.env.WSC_TOKEN_ID;
  const nftTokenId = process.env.NFT_CERTIFICATE_TOKEN_ID;
  const treasuryAccountId = process.env.HEDERA_OPERATOR_ID!;
  const treasuryKey = parsePrivateKey(process.env.HEDERA_OPERATOR_KEY!);

  if (!wscTokenId || !nftTokenId) throw new Error('Token IDs not configured');

  // Verify balance
  const balance = await getTokenBalance(buyerHederaAccountId, wscTokenId);
  const requiredAmount = Math.round(input.quantity_wsc * 100);
  if (balance < requiredAmount) {
    throw new Error(`Insufficient WSC balance. Required: ${input.quantity_wsc}, Available: ${balance / 100}`);
  }

  const buyerKey = parsePrivateKey(decrypt(buyerEncryptedKey));
  const equivalentLiters = input.quantity_wsc * LITERS_PER_WSC;
  let burnTxId = '';

  try {
    // Step 1: Transfer WSC from buyer to treasury
    await transferTokens(wscTokenId, buyerHederaAccountId, treasuryAccountId, requiredAmount, buyerKey);

    // Step 2: Burn WSC tokens
    const burnResult = await burnTokens(wscTokenId, requiredAmount);
    burnTxId = burnResult.transactionId;

    // Step 3: Get project info
    const { data: project } = await supabase
      .from('water_projects')
      .select('project_name, watershed_name, water_stress_zone')
      .eq('id', input.source_project_id)
      .single();
    if (!project) throw new Error('Source project not found');

    // Step 4: Create NFT metadata and store on HFS
    const certificateId = uuidv4();
    const nftMetadata: NftCertificateMetadata = {
      certificateId,
      issuedTo: buyerOrgName,
      issuedToDID: buyerDid,
      quantityRetired: input.quantity_wsc,
      equivalentLiters,
      sourceProject: project.project_name,
      sourceProjectId: input.source_project_id,
      watershed: project.watershed_name,
      qualityTier: 'tier_1',
      waterStressZone: project.water_stress_zone,
      retirementDate: new Date().toISOString(),
      purpose: input.purpose,
      complianceFramework: input.compliance_framework,
      guardianVerificationRef: process.env.GUARDIAN_POLICY_FILE_ID || '',
      hcsRetirementMessageId: '', // Updated after HCS submission
      verificationURL: '',        // Updated after record creation
    };

    const { fileId: metadataFileId } = await createFile(JSON.stringify(nftMetadata));

    // Step 5: Mint AVIC NFT
    const metadataBytes = new TextEncoder().encode(metadataFileId);
    const { transactionId: nftTxId, serialNumber } = await mintNFT(nftTokenId, metadataBytes);

    // Step 6: Transfer NFT from treasury to buyer
    await transferNFT(nftTokenId, serialNumber, treasuryAccountId, buyerHederaAccountId, treasuryKey);

    // Step 7: Issue Verifiable Credential
    const totalRetired = await getTotalRetired(buyerId);
    const totalRetiredWithCurrent = totalRetired + input.quantity_wsc;
    const offsetPercent = buyerWaterFootprint
      ? ((totalRetiredWithCurrent * LITERS_PER_WSC) / buyerWaterFootprint) * 100
      : 0;

    const vcSubject: VCSubject = {
      organizationName: buyerOrgName,
      organizationDID: buyerDid,
      quantityRetired: input.quantity_wsc,
      equivalentLiters,
      stewardshipLevel: getStewardshipLevel(offsetPercent),
      verificationYear: new Date().getFullYear(),
      sourceWatershed: project.watershed_name,
      complianceFramework: input.compliance_framework,
    };
    const vc = createVerifiableCredential(vcSubject);

    // Step 8: Log to HCS
    const now = new Date().toISOString();
    let hcsMessageId = '';
    const mainTopicId = process.env.HCS_MAIN_TOPIC_ID;
    if (mainTopicId) {
      const hcsResult = await submitMessage(mainTopicId, {
        event_type: 'credit_retirement',
        timestamp: now,
        entity_id: certificateId,
        actor_did: buyerDid,
        data_hash: hashData({ quantity: input.quantity_wsc, purpose: input.purpose }),
        metadata: {
          quantity_wsc_retired: input.quantity_wsc,
          equivalent_liters: equivalentLiters,
          source_project_id: input.source_project_id,
          nft_serial: serialNumber,
          burn_transaction_id: burnTxId,
        },
      });
      hcsMessageId = hcsResult.messageId;
    }

    // Step 9: Create retirement record
    const retirement: Retirement = {
      id: uuidv4(),
      buyer_id: buyerId,
      quantity_wsc_retired: input.quantity_wsc,
      equivalent_liters: equivalentLiters,
      purpose: input.purpose,
      facility_name: input.facility_name || null,
      source_project_id: input.source_project_id,
      source_watershed: project.watershed_name,
      compliance_framework: input.compliance_framework,
      hedera_burn_transaction_id: burnTxId,
      hcs_retirement_message_id: hcsMessageId,
      nft_certificate_token_id: nftTokenId,
      nft_certificate_serial: serialNumber,
      nft_metadata_hfs_file_id: metadataFileId,
      verifiable_credential_id: vc.id,
      created_at: now,
    };

    const { error } = await supabase.from('retirements').insert(retirement);
    if (error) throw new Error(error.message);

    // Notify buyer of successful retirement
    await createRetirementNotification(buyerId, input.quantity_wsc, equivalentLiters, serialNumber);

    return retirement;
  } catch (error) {
    // Rollback: if burn succeeded but later steps failed, re-mint tokens back to buyer
    if (burnTxId) {
      try {
        await mintFungibleTokensCompensation(wscTokenId, requiredAmount, buyerHederaAccountId, treasuryKey);
      } catch {
        // Log compensation failure — manual intervention needed
      }
    }
    throw error;
  }
}


/**
 * Compensate for a failed retirement by re-minting and transferring tokens back.
 */
async function mintFungibleTokensCompensation(
  tokenId: string,
  amount: number,
  toAccountId: string,
  treasuryKey: PrivateKey
): Promise<void> {
  const { mintFungibleTokens, transferTokens } = await import('../hedera/hts.service');
  await mintFungibleTokens(tokenId, amount);
  await transferTokens(tokenId, process.env.HEDERA_OPERATOR_ID!, toAccountId, amount, treasuryKey);
}

/**
 * Get total WSC retired by a buyer.
 */
async function getTotalRetired(buyerId: string): Promise<number> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('retirements')
    .select('quantity_wsc_retired')
    .eq('buyer_id', buyerId);
  return (data || []).reduce((sum: number, r: { quantity_wsc_retired: number }) => sum + r.quantity_wsc_retired, 0);
}

/**
 * Get retirement history for a buyer.
 */
export async function getRetirementHistory(buyerId: string): Promise<Retirement[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('retirements')
    .select('*')
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Retirement[];
}

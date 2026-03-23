import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from './supabase';
import { mintFungibleTokens, transferTokens } from '../hedera/hts.service';
import { submitMessage } from '../hedera/hcs.service';
import { hashData } from '../utils/hashing';
import { decrypt } from '../utils/encryption';
import { QUALITY_MULTIPLIERS, STRESS_MULTIPLIERS, LITERS_PER_WSC } from '../utils/constants';
import { PrivateKey } from '@hashgraph/sdk';
import { parsePrivateKey } from '../hedera/client';
import type { MintingCalculation, WscMintingEvent, WaterProject } from '../types';
import type { QualityTier, WaterStressZone } from '../types/enums';

/**
 * Calculate WSC minting amount from verified sensor data.
 * Deterministic: same inputs always produce same output.
 */
export function calculateMinting(
  netWaterImpactLiters: number,
  qualityTier: QualityTier,
  waterStressZone: WaterStressZone
): MintingCalculation {
  const baseCredits = netWaterImpactLiters / LITERS_PER_WSC;
  const qualityMultiplier = QUALITY_MULTIPLIERS[qualityTier];
  const stressMultiplier = STRESS_MULTIPLIERS[waterStressZone];
  const finalWscMinted = baseCredits * qualityMultiplier * stressMultiplier;

  return {
    net_water_impact_liters: netWaterImpactLiters,
    base_credits: baseCredits,
    quality_tier: qualityTier,
    quality_multiplier: qualityMultiplier,
    stress_zone: waterStressZone,
    stress_multiplier: stressMultiplier,
    final_wsc_minted: parseFloat(finalWscMinted.toFixed(2)),
  };
}


/**
 * Mint WSC tokens for a verified project.
 * Mints to treasury, then transfers to operator.
 */
export async function mintWSC(
  project: WaterProject,
  operatorHederaAccountId: string,
  operatorEncryptedKey: string,
  netWaterImpactLiters: number,
  qualityTier: QualityTier,
  periodStart: string,
  periodEnd: string,
  guardianVerificationRef: string
): Promise<WscMintingEvent> {
  const supabase = getSupabase();
  const wscTokenId = process.env.WSC_TOKEN_ID;
  if (!wscTokenId) throw new Error('WSC_TOKEN_ID not configured');

  const calc = calculateMinting(netWaterImpactLiters, qualityTier, project.water_stress_zone);

  if (calc.final_wsc_minted <= 0) {
    throw new Error('No credits to mint: net water impact is zero or negative');
  }

  // Mint tokens to treasury (operator account is treasury)
  const mintAmount = Math.round(calc.final_wsc_minted * 100); // 2 decimal places
  const { transactionId } = await mintFungibleTokens(wscTokenId, mintAmount);

  // Transfer from treasury to project operator
  const operatorKey = parsePrivateKey(decrypt(operatorEncryptedKey));
  const treasuryAccountId = process.env.HEDERA_OPERATOR_ID!;
  const treasuryKey = parsePrivateKey(process.env.HEDERA_OPERATOR_KEY!);

  await transferTokens(wscTokenId, treasuryAccountId, operatorHederaAccountId, mintAmount, treasuryKey);

  // Log to HCS
  const now = new Date().toISOString();
  let hcsMessageId = '';
  const mainTopicId = process.env.HCS_MAIN_TOPIC_ID;
  if (mainTopicId) {
    const hcsResult = await submitMessage(mainTopicId, {
      event_type: 'wsc_minting',
      timestamp: now,
      entity_id: project.id,
      actor_did: '',
      data_hash: hashData(calc),
      metadata: {
        final_wsc_minted: calc.final_wsc_minted,
        quality_tier: qualityTier,
        stress_zone: project.water_stress_zone,
        quality_multiplier: calc.quality_multiplier,
        stress_multiplier: calc.stress_multiplier,
        hedera_transaction_id: transactionId,
      },
    });
    hcsMessageId = hcsResult.messageId;
  }

  // Create minting event record
  const mintingEvent: WscMintingEvent = {
    id: uuidv4(),
    project_id: project.id,
    verification_period_start: periodStart,
    verification_period_end: periodEnd,
    net_water_impact_liters: calc.net_water_impact_liters,
    base_credits: calc.base_credits,
    quality_tier: qualityTier,
    quality_multiplier: calc.quality_multiplier,
    stress_multiplier: calc.stress_multiplier,
    final_wsc_minted: calc.final_wsc_minted,
    hedera_transaction_id: transactionId,
    hcs_message_id: hcsMessageId,
    guardian_verification_ref: guardianVerificationRef,
    created_at: now,
  };

  const { error } = await supabase.from('wsc_minting_events').insert(mintingEvent);
  if (error) throw new Error(error.message);

  // Update project total_wsc_minted
  await supabase
    .from('water_projects')
    .update({
      total_wsc_minted: project.total_wsc_minted + calc.final_wsc_minted,
      updated_at: now,
    })
    .eq('id', project.id);

  return mintingEvent;
}

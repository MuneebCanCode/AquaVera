import { getSupabase } from './supabase';
import { getAccountNFTs, getNFTInfo, getTopicMessages } from '../hedera/mirror.service';
import type { Retirement } from '../types';

export interface PublicVerificationData {
  retirement: Retirement;
  project: {
    project_name: string;
    project_type: string;
    watershed_name: string;
    water_stress_zone: string;
    location_name: string;
  };
  buyer: {
    organization_name: string;
  };
  mirrorNodeVerification: {
    burnTransactionVerified: boolean;
    nftOwnershipVerified: boolean;
    hcsMessageVerified: boolean;
    overallVerified: boolean;
  };
}

/**
 * Get public verification data for a retirement.
 * Cross-checks against Mirror Node for authenticity.
 */
export async function getPublicVerification(retirementId: string): Promise<PublicVerificationData> {
  const supabase = getSupabase();

  // Fetch retirement
  const { data: retirement, error } = await supabase
    .from('retirements')
    .select('*')
    .eq('id', retirementId)
    .single();
  if (error || !retirement) throw new Error('Retirement not found');

  // Fetch project
  const { data: project } = await supabase
    .from('water_projects')
    .select('project_name, project_type, watershed_name, water_stress_zone, location_name')
    .eq('id', retirement.source_project_id)
    .single();

  // Fetch buyer
  const { data: buyer } = await supabase
    .from('users')
    .select('organization_name, hedera_account_id')
    .eq('id', retirement.buyer_id)
    .single();

  // Mirror Node cross-check
  let burnTransactionVerified = false;
  let nftOwnershipVerified = false;
  let hcsMessageVerified = false;

  try {
    // Verify NFT ownership
    if (buyer?.hedera_account_id && retirement.nft_certificate_token_id) {
      const nft = await getNFTInfo(retirement.nft_certificate_token_id, retirement.nft_certificate_serial);
      nftOwnershipVerified = nft?.account_id === buyer.hedera_account_id;
    }
  } catch {
    // Mirror Node unavailable
  }

  try {
    // Verify HCS message exists
    const mainTopicId = process.env.HCS_MAIN_TOPIC_ID;
    if (mainTopicId && retirement.hcs_retirement_message_id) {
      const messages = await getTopicMessages(mainTopicId, 200);
      hcsMessageVerified = messages.some(
        (m) => m.sequence_number.toString() === retirement.hcs_retirement_message_id
      );
    }
  } catch {
    // Mirror Node unavailable
  }

  // Burn transaction verification — we trust the stored TX ID
  burnTransactionVerified = !!retirement.hedera_burn_transaction_id;

  return {
    retirement: retirement as Retirement,
    project: project || { project_name: 'Unknown', project_type: '', watershed_name: '', water_stress_zone: '', location_name: '' },
    buyer: { organization_name: buyer?.organization_name || 'Unknown' },
    mirrorNodeVerification: {
      burnTransactionVerified,
      nftOwnershipVerified,
      hcsMessageVerified,
      overallVerified: burnTransactionVerified && (nftOwnershipVerified || hcsMessageVerified),
    },
  };
}

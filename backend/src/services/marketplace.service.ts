import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from './supabase';
import { atomicTransfer } from '../hedera/hts.service';
import { submitMessage } from '../hedera/hcs.service';
import { getTokenBalance } from '../hedera/mirror.service';
import { hashData } from '../utils/hashing';
import { decrypt } from '../utils/encryption';
import { REVENUE_SPLIT } from '../utils/constants';
import { createTradeNotifications } from './notification.service';
import { distributeReward } from './community.service';
import { parsePrivateKey } from '../hedera/client';
import { PrivateKey } from '@hashgraph/sdk';
import type { MarketplaceListing, Trade } from '../types';
import type { CreateListingInput, BuyRequestInput } from '../utils/validation';

/**
 * Calculate revenue split for a trade.
 */
export function calculateRevenueSplit(totalAmount: number): {
  sellerAmount: number;
  communityAmount: number;
  verifierAmount: number;
  platformAmount: number;
  networkAmount: number;
} {
  const sellerAmount = parseFloat((totalAmount * REVENUE_SPLIT.SELLER).toFixed(8));
  const communityAmount = parseFloat((totalAmount * REVENUE_SPLIT.COMMUNITY).toFixed(8));
  const verifierAmount = parseFloat((totalAmount * REVENUE_SPLIT.VERIFIER).toFixed(8));
  const platformAmount = parseFloat((totalAmount * REVENUE_SPLIT.PLATFORM).toFixed(8));
  const networkAmount = parseFloat((totalAmount * REVENUE_SPLIT.NETWORK).toFixed(8));
  return { sellerAmount, communityAmount, verifierAmount, platformAmount, networkAmount };
}

/**
 * Create a new marketplace listing.
 */
export async function createListing(
  sellerId: string,
  sellerHederaAccountId: string,
  input: CreateListingInput
): Promise<MarketplaceListing> {
  const supabase = getSupabase();
  const wscTokenId = process.env.WSC_TOKEN_ID;
  if (!wscTokenId) throw new Error('WSC_TOKEN_ID not configured');

  // Verify seller has sufficient WSC balance
  const balance = await getTokenBalance(sellerHederaAccountId, wscTokenId);
  const requiredBalance = Math.round(input.quantity_wsc * 100); // 2 decimals
  if (balance < requiredBalance) {
    throw new Error(`Insufficient WSC balance. Required: ${input.quantity_wsc}, Available: ${balance / 100}`);
  }

  // Get project details for listing metadata
  const { data: project, error: projError } = await supabase
    .from('water_projects')
    .select('project_type, watershed_name, water_stress_zone')
    .eq('id', input.project_id)
    .single();
  if (projError || !project) throw new Error('Project not found');

  const now = new Date().toISOString();
  const listing: MarketplaceListing = {
    id: uuidv4(),
    seller_id: sellerId,
    project_id: input.project_id,
    quantity_wsc: input.quantity_wsc,
    price_per_wsc_hbar: input.price_per_wsc_hbar,
    credit_type: project.project_type,
    quality_tier: 'tier_1', // Default for demo
    watershed_name: project.watershed_name,
    water_stress_zone: project.water_stress_zone,
    quantity_remaining: input.quantity_wsc,
    status: 'active',
    created_at: now,
    updated_at: now,
  };

  const { error } = await supabase.from('marketplace_listings').insert(listing);
  if (error) throw new Error(error.message);

  return listing;
}


/**
 * Execute a marketplace trade with atomic transfer and revenue split.
 */
export async function executeTrade(
  buyerId: string,
  buyerHederaAccountId: string,
  buyerEncryptedKey: string,
  input: BuyRequestInput
): Promise<Trade> {
  const supabase = getSupabase();
  const wscTokenId = process.env.WSC_TOKEN_ID;
  const avusdTokenId = process.env.AVUSD_TOKEN_ID;
  if (!wscTokenId) throw new Error('WSC_TOKEN_ID not configured');

  // Fetch listing
  const { data: listing, error: listingError } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('id', input.listing_id)
    .single();
  if (listingError || !listing) throw new Error('Listing not found');
  if (listing.status === 'sold' || listing.status === 'cancelled') {
    throw new Error('Listing is no longer available');
  }
  if (input.quantity_wsc > listing.quantity_remaining) {
    throw new Error(`Requested quantity ${input.quantity_wsc} exceeds available ${listing.quantity_remaining}`);
  }

  // Fetch seller info
  const { data: seller } = await supabase
    .from('users')
    .select('hedera_account_id, hedera_private_key_encrypted, hedera_did')
    .eq('id', listing.seller_id)
    .single();
  if (!seller?.hedera_account_id || !seller?.hedera_private_key_encrypted) {
    throw new Error('Seller Hedera account not found');
  }

  // Fetch buyer DID
  const { data: buyer } = await supabase
    .from('users')
    .select('hedera_did')
    .eq('id', buyerId)
    .single();

  // Fetch project verifier
  const { data: project } = await supabase
    .from('water_projects')
    .select('verifier_id')
    .eq('id', listing.project_id)
    .single();

  let verifierAccountId = process.env.PLATFORM_TREASURY_ACCOUNT_ID || process.env.HEDERA_OPERATOR_ID!;
  if (project?.verifier_id) {
    const { data: verifier } = await supabase
      .from('users')
      .select('hedera_account_id')
      .eq('id', project.verifier_id)
      .single();
    if (verifier?.hedera_account_id) verifierAccountId = verifier.hedera_account_id;
  }

  // Calculate amounts
  const totalAmount = input.quantity_wsc * listing.price_per_wsc_hbar;
  const split = calculateRevenueSplit(totalAmount);

  // Execute atomic transfer
  const sellerKey = parsePrivateKey(decrypt(seller.hedera_private_key_encrypted));
  const buyerKey = parsePrivateKey(decrypt(buyerEncryptedKey));

  const paymentTokenId = input.payment_method === 'avusd' ? (avusdTokenId || null) : null;

  const wscAmount = Math.round(input.quantity_wsc * 100); // 2 decimals

  const { transactionId } = await atomicTransfer({
    wscTokenId,
    paymentTokenId,
    sellerAccountId: seller.hedera_account_id,
    buyerAccountId: buyerHederaAccountId,
    communityAccountId: process.env.COMMUNITY_FUND_ACCOUNT_ID || process.env.HEDERA_OPERATOR_ID!,
    verifierAccountId,
    platformAccountId: process.env.PLATFORM_TREASURY_ACCOUNT_ID || process.env.HEDERA_OPERATOR_ID!,
    wscAmount,
    sellerPayment: Math.round(split.sellerAmount * 1e8),
    communityPayment: Math.round(split.communityAmount * 1e8),
    verifierPayment: Math.round(split.verifierAmount * 1e8),
    platformPayment: Math.round(split.platformAmount * 1e8),
    sellerKey,
    buyerKey,
  });

  // Log to HCS
  const now = new Date().toISOString();
  let hcsMessageId = '';
  const mainTopicId = process.env.HCS_MAIN_TOPIC_ID;
  if (mainTopicId) {
    const hcsResult = await submitMessage(mainTopicId, {
      event_type: 'marketplace_trade',
      timestamp: now,
      entity_id: input.listing_id,
      actor_did: buyer?.hedera_did || '',
      data_hash: hashData({ listing_id: input.listing_id, quantity: input.quantity_wsc, total: totalAmount }),
      metadata: {
        buyer_did: buyer?.hedera_did || '',
        seller_did: seller.hedera_did || '',
        quantity_wsc: input.quantity_wsc,
        price_per_wsc: listing.price_per_wsc_hbar,
        total_amount: totalAmount,
        revenue_split: split,
        payment_method: input.payment_method,
        settlement_method: input.settlement_method,
        hedera_transaction_id: transactionId,
      },
    });
    hcsMessageId = hcsResult.messageId;
  }

  // Create trade record
  const trade: Trade = {
    id: uuidv4(),
    listing_id: input.listing_id,
    buyer_id: buyerId,
    seller_id: listing.seller_id,
    project_id: listing.project_id,
    quantity_wsc: input.quantity_wsc,
    price_per_wsc_hbar: listing.price_per_wsc_hbar,
    total_hbar: totalAmount,
    platform_fee_hbar: split.platformAmount,
    community_fund_hbar: split.communityAmount,
    verifier_fee_hbar: split.verifierAmount,
    seller_receives_hbar: split.sellerAmount,
    payment_method: input.payment_method,
    settlement_method: input.settlement_method || 'atomic_transfer',
    hedera_transaction_id: transactionId,
    hcs_message_id: hcsMessageId,
    settlement_tx_hash: null,
    status: 'completed',
    created_at: now,
  };

  const { error: tradeError } = await supabase.from('trades').insert(trade);
  if (tradeError) throw new Error(tradeError.message);

  // Update listing
  const newRemaining = listing.quantity_remaining - input.quantity_wsc;
  const newStatus = newRemaining <= 0 ? 'sold' : 'partially_filled';
  await supabase
    .from('marketplace_listings')
    .update({ quantity_remaining: newRemaining, status: newStatus, updated_at: now })
    .eq('id', input.listing_id);

  // Create trade notifications for buyer and seller
  await createTradeNotifications(
    buyerId,
    listing.seller_id,
    input.quantity_wsc,
    totalAmount,
    split.sellerAmount,
    transactionId
  );

  // Create community reward record
  const communityAccountId = process.env.COMMUNITY_FUND_ACCOUNT_ID || process.env.HEDERA_OPERATOR_ID!;
  await distributeReward(trade.id, listing.project_id, totalAmount, communityAccountId);

  return trade;
}


/**
 * List marketplace listings with optional filters.
 */
export async function listListings(filters?: {
  creditType?: string;
  qualityTier?: string;
  watershedName?: string;
  waterStressZone?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<MarketplaceListing[]> {
  const supabase = getSupabase();
  let query = supabase.from('marketplace_listings').select('*').eq('status', 'active');

  if (filters?.creditType) query = query.eq('credit_type', filters.creditType);
  if (filters?.qualityTier) query = query.eq('quality_tier', filters.qualityTier);
  if (filters?.watershedName) query = query.eq('watershed_name', filters.watershedName);
  if (filters?.waterStressZone) query = query.eq('water_stress_zone', filters.waterStressZone);
  if (filters?.minPrice != null) query = query.gte('price_per_wsc_hbar', filters.minPrice);
  if (filters?.maxPrice != null) query = query.lte('price_per_wsc_hbar', filters.maxPrice);

  const sortBy = filters?.sortBy || 'created_at';
  const sortOrder = filters?.sortOrder === 'asc';
  query = query.order(sortBy, { ascending: sortOrder });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Enrich listings with seller organization name and project name
  const listings = (data || []) as Record<string, unknown>[];
  const usersTable = getSupabase().from('users');
  const projectsTable = getSupabase().from('water_projects');

  for (const listing of listings) {
    // Get seller organization name
    const { data: seller } = usersTable.select('organization_name, evm_address').eq('id', listing.seller_id as string).single();
    if (seller) {
      listing.seller_organization = seller.organization_name;
      listing.seller_evm_address = seller.evm_address;
    }
    // Get project name
    const { data: project } = projectsTable.select('project_name').eq('id', listing.project_id as string).single();
    if (project) {
      listing.project_name = project.project_name;
    }
  }

  return listings as unknown as MarketplaceListing[];
}

/**
 * Auto-create a marketplace listing after successful minting.
 * Uses a default price based on the water stress zone.
 */
export async function autoCreateListingAfterMint(
  sellerId: string,
  projectId: string,
  quantityWsc: number,
  qualityTier: string,
): Promise<MarketplaceListing> {
  const supabase = getSupabase();

  const { data: project } = await supabase
    .from('water_projects')
    .select('project_type, watershed_name, water_stress_zone')
    .eq('id', projectId)
    .single();
  if (!project) throw new Error('Project not found for auto-listing');

  // Default pricing by stress zone (HBAR per WSC)
  const stressPricing: Record<string, number> = {
    low: 10.0,
    medium: 12.5,
    high: 15.0,
    extreme: 18.0,
  };
  const pricePerWsc = stressPricing[project.water_stress_zone] || 12.5;

  const now = new Date().toISOString();
  const listing: MarketplaceListing = {
    id: require('uuid').v4(),
    seller_id: sellerId,
    project_id: projectId,
    quantity_wsc: quantityWsc,
    price_per_wsc_hbar: pricePerWsc,
    credit_type: project.project_type,
    quality_tier: (qualityTier || 'tier_1') as any,
    watershed_name: project.watershed_name,
    water_stress_zone: project.water_stress_zone,
    quantity_remaining: quantityWsc,
    status: 'active',
    created_at: now,
    updated_at: now,
  };

  const { error } = await supabase.from('marketplace_listings').insert(listing);
  if (error) throw new Error(error.message);

  return listing;
}

/**
 * Cancel a listing.
 */
export async function cancelListing(listingId: string, sellerId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('marketplace_listings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', listingId)
    .eq('seller_id', sellerId)
    .in('status', ['active', 'partially_filled']);
  if (error) throw new Error(error.message);
}

import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from './supabase';
import type { Notification } from '../types';
import type { NotificationType } from '../types/enums';

/**
 * Create a notification for a user.
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<Notification> {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const notification: Notification = {
    id: uuidv4(),
    user_id: userId,
    type,
    title,
    message,
    metadata: metadata || null,
    is_read: false,
    created_at: now,
  };

  const { error } = await supabase.from('notifications').insert(notification);
  if (error) throw new Error(error.message);

  return notification;
}

/**
 * Create trade notifications for both buyer and seller.
 */
export async function createTradeNotifications(
  buyerId: string,
  sellerId: string,
  quantityWsc: number,
  totalHbar: number,
  sellerReceives: number,
  transactionId: string
): Promise<void> {
  await createNotification(buyerId, 'trade', 'Trade Completed',
    `You purchased ${quantityWsc} WSC for ${totalHbar.toFixed(4)} HBAR.`,
    { transaction_id: transactionId, quantity: quantityWsc, total: totalHbar }
  );
  await createNotification(sellerId, 'trade', 'Credits Sold',
    `${quantityWsc} WSC sold for ${sellerReceives.toFixed(4)} HBAR (after fees).`,
    { transaction_id: transactionId, quantity: quantityWsc, received: sellerReceives }
  );
}


/**
 * Create verification notification for project operator.
 */
export async function createVerificationNotification(
  operatorId: string,
  projectName: string,
  approved: boolean,
  notes?: string
): Promise<void> {
  const status = approved ? 'approved' : 'rejected';
  await createNotification(operatorId, 'verification',
    `Project ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    `Your project "${projectName}" has been ${status}.${notes ? ` Notes: ${notes}` : ''}`,
    { project_name: projectName, result: status }
  );
}

/**
 * Create minting notification for project operator.
 */
export async function createMintingNotification(
  operatorId: string,
  projectName: string,
  amount: number,
  qualityTier: string,
  qualityMultiplier: number,
  stressMultiplier: number
): Promise<void> {
  await createNotification(operatorId, 'minting', 'WSC Tokens Minted',
    `${amount} WSC minted for "${projectName}" (${qualityTier}, ×${qualityMultiplier} quality, ×${stressMultiplier} stress).`,
    { project_name: projectName, amount, quality_tier: qualityTier }
  );
}

/**
 * Create retirement notification for buyer.
 */
export async function createRetirementNotification(
  buyerId: string,
  quantity: number,
  equivalentLiters: number,
  nftSerial: number
): Promise<void> {
  await createNotification(buyerId, 'retirement', 'Credits Retired',
    `${quantity} WSC retired (${equivalentLiters.toLocaleString()} liters). AVIC NFT #${nftSerial} issued.`,
    { quantity, equivalent_liters: equivalentLiters, nft_serial: nftSerial }
  );
}

/**
 * Create community reward notification for project operator.
 */
export async function createRewardNotification(
  operatorId: string,
  rewardAmount: number,
  tradeId: string
): Promise<void> {
  await createNotification(operatorId, 'reward', 'Community Reward Received',
    `${rewardAmount.toFixed(4)} HBAR community reward from trade.`,
    { reward_amount: rewardAmount, trade_id: tradeId }
  );
}

/**
 * Get notifications for a user.
 */
export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Notification[];
}

/**
 * Get unread notification count.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw new Error(error.message);
  return count || 0;
}

/**
 * Mark a notification as read.
 */
export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

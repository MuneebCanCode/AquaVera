import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from './supabase';
import { transferTokens } from '../hedera/hts.service';
import { submitMessage } from '../hedera/hcs.service';
import { hashData } from '../utils/hashing';
import { decrypt } from '../utils/encryption';
import { REVENUE_SPLIT } from '../utils/constants';
import { PrivateKey } from '@hashgraph/sdk';
import type { CommunityReward } from '../types';

/**
 * Distribute community reward after a trade.
 * 15% of trade total goes to the community fund associated with the project.
 */
export async function distributeReward(
  tradeId: string,
  projectId: string,
  totalTradeAmount: number,
  communityAccountId: string
): Promise<CommunityReward> {
  const supabase = getSupabase();
  const rewardAmount = parseFloat((totalTradeAmount * REVENUE_SPLIT.COMMUNITY).toFixed(8));
  const now = new Date().toISOString();

  // The community reward HBAR transfer is already handled in the atomic transfer.
  // This service records the reward and logs to HCS.
  // For standalone distributions (e.g., scheduled), we'd transfer here.

  // Log to HCS
  let hcsMessageId = '';
  const mainTopicId = process.env.HCS_MAIN_TOPIC_ID;
  if (mainTopicId) {
    const hcsResult = await submitMessage(mainTopicId, {
      event_type: 'community_reward_distribution',
      timestamp: now,
      entity_id: tradeId,
      actor_did: '',
      data_hash: hashData({ tradeId, projectId, rewardAmount }),
      metadata: {
        trade_id: tradeId,
        project_id: projectId,
        reward_amount_hbar: rewardAmount,
        recipient_account: communityAccountId,
      },
    });
    hcsMessageId = hcsResult.messageId;
  }

  const reward: CommunityReward = {
    id: uuidv4(),
    project_id: projectId,
    trade_id: tradeId,
    reward_amount_hbar: rewardAmount,
    recipient_hedera_account_id: communityAccountId,
    hedera_transaction_id: '', // Already part of atomic transfer
    hcs_message_id: hcsMessageId,
    created_at: now,
  };

  const { error } = await supabase.from('community_rewards').insert(reward);
  if (error) throw new Error(error.message);

  return reward;
}

/**
 * Get community rewards for a project.
 */
export async function getProjectRewards(projectId: string): Promise<CommunityReward[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('community_rewards')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as CommunityReward[];
}

/**
 * Get cumulative community stats.
 */
export async function getCommunityStats(): Promise<{
  totalRewardsHbar: number;
  totalTrades: number;
  rewardsByProject: Array<{ project_id: string; total_hbar: number; trade_count: number }>;
}> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('community_rewards').select('*');
  if (error) throw new Error(error.message);

  const rewards = (data || []) as CommunityReward[];
  const totalRewardsHbar = rewards.reduce((sum, r) => sum + r.reward_amount_hbar, 0);
  const totalTrades = rewards.length;

  const byProject = new Map<string, { total_hbar: number; trade_count: number }>();
  for (const r of rewards) {
    const existing = byProject.get(r.project_id) || { total_hbar: 0, trade_count: 0 };
    existing.total_hbar += r.reward_amount_hbar;
    existing.trade_count += 1;
    byProject.set(r.project_id, existing);
  }

  return {
    totalRewardsHbar,
    totalTrades,
    rewardsByProject: Array.from(byProject.entries()).map(([project_id, stats]) => ({
      project_id,
      ...stats,
    })),
  };
}

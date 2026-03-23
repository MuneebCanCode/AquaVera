import { Router, Response } from 'express';
import { getSupabase } from '../services/supabase';
import { scheduleTransfer, getScheduleInfo } from '../hedera/scheduling.service';
import { submitMessage } from '../hedera/hcs.service';
import { hashData } from '../utils/hashing';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { hederaLimiter } from '../middleware/rate-limit';
import { v4 as uuid } from 'uuid';

const router = Router();

// POST /api/scheduling/community-reward — Schedule a future community reward distribution
router.post('/community-reward', requireAuth, requireRole('admin'), hederaLimiter, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { project_id, recipient_account_id, amount_hbar, memo } = req.body;
    if (!project_id || !recipient_account_id || !amount_hbar) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'project_id, recipient_account_id, and amount_hbar are required', requestId: '' } });
      return;
    }

    const operatorAccountId = process.env.HEDERA_OPERATOR_ID!;
    const result = await scheduleTransfer(
      operatorAccountId,
      recipient_account_id,
      amount_hbar,
      memo || `AquaVera scheduled community reward for project ${project_id}`
    );

    // Log to HCS
    const hcsTopicId = process.env.HCS_MAIN_TOPIC_ID!;
    let hcsMessageId: string | null = null;
    try {
      const hcsResult = await submitMessage(hcsTopicId, {
        event_type: 'scheduled_community_reward',
        timestamp: new Date().toISOString(),
        entity_id: result.scheduleId,
        actor_did: 'platform',
        data_hash: hashData({ project_id, recipient_account_id, amount_hbar }),
        metadata: { project_id, amount_hbar, schedule_id: result.scheduleId },
      });
      hcsMessageId = hcsResult.messageId;
    } catch { /* HCS logging is best-effort */ }

    // Store in Supabase
    const supabase = getSupabase();
    const record = {
      id: uuid(),
      schedule_id: result.scheduleId,
      transaction_type: 'community_reward',
      transaction_data: { project_id, recipient_account_id, amount_hbar, memo },
      status: 'pending',
      expected_execution: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // ~30 min from now
      executed_transaction_id: null,
      hcs_message_id: hcsMessageId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await supabase.from('scheduled_transactions').insert(record);

    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
});

// GET /api/scheduling — List all scheduled transactions
router.get('/', requireAuth, async (_req: AuthenticatedRequest, res: Response, next) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('scheduled_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
});

// GET /api/scheduling/:id/status — Check schedule status from Hedera
router.get('/:id/status', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const supabase = getSupabase();
    const { data: record } = await supabase
      .from('scheduled_transactions')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (!record) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Scheduled transaction not found', requestId: '' } });
      return;
    }

    // Query Hedera for latest status
    let hederaStatus = { executed: false, deleted: false, memo: '', expirationTime: null as string | null };
    try {
      hederaStatus = await getScheduleInfo(record.schedule_id);
    } catch { /* Mirror node may not have it yet */ }

    // Update status if changed
    let newStatus = record.status;
    if (hederaStatus.executed && record.status !== 'executed') newStatus = 'executed';
    else if (hederaStatus.deleted && record.status !== 'expired') newStatus = 'expired';

    if (newStatus !== record.status) {
      await supabase.from('scheduled_transactions').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', record.id);
    }

    res.json({ success: true, data: { ...record, status: newStatus, hederaStatus } });
  } catch (err) { next(err); }
});

export default router;

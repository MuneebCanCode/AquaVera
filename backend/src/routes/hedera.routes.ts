import { Router, Response } from 'express';
import { getAccountBalance, getTransactions, getTopicMessages } from '../hedera/mirror.service';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/hedera/balance/:accountId — Get Hedera account balance
router.get('/balance/:accountId', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const balance = await getAccountBalance(req.params.accountId);
    res.json({ success: true, data: balance });
  } catch (err) { next(err); }
});

// GET /api/hedera/transactions/:accountId — Get transaction history
router.get('/transactions/:accountId', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const transactions = await getTransactions(req.params.accountId, limit);
    res.json({ success: true, data: transactions });
  } catch (err) { next(err); }
});

// GET /api/hedera/messages/:topicId — Get HCS topic messages
router.get('/messages/:topicId', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const messages = await getTopicMessages(req.params.topicId, limit);
    res.json({ success: true, data: messages });
  } catch (err) { next(err); }
});

export default router;

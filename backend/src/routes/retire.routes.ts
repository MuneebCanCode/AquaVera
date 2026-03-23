import { Router, Response } from 'express';
import { retireCredits, getRetirementHistory } from '../services/retirement.service';
import { getProfile } from '../services/auth.service';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { retirementRequestSchema } from '../utils/validation';
import { hederaLimiter } from '../middleware/rate-limit';

const router = Router();

// POST /api/retire — Retire WSC credits and receive AVIC NFT
router.post('/', requireAuth, requireRole('corporate_buyer'), hederaLimiter, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = retirementRequestSchema.parse(req.body);
    const user = await getProfile(req.userId!);
    if (!user.hedera_account_id || !user.hedera_private_key_encrypted || !user.hedera_did) {
      res.status(400).json({ success: false, error: { code: 'HEDERA_ACCOUNT_MISSING', message: 'User has no Hedera account', requestId: '' } });
      return;
    }
    const retirement = await retireCredits(
      req.userId!,
      user.hedera_account_id,
      user.hedera_private_key_encrypted,
      user.hedera_did,
      user.organization_name,
      user.water_footprint_liters_annual,
      input
    );
    res.status(201).json({ success: true, data: retirement });
  } catch (err) { next(err); }
});

// GET /api/retire/history — Get retirement history for current user
router.get('/history', requireAuth, requireRole('corporate_buyer'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const history = await getRetirementHistory(req.userId!);
    res.json({ success: true, data: history });
  } catch (err) { next(err); }
});

export default router;

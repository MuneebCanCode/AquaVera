import { Router, Response } from 'express';
import { getProjectRewards, getCommunityStats } from '../services/community.service';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/community/rewards — Get community rewards (optionally filtered by project)
router.get('/rewards', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const projectId = req.query.project_id as string;
    if (!projectId) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'project_id query parameter is required', requestId: '' } });
      return;
    }
    const rewards = await getProjectRewards(projectId);
    res.json({ success: true, data: rewards });
  } catch (err) { next(err); }
});

// GET /api/community/stats — Get cumulative community stats
router.get('/stats', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const stats = await getCommunityStats();
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

export default router;

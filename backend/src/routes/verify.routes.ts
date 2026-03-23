import { Router, Response, Request } from 'express';
import { getPublicVerification } from '../services/verification.service';

const router = Router();

// GET /api/verify/:id — Public verification endpoint (no auth required)
router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const verification = await getPublicVerification(req.params.id);
    res.json({ success: true, data: verification });
  } catch (err) { next(err); }
});

export default router;

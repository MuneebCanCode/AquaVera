import { Router, Response } from 'express';
import { listCertificates, getCertificateDetail } from '../services/certificate.service';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/certificates — List certificates for current user
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const certificates = await listCertificates(req.userId!);
    res.json({ success: true, data: certificates });
  } catch (err) { next(err); }
});

// GET /api/certificates/:id — Get certificate detail with HFS metadata
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const detail = await getCertificateDetail(req.params.id);
    res.json({ success: true, data: detail });
  } catch (err) { next(err); }
});

export default router;

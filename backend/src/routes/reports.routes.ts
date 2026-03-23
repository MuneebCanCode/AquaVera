import { Router, Response } from 'express';
import { generateReport, getReportData } from '../services/report.service';
import { getProfile } from '../services/auth.service';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { reportGenerationSchema } from '../utils/validation';
import { hederaLimiter } from '../middleware/rate-limit';

const router = Router();

// POST /api/reports/generate — Generate compliance report
router.post('/generate', requireAuth, requireRole('corporate_buyer'), hederaLimiter, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = reportGenerationSchema.parse(req.body);
    const user = await getProfile(req.userId!);
    const report = await generateReport(
      req.userId!,
      user.organization_name,
      user.water_footprint_liters_annual,
      input.framework,
      input.period_start,
      input.period_end
    );
    res.status(201).json({ success: true, data: report });
  } catch (err) { next(err); }
});

// GET /api/reports/data — Preview report data without persisting
router.get('/data', requireAuth, requireRole('corporate_buyer'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const framework = req.query.framework as string;
    const periodStart = req.query.period_start as string;
    const periodEnd = req.query.period_end as string;
    if (!framework || !periodStart || !periodEnd) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'framework, period_start, and period_end are required', requestId: '' } });
      return;
    }
    const user = await getProfile(req.userId!);
    const data = await getReportData(
      req.userId!,
      user.organization_name,
      user.water_footprint_liters_annual,
      framework as Parameters<typeof getReportData>[3],
      periodStart,
      periodEnd
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

export default router;

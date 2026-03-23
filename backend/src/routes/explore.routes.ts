import { Router, Request, Response } from 'express';
import { getTable } from '../services/supabase';

const router = Router();

/**
 * GET /api/explore/users?role=project_operator|corporate_buyer|verifier
 * Public endpoint — returns demo users filtered by role (no auth required).
 */
router.get('/users', (req: Request, res: Response) => {
  const role = req.query.role as string;
  if (!role || !['project_operator', 'corporate_buyer', 'verifier'].includes(role)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ROLE', message: 'Role must be project_operator, corporate_buyer, or verifier' } });
    return;
  }

  const users = getTable<Record<string, unknown>>('users')
    .filter((u) => u.role === role)
    .map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      organization_name: u.organization_name,
      role: u.role,
      industry: u.industry,
      water_footprint_liters_annual: u.water_footprint_liters_annual,
    }));

  res.json({ success: true, data: users });
});

export default router;

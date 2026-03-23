import { Router, Response } from 'express';
import { register, login, getProfile } from '../services/auth.service';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { registerSchema, loginSchema } from '../utils/validation';
import { hederaLimiter } from '../middleware/rate-limit';

const router = Router();

// POST /api/auth/register — Register user + Hedera account + DID
router.post('/register', hederaLimiter, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const user = await register(input);
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
});

// POST /api/auth/login — Authenticate via backend
router.post('/login', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await login(email, password);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/auth/me — Get current user profile
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = await getProfile(req.userId!);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

export default router;

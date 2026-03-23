import { Router, Response, Request } from 'express';
import { getTable } from '../services/store';

const router = Router();

// GET /api/health — Health check with connectivity verification
router.get('/', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {};

  // In-memory store connectivity
  try {
    const users = getTable('users');
    checks.dataStore = 'ok';
    checks.userCount = String(users.length);
  } catch {
    checks.dataStore = 'down';
  }

  // Mirror Node connectivity
  try {
    const mirrorRes = await fetch('https://testnet.mirrornode.hedera.com/api/v1/blocks?limit=1');
    checks.mirrorNode = mirrorRes.ok ? 'ok' : 'degraded';
  } catch {
    checks.mirrorNode = 'down';
  }

  const overallStatus = Object.values(checks).every((s) => s === 'ok' || !isNaN(Number(s))) ? 'ok' : 'degraded';

  res.json({
    success: true,
    data: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      checks,
    },
  });
});

export default router;

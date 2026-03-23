import { Router } from 'express';
import { getGuardianPolicy } from '../services/guardian.service';

const router = Router();

/** GET /api/guardian/policy — Returns the Guardian MRV policy JSON */
router.get('/policy', async (_req, res) => {
  try {
    const policy = await getGuardianPolicy();
    res.json({
      source: 'hedera_file_service',
      file_id: process.env.GUARDIAN_POLICY_FILE_ID || 'default',
      network: process.env.HEDERA_NETWORK || 'testnet',
      policy,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to fetch Guardian policy' });
  }
});

export default router;

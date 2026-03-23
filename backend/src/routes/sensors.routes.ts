import { Router, Response } from 'express';
import { simulateSensorReading, bulkSimulateReadings, getReadings } from '../services/sensor.service';
import { verifyProjectData } from '../services/guardian.service';
import { mintWSC } from '../services/minting.service';
import { autoCreateListingAfterMint } from '../services/marketplace.service';
import { getProject } from '../services/project.service';
import { getProfile } from '../services/auth.service';
import { getAccountByEvmAddress } from '../hedera/mirror.service';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { hederaLimiter } from '../middleware/rate-limit';
import { paginationSchema } from '../utils/validation';

const router = Router();

// POST /api/sensors/simulate/:projectId — Generate mock sensor reading (operator only)
router.post('/simulate/:projectId', requireAuth, requireRole('project_operator'), hederaLimiter, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const project = await getProject(req.params.projectId);
    if (project.owner_id !== req.userId) {
      res.status(403).json({ success: false, error: { code: 'AUTH_FORBIDDEN', message: 'Not the project owner', requestId: '' } });
      return;
    }
    const reading = await simulateSensorReading(project);
    res.status(201).json({ success: true, data: reading });
  } catch (err) { next(err); }
});

// POST /api/sensors/bulk-simulate/:projectId — Generate 30 days of hourly readings (operator only)
router.post('/bulk-simulate/:projectId', requireAuth, requireRole('project_operator'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const project = await getProject(req.params.projectId);
    if (project.owner_id !== req.userId) {
      res.status(403).json({ success: false, error: { code: 'AUTH_FORBIDDEN', message: 'Not the project owner', requestId: '' } });
      return;
    }
    const days = Math.min(parseInt(req.body.days as string) || 30, 90);
    const result = await bulkSimulateReadings(project, days);
    res.status(201).json({ success: true, data: { message: `Generated ${result.count} sensor readings for ${days} days`, count: result.count } });
  } catch (err) { next(err); }
});

// GET /api/sensors/:projectId — Get sensor readings for a project
router.get('/:projectId', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await getReadings(req.params.projectId, page, limit);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});


// POST /api/sensors/verify — Trigger Guardian MRV verification and mint WSC (operator only)
router.post('/verify', requireAuth, requireRole('project_operator'), hederaLimiter, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { project_id, period_start, period_end, quality_tier } = req.body;
    const project = await getProject(project_id);
    if (project.owner_id !== req.userId) {
      res.status(403).json({ success: false, error: { code: 'AUTH_FORBIDDEN', message: 'Not the project owner', requestId: '' } });
      return;
    }

    // Run Guardian MRV verification
    const verification = await verifyProjectData(project_id, period_start, period_end, project.baseline_daily_liters, quality_tier || 'tier_1', project.water_stress_zone);
    if (!verification.passed) {
      res.json({ success: true, data: { verification, minting: null } });
      return;
    }

    // Mint WSC tokens (only if user has a Hedera account)
    const user = await getProfile(req.userId!);
    let hederaAccountId = user.hedera_account_id;
    const encryptedKey = user.hedera_private_key_encrypted;

    // If user has EVM address but no Hedera account, try to resolve via Mirror Node
    if (!hederaAccountId && user.evm_address) {
      const resolved = await getAccountByEvmAddress(user.evm_address);
      if (resolved) {
        hederaAccountId = resolved.accountId;
      }
    }

    if (!hederaAccountId || !encryptedKey) {
      // Return verification results without minting
      res.json({ success: true, data: { verification, minting: null, mintingSkipped: 'No Hedera account linked. Connect a MetaMask wallet or run seed-hedera.ts to provision accounts.' } });
      return;
    }

    const mintingEvent = await mintWSC(
      project,
      hederaAccountId,
      encryptedKey,
      verification.netWaterImpactLiters,
      quality_tier || 'tier_1',
      period_start,
      period_end,
      `guardian_verification_${project_id}_${period_start}_${period_end}`
    );

    // Auto-create marketplace listing for the minted tokens
    let autoListing = null;
    try {
      autoListing = await autoCreateListingAfterMint(
        req.userId!,
        project_id,
        mintingEvent.final_wsc_minted,
        quality_tier || 'tier_1',
      );
    } catch (listingErr) {
      // Non-fatal: minting succeeded, listing creation is best-effort
      console.warn('Auto-listing creation failed:', listingErr);
    }

    res.json({ success: true, data: { verification, minting: mintingEvent, listing: autoListing } });
  } catch (err) { next(err); }
});

export default router;

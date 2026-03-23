import { Router, Response } from 'express';
import { createListing, executeTrade, listListings, cancelListing } from '../services/marketplace.service';
import { getProfile } from '../services/auth.service';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { createListingSchema, buyRequestSchema } from '../utils/validation';
import { hederaLimiter } from '../middleware/rate-limit';

const router = Router();

// GET /api/marketplace/listings — List active marketplace listings
router.get('/listings', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const filters: Record<string, string | number | undefined> = {};
    if (req.query.credit_type) filters.creditType = req.query.credit_type as string;
    if (req.query.quality_tier) filters.qualityTier = req.query.quality_tier as string;
    if (req.query.watershed_name) filters.watershedName = req.query.watershed_name as string;
    if (req.query.water_stress_zone) filters.waterStressZone = req.query.water_stress_zone as string;
    if (req.query.min_price) filters.minPrice = parseFloat(req.query.min_price as string);
    if (req.query.max_price) filters.maxPrice = parseFloat(req.query.max_price as string);
    if (req.query.sort_by) filters.sortBy = req.query.sort_by as string;
    if (req.query.sort_order) filters.sortOrder = req.query.sort_order as string;
    const listings = await listListings(filters as Parameters<typeof listListings>[0]);
    res.json({ success: true, data: listings });
  } catch (err) { next(err); }
});

// POST /api/marketplace/listings — Create sell listing (operator only)
router.post('/listings', requireAuth, requireRole('project_operator'), hederaLimiter, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = createListingSchema.parse(req.body);
    const user = await getProfile(req.userId!);
    if (!user.hedera_account_id) {
      res.status(400).json({ success: false, error: { code: 'HEDERA_ACCOUNT_MISSING', message: 'User has no Hedera account', requestId: '' } });
      return;
    }
    const listing = await createListing(req.userId!, user.hedera_account_id, input);
    res.status(201).json({ success: true, data: listing });
  } catch (err) { next(err); }
});

// POST /api/marketplace/buy — Buy WSC from a listing
router.post('/buy', requireAuth, requireRole('corporate_buyer'), hederaLimiter, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = buyRequestSchema.parse(req.body);
    const user = await getProfile(req.userId!);
    if (!user.hedera_account_id || !user.hedera_private_key_encrypted) {
      res.status(400).json({ success: false, error: { code: 'HEDERA_ACCOUNT_MISSING', message: 'User has no Hedera account', requestId: '' } });
      return;
    }
    const trade = await executeTrade(req.userId!, user.hedera_account_id, user.hedera_private_key_encrypted, input);
    res.status(201).json({ success: true, data: trade });
  } catch (err) { next(err); }
});

// POST /api/marketplace/buy-confirm — MetaMask wallet buy: backend executes trade, records with buyer's EVM address
router.post('/buy-confirm', requireAuth, requireRole('corporate_buyer'), hederaLimiter, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { listingId, quantityWsc, buyerEvmAddress } = req.body;
    if (!listingId || !quantityWsc || quantityWsc <= 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'listingId and quantityWsc are required', requestId: '' } });
      return;
    }

    const user = await getProfile(req.userId!);

    // If user has a Hedera account and encrypted key, use the standard trade flow
    if (user.hedera_account_id && user.hedera_private_key_encrypted) {
      const trade = await executeTrade(req.userId!, user.hedera_account_id, user.hedera_private_key_encrypted, {
        listing_id: listingId,
        quantity_wsc: quantityWsc,
        payment_method: 'hbar',
        settlement_method: 'atomic_transfer',
      });
      // Attach the settlement_tx_hash if buyer provided EVM address
      if (buyerEvmAddress && trade) {
        (trade as unknown as Record<string, unknown>).settlement_tx_hash = trade.hedera_transaction_id;
      }
      res.status(201).json({ success: true, data: { ...trade, txHash: trade.hedera_transaction_id } });
      return;
    }

    // Fallback: no Hedera account — record trade without on-chain transfer
    res.status(400).json({ success: false, error: { code: 'HEDERA_ACCOUNT_MISSING', message: 'User has no Hedera account for trade execution', requestId: '' } });
  } catch (err) { next(err); }
});

// DELETE /api/marketplace/listings/:id — Cancel a listing (seller only)
router.delete('/listings/:id', requireAuth, requireRole('project_operator'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await cancelListing(req.params.id, req.userId!);
    res.json({ success: true, data: { message: 'Listing cancelled' } });
  } catch (err) { next(err); }
});

export default router;
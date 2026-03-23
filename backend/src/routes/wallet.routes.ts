import { Router, Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { getTable } from '../services/store';
import { getAccountByEvmAddress, isTokenAssociated, getAccountBalance } from '../hedera/mirror.service';

const router = Router();

// POST /api/wallet/connect — Link MetaMask EVM address to user profile
router.post('/connect', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { evmAddress } = req.body;
    if (!evmAddress || !/^0x[0-9a-fA-F]{40}$/.test(evmAddress)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ADDRESS', message: 'Invalid EVM address format', requestId: '' } });
      return;
    }

    // Resolve EVM address to Hedera account via Mirror Node
    const account = await getAccountByEvmAddress(evmAddress);
    let hederaAccountId: string | null = null;
    let tokenAssociated = false;

    if (account) {
      hederaAccountId = account.accountId;

      // Check WSC token association
      const wscTokenId = process.env.WSC_TOKEN_ID;
      if (wscTokenId && hederaAccountId) {
        tokenAssociated = await isTokenAssociated(hederaAccountId, wscTokenId);
      }
    }

    // Update user record
    const users = getTable<Record<string, unknown>>('users');
    const user = users.find(u => u.id === req.userId);
    if (user) {
      user.evm_address = evmAddress.toLowerCase();
      if (hederaAccountId) {
        user.hedera_account_id = hederaAccountId;
      }
      user.updated_at = new Date().toISOString();
    }

    res.json({ success: true, data: { hederaAccountId, tokenAssociated } });
  } catch (err) { next(err); }
});

// POST /api/wallet/disconnect — Unlink MetaMask wallet from user profile
router.post('/disconnect', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const users = getTable<Record<string, unknown>>('users');
    const user = users.find(u => u.id === req.userId);
    if (user) {
      user.evm_address = null;
      user.updated_at = new Date().toISOString();
    }
    res.json({ success: true, data: { success: true } });
  } catch (err) { next(err); }
});


// GET /api/wallet/balance — Get user's WSC and HBAR balances from Mirror Node
router.get('/balance', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const users = getTable<Record<string, unknown>>('users');
    const user = users.find(u => u.id === req.userId);
    if (!user?.hedera_account_id) {
      res.json({ success: true, data: { wscBalance: 0, hbarBalance: 0 } });
      return;
    }

    const balances = await getAccountBalance(user.hedera_account_id as string);
    const wscTokenId = process.env.WSC_TOKEN_ID;
    const wscToken = balances.tokens.find(t => t.token_id === wscTokenId);
    const wscBalance = wscToken ? wscToken.balance / 100 : 0; // 2 decimals

    res.json({
      success: true,
      data: {
        wscBalance,
        hbarBalance: balances.balance / 1e8, // tinybars to HBAR
      },
    });
  } catch (err) { next(err); }
});

export default router;

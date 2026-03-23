import { Router, Request, Response } from 'express';
import { getSupabase } from '../services/supabase';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { LITERS_PER_WSC } from '../utils/constants';

const router = Router();

// ─── In-memory cache for platform stats (public endpoint, refreshes every 30s) ──
let platformStatsCache: { data: Record<string, unknown>; ts: number } | null = null;
const PLATFORM_CACHE_TTL = 30_000;

// GET /api/dashboard/stats/platform — Public platform stats (no auth required)
router.get('/stats/platform', async (_req: Request, res: Response, next) => {
  try {
    const now = Date.now();
    if (platformStatsCache && now - platformStatsCache.ts < PLATFORM_CACHE_TTL) {
      res.json({ success: true, data: platformStatsCache.data });
      return;
    }

    const supabase = getSupabase();
    const [projectsRes, mintRes, buyersRes, retirementsRes] = await Promise.all([
      supabase.from('water_projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('water_projects').select('total_wsc_minted'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'corporate_buyer'),
      supabase.from('retirements').select('quantity_wsc_retired'),
    ]);

    const totalWscMinted = (mintRes.data || []).reduce((sum: number, p: { total_wsc_minted: number }) => sum + p.total_wsc_minted, 0);
    const totalCreditsRetired = (retirementsRes.data || []).reduce((sum: number, r: { quantity_wsc_retired: number }) => sum + r.quantity_wsc_retired, 0);

    const data = {
      totalWscMinted,
      totalLitersVerified: totalWscMinted * LITERS_PER_WSC,
      totalActiveProjects: projectsRes.count || 0,
      totalCorporateBuyers: buyersRes.count || 0,
      totalCreditsRetired,
    };

    platformStatsCache = { data, ts: now };
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/dashboard/stats — Aggregated dashboard statistics
router.get('/stats', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const supabase = getSupabase();
    const userId = req.userId!;
    const role = req.userRole;
    const explore = req.query.explore === 'true';

    // Common stats
    const { count: totalProjects } = await supabase
      .from('water_projects')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { data: allRetirements } = await supabase
      .from('retirements')
      .select('quantity_wsc_retired');
    const totalWscRetired = (allRetirements || []).reduce((sum: number, r: { quantity_wsc_retired: number }) => sum + r.quantity_wsc_retired, 0);

    const { data: allTrades } = await supabase
      .from('trades')
      .select('total_hbar');
    const totalTradeVolume = (allTrades || []).reduce((sum: number, t: { total_hbar: number }) => sum + t.total_hbar, 0);

    const { count: activeListings } = await supabase
      .from('marketplace_listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Role-specific stats
    let userStats: Record<string, unknown> = {};
    if (role === 'corporate_buyer') {
      let retirementQuery = supabase
        .from('retirements')
        .select('quantity_wsc_retired');
      if (!explore) retirementQuery = retirementQuery.eq('buyer_id', userId);
      const { data: myRetirements } = await retirementQuery;
      const myRetired = (myRetirements || []).reduce((sum: number, r: { quantity_wsc_retired: number }) => sum + r.quantity_wsc_retired, 0);
      userStats = { myWscRetired: myRetired, myLitersOffset: myRetired * LITERS_PER_WSC };
    } else if (role === 'project_operator') {
      let projectQuery = supabase
        .from('water_projects')
        .select('id, total_wsc_minted');
      if (!explore) projectQuery = projectQuery.eq('owner_id', userId);
      const { data: myProjects } = await projectQuery;
      const myMinted = (myProjects || []).reduce((sum: number, p: { total_wsc_minted: number }) => sum + p.total_wsc_minted, 0);
      const projectIds = (myProjects || []).map((p: { id: string }) => p.id);
      let communityRewardsEarned = 0;
      if (projectIds.length > 0) {
        const { data: rewards } = await supabase
          .from('community_rewards')
          .select('reward_amount_hbar')
          .in('project_id', projectIds);
        communityRewardsEarned = (rewards || []).reduce((sum: number, r: { reward_amount_hbar: number }) => sum + r.reward_amount_hbar, 0);
      }
      userStats = { myProjectCount: (myProjects || []).length, myTotalWscMinted: myMinted, communityRewardsEarned };
    } else if (role === 'admin') {
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      const { data: allProjects } = await supabase
        .from('water_projects')
        .select('total_wsc_minted');
      const totalWscMinted = (allProjects || []).reduce((sum: number, p: { total_wsc_minted: number }) => sum + p.total_wsc_minted, 0);
      const { count: totalTradesCompleted } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');
      const { count: totalRetirementsCount } = await supabase
        .from('retirements')
        .select('*', { count: 'exact', head: true });
      const { data: allRewards } = await supabase
        .from('community_rewards')
        .select('reward_amount_hbar');
      const totalCommunityRewards = (allRewards || []).reduce((sum: number, r: { reward_amount_hbar: number }) => sum + r.reward_amount_hbar, 0);
      userStats = {
        totalUsers: totalUsers || 0,
        totalWscMinted,
        totalTradesCompleted: totalTradesCompleted || 0,
        totalRetirements: totalRetirementsCount || 0,
        totalCommunityRewards,
      };
    }

    res.json({
      success: true,
      data: {
        totalActiveProjects: totalProjects || 0,
        totalWscRetired,
        totalLitersOffset: totalWscRetired * LITERS_PER_WSC,
        totalTradeVolumeHbar: totalTradeVolume,
        activeListings: activeListings || 0,
        ...userStats,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/dashboard/activity — Recent platform activity
router.get('/activity', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const supabase = getSupabase();
    const limit = parseInt(req.query.limit as string) || 20;

    const { data: recentTrades } = await supabase
      .from('trades')
      .select('id, quantity_wsc, total_hbar, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data: recentRetirements } = await supabase
      .from('retirements')
      .select('id, quantity_wsc_retired, equivalent_liters, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    res.json({
      success: true,
      data: {
        recentTrades: recentTrades || [],
        recentRetirements: recentRetirements || [],
      },
    });
  } catch (err) { next(err); }
});

export default router;

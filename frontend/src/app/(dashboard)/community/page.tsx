'use client';

import { useEffect, useState } from 'react';
import { Heart, Coins, Users, Droplets, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNumber, formatHbar, formatLiters } from '@/lib/utils';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardTitle } from '@/components/ui/Card';
import { HashScanLink } from '@/components/ui/HashScanLink';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { toast } from 'sonner';
import type { CommunityReward, WaterProject } from '@/types';
import { withExplore } from '@/lib/explore';

interface CommunityStats {
  totalRewardsHbar: number;
  totalTrades: number;
  totalProjects: number;
  projectBreakdown: { projectId: string; projectName: string; totalRewards: number; tradeCount: number }[];
}

const impactStories = [
  {
    title: 'Clean Water for Rural Schools',
    description: 'Community funds from the Colorado River Watershed Restoration project helped install water filtration systems in 3 rural schools, providing clean drinking water to over 500 students.',
    icon: Droplets,
  },
  {
    title: 'Women-Led Water Cooperatives',
    description: 'Revenue from the Kenya RainHarvest Foundation project funded training for 50 women in water management, creating sustainable local cooperatives that serve 2,000 households.',
    icon: Users,
  },
  {
    title: 'Industrial Recycling Innovation',
    description: 'The Mumbai AquaCycle Industries project reinvested community rewards into R&D for advanced water recycling technology, reducing industrial water waste by 40% in the pilot facility.',
    icon: TrendingUp,
  },
];

export default function CommunityPage() {
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [rewards, setRewards] = useState<CommunityReward[]>([]);
  const [projects, setProjects] = useState<WaterProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<CommunityStats>(withExplore('/community/stats')),
      api.get<WaterProject[]>(withExplore('/projects')),
    ]).then(([statsRes, projRes]) => {
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      else if (!statsRes.success) toast.error(statsRes.error?.message || 'Failed to load community stats');
      if (projRes.success && projRes.data) {
        const active = projRes.data.filter((p) => p.status === 'active');
        setProjects(active);
        if (active.length > 0) {
          setSelectedProject(active[0].id);
          loadRewards(active[0].id);
        }
      }
    }).finally(() => setLoading(false));
  }, []);

  async function loadRewards(projectId: string) {
    const res = await api.get<CommunityReward[]>(`/community/rewards?project_id=${projectId}`);
    if (res.success && res.data) setRewards(res.data);
  }

  function handleProjectChange(projectId: string) {
    setSelectedProject(projectId);
    loadRewards(projectId);
  }

  const rewardColumns: Column<CommunityReward>[] = [
    { key: 'trade_id', header: 'Trade', render: (r) => <span className="text-xs font-mono">{r.trade_id.slice(0, 8)}…</span> },
    { key: 'reward_amount_hbar', header: 'Amount', render: (r) => formatHbar(r.reward_amount_hbar) },
    { key: 'recipient_hedera_account_id', header: 'Recipient', render: (r) => <span className="text-xs font-mono">{r.recipient_hedera_account_id}</span> },
    { key: 'hedera_transaction_id', header: 'Transaction', render: (r) => r.hedera_transaction_id ? <HashScanLink entityType="transaction" entityId={r.hedera_transaction_id} /> : <span className="text-gray-400">—</span> },
    { key: 'created_at', header: 'Date', render: (r) => new Date(r.created_at).toLocaleDateString() },
  ];

  if (loading) return <LoadingSpinner size="lg" label="Loading community data..." />;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Community Conservation Fund</h2>
      <p className="text-sm text-gray-500">15% of every credit sale goes directly to communities associated with water projects.</p>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Coins} label="Total Rewards Distributed" value={formatHbar(stats?.totalRewardsHbar || 0)} />
        <StatCard icon={Heart} label="Contributing Trades" value={formatNumber(stats?.totalTrades || 0)} />
        <StatCard icon={Users} label="Projects Benefiting" value={formatNumber(stats?.totalProjects || 0)} />
      </div>

      {/* Per-Project Breakdown */}
      {stats?.projectBreakdown && stats.projectBreakdown.length > 0 && (
        <Card>
          <CardTitle>Rewards by Project</CardTitle>
          <div className="space-y-3 mt-3">
            {stats.projectBreakdown.map((pb) => (
              <div key={pb.projectId} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{pb.projectName}</p>
                  <p className="text-xs text-gray-500">{pb.tradeCount} trade{pb.tradeCount !== 1 ? 's' : ''}</p>
                </div>
                <span className="font-bold text-teal">{formatHbar(pb.totalRewards)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Distribution Table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Distribution History</CardTitle>
          <select
            value={selectedProject}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="input-field w-auto text-sm"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.project_name}</option>
            ))}
          </select>
        </div>
        <DataTable columns={rewardColumns} data={rewards} keyExtractor={(r) => r.id} emptyMessage="No rewards distributed yet for this project." />
      </Card>

      {/* Impact Stories */}
      <Card>
        <CardTitle>Impact Stories</CardTitle>
        <p className="text-sm text-gray-500 mt-1 mb-4">How community funds are making a difference around the world.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {impactStories.map((story, i) => (
            <div key={i} className="p-4 rounded-lg border border-gray-200 hover:border-teal/30 transition-colors">
              <story.icon className="h-8 w-8 text-teal mb-3" />
              <h4 className="font-semibold text-gray-900 text-sm mb-2">{story.title}</h4>
              <p className="text-xs text-gray-500 leading-relaxed">{story.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

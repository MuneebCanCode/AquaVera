'use client';

import { useEffect, useState } from 'react';
import { LazyBarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from '@/components/ui/LazyChart';
import { Users, Droplets, Coins, ArrowRightLeft, Leaf, Activity, TrendingUp, Clock, CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNumber, formatLiters, formatHbar } from '@/lib/utils';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardTitle } from '@/components/ui/Card';
import { ChartWrapper } from '@/components/ui/ChartWrapper';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { ScheduledTransaction } from '@/types';

export function AdminDashboard() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [scheduled, setScheduled] = useState<ScheduledTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Record<string, number>>('/dashboard/stats'),
      api.get<ScheduledTransaction[]>('/scheduling'),
    ]).then(([statsRes, schedRes]) => {
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (schedRes.success && schedRes.data) setScheduled(schedRes.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner size="lg" label="Loading dashboard..." />;

  const impactData = [
    { name: 'Projects', value: stats.totalActiveProjects || 0 },
    { name: 'WSC Retired', value: stats.totalWscRetired || 0 },
    { name: 'Listings', value: stats.activeListings || 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={formatNumber(stats.totalUsers || 0)} />
        <StatCard icon={Droplets} label="Total Projects" value={formatNumber(stats.totalActiveProjects || 0)} />
        <StatCard icon={Coins} label="Total WSC Minted" value={formatNumber(stats.totalWscMinted || 0)} />
        <StatCard icon={ArrowRightLeft} label="Trades Completed" value={formatNumber(stats.totalTradesCompleted || 0)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Leaf} label="Total Retirements" value={formatNumber(stats.totalRetirements || 0)} />
        <StatCard icon={TrendingUp} label="Community Rewards" value={formatHbar(stats.totalCommunityRewards || 0)} />
        <StatCard icon={Activity} label="Liters Verified" value={formatLiters(stats.totalLitersOffset || 0)} />
      </div>

      <Card>
        <CardTitle>Platform Overview</CardTitle>
        <ChartWrapper height={280}>
          <LazyBarChart data={impactData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#0D9488" radius={[4, 4, 0, 0]} />
          </LazyBarChart>
        </ChartWrapper>
      </Card>

      {/* Scheduled Transactions */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <CalendarClock className="h-5 w-5 text-teal" />
          <CardTitle>Scheduled Transactions</CardTitle>
        </div>
        {scheduled.length > 0 ? (
          <div className="space-y-3">
            {scheduled.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{tx.transaction_type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Expected: {new Date(tx.expected_execution).toLocaleString()}
                  </p>
                  {tx.schedule_id && (
                    <p className="text-xs text-gray-400 font-mono mt-0.5">Schedule: {tx.schedule_id}</p>
                  )}
                </div>
                <Badge variant={tx.status === 'executed' ? 'success' : tx.status === 'expired' ? 'danger' : 'warning'}>
                  {tx.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">No scheduled transactions yet.</p>
        )}
      </Card>
    </div>
  );
}

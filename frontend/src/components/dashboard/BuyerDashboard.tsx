'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LazyPieChart, Pie, Cell, Tooltip, Legend } from '@/components/ui/LazyChart';
import { Coins, Droplets, Leaf, Award, ShoppingCart, FileText, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNumber, formatLiters, formatHbar } from '@/lib/utils';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardTitle } from '@/components/ui/Card';
import { ChartWrapper } from '@/components/ui/ChartWrapper';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { User, Trade, Retirement, MarketplaceListing } from '@/types';
import { withExplore } from '@/lib/explore';
import { useWallet } from '@/lib/wallet';

interface Props { user: User }

const COLORS = ['#0D9488', '#1E3A5F', '#10B981', '#F59E0B', '#EF4444'];

const stewardshipColors: Record<string, string> = {
  Bronze: 'bg-amber-100 text-amber-700',
  Silver: 'bg-gray-200 text-gray-700',
  Gold: 'bg-yellow-100 text-yellow-700',
  Platinum: 'bg-purple-100 text-purple-700',
};

function getStewardshipLevel(offsetPct: number): string {
  if (offsetPct >= 75) return 'Platinum';
  if (offsetPct >= 50) return 'Gold';
  if (offsetPct >= 25) return 'Silver';
  return 'Bronze';
}

export function BuyerDashboard({ user }: Props) {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [trades, setTrades] = useState<Trade[]>([]);
  const [retirements, setRetirements] = useState<Retirement[]>([]);
  const [portfolioData, setPortfolioData] = useState<{ name: string; value: number }[]>([]);
  const [mirrorBalance, setMirrorBalance] = useState<number | null>(null);
  const [mirrorFallback, setMirrorFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const wallet = useWallet();

  useEffect(() => {
    const promises: Promise<unknown>[] = [
      api.get<Record<string, number>>(withExplore('/dashboard/stats')),
      api.get<{ recentTrades: Trade[]; recentRetirements: Retirement[] }>(withExplore('/dashboard/activity')),
      api.get<MarketplaceListing[]>(withExplore('/marketplace/listings')),
    ];

    // Fetch real-time balance from Mirror Node
    if (user.hedera_account_id) {
      promises.push(
        api.get<{ hbarBalance: number; tokenBalances: { tokenId: string; balance: number }[] }>(`/hedera/balance/${user.hedera_account_id}`)
      );
    }

    Promise.all(promises).then(([statsRes, activityRes, listingsRes, balRes]) => {
      const sr = statsRes as { success: boolean; data?: Record<string, number> };
      const ar = activityRes as { success: boolean; data?: { recentTrades: Trade[]; recentRetirements: Retirement[] } };
      const lr = listingsRes as { success: boolean; data?: MarketplaceListing[] };
      const br = balRes as { success: boolean; data?: { tokenBalances: { tokenId: string; balance: number }[] } } | undefined;

      if (sr.success && sr.data) setStats(sr.data);
      if (ar.success && ar.data) {
        setTrades(ar.data.recentTrades || []);
        setRetirements(ar.data.recentRetirements || []);
      }
      // Mirror Node balance
      if (br && br.success && br.data) {
        const wscToken = br.data.tokenBalances?.find((t) => t.balance > 0);
        if (wscToken) setMirrorBalance(wscToken.balance);
        else setMirrorBalance(0);
      } else {
        setMirrorFallback(true); // Mirror Node unavailable
      }
      // Build portfolio breakdown
      if (lr.success && lr.data) {
        const typeMap: Record<string, number> = {};
        lr.data.forEach((l) => {
          const sold = l.quantity_wsc - l.quantity_remaining;
          if (sold > 0) {
            const label = l.credit_type.charAt(0).toUpperCase() + l.credit_type.slice(1);
            typeMap[label] = (typeMap[label] || 0) + sold;
          }
        });
        const entries = Object.entries(typeMap);
        if (entries.length > 0) {
          setPortfolioData(entries.map(([name, value]) => ({ name, value })));
        }
      }
    }).finally(() => setLoading(false));
  }, []);

  // Fetch live balance from wallet endpoint when wallet is connected
  useEffect(() => {
    if (wallet.status === 'connected') {
      api.get<{ wscBalance: number; hbarBalance: number }>('/wallet/balance')
        .then((res) => {
          if (res.success && res.data) {
            setMirrorBalance(res.data.wscBalance);
            setMirrorFallback(false);
          }
        });
    }
  }, [wallet.status]);

  if (loading) return <LoadingSpinner size="lg" label="Loading dashboard..." />;

  const annualUsage = user.water_footprint_liters_annual || 0;
  const litersOffset = (stats.myLitersOffset || 0);
  const offsetPct = annualUsage > 0 ? Math.min(100, Math.round((litersOffset / annualUsage) * 100)) : 0;
  const level = getStewardshipLevel(offsetPct);

  const tradeColumns: Column<Trade>[] = [
    { key: 'quantity_wsc', header: 'Quantity', render: (r) => `${formatNumber(r.quantity_wsc)} WSC` },
    { key: 'total_hbar', header: 'Total', render: (r) => formatHbar(r.total_hbar) },
    { key: 'status', header: 'Status', render: (r) => <Badge variant="success">{r.status}</Badge> },
    { key: 'created_at', header: 'Date', render: (r) => new Date(r.created_at).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      {/* Stewardship Badge */}
      <div className="flex items-center gap-3">
        <span className={`badge text-sm px-3 py-1 ${stewardshipColors[level]}`}>
          <Award className="h-4 w-4 mr-1 inline" />
          {level} Stewardship
        </span>
        <span className="text-sm text-gray-500">{offsetPct}% water footprint offset</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Droplets} label="Annual Water Usage" value={formatLiters(annualUsage)} />
        <StatCard icon={Coins} label={wallet.status === 'connected' ? 'WSC Balance (live)' : mirrorFallback ? 'WSC Balance (cached)' : 'WSC Balance'} value={formatNumber(mirrorBalance ?? stats.wscBalance ?? 0)} />
        <StatCard icon={Leaf} label="WSC Retired" value={formatNumber(stats.myWscRetired || 0)} />
        <StatCard icon={TrendingUp} label="Net Offset" value={`${offsetPct}%`} />
      </div>

      {/* Mirror Node Fallback Warning */}
      {mirrorFallback && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm">
          <span>⚠️</span>
          <span>On-chain data temporarily unavailable — showing cached values</span>
        </div>
      )}

      {/* Portfolio Pie Chart */}
      {portfolioData.length > 0 && (
        <Card>
          <CardTitle>Credit Portfolio Breakdown</CardTitle>
          <ChartWrapper height={250}>
            <LazyPieChart>
              <Pie data={portfolioData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                {portfolioData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </LazyPieChart>
          </ChartWrapper>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/marketplace"><Button><ShoppingCart className="h-4 w-4" /> Buy Credits</Button></Link>
        <Link href="/retire"><Button variant="secondary"><Leaf className="h-4 w-4" /> Retire Credits</Button></Link>
        <Link href="/reports"><Button variant="outline"><FileText className="h-4 w-4" /> Generate Report</Button></Link>
      </div>

      {/* Recent Trades */}
      <Card>
        <CardTitle>Recent Trades</CardTitle>
        <DataTable columns={tradeColumns} data={trades} keyExtractor={(r) => r.id} emptyMessage="No trades yet" />
      </Card>

      {/* AVIC Certificates */}
      <Card>
        <CardTitle>Impact Certificates (AVIC NFTs)</CardTitle>
        {retirements.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
            {retirements.map((r) => (
              <div key={r.id} className="p-4 rounded-lg border border-teal/20 bg-teal-50/30">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-5 w-5 text-teal" />
                  <span className="font-medium text-gray-900">{formatNumber(r.quantity_wsc_retired)} WSC</span>
                </div>
                <p className="text-xs text-gray-500">{formatLiters(r.equivalent_liters)} offset</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm mt-3">No certificates yet. Retire credits to earn AVIC NFTs.</p>
        )}
      </Card>
    </div>
  );
}

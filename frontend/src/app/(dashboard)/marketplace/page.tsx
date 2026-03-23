'use client';

import { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, Coins, Droplets, ShoppingCart, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNumber, formatHbar } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { BuyModal } from '@/components/marketplace/BuyModal';
import { CreateListingModal } from '@/components/marketplace/CreateListingModal';
import type { MarketplaceListing } from '@/types';
import { withExplore } from '@/lib/explore';

const creditTypes = ['all', 'conservation', 'restoration', 'recycling', 'access', 'efficiency'];
const qualityTiers = ['all', 'tier_1', 'tier_2', 'tier_3'];
const stressZones = ['all', 'low', 'medium', 'high', 'extreme'];
const sortOptions = [
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'quantity_desc', label: 'Quantity: Most' },
  { value: 'date_desc', label: 'Newest' },
];

export default function MarketplacePage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [stressFilter, setStressFilter] = useState('all');
  const [sort, setSort] = useState('price_asc');
  const [buyListing, setBuyListing] = useState<MarketplaceListing | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function fetchListings() {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter !== 'all') params.set('credit_type', typeFilter);
    if (tierFilter !== 'all') params.set('quality_tier', tierFilter);
    if (stressFilter !== 'all') params.set('water_stress_zone', stressFilter);
    const [sortBy, sortOrder] = sort.includes('asc') ? [sort.replace('_asc', ''), 'asc'] : [sort.replace('_desc', ''), 'desc'];
    params.set('sort_by', sortBy);
    params.set('sort_order', sortOrder);
    const res = await api.get<MarketplaceListing[]>(withExplore(`/marketplace/listings?${params.toString()}`));
    if (res.success && res.data) setListings(res.data);
    setLoading(false);
  }

  useEffect(() => { fetchListings(); }, [typeFilter, tierFilter, stressFilter, sort]);

  const activeListings = listings.filter((l) => l.status === 'active' || l.status === 'partially_filled');

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <SlidersHorizontal className="h-4 w-4" /> Filters:
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field w-auto text-sm">
          {creditTypes.map((t) => (
            <option key={t} value={t}>{t === 'all' ? 'All Credit Types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="input-field w-auto text-sm">
          {qualityTiers.map((t) => (
            <option key={t} value={t}>{t === 'all' ? 'All Tiers' : t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
        <select value={stressFilter} onChange={(e) => setStressFilter(e.target.value)} className="input-field w-auto text-sm">
          {stressZones.map((z) => (
            <option key={z} value={z}>{z === 'all' ? 'All Stress Zones' : z.charAt(0).toUpperCase() + z.slice(1)}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="input-field w-auto text-sm">
          {sortOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {user?.role === 'project_operator' && (
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Create Listing</Button>
        )}
      </div>

      {/* Listings Grid */}
      {loading ? (
        <LoadingSpinner size="lg" label="Loading marketplace..." />
      ) : activeListings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeListings.map((l) => (
            <div key={l.id} className="card hover:border-teal/40 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-lg font-bold text-gray-900">{formatNumber(l.quantity_remaining)} WSC</p>
                  <p className="text-sm text-teal font-medium">{formatHbar(l.price_per_wsc_hbar)} / WSC</p>
                </div>
                <StatusBadge status={l.status} />
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <StatusBadge status={l.credit_type} />
                <StatusBadge status={l.quality_tier} />
                <StatusBadge status={l.water_stress_zone} />
              </div>
              <div className="text-xs text-gray-500 space-y-1 mb-4">
                <div className="flex items-center gap-1"><Droplets className="h-3 w-3" /> {l.watershed_name}</div>
                {l.seller_organization && <div>Seller: {l.seller_organization}</div>}
                {l.project_name && <div>Project: {l.project_name}</div>}
              </div>
              {user?.role === 'corporate_buyer' && (
                <Button size="sm" className="w-full" onClick={() => setBuyListing(l)}>
                  <ShoppingCart className="h-3 w-3" /> Buy Credits
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">No active listings match your filters.</div>
      )}

      {/* Buy Modal */}
      {buyListing && (
        <BuyModal
          listing={buyListing}
          onClose={() => setBuyListing(null)}
          onSuccess={() => { setBuyListing(null); fetchListings(); }}
        />
      )}

      {/* Create Listing Modal */}
      {showCreate && (
        <CreateListingModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); fetchListings(); }}
        />
      )}
    </div>
  );
}

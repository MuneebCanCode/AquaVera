'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Droplets, MapPin, Coins } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { WaterProject } from '@/types';
import { withExplore } from '@/lib/explore';

const projectTypes = ['all', 'conservation', 'restoration', 'recycling', 'access', 'efficiency'];
const stressZones = ['all', 'low', 'medium', 'high', 'extreme'];

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<WaterProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [stressFilter, setStressFilter] = useState('all');

  useEffect(() => {
    api.get<WaterProject[]>(withExplore('/projects')).then((res) => {
      if (res.success && res.data) setProjects(res.data);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = projects.filter((p) => {
    if (search && !p.project_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'all' && p.project_type !== typeFilter) return false;
    if (stressFilter !== 'all' && p.water_stress_zone !== stressFilter) return false;
    return true;
  });

  if (loading) return <LoadingSpinner size="lg" label="Loading projects..." />;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field w-auto">
          {projectTypes.map((t) => (
            <option key={t} value={t}>{t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <select value={stressFilter} onChange={(e) => setStressFilter(e.target.value)} className="input-field w-auto">
          {stressZones.map((z) => (
            <option key={z} value={z}>{z === 'all' ? 'All Stress Zones' : z.charAt(0).toUpperCase() + z.slice(1)}</option>
          ))}
        </select>
        {user?.role === 'project_operator' && (
          <Link href="/projects/register">
            <Button size="sm"><Plus className="h-4 w-4" /> Register Project</Button>
          </Link>
        )}
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="card hover:border-teal/40 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm leading-tight">{p.project_name}</h3>
              <StatusBadge status={p.status} />
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <StatusBadge status={p.project_type} />
              <StatusBadge status={p.water_stress_zone} />
            </div>
            <div className="space-y-1.5 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> {p.location_name}
              </div>
              <div className="flex items-center gap-1.5">
                <Droplets className="h-3 w-3" /> {p.watershed_name}
              </div>
              <div className="flex items-center gap-1.5">
                <Coins className="h-3 w-3" /> {formatNumber(p.total_wsc_minted)} WSC minted
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          {search || typeFilter !== 'all' || stressFilter !== 'all'
            ? 'No projects match your filters.'
            : 'No projects found.'}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Clock, CheckCircle, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardTitle } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { toast } from 'sonner';
import type { User, WaterProject } from '@/types';
import { withExplore } from '@/lib/explore';

interface Props { user: User }

export function VerifierDashboard({ user }: Props) {
  const [projects, setProjects] = useState<WaterProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    api.get<WaterProject[]>(withExplore('/projects')).then((res) => {
      if (res.success && res.data) setProjects(res.data);
    }).finally(() => setLoading(false));
  }, []);

  const pending = projects.filter((p) => p.status === 'pending_verification' || p.status === 'registered');
  const verified = projects.filter((p) => p.status === 'active');

  async function handleVerify(projectId: string, approved: boolean) {
    setActionLoading(projectId);
    const notes = approved ? 'All sensor data verified. Project meets MRV policy requirements.' : 'Data quality issues detected. Please review sensor calibration.';
    const res = await api.post(`/projects/${projectId}/verify`, { approved, verification_notes: notes });
    setActionLoading(null);
    if (res.success) {
      toast.success(approved ? 'Project approved' : 'Project rejected');
      // Refresh
      const refreshed = await api.get<WaterProject[]>('/projects');
      if (refreshed.success && refreshed.data) setProjects(refreshed.data);
    } else {
      toast.error(res.error?.message || 'Action failed');
    }
  }

  if (loading) return <LoadingSpinner size="lg" label="Loading dashboard..." />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Clock} label="Pending Review" value={pending.length} />
        <StatCard icon={ShieldCheck} label="Verified Projects" value={verified.length} />
        <StatCard icon={CheckCircle} label="Total Projects" value={projects.length} />
      </div>

      {/* Pending Verification */}
      <Card>
        <CardTitle>Projects Pending Verification</CardTitle>
        <div className="space-y-3 mt-3">
          {pending.map((p) => (
            <div key={p.id} className="p-4 rounded-lg border border-yellow-200 bg-yellow-50/30">
              <div className="flex items-center justify-between">
                <div>
                  <Link href={`/projects/${p.id}`} className="font-medium text-gray-900 hover:text-teal">
                    {p.project_name}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={p.project_type} />
                    <StatusBadge status={p.water_stress_zone} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{p.location_name} · {formatNumber(p.baseline_daily_liters)} L/day baseline</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    loading={actionLoading === p.id}
                    onClick={() => handleVerify(p.id, true)}
                  >
                    <CheckCircle className="h-3 w-3" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={actionLoading === p.id}
                    onClick={() => handleVerify(p.id, false)}
                  >
                    <XCircle className="h-3 w-3" /> Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {pending.length === 0 && (
            <p className="text-center text-gray-400 py-6">No projects pending verification.</p>
          )}
        </div>
      </Card>

      {/* Verified Projects */}
      <Card>
        <CardTitle>Verified Projects</CardTitle>
        <div className="space-y-3 mt-3">
          {verified.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
              <div>
                <Link href={`/projects/${p.id}`} className="font-medium text-gray-900 hover:text-teal">
                  {p.project_name}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={p.status} />
                  <StatusBadge status={p.project_type} />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Verified {p.verification_date ? new Date(p.verification_date).toLocaleDateString() : 'N/A'}
                  {' · '}{formatNumber(p.total_wsc_minted)} WSC minted
                </p>
              </div>
            </div>
          ))}
          {verified.length === 0 && (
            <p className="text-center text-gray-400 py-6">No verified projects yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

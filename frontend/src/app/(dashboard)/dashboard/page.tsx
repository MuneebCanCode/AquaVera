'use client';

import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const loader = () => <LoadingSpinner size="lg" label="Loading dashboard..." />;

const OperatorDashboard = dynamic(() => import('@/components/dashboard/OperatorDashboard').then((m) => ({ default: m.OperatorDashboard })), { loading: loader });
const BuyerDashboard = dynamic(() => import('@/components/dashboard/BuyerDashboard').then((m) => ({ default: m.BuyerDashboard })), { loading: loader });
const VerifierDashboard = dynamic(() => import('@/components/dashboard/VerifierDashboard').then((m) => ({ default: m.VerifierDashboard })), { loading: loader });
const AdminDashboard = dynamic(() => import('@/components/dashboard/AdminDashboard').then((m) => ({ default: m.AdminDashboard })), { loading: loader });

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  switch (user.role) {
    case 'project_operator':
      return <OperatorDashboard user={user} />;
    case 'corporate_buyer':
      return <BuyerDashboard user={user} />;
    case 'verifier':
      return <VerifierDashboard user={user} />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <AdminDashboard />;
  }
}

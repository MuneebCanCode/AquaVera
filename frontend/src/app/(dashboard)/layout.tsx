'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { isExploreMode, clearExploreMode } from '@/lib/explore';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { Header } from '@/components/layout/Header';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Waves, X } from 'lucide-react';

const NOTIFICATION_CACHE_MS = 60_000; // refresh at most once per minute

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [explore, setExplore] = useState(false);
  const lastNotifFetch = useRef(0);

  useEffect(() => {
    setExplore(isExploreMode());
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Fetch notifications at most once per minute (cached)
  useEffect(() => {
    if (!user) return;
    const now = Date.now();
    if (now - lastNotifFetch.current < NOTIFICATION_CACHE_MS) return;
    lastNotifFetch.current = now;

    api.get<{ notifications: unknown[]; unreadCount: number }>(explore ? '/notifications?explore=true' : '/notifications')
      .then((res) => {
        if (res.success && res.data) setUnreadCount(res.data.unreadCount);
      });
  }, [user, explore]);

  function handleExitExplore() {
    clearExploreMode();
    logout();
    router.push('/');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" label="Loading AquaVera..." />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-light-gray">
      {explore && (
        <div className="bg-gradient-to-r from-teal to-emerald-600 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm">
          <Waves className="h-4 w-4" />
          <span>You are exploring AquaVera as <span className="font-semibold">{user?.role === 'project_operator' ? 'a Project Operator' : user?.role === 'corporate_buyer' ? 'a Corporate Buyer' : 'a Verifier'}</span> — viewing all demo data</span>
          <button onClick={handleExitExplore} className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors text-xs font-medium">
            <X className="h-3 w-3" /> Exit
          </button>
        </div>
      )}
      <Sidebar />
      <MobileNav />
      <div className="lg:pl-64">
        <Header unreadCount={unreadCount} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

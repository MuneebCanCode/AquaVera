'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCheck, Mail, MailOpen, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { toast } from 'sonner';
import type { Notification, NotificationType } from '@/types';
import { withExplore } from '@/lib/explore';

const typeConfig: Record<NotificationType, { label: string; variant: 'default' | 'success' | 'danger' | 'warning' | 'info' }> = {
  trade: { label: 'Trade', variant: 'info' },
  verification: { label: 'Verification', variant: 'warning' },
  minting: { label: 'Minting', variant: 'success' },
  retirement: { label: 'Retirement', variant: 'success' },
  reward: { label: 'Reward', variant: 'info' },
  system: { label: 'System', variant: 'default' },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    const res = await api.get<{ notifications: Notification[]; unreadCount: number }>(withExplore('/notifications'));
    if (res.success && res.data) {
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } else {
      toast.error(res.error?.message || 'Failed to load notifications');
    }
  }, []);

  useEffect(() => {
    loadNotifications().finally(() => setLoading(false));
  }, [loadNotifications]);

  async function markAsRead(id: string) {
    setMarkingId(id);
    const res = await api.patch(`/notifications/${id}/read`);
    if (res.success) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } else {
      toast.error(res.error?.message || 'Failed to mark as read');
    }
    setMarkingId(null);
  }

  if (loading) return <LoadingSpinner size="lg" label="Loading notifications..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
          <p className="text-sm text-gray-500">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => { setLoading(true); loadNotifications().finally(() => setLoading(false)); }}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Bell className="h-12 w-12 mb-3" />
            <p className="text-sm">No notifications yet.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const cfg = typeConfig[n.type] || typeConfig.system;
            return (
              <Card key={n.id} className={`transition-colors ${!n.is_read ? 'border-l-4 border-l-teal bg-teal/5' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {n.is_read ? (
                      <MailOpen className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Mail className="h-5 w-5 text-teal" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p className="font-medium text-gray-900 text-sm">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                  </div>
                  {!n.is_read && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => markAsRead(n.id)}
                      disabled={markingId === n.id}
                    >
                      {markingId === n.id ? <LoadingSpinner size="sm" /> : <CheckCheck className="h-4 w-4" />}
                      <span className="ml-1 hidden sm:inline">Mark read</span>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

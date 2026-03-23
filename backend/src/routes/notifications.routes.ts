import { Router, Response } from 'express';
import { getUserNotifications, markAsRead, getUnreadCount } from '../services/notification.service';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { getTable } from '../services/supabase';

const router = Router();

// GET /api/notifications — Get notifications for current user (or all role users in explore mode)
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const explore = req.query.explore === 'true';
    if (explore) {
      // In explore mode, get notifications for all users with the same role
      const users = getTable<Record<string, unknown>>('users').filter((u) => u.role === req.userRole);
      const userIds = users.map((u) => u.id as string);
      const allNotifs = getTable<Record<string, unknown>>('notifications')
        .filter((n) => userIds.includes(n.user_id as string))
        .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());
      const unread = allNotifs.filter((n) => !n.is_read).length;
      res.json({ success: true, data: { notifications: allNotifs, unreadCount: unread } });
    } else {
      const notifications = await getUserNotifications(req.userId!);
      const unreadCount = await getUnreadCount(req.userId!);
      res.json({ success: true, data: { notifications, unreadCount } });
    }
  } catch (err) { next(err); }
});

// PATCH /api/notifications/:id/read — Mark notification as read
router.patch('/:id/read', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await markAsRead(req.params.id, req.userId!);
    res.json({ success: true, data: { message: 'Notification marked as read' } });
  } catch (err) { next(err); }
});

export default router;

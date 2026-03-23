import { Request, Response, NextFunction } from 'express';
import { getTokenStore, getTable } from '../services/store';
import type { UserRole } from '../types/enums';

/**
 * Extend Express Request with authenticated user info.
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: UserRole;
  userEmail?: string;
}

/**
 * Middleware: verify Bearer token from Authorization header.
 * Looks up token in the in-memory token store, then fetches user role.
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'AUTH_MISSING_TOKEN', message: 'Authorization token required', requestId: req.headers['x-request-id'] || '' },
    });
    return;
  }

  const token = authHeader.slice(7);
  const tokens = getTokenStore();
  const userId = tokens.get(token);

  if (!userId) {
    res.status(401).json({
      success: false,
      error: { code: 'AUTH_INVALID_TOKEN', message: 'Invalid or expired token', requestId: req.headers['x-request-id'] || '' },
    });
    return;
  }

  // Fetch user role from users table
  const users = getTable<Record<string, unknown>>('users');
  const profile = users.find(u => u.id === userId);

  if (!profile) {
    res.status(401).json({
      success: false,
      error: { code: 'AUTH_PROFILE_NOT_FOUND', message: 'User profile not found', requestId: req.headers['x-request-id'] || '' },
    });
    return;
  }

  req.userId = userId;
  req.userRole = profile.role as UserRole;
  req.userEmail = profile.email as string;
  next();
}


/**
 * Middleware factory: require specific role(s).
 */
export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({
        success: false,
        error: { code: 'AUTH_FORBIDDEN', message: `Requires role: ${roles.join(' or ')}`, requestId: req.headers['x-request-id'] || '' },
      });
      return;
    }
    next();
  };
}

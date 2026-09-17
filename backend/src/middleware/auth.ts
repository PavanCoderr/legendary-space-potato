import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { getUserById } from '../db/users';

/**
 * Middleware that enforces authentication.
 *
 * Uses JWT tokens issued by the signup/login endpoints.
 * The token is sent as `Authorization: Bearer <token>`.
 * Sets `req.user` on success, or leaves it null.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    next();
    return;
  }

  // Attach user to request via a type-safe approach
  (req as any).user = { id: payload.userId, email: payload.email };
  next();
}

/**
 * Middleware that requires authentication (returns 401 if not authenticated).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

/**
 * Helper to extract the authenticated user from a request.
 * Returns undefined if not authenticated.
 */
export function getUser(req: Request): { id: string; email: string } | undefined {
  return (req as any).user;
}

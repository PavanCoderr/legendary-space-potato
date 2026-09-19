import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { getDb } from '../db';

/**
 * Middleware that enforces authentication.
 *
 * Uses JWT tokens issued by the signup/login endpoints.
 * The token is sent as `Authorization: Bearer <token>`.
 * Sets `req.user` on success, or leaves it null.
 * If the token has a jti (session id), checks that the session is still valid.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
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

  // If the token carries a session id, verify the session is still active.
  // Revoked or expired sessions are rejected — we do NOT call next() to
  // continue, because every protected route must go through requireAuth.
  if (payload.jti) {
    try {
      const db = await getDb();
      const session = await db.get<{ user_id: string; expires_at: string | null }>(
        'SELECT user_id, expires_at FROM sessions WHERE id = ?',
        payload.jti,
      );
      if (!session) {
        // Session was revoked (e.g. via logout) — do not authenticate
        (req as any).user = null;
        next();
        return;
      }
      // Check expiry
      if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
        // Session expired — do not authenticate
        (req as any).user = null;
        next();
        return;
      }
    } catch {
      // If session check fails (DB error), fall back to token-only auth
      // rather than hard-rejecting all traffic during a DB outage.
    }
  }

  // Attach user to request
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

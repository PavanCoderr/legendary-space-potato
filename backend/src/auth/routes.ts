import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { findUserByEmail, createUser } from '../db/users';
import { signToken, verifyToken, JwtPayload } from '../utils/jwt';
import { authenticate, requireAuth, getUser } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const bcryptRounds = 10;

export function registerAuthRoutes(router: Router): void {
  router.post('/signup', async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, bcryptRounds);

    // Create user
    const user = await createUser({
      email,
      password_hash: passwordHash,
      name: name ?? undefined,
    });

    // Create session
    const jti = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const db = await getDb();
    await db.run(
      'INSERT INTO sessions (id, user_id, email, expires_at) VALUES (?, ?, ?, ?)',
      jti,
      user.id,
      user.email,
      expiresAt,
    );

    // Issue JWT token with jti
    const token = signToken({ userId: user.id, email: user.email, jti });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        level: user.level,
      },
      token,
    });
  });

  router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Create session
    const jti = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const db = await getDb();
    await db.run(
      'INSERT INTO sessions (id, user_id, email, expires_at) VALUES (?, ?, ?, ?)',
      jti,
      user.id,
      user.email,
      expiresAt,
    );

    // Issue JWT token with jti
    const token = signToken({ userId: user.id, email: user.email, jti });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        level: user.level,
      },
      token,
    });
  });

  router.get('/session', authenticate, async (req: Request, res: Response) => {
    const user = getUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const dbUser = await findUserByEmail(user.email);
    if (!dbUser) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        level: dbUser.level,
      },
    });
  });

  // Logout — deletes only the current session, leaving other devices' tokens valid.
  router.post('/logout', authenticate, requireAuth, async (req: Request, res: Response) => {
    const user = getUser(req);
    if (user) {
      const authHeader = req.headers.authorization;
      const token = authHeader?.substring(7) ?? '';
      const payload = verifyToken(token) as JwtPayload | null;
      if (payload?.jti) {
        const db = await getDb();
        await db.run('DELETE FROM sessions WHERE id = ?', payload.jti);
      }
    }
    res.json({ success: true });
  });
}

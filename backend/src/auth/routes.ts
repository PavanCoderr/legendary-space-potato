import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { findUserByEmail, createUser } from '../db/users';
import { signToken } from '../utils/jwt';
import { authenticate, requireAuth, getUser } from '../middleware/auth';

const bcryptRounds = 10;

export function registerAuthRoutes(router: Router): void {
  router.post('/signup', async (_req: Request, res: Response) => {
    const { email, password, name } = _req.body;

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
      res.status(409).json({ error: 'User already exists' });
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

    // Issue JWT token
    const token = signToken({ userId: user.id, email: user.email });

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

  router.post('/login', async (_req: Request, res: Response) => {
    const { email, password } = _req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Issue JWT token
    const token = signToken({ userId: user.id, email: user.email });

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

  // Logout — with stateless JWT auth, the client simply discards the token.
  // The sessions table is cleaned up here for completeness if a session exists.
  router.post('/logout', authenticate, requireAuth, async (req: Request, res: Response) => {
    const user = getUser(req);
    if (user) {
      const db = await getDb();
      await db.run(`DELETE FROM sessions WHERE email = ?`, user.email);
    }
    res.json({ success: true });
  });
}

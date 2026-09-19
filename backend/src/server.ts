import cors from 'cors';
import express from 'express';
import { json } from 'body-parser';
import { registerRoutes } from './routes';
import { initializeDatabase } from './db';
import { seedDatabase } from './db/seed';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(json({ limit: '1mb' }));

// Trust proxy for rate limiting behind Render's proxy (free tier)
// Without this, all users share one IP and the 10/15min auth limiter becomes a global lockout
app.set('trust proxy', 1);

// Routes
registerRoutes(app);

// Initialize database and seed content (skip during tests)
if (process.env.NODE_ENV !== 'test') {
  async function startup(): Promise<void> {
    await initializeDatabase();
    await seedDatabase();
  }
  startup().catch(err => {
    console.error('[server] Startup error:', err);
    process.exit(1);
  });

  app.listen(PORT, () => {
    console.log(`QubitVerse backend listening on port ${PORT}`);
  });
}

// Validate required environment at startup
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) {
    console.error('[server] FATAL: JWT_SECRET must be set in production');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.error('[server] FATAL: DATABASE_URL or POSTGRES_URL must be set in production');
    process.exit(1);
  }
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'qubitverse-backend' });
});

// Debug endpoints — gated behind non-production to avoid leaking config
if (process.env.NODE_ENV !== 'production') {
  // Debug endpoint to inspect CORS configuration
  app.get('/api/debug/cors', (_req, res) => {
    res.json({
      CORS_ORIGIN: process.env.CORS_ORIGIN || null,
      NODE_ENV: process.env.NODE_ENV || 'not set',
      PORT: process.env.PORT || 'not set',
      allEnvKeys: Object.keys(process.env).filter(k =>
        k.includes('CORS') || k.includes('ORIGIN') || k.includes('VERCEL')
      ).sort(),
    });
  });

  // Debug endpoint to inspect JWT configuration
  app.get('/api/debug/jwt', (_req, res) => {
    res.json({
      JWT_SECRET_SET: !!process.env.JWT_SECRET,
      JWT_SECRET_LENGTH: process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0,
      NODE_ENV: process.env.NODE_ENV || 'not set',
    });
  });
}

// 404 handler
app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Backend error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

export { app };
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
app.use(json({ limit: '10mb' }));

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
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[server] FATAL: JWT_SECRET must be set in production');
  process.exit(1);
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'qubitverse-backend' });
});

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

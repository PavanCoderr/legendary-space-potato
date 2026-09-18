import { Router, type Request, type Response } from 'express';
import { GLOSSARY } from '../data/glossary';

/**
 * Register glossary-related routes.
 *
 * Routes:
 * - GET /api/glossary — list all glossary entries
 * - GET /api/glossary/:term — fetch a single entry by term or alias (case-insensitive)
 */
export function registerGlossaryRoutes(): Router {
  const router = Router();

  // List all glossary entries (public — same data as frontend)
  router.get('/', (_req: Request, res: Response) => {
    res.json({ glossary: GLOSSARY });
  });

  // Get a single glossary entry by term or alias (case-insensitive)
  router.get('/:term', (req: Request, res: Response) => {
    const term = req.params.term as string;
    const lowerTerm = term.toLowerCase();

    const entry = GLOSSARY.find(
      (g) =>
        g.term.toLowerCase() === lowerTerm ||
        g.aliases.some((a) => a.toLowerCase() === lowerTerm)
    );

    if (!entry) {
      res.status(404).json({ error: 'Glossary entry not found' });
      return;
    }

    res.json({ entry });
  });

  return router;
}

import { Router, type Request, type Response } from 'express';
import { getDb } from '../db';
import { getUser } from '../middleware/auth';
import { deserializeCircuit } from '../quantum/circuit';
import { simulate, createSeededRandom } from '../quantum/simulator';
import { CHALLENGES } from '../data/challenges';
import { awardXp } from '../rewards';
import { v4 as uuidv4 } from 'uuid';
import { capShots } from '../utils/shots';

/**
 * Strip implementation details (`solutionCode`) from a challenge payload
 * before sending it to the client. The `validate` field is a function and
 * vanishes from JSON on its own; only `solutionCode` needs explicit removal.
 */
function stripSolutionCode(challenge: typeof CHALLENGES[number]): Omit<typeof CHALLENGES[number], 'solutionCode'> {
  const { solutionCode, ...rest } = challenge as unknown as { solutionCode: unknown; [k: string]: unknown };
  void solutionCode; // explicitly discard — never expose solution code to clients
  return rest as Omit<typeof CHALLENGES[number], 'solutionCode'>;
}

/**
 * Register challenge-related routes.
 *
 * Routes:
 * - GET  /api/challenges — list all challenges (public)
 * - GET  /api/challenges/:id — fetch a single challenge (public)
 * - POST /api/challenges/:id/submit — submit a circuit for server-side evaluation (auth required)
 *
 * The submit endpoint re-runs the real quantum simulator and validator on the
 * server, so pass/fail can never be spoofed by a client-supplied `passed` flag.
 */
export function registerChallengeRoutes(): Router {
  const router = Router();

  // List all challenges (public — mirrors the frontend's seed data)
  // solutionCode is stripped from public payloads (CG2).
  router.get('/', (_req: Request, res: Response) => {
    res.json({ challenges: CHALLENGES.map(stripSolutionCode) });
  });

  // Get a single challenge (public)
  // solutionCode is stripped from public payloads (CG2).
  router.get('/:id', (req: Request, res: Response) => {
    const challenge = CHALLENGES.find(c => c.id === req.params.id);
    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }
    res.json({ challenge: stripSolutionCode(challenge) });
  });

  // Submit a circuit for challenge evaluation (auth required)
  router.post('/:id/submit', async (req: Request, res: Response) => {
    const { id: challengeId } = req.params;
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { circuit, shots: reqShots, seed } = req.body;
    const db = await getDb();

    // Look up the challenge from the seeded definition (single source of truth)
    const challenge = CHALLENGES.find(c => c.id === challengeId);
    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    if (!circuit) {
      res.status(400).json({ error: 'Circuit is required' });
      return;
    }

    try {
      // Deserialize and validate the submitted circuit.
      // deserializeCircuit returns issues as plain strings, so we treat any
      // returned issue text as an error (the function already skips invalid ops).
      const { circuit: qc, issues } = deserializeCircuit(circuit, `Challenge ${challengeId}`);
      if (issues.length > 0) {
        res.status(400).json({
          success: false,
          error: `Invalid circuit: ${issues.join(', ')}`,
        });
        return;
      }

      // Cap shots to prevent CPU-bound requests (CG1)
      const cappedShots = capShots(reqShots ?? challenge.shots);

      // Run the real quantum simulation server-side
      const options: { shots: number; random?: () => number } = {
        shots: cappedShots,
      };
      if (typeof seed === 'number' && !isNaN(seed)) {
        options.random = createSeededRandom(seed);
      }

      const simulation = simulate(qc, options);

      // Evaluate checks server-side — never trust a client-supplied `passed` flag
      const checks = challenge.validate({ circuit: qc, simulation });
      const allPassed = checks.every(c => c.passed);

      const now = new Date().toISOString();

      // Award XP on pass first (idempotent — xp_ledger UNIQUE constraint prevents double-awards).
      // The real xp_awarded is written to challenge_attempts below so it accurately
      // reflects the awarded amount (0 on fail, 0 on idempotent re-pass).
      let xpAwarded = 0;
      if (allPassed) {
        const xpResult = await awardXp(user.id, {
          amount: challenge.xp,
          reason: `Challenge passed: ${challenge.title}`,
          sourceType: 'challenge_passed',
          sourceId: challengeId as string,
        });
        xpAwarded = xpResult.awarded ? challenge.xp : 0;
      }

      // Record the attempt with the real xp_awarded value (CG2)
      await db.run(
        `INSERT INTO challenge_attempts
         (id, user_id, challenge_id, passed, checks, xp_awarded, attempted_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        uuidv4(),
        user.id,
        challengeId,
        allPassed ? 1 : 0,
        JSON.stringify(checks.map(c => ({ label: c.label, passed: c.passed, detail: c.detail }))),
        xpAwarded,
        now,
        now,
      );

      res.json({
        success: true,
        passed: allPassed,
        checks: checks.map(c => ({ id: c.id, label: c.label, passed: c.passed, detail: c.detail })),
        xpAwarded,
      });
    } catch (error) {
      console.error('Challenge submission error:', error);
      const message = error instanceof Error ? error.message : 'Challenge evaluation failed';
      res.status(400).json({
        success: false,
        error: message,
      });
    }
  });

  return router;
}

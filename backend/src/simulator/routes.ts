import { Router, type Request, type Response } from 'express';
import { getDb } from '../db';
import { getUser } from '../middleware/auth';
import {
  deserializeCircuit,
  serializeCircuit,
} from '../quantum/circuit';
import {
  simulate,
  createSeededRandom,
} from '../quantum/simulator';
import type { SimulationResult } from '../quantum/simulator';
import { capShots } from '../utils/shots';

/**
 * Register simulator routes.
 *
 * Route:
 * - POST /simulate — run a quantum circuit simulation
 *
 * Uses the existing frontend quantum simulator for mathematically correct results.
 */
export function registerSimulateRoutes(): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    const { circuit, shots = 1024, seed } = req.body;
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!circuit) {
      res.status(400).json({ error: 'Circuit is required' });
      return;
    }

    try {
      // Deserialize the circuit JSON into the internal representation
      const { circuit: qc, issues } = deserializeCircuit(circuit, 'User Circuit');

      // If deserialization produced issues, return them as an error
      if (issues.length > 0) {
        res.status(400).json({
          success: false,
          error: `Invalid circuit: ${issues.join(' ')}`,
        });
        return;
      }

      // Cap shots to prevent CPU-bound requests (CG1)
      const cappedShots = capShots(shots);

      // Build simulation options
      const options: { shots: number; random?: () => number } = { shots: cappedShots };

      // If a seed is provided, use a seeded PRNG for reproducible results
      if (typeof seed === 'number' && !isNaN(seed)) {
        options.random = createSeededRandom(seed);
      }

      // Run the real simulation
      const result = simulate(qc, options);

      // Track simulation in user activities
      const db = await getDb();
      await db.run(
        `UPDATE activities
         SET simulations = simulations + 1,
             total_shots = total_shots + ?,
             last_active_at = ?,
             updated_at = ?
         WHERE user_id = ?`,
        cappedShots,
        new Date().toISOString(),
        new Date().toISOString(),
        user.id
      );

      // Return the simulation result directly (flattened) to match the frontend's
      // SimulationResult contract, so the HTTP API integrates seamlessly.
      res.json(formatSimulationResult(result));
    } catch (error) {
      console.error('Simulation error:', error);

      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({
        success: false,
        error: message.includes('Cannot simulate')
          ? message
          : 'Simulation failed',
      });
    }
  });

  return router;
}

function formatSimulationResult(result: SimulationResult) {
  return {
    circuitId: result.circuitId,
    circuitName: result.circuitName,
    numQubits: result.numQubits,
    shots: result.shots,
    operations: result.operations,
    unitaryCount: result.unitaryCount,
    hasMeasurementGates: result.hasMeasurementGates,
    // State vector amplitudes
    amplitudes: result.amplitudes,
    probabilities: result.probabilities,
    qubitProbabilities: result.qubitProbabilities,
    // Bloch sphere vectors
    bloch: result.bloch,
    // Measurement results
    measurement: result.measurement,
    warnings: result.warnings,
    elapsedMs: result.elapsedMs,
  };
}

import { Router, type Request, type Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getUser } from '../middleware/auth';
import { deserializeCircuit, validateCircuit } from '../quantum/circuit';
import { simulate, createSeededRandom } from '../quantum/simulator';
import { capShots } from '../utils/shots';

export interface Circuit {
  id: string;
  name: string;
  description?: string;
  gates: Gate[];
  qubits: number;
  created_at: string;
  updated_at: string;
}

export interface Gate {
  id: string;
  type: string;
  target: number | number[];
  control?: number;
  angle?: number;
  duration: number;
  probability: number;
}

export interface CircuitSimulationResult {
  success: boolean;
  final_state: string[];
  measurements: Record<string, number>;
  shots_used: number;
  error?: string;
}

/**
 * Register circuit-related routes on the given router.
 *
 * These cover:
 * - /circuits/:id/simulate — simulate a circuit
 * - /state/circuits/:id — fetch a saved circuit (state endpoint)
 * - /state/circuits/:id/save — save circuit progress
 */
export function registerCircuitRoutes(): Router {
  const router = Router();

  // Simulate a circuit
  router.post('/:id/simulate', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { shots = 1024, seed } = req.body;
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const db = await getDb();
      // Look up circuit
      const circuit = await db.get(
        'SELECT circuit FROM projects WHERE id = ? AND user_id = ?',
        id,
        user.id
      );

      let circuitData: string | null = null;

      if (circuit) {
        circuitData = circuit.circuit;
      } else {
        // Fallback to lesson-based circuits if not a saved project
        const lessonCircuit = await db.get(
          'SELECT circuit FROM lesson_circuits WHERE id = ?',
          id
        );

        if (!lessonCircuit) {
          res.status(404).json({ error: 'Circuit not found' });
          return;
        }
        circuitData = lessonCircuit.circuit;
      }

      if (!circuitData) {
        res.status(404).json({ error: 'Circuit not found' });
        return;
      }

      // Deserialize and validate the circuit
      let parsedCircuit;
      try {
        const circuitJson = JSON.parse(circuitData);
        const { circuit: qc, issues } = deserializeCircuit(circuitJson, `Circuit ${id}`);

        if (issues.length > 0) {
          res.status(400).json({
            success: false,
            error: `Invalid circuit: ${issues.join(' ')}`,
          });
          return;
        }

        parsedCircuit = qc;
      } catch (parseError) {
        res.status(400).json({
          success: false,
          error: `Invalid circuit JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        });
        return;
      }

      // Cap shots to prevent CPU-bound requests (CG1)
      const cappedShots = capShots(shots);

      // Build simulation options
      const options: { shots: number; random?: () => number } = {
        shots: cappedShots,
      };

      // If a seed is provided, use a seeded PRNG for reproducible results
      if (typeof seed === 'number' && !isNaN(seed)) {
        options.random = createSeededRandom(seed);
      }

      // Run the real simulation
      try {
        const simResult = simulate(parsedCircuit, options);

        // Format result to match the CircuitSimulationResult contract
        const measurementBuckets = simResult.measurement.buckets;
        const measurements: Record<string, number> = {};
        for (const bucket of measurementBuckets) {
          measurements[bucket.label.replace(/[|⟩]/g, '')] = bucket.count;
        }

        const result: CircuitSimulationResult = {
          success: true,
          final_state: simResult.amplitudes
            .filter(a => a.probability > 0)
            .map(a => a.label),
          measurements,
          shots_used: cappedShots,
        };

        res.json(result);
      } catch (simError) {
        const message = simError instanceof Error ? simError.message : 'Simulation failed';
        res.status(400).json({
          success: false,
          error: message,
        });
      }
    } catch (error) {
      console.error('Circuit simulation error:', error);
      res.status(500).json({
        success: false,
        error: 'Simulation failed',
      });
    }
  });

  // Save a circuit as a project
  router.post('/save', async (req: Request, res: Response) => {
    const { name, description, circuit, code, lesson_id, tags } = req.body;
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!name || !circuit) {
      res.status(400).json({ error: 'Name and circuit are required' });
      return;
    }

    try {
      // Validate the circuit JSON before persisting — reject unknown gates,
      // out-of-range qubits, oversized payloads (C2).
      const { circuit: qc, issues: deserializeIssues } = deserializeCircuit(circuit, 'Saved Circuit');
      if (deserializeIssues.length > 0) {
        res.status(400).json({
          success: false,
          error: `Invalid circuit: ${deserializeIssues.join('; ')}`,
        });
        return;
      }

      // Validate structural issues that deserialization alone doesn't catch:
      // e.g., two gates acting on the same qubit in the same time step (C2 residual).
      const validationIssues = validateCircuit(qc);
      if (validationIssues.length > 0) {
        const errorMessages = validationIssues
          .filter((issue) => issue.severity === 'error')
          .map((issue) => issue.message);
        if (errorMessages.length > 0) {
          res.status(400).json({
            success: false,
            error: `Invalid circuit: ${errorMessages.join('; ')}`,
          });
          return;
        }
      }

      const db = await getDb();
      const now = new Date().toISOString();

      await db.run(
        `INSERT INTO projects (id, user_id, name, description, circuit, code, lesson_id, status, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        uuidv4(),
        user.id,
        name,
        description ?? null,
        JSON.stringify(circuit),
        code ?? null,
        lesson_id ?? null,
        'draft',
        JSON.stringify(tags ?? []),
        now,
        now
      );

      res.status(201).json({ success: true });
    } catch (error) {
      console.error('Save circuit error:', error);
      res.status(500).json({ error: 'Failed to save circuit' });
    }
  });

  return router;
}

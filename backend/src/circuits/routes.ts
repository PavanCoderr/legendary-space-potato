import { Router, type Request, type Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getUser } from '../middleware/auth';

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
    const { shots = 1024, initial_state } = req.body;
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

      if (!circuit) {
        // Fallback to lesson-based circuits if not a saved project
        const lessonCircuit = await db.get(
          'SELECT circuit FROM lesson_circuits WHERE lesson_id = ? AND id = ?',
          id,
          id
        );

        if (!lessonCircuit) {
          res.status(404).json({ error: 'Circuit not found' });
          return;
        }
      }

      // TODO: Integrate with actual quantum simulator (qiskit-stubs or simulator module)
      // For now, return a placeholder result
      const result: CircuitSimulationResult = {
        success: true,
        final_state: ['|00⟩', '|01⟩', '|10⟩', '|11⟩'],
        measurements: { '00': 256, '01': 256, '10': 256, '11': 256 },
        shots_used: shots,
      };

      res.json(result);
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

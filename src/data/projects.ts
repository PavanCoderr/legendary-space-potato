import { circuitToCode, deserializeCircuit, type SerializedCircuit } from '../quantum';
import {
  bellCircuit,
  groverCircuit,
  superpositionCircuit,
  teleportationPrepCircuit,
} from './presets';
import type { Project } from './types';

function makeProject(
  id: string,
  name: string,
  description: string,
  tags: string[],
  circuit: SerializedCircuit,
  lessonId: string | null,
  status: Project['status'],
  created: string,
  updated: string,
): Project {
  const { circuit: parsed } = deserializeCircuit(circuit, name);
  return {
    id,
    name,
    description,
    circuit,
    code: circuitToCode(parsed),
    lessonId,
    status,
    tags,
    createdAt: created,
    updatedAt: updated,
  };
}

/** Starter projects so the Projects area is useful from the first visit. */
export const SAMPLE_PROJECTS: Project[] = [
  makeProject(
    'project-bell',
    'Bell State',
    'The canonical entanglement generator: Hadamard on q0 followed by a CNOT. Used as the reference circuit for the Entanglement lesson.',
    ['entanglement', 'bell', 'reference'],
    bellCircuit(),
    'entanglement',
    'completed',
    '2026-08-02T09:15:00.000Z',
    '2026-08-14T17:40:00.000Z',
  ),
  makeProject(
    'project-superposition',
    'Superposition Experiment',
    'A single-qubit playground for phases: H, S and T on the equator, measured with 4096 shots to compare the counts with the ideal probabilities.',
    ['superposition', 'single-qubit'],
    superpositionCircuit(),
    'superposition',
    'in-progress',
    '2026-08-05T11:02:00.000Z',
    '2026-08-12T08:20:00.000Z',
  ),
  makeProject(
    'project-teleportation',
    'Quantum Teleportation',
    'Preparation half of the teleportation protocol: a Bell pair shared by q1 and q2, with the message qubit encoded on q0. The classical feed-forward X/Z correction is not part of this circuit because QubitVerse\'s simulator does not yet execute classically-conditioned gates.',
    ['teleportation', 'protocol', '3-qubit'],
    teleportationPrepCircuit(),
    'entanglement',
    'in-progress',
    '2026-08-08T14:30:00.000Z',
    '2026-08-11T19:05:00.000Z',
  ),
  makeProject(
    'project-grover',
    'Grover Search',
    'Two-qubit Grover search for the marked state |11⟩, including the phase oracle and the diffusion operator, with a measurement at the end.',
    ['algorithms', 'grover', 'search'],
    groverCircuit(),
    'algorithms',
    'completed',
    '2026-08-10T08:45:00.000Z',
    '2026-08-15T10:10:00.000Z',
  ),
];

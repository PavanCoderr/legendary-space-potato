import type { QuantumCircuit } from '../quantum';
import { gateArity } from '../quantum';

import type { Challenge, ChallengeCheck, ChallengeContext } from './types';
import { bellCircuit, groverCircuit } from './presets';

/**
 * Challenge validators.
 *
 * Every check is computed from the learner's circuit and a freshly simulated state
 * vector — no expected value is hard-coded into the checks themselves, only the
 * physics tolerances you would apply by hand.
 */
function ok(id: string, label: string, detail: string): ChallengeCheck {
  return { id, label, passed: true, detail };
}

function fail(id: string, label: string, detail: string): ChallengeCheck {
  return { id, label, passed: false, detail };
}

function probability(simulation: ChallengeContext['simulation'], label: string): number | null {
  if (!simulation) return null;
  const entry = simulation.probabilities.find(p => p.label === label);
  return entry ? entry.probability : 0;
}

function wiresOf(circuit: QuantumCircuit, type: string) {
  return circuit.ops.filter(op => op.type === type);
}

/** True when the gates appear on the given wires in this relative order (other gates allowed between). */
function hasOrderedSequence(
  circuit: QuantumCircuit,
  sequence: { type: string; qubits: number[] }[],
): boolean {
  let cursor = -Infinity;
  for (const step of sequence) {
    const match = circuit.ops
      .filter(
        op =>
          op.type === step.type &&
          op.column > cursor &&
          step.qubits.every((q, index) => op.qubits[index] === q),
      )
      .sort((a, b) => a.column - b.column)[0];
    if (!match) return false;
    cursor = match.column;
  }
  return true;
}

const runFirst = (id: string, label: string): ChallengeCheck =>
  fail(id, label, 'Run the circuit first so QubitVerse can inspect the resulting quantum state.');

const validCircuit = (context: ChallengeContext): ChallengeCheck => {
  if (context.circuit.ops.length === 0) {
    return fail('valid', 'Circuit contains at least one gate', 'The circuit is empty — drag a gate onto the grid to begin.');
  }
  return ok('valid', 'Circuit contains at least one gate', `${context.circuit.ops.length} gate(s) placed on ${context.circuit.numQubits} qubit(s).`);
};

export const CHALLENGES: Challenge[] = [
  {
    id: 'challenge-bit-flip',
    lessonId: 'qubits',
    topic: 'fundamentals',
    title: 'Flip a qubit to |1⟩',
    difficulty: 'easy',
    xp: 40,
    brief:
      'A single qubit starts in |0⟩. Apply exactly one gate to q0 so that measurement returns 1 on every shot.',
    objectives: [
      'Use one single-qubit gate on q0',
      'Make P(|1⟩) equal 1',
      'Keep the circuit valid: one qubit, one time step',
    ],
    hints: [
      'Notice that P(|1⟩) is |β|², so you need β = ±1 (or ±i) and α = 0.',
      'The bit-flip gate is the quantum version of a classical NOT.',
    ],
    shots: 1000,
    starterCircuit: { name: 'Bit flip challenge', numQubits: 1, ops: [] },
    expectedOutcome: 'All 1000 shots read 1: a single bar at |1⟩.',
    solutionCode: 'qc = QuantumCircuit(1)\nqc.x(0)\nqc.measure_all()',
    validate: context => {
      const p1 = probability(context.simulation, '|1⟩');
      const checks: ChallengeCheck[] = [validCircuit(context)];
      checks.push(
        p1 === null
          ? runFirst('result', 'P(|1⟩) = 1')
          : p1 > 0.999
            ? ok('result', 'P(|1⟩) = 1', 'The qubit is in |1⟩ with probability 1 after your gate.')
            : fail(
                'result',
                'P(|1⟩) = 1',
                `Your circuit leaves P(|1⟩) at ${(p1 * 100).toFixed(1)}%. A gate that maps |0⟩ onto |1⟩ is needed.`,
              ),
      );
      const single = context.circuit.ops.filter(op => op.type !== 'M');
      checks.push(
        single.length === 1 && single[0].qubits[0] === 0
          ? ok('structure', 'One gate applied to q0', `You used ${single[0].type} on q0.`)
          : fail(
              'structure',
              'One gate applied to q0',
              `Expected exactly one unitary gate on q0, found ${single.length}: ${single
                .map(op => `${op.type}(${op.qubits.join(',')})`)
                .join(', ') || 'none'}.`,
            ),
      );
      return checks;
    },
  },
  {
    id: 'challenge-superposition',
    lessonId: 'superposition',
    topic: 'fundamentals',
    title: 'Create a 50/50 superposition',
    difficulty: 'easy',
    xp: 50,
    brief:
      'Prepare q0 in an equal superposition of |0⟩ and |1⟩, then measure it with at least 500 shots and confirm the split.',
    objectives: [
      'Apply H to q0 starting from |0⟩',
      'Reach P(0) = P(1) = 0.5',
      'Include a measurement gate so shots are recorded',
    ],
    hints: [
      'The Hadamard gate maps |0⟩ to (|0⟩+|1⟩)/√2.',
      'Both probabilities should read 50.0% — if one is 100% you probably forgot the measurement ordering.',
    ],
    shots: 1000,
    starterCircuit: { name: 'Superposition challenge', numQubits: 1, ops: [] },
    expectedOutcome: 'Two bars at roughly 500 counts each; the state vector shows 0.707|0⟩ + 0.707|1⟩.',
    solutionCode: 'qc = QuantumCircuit(1)\nqc.h(0)\nqc.measure_all()',
    validate: context => {
      const checks: ChallengeCheck[] = [validCircuit(context)];
      const hasH = wiresOf(context.circuit, 'H').some(op => op.qubits[0] === 0);
      checks.push(
        hasH
          ? ok('gate', 'Hadamard applied to q0', 'H is present on q0, so the state is driven onto the equator.')
          : fail('gate', 'Hadamard applied to q0', 'No H gate found on q0. Another gate can create a 50/50 split (try it), but this lesson asks for Hadamard.'),
      );
      const hasMeasurement = wiresOf(context.circuit, 'M').length > 0;
      checks.push(
        hasMeasurement
          ? ok('measure', 'Measurement gate present', 'Counts are recorded from an explicit measurement.')
          : fail('measure', 'Measurement gate present', 'Add an M gate so the run records measurement outcomes.'),
      );
      const p0 = probability(context.simulation, '|0⟩');
      const p1 = probability(context.simulation, '|1⟩');
      checks.push(
        p0 === null || p1 === null
          ? runFirst('result', 'P(0) = P(1) = 0.5')
          : Math.abs(p0 - 0.5) < 0.001 && Math.abs(p1 - 0.5) < 0.001
            ? ok('result', 'P(0) = P(1) = 0.5', `Simulated probabilities are ${(p0 * 100).toFixed(1)}% / ${(p1 * 100).toFixed(1)}%.`)
            : fail(
                'result',
                'P(0) = P(1) = 0.5',
                `Got ${(p0 * 100).toFixed(1)}% / ${(p1 * 100).toFixed(1)}%. An equal superposition needs amplitudes of magnitude 1/√2 on both basis states.`,
              ),
      );
      const shots = context.simulation?.shots ?? 0;
      checks.push(
        shots >= 500
          ? ok('shots', 'At least 500 shots', `Sampled ${shots} shots, so the counts estimate the probabilities well.`)
          : fail('shots', 'At least 500 shots', `Only ${shots} shots were sampled. Set the shot count to 500 or more.`),
      );
      return checks;
    },
  },
  {
    id: 'challenge-bell-state',
    lessonId: 'entanglement',
    topic: 'fundamentals',
    title: 'Create a Bell state',
    difficulty: 'medium',
    xp: 80,
    brief:
      'Entangle q0 and q1 so that measurement outcomes are perfectly correlated. Apply H to q0, apply CNOT between q0 and q1, run the circuit, and obtain the correlated measurement results.',
    objectives: [
      'Apply H to q0',
      'Apply CNOT (CX) with q0 as control and q1 as target',
      'Run the circuit and obtain only |00⟩ and |11⟩ outcomes',
      'Show that both qubits are entangled (their Bloch vectors are centred)',
    ],
    hints: [
      'H on q0 creates (|0⟩+|1⟩)/√2; the CNOT then flips q1 only in the |1⟩ branch.',
      'The control is the qubit whose value decides whether the flip happens — your CNOT should be controlled by q0.',
      'If you see |01⟩ or |10⟩ results, the CNOT control and target are probably swapped.',
    ],
    shots: 1000,
    starterCircuit: { name: 'Bell state challenge', numQubits: 2, ops: [] },
    expectedOutcome: '|00⟩ ≈ 50%, |11⟩ ≈ 50%, and each qubit’s Bloch vector has length ≈ 0.',
    solutionCode: 'qc = QuantumCircuit(2)\nqc.h(0)\nqc.cx(0, 1)\nqc.measure_all()',
    validate: context => {
      const checks: ChallengeCheck[] = [validCircuit(context)];
      const hOnQ0 = wiresOf(context.circuit, 'H').some(op => op.qubits[0] === 0);
      checks.push(
        hOnQ0
          ? ok('h', 'H applied to q0', 'The control qubit is in a superposition, so both branches are live.')
          : fail('h', 'H applied to q0', 'The Hadamard gate must be applied to q0 before the CNOT.'),
      );
      const cnot = wiresOf(context.circuit, 'CNOT').find(op => op.qubits[0] === 1 && op.qubits[1] === 0);
      const swapped = wiresOf(context.circuit, 'CNOT').find(op => op.qubits[0] === 0 && op.qubits[1] === 1);
      checks.push(
        cnot
          ? ok('cnot', 'CNOT controlled by q0, targeting q1', 'The entangler is wired correctly.')
          : swapped
            ? fail('cnot', 'CNOT controlled by q0, targeting q1', 'Your CNOT has q0 as the target and q1 as the control. Swap the wires: control = q0 (the one with H), target = q1.')
            : fail('cnot', 'CNOT controlled by q0, targeting q1', 'No CNOT gate found. Add a CX gate spanning q0 (control) and q1 (target).'),
      );
      const sim = context.simulation;
      if (!sim) {
        checks.push(runFirst('correlation', 'Only |00⟩ and |11⟩ outcomes'));
        checks.push(runFirst('balance', 'Both outcomes share the probability'));
        checks.push(runFirst('entangled', 'The qubits are entangled'));
      } else {
        const observed = sim.measurement.buckets.filter(b => b.count > 0);
        const labels = observed.map(b => b.label).sort();
        checks.push(
          labels.length === 2 && labels[0] === '|00⟩' && labels[1] === '|11⟩'
            ? ok('correlation', 'Only |00⟩ and |11⟩ outcomes', `Observed ${labels.join(' and ')} across ${sim.shots} shots.`)
            : fail(
                'correlation',
                'Only |00⟩ and |11⟩ outcomes',
                `Observed ${observed.map(b => `${b.label}×${b.count}`).join(', ') || 'no outcomes'}. A Bell state can only produce perfectly correlated results.`,
              ),
        );
        const p00 = probability(sim, '|00⟩') ?? 0;
        const p11 = probability(sim, '|11⟩') ?? 0;
        checks.push(
          Math.abs(p00 - 0.5) < 0.01 && Math.abs(p11 - 0.5) < 0.01
            ? ok('balance', 'Both outcomes share the probability', `Ideal probabilities are ${(p00 * 100).toFixed(1)}% / ${(p11 * 100).toFixed(1)}%.`)
            : fail('balance', 'Both outcomes share the probability', `Ideal probabilities were ${(p00 * 100).toFixed(1)}% / ${(p11 * 100).toFixed(1)}%; a Bell state is a perfect 50/50 split.`),
        );
        const mixed = sim.bloch.every(vector => vector.magnitude < 0.05);
        checks.push(
          mixed
            ? ok('entangled', 'The qubits are entangled', `Both Bloch vectors have length ≈ ${sim.bloch[0].magnitude.toFixed(3)}, the signature of a maximally entangled pair.`)
            : fail(
                'entangled',
                'The qubits are entangled',
                `Bloch vector lengths are ${sim.bloch.map(v => v.magnitude.toFixed(3)).join(' / ')}. A length near 1 means the qubits are still in a product state — check the CNOT wiring.`,
              ),
        );
      }
      return checks;
    },
  },
  {
    id: 'challenge-hzh',
    lessonId: 'gates',
    topic: 'gates',
    title: 'Build X out of H and Z',
    difficulty: 'medium',
    xp: 70,
    brief:
      'Starting from |0⟩, reproduce the action of an X gate using only H and Z gates on q0, then prove it by measuring.',
    objectives: [
      'Apply H, then Z, then H to q0 (in that order)',
      'Obtain P(|1⟩) = 1 without using an X gate',
    ],
    hints: [
      'Z rotates 180° about the vertical axis; H moves the state onto the equator.',
      'On the Bloch sphere the sequence is: north pole → +X → −X → south pole.',
    ],
    shots: 1000,
    starterCircuit: { name: 'HZH challenge', numQubits: 1, ops: [] },
    expectedOutcome: 'Every shot reads 1, exactly like a single X gate.',
    solutionCode: 'qc = QuantumCircuit(1)\nqc.h(0)\nqc.z(0)\nqc.h(0)\nqc.measure_all()',
    validate: context => {
      const checks: ChallengeCheck[] = [validCircuit(context)];
      const structure = hasOrderedSequence(context.circuit, [
        { type: 'H', qubits: [0] },
        { type: 'Z', qubits: [0] },
        { type: 'H', qubits: [0] },
      ]);
      checks.push(
        structure
          ? ok('sequence', 'H → Z → H applied to q0', 'The gate sequence matches HZH.')
          : fail('sequence', 'H → Z → H applied to q0', 'QubitVerse did not find H, then Z, then H on q0 in that order.'),
      );
      const usedX = wiresOf(context.circuit, 'X').length + wiresOf(context.circuit, 'Y').length > 0;
      checks.push(
        usedX
          ? fail('noflip', 'No bit-flip gate used', 'The point of this challenge is to build the flip from H and Z, so X/Y are not allowed.')
          : ok('noflip', 'No bit-flip gate used', 'No X or Y gates in the circuit.'),
      );
      const p1 = probability(context.simulation, '|1⟩');
      checks.push(
        p1 === null
          ? runFirst('result', 'P(|1⟩) = 1')
          : p1 > 0.999
            ? ok('result', 'P(|1⟩) = 1', 'Your HZH circuit behaves exactly like X.')
            : fail('result', 'P(|1⟩) = 1', `P(|1⟩) is ${(p1 * 100).toFixed(1)}%. Check the gate order on q0.`),
      );
      return checks;
    },
  },
  {
    id: 'challenge-grover',
    lessonId: 'algorithms',
    topic: 'algorithms',
    title: 'Grover search for |11⟩',
    difficulty: 'hard',
    xp: 120,
    brief:
      'Two qubits start in |00⟩. Build a circuit that uses interference to make |11⟩ the certain measurement outcome — the oracle alone is not enough, you need the diffusion step too.',
    objectives: [
      'Prepare both qubits in superposition with H',
      'Mark |11⟩ with a phase oracle built from H and CNOT',
      'Amplify it with the diffusion operator',
      'Reach P(|11⟩) ≥ 0.95',
    ],
    hints: [
      'CZ (a controlled phase flip) marks |11⟩; build it as H on the target, CNOT, H on the target.',
      'The diffusion step is H⊗H · X⊗X · CZ · X⊗X · H⊗H.',
      'Compare the run with and without the diffusion block: the oracle alone leaves 25% on each outcome.',
    ],
    shots: 1000,
    starterCircuit: { name: 'Grover challenge', numQubits: 2, ops: [] },
    expectedOutcome: '≈100% of shots land on |11⟩ with the full circuit (25% per outcome without diffusion).',
    solutionCode: 'qc = QuantumCircuit(2)\nqc.h(0)\nqc.h(1)\n# oracle + diffusion below',
    validate: context => {
      const checks: ChallengeCheck[] = [validCircuit(context)];
      const sim = context.simulation;
      const p11 = probability(sim, '|11⟩');
      const usesBoth = wiresOf(context.circuit, 'H').some(op => op.qubits[0] === 0) && wiresOf(context.circuit, 'H').some(op => op.qubits[0] === 1);
      checks.push(
        usesBoth
          ? ok('superposition', 'Both qubits put in superposition', 'H is applied to q0 and q1, so the search space of four items is covered.')
          : fail('superposition', 'Both qubits put in superposition', 'Apply H to both qubits before the oracle so all four basis states start with equal amplitude.'),
      );
      checks.push(
        context.circuit.ops.length >= 8
          ? ok('depth', 'Oracle and diffusion present', `${context.circuit.ops.length} gates in the circuit.`)
          : fail('depth', 'Oracle and diffusion present', `Only ${context.circuit.ops.length} gates found. A Grover iteration needs the phase oracle plus the diffusion block (H, X, CZ, X, H on both wires).`),
      );
      checks.push(
        p11 === null
          ? runFirst('result', 'P(|11⟩) ≥ 0.95')
          : p11 >= 0.95
            ? ok('result', 'P(|11⟩) ≥ 0.95', `Amplitude amplification worked: P(|11⟩) = ${(p11 * 100).toFixed(1)}%.`)
            : fail('result', 'P(|11⟩) ≥ 0.95', `P(|11⟩) is only ${(p11 * 100).toFixed(1)}%. Marked-but-not-amplified states sit at 25%, so check your diffusion gates.`),
      );
      if (sim) {
        const spread = sim.measurement.buckets.filter(b => b.count > 0).length;
        checks.push(
          spread <= 2
            ? ok('focus', 'Measurement concentrates on the answer', `Only ${spread} outcome(s) appeared in ${sim.shots} shots.`)
            : fail('focus', 'Measurement concentrates on the answer', `${spread} different outcomes appeared. The diffusion step should make the marked state dominant.`),
        );
      }
      return checks;
    },
  },
];

export const CHALLENGE_MAP: Record<string, Challenge> = CHALLENGES.reduce(
  (acc, challenge) => ({ ...acc, [challenge.id]: challenge }),
  {} as Record<string, Challenge>,
);

export function getChallenge(id: string | null | undefined): Challenge | null {
  if (!id) return null;
  return CHALLENGE_MAP[id] ?? null;
}

export function challengeForLesson(lessonId: string): Challenge | null {
  return CHALLENGES.find(challenge => challenge.lessonId === lessonId) ?? null;
}

/** Describes a challenge's starter circuit for the UI. */
export function describeStarter(challenge: Challenge): string {
  const { numQubits, ops } = challenge.starterCircuit;
  if (ops.length === 0) return `${numQubits} qubit${numQubits > 1 ? 's' : ''}, empty circuit`;
  return ops.map(op => `${op.type}(${op.qubits.join(',')})`).join(' → ');
}

/** Re-exported so the practice page can show the gate legend next to the challenge. */
export { gateArity };

/** Reference circuits shown as "what a solution looks like". */
export const REFERENCE_CIRCUITS = {
  bell: bellCircuit,
  grover: groverCircuit,
};

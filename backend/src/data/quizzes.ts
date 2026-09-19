import type { Quiz } from './types';

/** One quiz bank per lesson; the lesson page shuffles the order per attempt. */
export const QUIZZES: Quiz[] = [
  {
    id: 'qubits-1',
    lessonId: 'qubits',
    topic: 'fundamentals',
    question: 'A qubit is in the state |ψ⟩ = 0.6|0⟩ + 0.8|1⟩. What does a measurement return, on average?',
    options: [
      'Always 0, because the |0⟩ amplitude is smaller',
      '0 with probability 0.36 and 1 with probability 0.64',
      '0 with probability 0.6 and 1 with probability 0.8',
      'A random value between 0 and 1',
    ],
    correctIndex: 1,
    explanation:
      'The Born rule says the probability is the squared magnitude of the amplitude: |0.6|² = 0.36 and |0.8|² = 0.64, and 0.36 + 0.64 = 1, so the state is properly normalised. Note the amplitudes themselves do not sum to 1 (0.6 + 0.8 = 1.4) — only their squared magnitudes must.',
    xp: 20,
  },
  {
    id: 'qubits-2',
    lessonId: 'qubits',
    topic: 'fundamentals',
    question: 'What makes a qubit different from a classical bit whose value you simply do not know?',
    options: [
      'Nothing — a qubit is just an unknown bit',
      'A qubit can hold many classical values at the same time and read them all out',
      'A qubit has complex amplitudes, so its branches can interfere with each other',
      'A qubit never changes when you measure it',
    ],
    correctIndex: 2,
    explanation:
      'Complex amplitudes allow interference: negative or imaginary components can cancel. That is what makes algorithms like Grover work, and it is not available to a probabilistic classical bit.',
    xp: 20,
  },
  {
    id: 'superposition-1',
    lessonId: 'superposition',
    topic: 'fundamentals',
    question: 'What does the Hadamard gate do to |0⟩?',
    options: [
      'Converts |0⟩ directly to |1⟩',
      'Creates an equal superposition (|0⟩ + |1⟩)/√2',
      'Measures the qubit and reports 0 or 1',
      'Deletes the qubit and returns it to |0⟩',
    ],
    correctIndex: 1,
    explanation:
      'H|0⟩ = (|0⟩ + |1⟩)/√2 = |+⟩. Both basis states get amplitude 1/√2, so each is measured with probability 1/2.',
    xp: 20,
  },
  {
    id: 'superposition-2',
    lessonId: 'superposition',
    topic: 'fundamentals',
    question: 'H|0⟩ and H|1⟩ both measure 50/50. What is different between the two states?',
    options: [
      'Nothing at all — they are the same state',
      'The relative phase: |+⟩ points along +X and |−⟩ along −X on the Bloch sphere',
      'The number of qubits involved',
      'One of them is not normalised',
    ],
    correctIndex: 1,
    explanation:
      'H|0⟩ = |+⟩ = (|0⟩+|1⟩)/√2 and H|1⟩ = |−⟩ = (|0⟩−|1⟩)/√2 differ by the sign of the |1⟩ amplitude — a relative phase of π. Probabilities cannot see it; a later Hadamard turns that phase into a measurable difference.',
    xp: 20,
  },
  {
    id: 'entanglement-1',
    lessonId: 'entanglement',
    topic: 'fundamentals',
    question: 'Starting from |00⟩, which two gates create the Bell state (|00⟩ + |11⟩)/√2?',
    options: [
      'H on q0, then CNOT with q0 as control and q1 as target',
      'CNOT on q0 and q1, then H on q0',
      'X on q0, then Z on q1',
      'H on q0 and H on q1 in the same step',
    ],
    correctIndex: 0,
    explanation:
      'H on q0 makes (|0⟩+|1⟩)/√2, then the CNOT entangles the pair: the |1⟩ branch flips q1, giving (|00⟩ + |11⟩)/√2.',
    xp: 25,
  },
  {
    id: 'entanglement-2',
    lessonId: 'entanglement',
    topic: 'fundamentals',
    question: 'You measure a Bell state and see |00⟩. What then happens to the individual Bloch vectors of q0 and q1?',
    options: [
      'Nothing changes — the measurement only affects the classical record',
      'The state is now a product state |00⟩, so both vectors point to their own north pole',
      'Both vectors point to the centre forever',
      'The qubits are destroyed',
    ],
    correctIndex: 1,
    explanation:
      'Before measurement each qubit is maximally mixed (vector length 0). After reading |00⟩ the pair collapses onto a product state, so q0 and q1 each sit on the north pole with a full-length vector.',
    xp: 25,
  },
  {
    id: 'gates-1',
    lessonId: 'gates',
    topic: 'gates',
    question: 'Which statement about quantum gates is true?',
    options: [
      'Gates are reversible except for measurement',
      'X and Z do exactly the same thing',
      'Applying a gate can change the number of qubits',
      'Gates always change the probabilities of |0⟩ and |1⟩',
    ],
    correctIndex: 0,
    explanation:
      'Gates are unitary, hence invertible — the state before the gate can always be recovered. Measurement is the only irreversible operation in this toolbox.',
    xp: 20,
  },
  {
    id: 'gates-2',
    lessonId: 'gates',
    topic: 'gates',
    question: 'You apply H, Z, H in that order to q0, which started in |0⟩. What do you measure?',
    options: [
      '50/50, because the circuit contains a Hadamard gate',
      'Always 1, because HZH = X',
      'Always 0, because Z leaves |0⟩ unchanged',
      'It depends on the number of shots',
    ],
    correctIndex: 1,
    explanation:
      'HZH = X, so the three-gate sequence is exactly a bit flip: starting from |0⟩ you always measure 1. Deleting the Z gives H H = I and always measures 0 — order matters.',
    xp: 20,
  },
  {
    id: 'algorithms-1',
    lessonId: 'algorithms',
    topic: 'algorithms',
    question: 'What does the diffusion step in Grover’s algorithm do?',
    options: [
      'It measures every qubit and stores the result',
      'It reflects the amplitudes about their average, amplifying the marked answer',
      'It copies the marked state into an ancilla qubit',
      'It deletes the unmarked states from the register',
    ],
    correctIndex: 1,
    explanation:
      'Diffusion applies 2|s⟩⟨s| − I (built from H, X and CZ), reflecting amplitudes about their mean. The marked amplitude grows while the others shrink; nothing is deleted.',
    xp: 25,
  },
  {
    id: 'algorithms-2',
    lessonId: 'algorithms',
    topic: 'algorithms',
    question: 'How many Grover iterations are needed to find one marked item among N = 4 items, and what is the success probability?',
    options: [
      'Two iterations, probability 1',
      'One iteration, probability 1',
      'Four iterations, probability 25%',
      'One iteration, probability 25% — the rest is a speedup in gate count only',
    ],
    correctIndex: 1,
    explanation:
      'For N = 4 a single iteration (oracle + diffusion) rotates the state all the way onto the marked item, so |11⟩ has probability exactly 1. In general you need about ⌈(π/4)√N⌉ iterations.',
    xp: 25,
  },

  // E6 — new quiz questions (2026-09-18, user-approved draft)
  // Added to BOTH src/data/quizzes.ts and backend/src/data/quizzes.ts (E3 drift test)

  // Lesson: qubits (3 new)
  {
    id: 'qubits-3',
    lessonId: 'qubits',
    topic: 'fundamentals',
    question: 'A qubit is in the state |ψ⟩ = −|1⟩. What is the probability of measuring 1?',
    options: [
      '0 — the minus sign cancels the state',
      '1/2',
      '1 — the minus sign is a global phase and does not affect probabilities',
      'It depends on the number of shots',
    ],
    correctIndex: 2,
    explanation:
      'P(1) = |−1|² = 1. Multiplying the whole state by −1 (or any complex number of magnitude 1) is a global phase, which is unobservable. Only the relative phase between |0⟩ and |1⟩ can change measurement statistics.',
    xp: 20,
  },
  {
    id: 'qubits-4',
    lessonId: 'qubits',
    topic: 'fundamentals',
    question: 'Which of the following is a valid qubit state?',
    options: [
      '0.3|0⟩ + 0.7|1⟩',
      '0.6|0⟩ + 0.8|1⟩',
      '0.5|0⟩ + 0.5|1⟩',
      '0.8|0⟩ + 0.8|1⟩',
    ],
    correctIndex: 1,
    explanation:
      'A state is valid only when the squared magnitudes sum to 1. Only 0.6/0.8 works: 0.36 + 0.64 = 1. The others give 0.09 + 0.49 = 0.58, 0.25 + 0.25 = 0.5 and 0.64 + 0.64 = 1.28. Note the amplitudes themselves never need to sum to 1 — only their squared magnitudes do.',
    xp: 20,
  },
  {
    id: 'qubits-5',
    lessonId: 'qubits',
    topic: 'fundamentals',
    question: 'You run a 50/50 circuit with 100 shots and repeat the run many times. What do the counts look like?',
    options: [
      'Every run gives exactly 50 zeros and 50 ones',
      'Counts land near 50/50 but differ from run to run',
      'After the first run the counts stay fixed forever',
      'All shots return 0 because the circuit started in |0⟩',
    ],
    correctIndex: 1,
    explanation:
      'Each shot is an independent sample from the Born rule. For 100 shots the counts follow a binomial distribution centred on 50 with a spread of about √(100 · 0.5 · 0.5) = 5, so most runs land within a few counts of 50/50 — an exact 50/50 split happens only ~8% of the time. This is why the platform reports counts, not certainties.',
    xp: 20,
  },

  // Lesson: superposition (3 new)
  {
    id: 'superposition-3',
    lessonId: 'superposition',
    topic: 'fundamentals',
    question: 'Starting from |0⟩ you apply H and then H again, and measure. What do you observe?',
    options: [
      'Always 0 — H is its own inverse, so the two gates cancel exactly',
      '50/50, because one H is enough to superpose',
      'Always 1',
      '25% |0⟩, 50% |1⟩, 25% nothing',
    ],
    correctIndex: 0,
    explanation:
      'H·H = I. The first H creates (|0⟩ + |1⟩)/√2; the second H recombines the two amplitudes — the |1⟩ contributions arrive with opposite signs and cancel by destructive interference, leaving |0⟩ with certainty.',
    xp: 20,
  },
  {
    id: 'superposition-4',
    lessonId: 'superposition',
    topic: 'fundamentals',
    question: 'You prepare |+⟩ with H, then apply Z. What are the measurement probabilities now?',
    options: [
      'All shots return 1',
      'All shots return 0',
      'Still ~50/50 — Z changes only the phase, turning |+⟩ into |−⟩',
      '75/25',
    ],
    correctIndex: 2,
    explanation:
      'Z flips the sign of the |1⟩ amplitude: |+⟩ = (|0⟩ + |1⟩)/√2 becomes |−⟩ = (|0⟩ − |1⟩)/√2. Probabilities cannot see relative phase, so both outcomes stay at 50%. Apply a final H and the phase becomes measurable: H|−⟩ = |1⟩ deterministically.',
    xp: 25,
  },
  {
    id: 'superposition-5',
    lessonId: 'superposition',
    topic: 'fundamentals',
    question: 'After H on |0⟩ the Bloch vector points along +X. After H then Z, where does it point?',
    options: [
      'Along −X (the |−⟩ state)',
      'Along −Z (the |1⟩ state)',
      'Along +Z (the |0⟩ state)',
      'Along +Y',
    ],
    correctIndex: 0,
    explanation:
      'Z is a 180° rotation about the Z axis, so it rotates an equatorial vector from +X to −X without changing the probabilities — the Bloch sphere view of the phase flip.',
    xp: 20,
  },

  // Lesson: entanglement (2 new)
  {
    id: 'entanglement-3',
    lessonId: 'entanglement',
    topic: 'fundamentals',
    question: 'A CNOT has q0 as control and q1 as target (states written |q0 q1⟩). Which basis states does it change?',
    options: [
      'Only states where q1 is 1',
      'Only states where q0 is 1: |10⟩ ↔ |11⟩',
      'All four basis states',
      'None — CNOT only affects superpositions',
    ],
    correctIndex: 1,
    explanation:
      'CNOT flips the target q1 exactly when the control q0 is |1⟩: |10⟩ → |11⟩ and |11⟩ → |10⟩. The states |00⟩ and |01⟩ pass through unchanged. That conditional flip is what copies the control superposition into correlation in the Bell circuit.',
    xp: 25,
  },
  {
    id: 'entanglement-4',
    lessonId: 'entanglement',
    topic: 'fundamentals',
    question: 'A two-qubit state has equal amplitudes on all four outcomes: (|00⟩ + |01⟩ + |10⟩ + |11⟩)/2. Is it entangled?',
    options: [
      'Yes — seeing all four outcomes always means entanglement',
      'No — it factors as (|0⟩ + |1⟩)/√2 ⊗ (|0⟩ + |1⟩)/√2, two independent qubits',
      'Only if the measured counts are exactly equal',
      'It cannot be determined without running the circuit',
    ],
    correctIndex: 1,
    explanation:
      'This state is a product: each qubit is independently |+⟩. Entanglement means the state cannot be factored into one description per qubit — like the Bell state (|00⟩ + |11⟩)/√2, where knowing one qubit outcome determines the other.',
    xp: 25,
  },

  // Lesson: gates (2 new)
  {
    id: 'gates-3',
    lessonId: 'gates',
    topic: 'fundamentals',
    question: 'S and T are both rotations about the Z axis. How do they differ?',
    options: [
      'S rotates 90° about Z, T rotates 45°',
      'S rotates 90° about Z, T rotates 45° — and two T\'s compose into an S (up to global phase)',
      'S changes probabilities, T changes only phase',
      'They are the same gate with different names',
    ],
    correctIndex: 1,
    explanation:
      'S applies a phase of π/2 (quarter turn, 90°) and T applies π/4 (45°). Neither changes the measurement probabilities of |0⟩ or |1⟩ — both just move the state around the equator. T·T = diag(1, i) = S up to a global phase, which is why T is the finer screwdriver built from which S can be made.',
    xp: 25,
  },
  {
    id: 'gates-4',
    lessonId: 'gates',
    topic: 'fundamentals',
    question: 'You apply Z to a qubit in |0⟩ and measure. What do you observe?',
    options: [
      'Always 0 — Z leaves |0⟩ untouched',
      'Always 1',
      '50/50',
      '0 and 1 alternating shot by shot',
    ],
    correctIndex: 0,
    explanation:
      'Z = diag(1, −1): it flips the sign of |1⟩ but leaves |0⟩ exactly as it was, so |0⟩ → |0⟩ and every shot reads 0. The phase flip only becomes visible when the qubit is in superposition — e.g. Z on |+⟩ followed by H gives a deterministic 1.',
    xp: 20,
  },

  // Lesson: algorithms (2 new)
  {
    id: 'algorithms-3',
    lessonId: 'algorithms',
    topic: 'fundamentals',
    question: 'In Deutsch–Jozsa, what does the final Hadamard on the input qubit achieve?',
    options: [
      'It measures the output qubit',
      'It amplifies the answer the way Grover\'s diffusion does',
      'It converts the oracle\'s relative phase into a definite 0 or 1 on the input qubit',
      'It resets the input qubit to |0⟩ for the next run',
    ],
    correctIndex: 2,
    explanation:
      'The oracle writes the answer as a relative phase between the input qubit\'s |0⟩ and |1⟩ branches — invisible to measurement. The final H turns that phase difference back into population difference: constant function → always 0, balanced → always 1. One query, deterministic answer.',
    xp: 25,
  },
  {
    id: 'algorithms-4',
    lessonId: 'algorithms',
    topic: 'fundamentals',
    question: 'Grover search looks for 1 marked item among N = 16. Roughly how many oracle+diffusion iterations bring the success probability near 1?',
    options: [
      '1 — one iteration is always enough',
      'About 3 — the count scales as (π/4)·√N ≈ 3.14 for N = 16',
      '16 — one iteration per item',
      'About 8 — half the items',
    ],
    correctIndex: 1,
    explanation:
      'Iterations grow like (π/4)·√N. For N = 16 that is π ≈ 3.14, and 3 iterations reach ≈96% success — a quadratic speedup over the up-to-16 checks a classical search needs.',
    xp: 25,
  },
];

export const QUIZ_MAP: Record<string, Quiz> = QUIZZES.reduce(
  (acc, quiz) => ({ ...acc, [quiz.id]: quiz }),
  {} as Record<string, Quiz>,
);

export function quizzesForLesson(lessonId: string): Quiz[] {
  return QUIZZES.filter(quiz => quiz.lessonId === lessonId);
}

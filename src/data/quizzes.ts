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
      'The Born rule says the probability is the squared magnitude of the amplitude: |0.6|² = 0.36 and |0.8|² = 0.64. The amplitudes themselves are not probabilities (and note that 0.6 + 0.8 ≠ 1).',
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
];

export const QUIZ_MAP: Record<string, Quiz> = QUIZZES.reduce(
  (acc, quiz) => ({ ...acc, [quiz.id]: quiz }),
  {} as Record<string, Quiz>,
);

export function quizzesForLesson(lessonId: string): Quiz[] {
  return QUIZZES.filter(quiz => quiz.lessonId === lessonId);
}

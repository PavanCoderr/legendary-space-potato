/**
 * Concept glossary.
 *
 * These entries are what the global search returns in the "Concepts" group. Keeping them
 * as data means a student can find "H gate", "CNOT" or "Born rule" without opening a
 * lesson first, and the quiz generator can reuse the same definitions later.
 */
export interface GlossaryEntry {
  term: string;
  /** Alternative spellings and shorthand that should also match. */
  aliases: string[];
  definition: string;
  /** Where "open" takes the learner. */
  href: string;
  lessonId: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'Qubit',
    aliases: ['quantum bit'],
    definition: 'The unit of quantum information: a vector α|0⟩ + β|1⟩ of two complex amplitudes.',
    href: '#/lesson/qubits',
    lessonId: 'qubits',
  },
  {
    term: 'Amplitude',
    aliases: ['alpha beta', 'coefficient'],
    definition: 'The complex number in front of a basis state. Squaring its magnitude gives the probability.',
    href: '#/lesson/qubits',
    lessonId: 'qubits',
  },
  {
    term: 'Born rule',
    aliases: ['measurement probability'],
    definition: 'P(outcome) = |amplitude|². It is how a state vector becomes measurement statistics.',
    href: '#/lesson/qubits',
    lessonId: 'qubits',
  },
  {
    term: 'Measurement',
    aliases: ['collapse', 'measure', 'M gate'],
    definition: 'Reading a qubit returns 0 or 1 and destroys the superposition, collapsing the state.',
    href: '#/lesson/qubits',
    lessonId: 'qubits',
  },
  {
    term: 'Interference',
    aliases: ['constructive destructive'],
    definition: 'Amplitudes add and cancel. It is the mechanism every quantum algorithm relies on.',
    href: '#/lesson/qubits',
    lessonId: 'qubits',
  },
  {
    term: 'Bloch sphere',
    aliases: ['bloch vector'],
    definition: 'Geometric picture of a single qubit: |0⟩ north, |1⟩ south, superpositions on the equator.',
    href: '#/lesson/qubits',
    lessonId: 'qubits',
  },
  {
    term: 'Superposition',
    aliases: ['plus state', 'equal superposition'],
    definition: 'A definite state that is a combination of |0⟩ and |1⟩, measured as a probability split.',
    href: '#/lesson/superposition',
    lessonId: 'superposition',
  },
  {
    term: 'Hadamard gate',
    aliases: ['H gate', 'hadamard', 'H'],
    definition: 'H|0⟩ = (|0⟩ + |1⟩)/√2. Creates the equal superposition and is its own inverse.',
    href: '#/lesson/superposition',
    lessonId: 'superposition',
  },
  {
    term: 'Phase',
    aliases: ['relative phase', 'global phase'],
    definition: 'The complex argument of an amplitude. Invisible to measurement until gates mix branches.',
    href: '#/lesson/gates',
    lessonId: 'gates',
  },
  {
    term: 'X gate',
    aliases: ['bit flip', 'NOT', 'pauli x'],
    definition: 'The quantum NOT gate: a 180° rotation about the X axis that swaps |0⟩ and |1⟩.',
    href: '#/lesson/gates',
    lessonId: 'gates',
  },
  {
    term: 'Y gate',
    aliases: ['pauli y'],
    definition: 'A 180° rotation about Y: bit flip and phase flip at the same time.',
    href: '#/lesson/gates',
    lessonId: 'gates',
  },
  {
    term: 'Z gate',
    aliases: ['phase flip', 'pauli z'],
    definition: 'Flips the sign of the |1⟩ amplitude. Measurement probabilities stay identical.',
    href: '#/lesson/gates',
    lessonId: 'gates',
  },
  {
    term: 'S gate',
    aliases: ['phase gate', '90 degree'],
    definition: 'A 90° rotation about Z — a quarter turn of phase.',
    href: '#/lesson/gates',
    lessonId: 'gates',
  },
  {
    term: 'T gate',
    aliases: ['pi over 8'],
    definition: 'A 45° rotation about Z. Together with H and CNOT it is universal for quantum computing.',
    href: '#/lesson/gates',
    lessonId: 'gates',
  },
  {
    term: 'CNOT',
    aliases: ['CX', 'controlled not', 'controlled-NOT'],
    definition: 'Two-qubit gate that flips the target qubit only when the control qubit is |1⟩.',
    href: '#/lesson/entanglement',
    lessonId: 'entanglement',
  },
  {
    term: 'Entanglement',
    aliases: ['entangled', 'non-local'],
    definition: 'A joint state with no local description: the qubits are correlated beyond any classical bit pair.',
    href: '#/lesson/entanglement',
    lessonId: 'entanglement',
  },
  {
    term: 'Bell state',
    aliases: ['bell pair', 'phi plus'],
    definition: '(|00⟩ + |11⟩)/√2 — the canonical maximally entangled two-qubit state built with H + CNOT.',
    href: '#/lesson/entanglement',
    lessonId: 'entanglement',
  },
  {
    term: 'Reduced state',
    aliases: ['mixed state', 'purity'],
    definition: 'What one qubit looks like on its own. Its Bloch vector shrinks when it is entangled.',
    href: '#/lesson/entanglement',
    lessonId: 'entanglement',
  },
  {
    term: 'Oracle',
    aliases: ['phase oracle', 'function evaluation'],
    definition: 'A reversible circuit that marks solutions with a phase, hiding the answer in interference.',
    href: '#/lesson/algorithms',
    lessonId: 'algorithms',
  },
  {
    term: 'Deutsch–Jozsa',
    aliases: ['deutsch jozsa', 'deutsch algorithm'],
    definition: 'Decides constant vs balanced in one oracle query, where classical needs two.',
    href: '#/lesson/algorithms',
    lessonId: 'algorithms',
  },
  {
    term: "Grover's algorithm",
    aliases: ['grover', 'amplitude amplification', 'search'],
    definition: 'Finds a marked item among N in about √N steps using oracle plus diffusion.',
    href: '#/lesson/algorithms',
    lessonId: 'algorithms',
  },
  {
    term: "Shor's algorithm",
    aliases: ['shor', 'factoring', 'phase estimation'],
    definition: 'Factors integers with phase estimation, giving an exponential speedup over known classical methods.',
    href: '#/lesson/algorithms',
    lessonId: 'algorithms',
  },
  {
    term: 'Circuit depth',
    aliases: ['depth', 'columns'],
    definition: 'The number of sequential gate layers — how long the circuit takes if gates run in parallel.',
    href: '#/builder',
    lessonId: 'gates',
  },
  {
    term: 'Unitary',
    aliases: ['reversible', 'U dagger U'],
    definition: 'Every gate is a unitary matrix: it preserves norm, so no gate loses information.',
    href: '#/lesson/gates',
    lessonId: 'gates',
  },
];

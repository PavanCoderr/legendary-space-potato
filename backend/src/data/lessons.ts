import type { Lesson } from './types';
import {
  bellCircuit,
  deutschJozsaCircuit,
  groverCircuit,
  hzhCircuit,
  superpositionCircuit,
  xFlipCircuit,
} from './presets';

/**
 * Placeholder for a YouTube video id.
 *
 * Replace each module's `video.youtubeId` with either a bare id (the part after `watch?v=`)
 * or a whole YouTube URL — `parseYoutubeId` normalises it, so no component changes are ever
 * needed. While a value is still the placeholder the player renders an "add your video"
 * poster instead of a broken iframe.
 */
export const VIDEO_PLACEHOLDER = 'YOUTUBE_VIDEO_ID_HERE';

/**
 * Lesson content. Each lesson follows the platform flow:
 * concept → watch the teaching video → interactive lab → circuit example → simulation →
 * visualization → AI prompts → quiz → challenge.
 */
export const LESSONS: Lesson[] = [
  {
    id: 'qubits',
    title: 'Qubits',
    topic: 'fundamentals',
    level: 'beginner',
    minutes: 8,
    xp: 60,
    summary: 'What a qubit is, how amplitudes work, and why measurement changes everything.',
    icon: { displayName: 'CircleDot', name: 'CircleDot' },
    locked: false,
    prerequisites: [],
    objectives: [
      'Describe a qubit as a pair of complex amplitudes α|0⟩ + β|1⟩',
      'Apply the Born rule to predict measurement outcomes',
      'Explain why an unknown classical bit is not the same as a superposition',
    ],
    video: {
      youtubeId: 'https://youtu.be/eJmBXYV2OWw',
      title: 'Qubits, amplitudes and measurement',
      duration: '',
      summary:
        'Why a qubit is a vector of complex amplitudes rather than an unknown bit, and how the Born rule turns those amplitudes into the 0/1 you actually observe.',
      chapters: [
        { at: '0:00', label: 'What is Quantum Computing?' },
        { at: '6:00', label: 'Classical Bit vs Qubit' },
        { at: '13:00', label: 'Quantum States' },
        { at: '21:00', label: 'Measurement' },
      ],
    },
    outline: [
      { title: 'What is Quantum Computing?', minutes: 6, summary: 'Why we need a different model of computation at all.' },
      { title: 'Classical Bit vs Qubit', minutes: 7, summary: 'Definite values compared with complex amplitudes.' },
      { title: 'Quantum States', minutes: 8, summary: 'Dirac notation, kets and normalisation.' },
      { title: 'Measurement', minutes: 6, summary: 'The Born rule and why measurement is irreversible.' },
    ],
    concept: {
      heading: 'A qubit is a vector, not a coin flip',
      paragraphs: [
        'A classical bit is either 0 or 1. A qubit is described by two complex amplitudes, written |ψ⟩ = α|0⟩ + β|1⟩. The amplitudes tell you how much of |0⟩ and how much of |1⟩ the state contains, and they must satisfy |α|² + |β|² = 1 so the state stays normalised.',
        'Because the amplitudes are complex, they can be negative or imaginary. That is the source of every quantum advantage: amplitudes can cancel each other (destructive interference) or reinforce each other (constructive interference). Probabilities never interfere — amplitudes do.',
        'When you measure a qubit you only ever see 0 or 1, with probabilities |α|² and |β|². The measurement destroys the amplitudes you had: the state collapses onto the outcome you observed. That is why a circuit is run many times ("shots") to estimate the probability distribution.',
      ],
      keyPoints: [
        'State: |ψ⟩ = α|0⟩ + β|1⟩ with |α|² + |β|² = 1.',
        'Measurement returns 0 with probability |α|² and 1 with probability |β|².',
        'Global phase is unobservable; relative phase between |0⟩ and |1⟩ is what matters.',
        'An unknown classical bit has a definite value — a qubit in superposition does not.',
      ],
      math: [
        { expression: '|ψ⟩ = α|0⟩ + β|1⟩', caption: 'The general single-qubit state.' },
        { expression: 'P(0) = |α|²,  P(1) = |β|²', caption: 'The Born rule.' },
      ],
    },
    interactive: {
      kind: 'state-explorer',
      title: 'Lab 1 · Play with a single qubit',
      instructions:
        'Apply X to flip the qubit and Z to add a phase. Watch the state vector, the probabilities and the Bloch sphere update together — the sphere direction is the physics, the probabilities are what you would measure.',
      availableGates: ['X', 'Z', 'H'],
      startCircuit: { name: 'Qubit basics', numQubits: 1, ops: [] },
      successNote: 'X rotates the vector to the south pole (|1⟩); Z leaves the probabilities alone but flips the phase.',
      completionCheck: 'touched-all-gates',
    },
    example: {
      title: 'Deterministic flip: X, then measure',
      circuit: xFlipCircuit(),
      shots: 1000,
      explanation:
        'X is the quantum NOT gate. Starting from |0⟩ it produces exactly |1⟩, so every single shot reads 1. Compare this with the superposition lesson, where the same measurement becomes a coin flip.',
      expectation: 'A single bar at |1⟩ with 1000/1000 counts.',
    },
    visualization: {
      focus: 'Bloch vector pointing to the south pole.',
      notes: [
        'The Bloch sphere maps every pure single-qubit state to a point on the surface.',
        'North pole = |0⟩, south pole = |1⟩, equator = equal superpositions.',
        'The length of the vector stays 1 as long as the state is pure.',
      ],
    },
    aiPrompts: [
      { label: 'Explain this', prompt: 'Explain what a qubit amplitude actually means.' },
      { label: 'Why did this happen?', prompt: 'Why does X give a deterministic result while H does not?' },
      { label: 'Find my mistake', prompt: 'Check my circuit and tell me if the qubit state matches what I intended.' },
    ],
    quizIds: ['qubits-1', 'qubits-2'],
    challengeId: 'challenge-bit-flip',
    nextLessonId: 'superposition',
  },
  {
    id: 'superposition',
    title: 'Superposition',
    topic: 'fundamentals',
    level: 'beginner',
    minutes: 10,
    xp: 80,
    summary: 'How the Hadamard gate turns |0⟩ into an equal superposition — and why you get ~50/50.',
    icon: { displayName: 'Waves', name: 'Waves' },
    locked: false,
    prerequisites: ['qubits'],
    objectives: [
      'Write out H|0⟩ and H|1⟩',
      'Apply H to |0⟩, read the probabilities and describe the Bloch vector',
      'Explain why a second H returns the qubit to |0⟩',
    ],
    video: {
      youtubeId: 'https://youtu.be/PjKaRVNcyFE',
      title: 'Superposition and the Hadamard gate',
      duration: '',
      summary:
        'The H gate step by step: from |0⟩ to |+⟩, why the measurement becomes a 50/50 coin flip, and how to tell |+⟩ apart from |−⟩ even though their probabilities match.',
      chapters: [
        { at: '0:00', label: 'What is Superposition?' },
        { at: '7:00', label: 'Hadamard Gate' },
        { at: '15:00', label: 'Probability' },
        { at: '20:00', label: 'Interactive Experiment' },
      ],
    },
    outline: [
      { title: 'What is Superposition?', minutes: 7, summary: 'Combinations of basis states with complex amplitudes.' },
      { title: 'Hadamard Gate', minutes: 8, summary: 'The gate that builds the equal superposition.' },
      { title: 'Probability', minutes: 5, summary: 'From amplitudes to measured percentages.' },
      { title: 'Interactive Experiment', minutes: 6, summary: 'Build and run the H circuit yourself.' },
    ],
    concept: {
      heading: 'The Hadamard gate creates the |+⟩ state',
      paragraphs: [
        'The Hadamard gate is the workhorse of quantum algorithms. Applied to |0⟩ it produces |+⟩ = (|0⟩ + |1⟩)/√2 — an equal superposition of the two basis states. Applied to |1⟩ it produces |−⟩ = (|0⟩ − |1⟩)/√2, which differs from |+⟩ only by the sign of the |1⟩ amplitude.',
        'Those two states have identical measurement probabilities (50/50) but they are different physical states: |+⟩ points along +X on the Bloch sphere and |−⟩ points along −X. Probabilities can hide phase; the Bloch sphere cannot.',
        'H is its own inverse: H(H|0⟩) = |0⟩. That is interference at work — the two paths created by the first H recombine and the |1⟩ amplitudes cancel exactly.',
      ],
      keyPoints: [
        'H|0⟩ = (|0⟩ + |1⟩)/√2 = |+⟩, so P(0) = P(1) = 0.5.',
        'H|1⟩ = (|0⟩ − |1⟩)/√2 = |−⟩ — same probabilities, opposite phase.',
        'H·H = I, so two Hadamards in a row do nothing.',
        'Superposition is not "both values at once"; it is a definite amplitude vector whose measurement statistics are split.',
      ],
      math: [
        { expression: 'H = 1/√2 · [[1, 1], [1, −1]]', caption: 'The Hadamard matrix.' },
        { expression: 'H|0⟩ = (|0⟩ + |1⟩)/√2', caption: 'The state after a single H.' },
      ],
    },
    interactive: {
      kind: 'state-explorer',
      title: 'Lab 2 · The interactive H gate demo',
      instructions:
        'This is the core demo: start in |0⟩, press H, and watch the state vector and probabilities update. Then press S or Z to move the state around the equator and see that the 50/50 probabilities never change.',
      availableGates: ['H', 'Z', 'S', 'T', 'X'],
      startCircuit: { name: 'Superposition demo', numQubits: 1, ops: [] },
      successNote: 'After H the two probabilities are equal (≈50% each) and the Bloch vector lies on the equator pointing to +X.',
      completionCheck: 'touched-all-gates',
    },
    example: {
      title: 'H then measure with 1000 shots',
      circuit: superpositionCircuit(),
      shots: 1000,
      explanation:
        'The circuit is a single H followed by a measurement. The simulator evolves |0⟩ into (|0⟩ + |1⟩)/√2 and then samples 1000 shots from the Born rule, so the counts land near 500/500 — the exact split varies on every run because measurement is genuinely random.',
      expectation: 'Two bars, each close to 500 counts out of 1000 (>95% of the time within ±60).',
    },
    visualization: {
      focus: 'Bloch vector on the equator at +X.',
      notes: [
        'Rotate the sphere to check that the vector really lies in the XY plane (z = 0).',
        'Z and S rotate the vector around the vertical axis — that is a phase change.',
        'Press H twice to watch the vector return to the north pole.',
      ],
    },
    aiPrompts: [
      { label: 'Why did this happen?', prompt: 'Why did the H gate give approximately 50/50?' },
      { label: 'Explain my circuit', prompt: 'Explain my circuit and what state it prepares.' },
      { label: 'Give me a hint', prompt: 'Give me a hint for the superposition challenge.' },
    ],
    quizIds: ['superposition-1', 'superposition-2'],
    challengeId: 'challenge-superposition',
    nextLessonId: 'entanglement',
  },
  {
    id: 'entanglement',
    title: 'Entanglement',
    topic: 'fundamentals',
    level: 'beginner',
    minutes: 12,
    xp: 100,
    summary: 'CNOT plus superposition links two qubits so their measurements are correlated.',
    icon: { displayName: 'Link2', name: 'Link2' },
    locked: false,
    prerequisites: ['superposition'],
    objectives: [
      'Explain the difference between a product state and an entangled state',
      'Build a Bell state with H + CNOT',
      'Read the reduced Bloch vectors and explain why they shrink',
    ],
    video: {
      youtubeId: 'https://youtu.be/rGRUFzPeJI4',
      title: 'Entanglement and Bell states',
      duration: '',
      summary:
        'How H + CNOT ties two qubits together, why only |00⟩ and |11⟩ ever appear, and what the shrinking Bloch vectors tell you about each individual qubit.',
      chapters: [
        { at: '0:00', label: 'What is Entanglement?' },
        { at: '7:00', label: 'Bell States' },
        { at: '16:00', label: 'Interactive Experiment' },
      ],
    },
    outline: [
      { title: 'What is Entanglement?', minutes: 7, summary: 'Correlations with no local explanation.' },
      { title: 'Bell States', minutes: 9, summary: 'The four maximally entangled two-qubit states.' },
      { title: 'Interactive Experiment', minutes: 8, summary: 'Build the Bell pair and read the correlation.' },
    ],
    concept: {
      heading: 'Correlations that no classical bit pair can reproduce',
      paragraphs: [
        'A product state such as |00⟩ or (|0⟩+|1⟩)⊗|0⟩ can be described one qubit at a time. Entangled states cannot: the register is a single object with no local description for its parts.',
        'The standard recipe is H on q0 followed by CNOT with q0 as control and q1 as target. The result is (|00⟩ + |11⟩)/√2, the Bell state. Measuring q0 gives 0 or 1 with equal probability, and whatever you get, q1 matches it. The outcomes are perfectly correlated.',
        'Notice what happens to the individual qubits: each one is left in a maximally mixed state, so its Bloch vector shrinks to the centre of the sphere even though the pair as a whole is a perfectly pure state. That shrinkage is the visual signature of entanglement.',
        'The correlation is stronger than anything classical physics allows. If Alice and Bob each choose a measurement direction, the Bell inequality is violated — no pre-agreed classical recipe can reproduce the statistics.',
      ],
      keyPoints: [
        'CNOT flips the target only when the control is |1⟩.',
        'H + CNOT on two qubits gives the Bell state (|00⟩ + |11⟩)/√2.',
        'Only |00⟩ and |11⟩ ever appear: 50/50, and always matching.',
        'Each individual qubit is maximally mixed (Bloch vector length 0) — entanglement is a property of the pair.',
      ],
      math: [
        { expression: 'CNOT|a,b⟩ = |a, a⊕b⟩', caption: 'Controlled-NOT acts on the target when the control is 1.' },
        { expression: '|Φ⁺⟩ = (|00⟩ + |11⟩)/√2', caption: 'One of the four Bell states.' },
      ],
    },
    interactive: {
      kind: 'entanglement-lab',
      title: 'Lab 3 · Build your first Bell pair',
      instructions:
        'Apply H to q0, then drag a CNOT onto the wires with q0 as control and q1 as target. Run the circuit and check the measurement table: only |00⟩ and |11⟩ appear, and the two Bloch vectors collapse to the centre.',
      availableGates: ['H', 'CNOT', 'X', 'Z', 'M'],
      startCircuit: { name: 'Bell state lab', numQubits: 2, ops: [] },
      successNote: 'The measurement results are perfectly correlated: |00⟩ and |11⟩ only.',
      completionCheck: 'measured-correlation',
    },
    example: {
      title: 'Bell state with 1000 shots',
      circuit: bellCircuit(),
      shots: 1000,
      explanation:
        'H creates the superposition on q0, then CNOT copies the correlation into q1. The simulator evolves the two-qubit state vector and samples shots from it, so |01⟩ and |10⟩ never appear — they truly have probability 0, they are not merely unlikely.',
      expectation: '|00⟩ ≈ 50%, |11⟩ ≈ 50%, everything else 0%.',
    },
    visualization: {
      focus: 'Both single-qubit Bloch vectors have length ≈ 0.',
      notes: [
        'A shorter Bloch vector means the qubit is not in a pure state of its own.',
        'Switch the visualization to the probability chart to see only two bars.',
        'Replace the CNOT control with the other qubit and the state becomes (|00⟩ + |11⟩)/√2 still — try it.',
      ],
    },
    aiPrompts: [
      { label: 'Why did this happen?', prompt: 'Why do only |00⟩ and |11⟩ show up in my Bell state results?' },
      { label: 'Explain the result', prompt: 'Explain the measurement results of my circuit.' },
      { label: 'Find my mistake', prompt: 'Find my mistake: my Bell state shows |01⟩ outcomes.' },
    ],
    quizIds: ['entanglement-1', 'entanglement-2'],
    challengeId: 'challenge-bell-state',
    nextLessonId: 'gates',
  },
  {
    id: 'gates',
    title: 'Quantum Gates',
    topic: 'gates',
    level: 'beginner',
    minutes: 12,
    xp: 90,
    summary: 'The gate toolbox — H, X, Y, Z, S, T, CNOT — and how each one moves the state vector.',
    icon: { displayName: 'Blocks', name: 'Blocks' },
    locked: false,
    prerequisites: ['qubits'],
    objectives: [
      'Recognise the matrix and Bloch-sphere action of the common gates',
      'Explain why every gate (except measurement) is reversible',
      'Predict the effect of gate sequences such as HZH',
    ],
    video: {
      youtubeId: 'https://youtu.be/aCOsqL-jIOo',
      title: 'The quantum gate toolbox',
      duration: '',
      summary:
        'X, Y, Z, S, T, H and CNOT as rotations on the Bloch sphere — which ones move the probabilities, which only move the phase, and how to read a gate sequence.',
      chapters: [
        { at: '0:00', label: 'X Gate' },
        { at: '5:00', label: 'Y Gate' },
        { at: '10:00', label: 'Z Gate' },
        { at: '15:00', label: 'H Gate' },
        { at: '21:00', label: 'CNOT' },
      ],
    },
    outline: [
      { title: 'X Gate', minutes: 5, summary: 'The quantum bit flip.' },
      { title: 'Y Gate', minutes: 5, summary: 'Bit flip plus phase flip.' },
      { title: 'Z Gate', minutes: 5, summary: 'The phase flip no measurement can see.' },
      { title: 'H Gate', minutes: 6, summary: 'Poles to equator and back.' },
      { title: 'CNOT', minutes: 7, summary: 'The two-qubit gate that enables entanglement.' },
    ],
    concept: {
      heading: 'Gates are rotations of the state vector',
      paragraphs: [
        'Every quantum gate is a unitary matrix: U†U = I. Unitaries preserve the length of the state vector, which is exactly the statement that probabilities always sum to 1. Because they are invertible, no gate loses information — measurement is the only irreversible step.',
        'On the Bloch sphere, single-qubit gates are rotations. X, Y and Z rotate the vector 180° about their axis; S rotates 90° and T rotates 45° about Z; H is a 180° rotation about the diagonal (X+Z)/√2 axis, which is why it swaps the poles with the equator.',
        'Gate order matters because rotations do not commute: HZH = X, while ZHH = Z. Building intuition for sequences like this is how you learn to read circuits.',
      ],
      keyPoints: [
        'Gates are unitary: they preserve norm, so they are reversible.',
        'X/Y/Z = 180° rotations about X/Y/Z; S = 90° about Z; T = 45° about Z.',
        'H swaps the Z axis with the X axis.',
        'CNOT is the only two-qubit gate needed here: it creates entanglement and enables all the algorithms in the course.',
      ],
      math: [
        { expression: 'X = [[0, 1], [1, 0]]', caption: 'Bit flip.' },
        { expression: 'Z = [[1, 0], [0, −1]]', caption: 'Phase flip.' },
        { expression: 'HZH = X', caption: 'A gate-identity you can verify in the lab.' },
      ],
    },
    interactive: {
      kind: 'gate-tour',
      title: 'Lab 4 · Gate tour',
      instructions:
        'Apply each gate from |0⟩, then reset and try it from |+⟩ (H first). Note which gates change the probabilities and which only change the phase.',
      availableGates: ['H', 'X', 'Y', 'Z', 'S', 'T', 'CNOT', 'M'],
      startCircuit: { name: 'Gate tour', numQubits: 2, ops: [] },
      successNote: 'X, Y and H change the probabilities; Z, S and T only move the phase around the equator.',
      completionCheck: 'touched-all-gates',
    },
    example: {
      title: 'HZH on q0 behaves exactly like X',
      circuit: hzhCircuit(),
      shots: 1000,
      explanation:
        'H rotates the state onto the equator, Z flips its phase, and the final H rotates it back — landing on |1⟩ every time. Three gates doing the work of one is a compact demonstration that gates compose as matrix products.',
      expectation: 'P(|1⟩) = 1, identical to a single X gate.',
    },
    visualization: {
      focus: 'Start at the north pole, end at the south pole, passing through the equator.',
      notes: [
        'Step through the circuit one gate at a time in the Simulator to watch the vector move.',
        'Qubit 2 stays in |0⟩ because no gate touched it.',
      ],
    },
    aiPrompts: [
      { label: 'Explain this', prompt: 'Explain what each gate in my circuit does to the state.' },
      { label: 'Improve my code', prompt: 'Can you shorten my circuit without changing its result?' },
      { label: 'Give me a hint', prompt: 'Give me a hint for the HZH challenge.' },
    ],
    quizIds: ['gates-1', 'gates-2'],
    challengeId: 'challenge-hzh',
    nextLessonId: 'algorithms',
  },
  {
    id: 'algorithms',
    title: 'Algorithms',
    topic: 'algorithms',
    level: 'intermediate',
    minutes: 15,
    xp: 120,
    summary: 'Interference-based algorithms: Deutsch–Jozsa in one query and Grover amplitude amplification.',
    icon: { displayName: 'Sigma', name: 'Sigma' },
    locked: false,
    prerequisites: ['entanglement', 'gates'],
    objectives: [
      'Describe how oracles encode a problem into a phase',
      'Explain amplitude amplification with the Grover operator',
      'Read the measurement statistics of a Grover run and interpret the speedup',
    ],
    video: {
      youtubeId: 'https://youtu.be/QcK0GK7DUh8',
      title: 'Grover, Deutsch–Jozsa and the shape of a quantum algorithm',
      duration: '',
      summary:
        'Every algorithm in this course follows the same recipe: prepare a superposition, let the oracle interfere with it, then measure. We trace it through Deutsch–Jozsa and Grover on two qubits.',
      chapters: [
        { at: '0:00', label: 'Why Quantum Algorithms?' },
        { at: '6:00', label: 'Deutsch Algorithm' },
        { at: '14:00', label: "Grover's Algorithm" },
        { at: '24:00', label: "Shor's Algorithm" },
      ],
    },
    outline: [
      { title: 'Why Quantum Algorithms?', minutes: 6, summary: 'Interference instead of brute force.' },
      { title: 'Deutsch Algorithm', minutes: 8, summary: 'Deciding a function with a single query.' },
      { title: "Grover's Algorithm", minutes: 10, summary: 'Quadratic search through amplitude amplification.' },
      { title: "Shor's Algorithm", minutes: 9, summary: 'Phase estimation and the factoring speedup.' },
    ],
    concept: {
      heading: 'Algorithms that use interference, not brute force',
      paragraphs: [
        'A quantum algorithm prepares a superposition, lets the problem interfere with itself, and then measures. The oracle — a reversible circuit that evaluates the problem — is applied as a phase flip so that unwanted answers cancel out.',
        'Deutsch–Jozsa decides whether a function is constant or balanced with a single oracle query, where any classical algorithm needs two queries in the worst case for one bit. The measurement is deterministic: you get 1 for balanced and 0 for constant.',
        'Grover search finds a marked item among N possibilities in about √N steps. One iteration = oracle + diffusion, where the diffusion operator reflects the state about the average amplitude. After the right number of iterations the marked amplitude is close to 1; for two qubits and one marked state, a single iteration makes the success probability exactly 1.',
        'The speedup is quadratic for Grover and exponential for the phase-estimation family (Shor). In both cases the mechanism is the same: structured interference between amplitudes.',
      ],
      keyPoints: [
        'Oracles mark solutions with a phase, not with a classical flag.',
        'Grover: repeat (oracle → diffusion) roughly ⌈π/4·√N⌉ times.',
        'For N = 4 with one marked item, one Grover iteration is exactly enough (probability 1).',
        'Measurement destroys the superposition, so you must design the circuit so the answer lands with high probability.',
      ],
      math: [
        { expression: 'D = 2|s⟩⟨s| − I', caption: 'Diffusion: reflection about the average amplitude.' },
        { expression: 'D = H⊗H · X⊗X · CZ · X⊗X · H⊗H', caption: 'The diffusion operator built from basic gates.' },
      ],
    },
    interactive: {
      kind: 'algorithm-lab',
      title: 'Lab 5 · Grover on two qubits',
      instructions:
        'Load the Grover circuit, run it, then delete the diffusion block and run again. The first run measures |11⟩ with probability 1; the run without diffusion leaves all four outcomes equally likely — that is the difference interference makes.',
      availableGates: ['H', 'X', 'CNOT', 'Z', 'M'],
      startCircuit: groverCircuit(),
      successNote: 'With the full circuit, |11⟩ takes 100% of the shots. The oracle alone would give 25%.',
      completionCheck: 'always',
    },
    example: {
      title: 'Deutsch–Jozsa with a balanced oracle',
      circuit: deutschJozsaCircuit(),
      shots: 1000,
      explanation:
        'The input qubit is prepared in |+⟩ and the output qubit in |−⟩. The oracle f(x) = x flips the phase of the |1⟩ branch of the input, so after the final Hadamard the input qubit is |1⟩ with certainty — one query is enough to conclude the function is balanced.',
      expectation: '100% of shots read |1⟩ on the input qubit.',
    },
    visualization: {
      focus: 'Probability of |11⟩ rising from 25% to 100% as the diffusion step is added.',
      notes: [
        'Phase changes are invisible in the probability chart but essential to the algorithm.',
        'Watch the amplitude table: the diffusion step inverts amplitudes about their average.',
      ],
    },
    aiPrompts: [
      { label: 'Explain my circuit', prompt: 'Explain my circuit gate by gate.' },
      { label: 'Explain the result', prompt: 'Why does Grover give a deterministic answer for two qubits?' },
      { label: 'Give me a hint', prompt: 'Give me a hint for the Grover challenge.' },
    ],
    quizIds: ['algorithms-1', 'algorithms-2'],
    challengeId: 'challenge-grover',
    nextLessonId: null,
  },
];

export const LESSON_MAP: Record<string, Lesson> = LESSONS.reduce(
  (acc, lesson) => ({ ...acc, [lesson.id]: lesson }),
  {} as Record<string, Lesson>,
);

export function getLesson(id: string | null | undefined): Lesson | null {
  if (!id) return null;
  return LESSON_MAP[id] ?? null;
}

export function firstLesson(): Lesson {
  return LESSONS[0];
}

/** Next lesson in the curriculum by prerequisite order, used by "continue learning". */
export function recommendedLesson(completedIds: string[]): Lesson {
  const open = LESSONS.find(lesson => !completedIds.includes(lesson.id));
  return open ?? LESSONS[LESSONS.length - 1];
}

export const TOTAL_LESSON_XP = LESSONS.reduce((sum, lesson) => sum + lesson.xp, 0);

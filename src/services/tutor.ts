import { getChallenge } from '../data/challenges';
import { GATE_DEFS, type GateType } from '../quantum/gates';
import { validateCircuit } from '../quantum/circuit';
import { circuitToCode } from '../quantum/code';
import type { TutorContext } from '../data/types';
import {
  analyseSimplifications,
  describeCircuit,
  describeState,
  evolveStepByStep,
  significantStates,
  simulationWarnings,
} from './analysis';

/**
 * The QubitVerse tutor.
 *
 * This module is deliberately free of React and of the network: it takes a
 * `TutorRequest` (prompt + live application context) and returns a `TutorReply`. The
 * built-in rule engine below answers every supported action from the actual circuit and
 * simulation in front of the learner, so the tutor works with no API key at all. A real
 * LLM can be plugged in behind the same interface (see `llm.ts`), which is what
 * `settings.aiProvider.mode` switches between.
 */
export type TutorAction =
  | 'explain'
  | 'why'
  | 'mistake'
  | 'hint'
  | 'explain-circuit'
  | 'explain-result'
  | 'improve';

export interface TutorRequest {
  prompt: string;
  action?: TutorAction;
  context: TutorContext;
}

export interface TutorReply {
  text: string;
  followUps: string[];
  source: 'local' | 'remote';
  contextSummary: string;
  error?: string;
}

export const TUTOR_MODE_ITEMS: { action: TutorAction; label: string; question: string }[] = [
  { action: 'explain', label: 'Explain this', question: 'Explain the concept I am looking at.' },
  { action: 'why', label: 'Why did this happen?', question: 'Why did this result happen?' },
  { action: 'mistake', label: 'Find my mistake', question: 'Find my mistake in this circuit.' },
  { action: 'hint', label: 'Give me a hint', question: 'Give me a hint for the current challenge.' },
  { action: 'explain-circuit', label: 'Explain my circuit', question: 'Explain my circuit gate by gate.' },
  { action: 'explain-result', label: 'Explain the result', question: 'Explain my simulation result.' },
  { action: 'improve', label: 'Improve my code', question: 'Can you improve my circuit or code?' },
];

const GATE_KNOWLEDGE: Record<GateType, string> = {
  H: 'The Hadamard gate maps |0⟩ to (|0⟩+|1⟩)/√2 and |1⟩ to (|0⟩−|1⟩)/√2. On the Bloch sphere it is a 180° rotation about the X+Z diagonal, which is why it swaps the poles with the equator and turns "definite" into "50/50".',
  X: 'X is the quantum NOT: it swaps the amplitudes of |0⟩ and |1⟩, a 180° rotation about the X axis of the Bloch sphere. Starting from |0⟩ it gives |1⟩ with certainty, so it produces no superposition at all.',
  Y: 'Y is a bit flip combined with a phase flip: it rotates 180° about the Y axis, sending |0⟩ to i|1⟩. The probabilities look identical to X, but the state differs by a global phase/i factor.',
  Z: 'Z flips the sign of the |1⟩ amplitude, a 180° rotation about the Z axis. It never changes measurement probabilities in the Z basis — it moves the state around the equator, changing its phase.',
  S: 'S adds a 90° phase to |1⟩ (a quarter turn about the Z axis). It is the square root of Z, so S·S = Z.',
  T: 'T adds a 45° phase to |1⟩ (an eighth of a full turn, hence "π/8 gate"). It is the square root of S, so T·T = S and T⁴ = Z.',
  CNOT: 'CNOT flips the target qubit when the control is |1⟩. It is the entangler: applied to a superpositioned control, the two qubits end up in a joint state that cannot be written as a product of single-qubit states.',
  M: 'Measurement reads the qubit in the computational basis (Born rule), collapses the state onto the outcome, and is the only irreversible step in the circuit. QubitVerse executes measurement gates at the end of the circuit, exactly like Qiskit\'s measure_all().',
};

const CONCEPT_ANSWERS: { keywords: string[]; answer: string }[] = [
  {
    keywords: ['qubit', 'amplitude', 'bit'],
    answer:
      'A qubit is a pair of complex amplitudes: |ψ⟩ = α|0⟩ + β|1⟩ with |α|² + |β|² = 1. You never observe α and β directly — a measurement gives 0 with probability |α|² and 1 with probability |β|². The amplitudes are complex so different branches can cancel, which is where quantum speedups come from.',
  },
  {
    keywords: ['superposition', 'hadamard', '50/50', 'equal'],
    answer:
      'Superposition means the state is a genuine weighted combination of basis states rather than an unknown one. H|0⟩ = (|0⟩+|1⟩)/√2 gives amplitudes of magnitude 1/√2 on both, so each outcome has probability 1/2 and a single run is a coin flip. Run many shots and the counts converge on 50/50.',
  },
  {
    keywords: ['entangle', 'bell', 'correlat', 'cnot'],
    answer:
      'Entanglement is a joint property: the register state cannot be written as a product of single-qubit states. H on q0 followed by CNOT(q0→q1) gives (|00⟩+|11⟩)/√2, so the outcomes are perfectly correlated — you get |00⟩ or |11⟩ and never |01⟩ or |10⟩. Individually each qubit is maximally mixed, which you can see as a Bloch vector of length 0.',
  },
  {
    keywords: ['measure', 'born', 'collapse', 'shot'],
    answer:
      'Measurement applies the Born rule: outcome k appears with probability |amplitude_k|², and the state then collapses onto that outcome. Repeating the circuit (a "shot") gives a new sample, so the counts approximate the ideal probabilities. More shots means a tighter estimate, scaling as 1/√shots.',
  },
  {
    keywords: ['grover', 'algorithm', 'oracle', 'amplitude amplification', 'deutsch'],
    answer:
      'Quantum algorithms arrange for wrong answers to interfere destructively and the right answer constructively. Grover does this with an oracle (phase flip on solutions) followed by a diffusion step that reflects amplitudes about their average, needing about (π/4)√N iterations. Deutsch–Jozsa decides constant vs balanced with one oracle query instead of two.',
  },
  {
    keywords: ['bloch sphere', 'sphere'],
    answer:
      'The Bloch sphere represents a single qubit as a unit vector: north pole = |0⟩, south pole = |1⟩, equator = equal superpositions, +X = |+⟩, +Y = |+i⟩. Its length tells you purity — a pure state has length 1, and a vector that shrinks towards the centre means the qubit is entangled with, or has been measured by, something else.',
  },
  {
    keywords: ['gate', 'unitary', 'reversible', 'reversib'],
    answer:
      'Every quantum gate is a unitary matrix (U†U = I), so it preserves the norm of the state — that is why probabilities always sum to 1 — and it is invertible. Measurement is the only non-unitary step in the toolbox. Single-qubit gates are literally rotations of the Bloch vector.',
  },
];

const ACTION_KEYWORDS: { action: TutorAction; keywords: string[] }[] = [
  { action: 'mistake', keywords: ['mistake', 'wrong', 'error', 'bug', 'debug', 'broken', 'not working', 'fail'] },
  { action: 'hint', keywords: ['hint', 'stuck', 'help me', 'nudge', 'clue'] },
  { action: 'why', keywords: ['why', 'how come', 'explain what happened'] },
  { action: 'explain-result', keywords: ['result', 'counts', 'what happened', 'measurement result'] },
  { action: 'explain-circuit', keywords: ['my circuit', 'this circuit', 'gate by gate', 'explain the circuit'] },
  { action: 'improve', keywords: ['improve', 'optimize', 'optimise', 'shorter', 'simplif', 'faster', 'reduce'] },
];

export function detectAction(prompt: string, context: TutorContext): TutorAction {
  const text = prompt.toLowerCase();
  if (context.challenge && /hint|stuck|help me|clue/.test(text)) return 'hint';
  for (const entry of ACTION_KEYWORDS) {
    if (entry.keywords.some(keyword => text.includes(keyword))) return entry.action;
  }
  if (/what is|what does|explain|how does|tell me about/.test(text)) return 'explain';
  return context.simulation ? 'explain-result' : 'explain';
}

function detectGate(text: string): GateType | null {
  const lower = text.toLowerCase();
  if (/\bcnot\b|\bcx\b|controlled/.test(lower)) return 'CNOT';
  if (/\bmeasure/.test(lower)) return 'M';
  if (/\bhadamard\b|\bh gate\b|\bh\b/.test(lower)) return 'H';
  if (/\bpauli[- ]?x\b|\bx gate\b|\bx\b/.test(lower)) return 'X';
  if (/\bpauli[- ]?y\b|\by gate\b|\by\b/.test(lower)) return 'Y';
  if (/\bpauli[- ]?z\b|\bz gate\b|\bz\b/.test(lower)) return 'Z';
  if (/\bs gate\b|\bphase gate\b/.test(lower)) return 'S';
  if (/\bt gate\b|π\/8|pi\/8/.test(lower)) return 'T';
  return null;
}

export function buildContextSummary(context: TutorContext): string {
  const parts: string[] = [];
  if (context.lesson) parts.push(`lesson “${context.lesson.title}”`);
  if (context.challenge) parts.push(`challenge “${context.challenge.title}”`);
  parts.push(describeCircuit(context.circuit));
  if (context.selectedGate) parts.push(`palette gate selected: ${context.selectedGate}`);
  if (context.simulation) {
    parts.push(
      context.simulationStale
        ? 'a stale simulation result (the circuit changed since it ran)'
        : `last result: ${describeState(context.simulation)} over ${context.simulation.shots} shots`,
    );
  } else {
    parts.push('no simulation result yet');
  }
  if (context.lastChallengeChecks) {
    const failing = context.lastChallengeChecks.filter(check => !check.passed);
    parts.push(failing.length ? `${failing.length} failing challenge check(s)` : 'all challenge checks passing');
  }
  if (context.lastCodeIssues?.length) parts.push(`${context.lastCodeIssues.length} code issue(s)`);
  if (context.progress) {
    parts.push(
      `progress: concept ${context.progress.conceptRead ? 'read' : 'unread'}, lab ${context.progress.interactiveDone ? 'done' : 'open'}, quiz ${context.progress.quizCorrect}/${context.progress.quizTotal}, challenge ${context.progress.challengePassed ? 'passed' : 'open'}`,
    );
  }
  parts.push(`${context.xp} XP, ${context.streak}-day streak`);
  return parts.join(' · ');
}

function formatStates(states: { label: string; probability: number }[], limit = 4): string {
  return states
    .slice(0, limit)
    .map(entry => `${entry.label} ${(entry.probability * 100).toFixed(1)}%`)
    .join(', ');
}

function explainCircuit(context: TutorContext): string {
  const steps = evolveStepByStep(context.circuit);
  if (steps.length === 0) {
    return `Your circuit is empty. ${describeCircuit(context.circuit)}. Drag a gate from the palette (H is the classic starting point) and it will show up here with its state change.`;
  }
  const lines = steps.map(step => {
    const gate = GATE_DEFS[step.op.type];
    const wires = `q${step.op.qubits.join(', q')}`;
    const before = step.index === 0 ? '|0…0⟩' : 'the previous state';
    return `${step.index + 1}. ${gate.label} on ${wires} — ${gate.description} Starting from ${before}, the register becomes ${formatStates(step.states, 3)}.`;
  });
  const measurement = context.circuit.ops.some(op => op.type === 'M')
    ? 'Measurement gates are executed at the end, so the counts above come from sampling the final state.'
    : 'There are no measurement gates, so QubitVerse sampled the final state anyway to show you counts.';
  return [
    `Here is your circuit, one gate at a time (${describeCircuit(context.circuit)}):`,
    '',
    ...lines,
    '',
    measurement,
  ].join('\n');
}

function explainResult(context: TutorContext): string {
  const sim = context.simulation;
  if (!sim) {
    return 'There is no simulation result to explain yet. Press **Run** in the simulator (or the Run button above) and I will read the counts, the ideal probabilities and the Bloch vectors back to you.';
  }
  const lines: string[] = [];
  const top = significantStates(sim)
    .slice(0, 5)
    .map(entry => `${entry.label} — ideal ${(entry.probability * 100).toFixed(2)}%`);
  lines.push(`State: ${describeState(sim)}.`);
  lines.push(`Ideal probabilities from the state vector: ${top.join(', ')}.`);
  const counts = sim.measurement?.buckets
    ?.slice(0, 5)
    .map(bucket => `${bucket.label} × ${bucket.count} (${(bucket.measuredProbability * 100).toFixed(1)}%)`)
    .join(', ') ?? 'N/A';
  lines.push(
    `Measured over ${sim.shots} shots: ${counts || 'nothing sampled'}. Counts fluctuate by roughly √((p(1−p))/shots) around the ideal values — that is genuine measurement randomness, not an error.`,
  );
  if ((sim.bloch?.some(vector => vector.isMixed) ?? false) && sim.numQubits > 1) {
    lines.push(
      `Notice the Bloch vector lengths: ${sim.bloch
        ?.map((vector, index) => `q${index} ${vector.magnitude.toFixed(2)}`)
        .join(', ') ?? 'N/A'}. Anything below 1 means that qubit is correlated with the rest of the register (entanglement or prior measurement).`,
    );
  }
  const warnings = simulationWarnings(sim);
  if (warnings.length) lines.push(`Warnings: ${warnings.join(' ')}`);
  if (context.simulationStale) {
    lines.push('Careful: the circuit changed after this run, so press Run again before trusting these numbers.');
  }
  return lines.join('\n');
}

function findMistakes(context: TutorContext): string {
  const issues = validateCircuit(context.circuit);
  const problems: string[] = [];

  issues.forEach(issue => problems.push(`Circuit: ${issue.message}`));
  context.lastCodeIssues.forEach(issue => problems.push(`Code: ${issue}`));

  if (context.lastChallengeChecks) {
    context.lastChallengeChecks
      .filter(check => !check.passed)
      .forEach(check => problems.push(`Challenge check “${check.label}”: ${check.detail}`));
  }
  if (context.simulationStale) {
    problems.push('The displayed result is older than the circuit — press Run again before drawing conclusions.');
  }

  const sim = context.simulation;
  if (sim && sim.measurement?.buckets) {
    const impossible = sim.measurement.buckets.filter(
      bucket => bucket.idealProbability < 1e-6 && bucket.count > 0,
    );
    if (impossible.length > 0) {
      problems.push(
        `The counts contain ${impossible
          .map(b => b.label)
          .join(', ')} even though the state gives them probability 0 — rerun to resample.`,
      );
    }
    if (!sim.hasMeasurementGates) {
      problems.push(
        'No measurement gate is present. Shots are still sampled from the final state, but a circuit you submit to a real backend needs explicit measurements.',
      );
    }
    const controlLike = context.circuit.ops.filter(op => op.type === 'CNOT');
    if (context.lesson?.id === 'entanglement' && controlLike.length > 0) {
      const wrongWiring = controlLike.filter(op => op.qubits[0] === 0 && op.qubits[1] === 1);
      if (wrongWiring.length === controlLike.length) {
        problems.push(
          'Your CNOT looks like it has q0 as the target and q1 as the control. For Bell states the control must be the qubit that received the H.',
        );
      }
    }
  }

  // Rules of thumb that catch the most common beginner mistakes.
  const hCount = context.circuit.ops.filter(op => op.type === 'H').length;
  if (sim && hCount === 0 && sim.numQubits > 1 && /entangle|bell/i.test(context.lesson?.title ?? '')) {
    problems.push('There is no Hadamard gate, so nothing is in superposition for the CNOT to entangle.');
  }

  if (problems.length === 0) {
    return `I could not find anything wrong with what you have right now. ${describeCircuit(
      context.circuit,
    )} parses cleanly, and ${
      sim ? `the last run produced ${describeState(sim)}` : 'there is no result yet — press Run to check the state'
    }.`;
  }
  return [`I found ${problems.length} thing${problems.length > 1 ? 's' : ''} to look at:`, '', ...problems.map(p => `• ${p}`)].join('\n');
}

function giveHint(context: TutorContext): string {
  const challenge = context.challenge ?? (context.lesson ? getChallenge(context.lesson.challengeId) : null);
  if (!challenge) {
    return 'You are not inside a challenge right now. Open Practice to pick one, or ask me to explain the circuit you are building and I will suggest the next gate.';
  }
  const hints = challenge.hints ?? [];
  const challengeAttempts = context.challengeAttempts ?? 0;
  const hintIndex = Math.min(challengeAttempts, hints.length - 1);
  const hint = hints[Math.max(0, hintIndex)];
  return [
    `Challenge: ${challenge.title} — ${challenge.brief}`,
    '',
    `Objectives: ${challenge.objectives.map(objective => `• ${objective}`).join(' ')}`,
    '',
    '',
    hint ? `Hint ${hintIndex + 1}/${hints.length}: ${hint}` : 'No hints recorded for this challenge.',
    '',
    `What a passing run needs: ${challenge.expectedOutcome}`,
  ].join('\n');
}

function explainSelectedGate(context: TutorContext, gate: GateType): string {
  const def = GATE_DEFS[gate];
  const lines = [GATE_KNOWLEDGE[gate]];
  if (context.simulation) {
    const used = context.circuit.ops.filter(op => op.type === gate);
    if (used.length > 0) {
      lines.push(
        `Your circuit already applies ${def.label} ${used.length} time(s) (${used
          .map(op => `q${op.qubits.join(', q')}`)
          .join('; ')}). After the last run the register reads ${describeState(context.simulation)}.`,
      );
    }
  }
  lines.push(`Bloch-sphere effect: ${def.blochEffect}`);
  lines.push(`In code: \`${def.toCode(gate === 'CNOT' ? [1, 0] : [0])}\``);
  return lines.join('\n');
}

function conceptAnswer(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  const match = CONCEPT_ANSWERS.find(entry => entry.keywords.some(keyword => lower.includes(keyword)));
  if (!match) return null;
  return match.answer;
}

function improveCircuit(context: TutorContext): string {
  const suggestions = analyseSimplifications(context.circuit);
  const lines: string[] = [];
  if (suggestions.length === 0) {
    lines.push(
      `I do not see a mechanical simplification for ${describeCircuit(context.circuit)}. It has ${context.circuit.ops.length} gate(s) and depth ${context.circuit.ops.length}.`,
    );
  } else {
    lines.push(`Here is what can be simplified without changing the state:`);
    suggestions.forEach(suggestion => lines.push(`• ${suggestion.description}${suggestion.reason ? ` — ${suggestion.reason}` : ''}`));
  }
  lines.push('');
  lines.push('Current code for the circuit:');
  lines.push('```python');
  lines.push(circuitToCode(context.circuit));
  lines.push('```');
  const sim = context.simulation;
  if (sim) {
    lines.push(
      `After simplification the ideal distribution should stay exactly ${formatStates(
        significantStates(sim).map(entry => ({ label: entry.label, probability: entry.probability })),
        3,
      )}.`,
    );
  } else {
    lines.push('Run the circuit before and after so you can compare the distributions yourself.');
  }
  return lines.join('\n');
}

function whyAnswer(context: TutorContext): string {
  const sim = context.simulation;
  const lastGate = [...context.circuit.ops].sort((a, b) => a.column - b.column).pop();
  const parts: string[] = [];
  if (!sim) {
    parts.push(
      'I cannot see a result yet, so let me reason from the circuit: run it and I will give you the exact numbers. Based on the gates present,',
    );
  }
  if (lastGate) {
    const def = GATE_DEFS[lastGate.type];
    parts.push(
      `The last gate applied is ${def.label} on q${lastGate.qubits.join(', q')}. ${def.description}`,
    );
    if (sim && lastGate.type !== 'M') {
      const involvement = sim.qubitProbabilities
        .filter(q => lastGate.qubits.includes(q.qubit))
        .map(q => `q${q.qubit} is now 1 with probability ${(q.p1 * 100).toFixed(1)}%`)
        .join('; ');
      parts.push(`Measured on the current state: ${involvement}.`);
    }
  } else {
    parts.push('The circuit is empty, so the register is still |0…0⟩.');
  }
  if (sim) {
    parts.push(`Overall the register is in ${describeState(sim)}.`);
    const entangling = sim.numQubits > 1 && sim.bloch.some(vector => vector.isMixed);
    if (entangling) {
      parts.push(
        'The individual Bloch vectors are shorter than 1, which is the fingerprint of entanglement: neither qubit has a state of its own.',
      );
    }
  }
  return parts.join(' ');
}

function explainCurrentLessonConcept(context: TutorContext): string {
  const lesson = context.lesson;
  if (!lesson) {
    return `You are not inside a lesson, so here is the short version of what this platform is about: pick a lesson from Learn and I will explain each concept in the order it is introduced. Meanwhile, ${describeCircuit(
      context.circuit,
    )} is loaded in the builder.`;
  }
  const points = lesson.concept.keyPoints.map(point => `• ${point}`).join('\n');
  const keyPoints = lesson.concept.keyPoints.slice(0, 1).join(' ');
  return [
    `${lesson.title}: ${lesson.summary}`,
    '',
    lesson.concept.paragraphs[0],
    '',
    `Key points:`,
    points,
    '',
    keyPoints ? `In your circuit: ${describeCircuit(context.circuit)}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** The rule-based tutor that runs with no API key. */
export function localTutorReply(request: TutorRequest): TutorReply {
  const { context, prompt } = request;
  const action = request.action ?? detectAction(prompt, context);
  const gate = detectGate(prompt);
  let text: string;

  switch (action) {
    case 'explain-circuit':
      text = explainCircuit(context);
      break;
    case 'explain-result':
      text = explainResult(context);
      break;
    case 'mistake':
      text = findMistakes(context);
      break;
    case 'hint':
      text = giveHint(context);
      break;
    case 'improve':
      text = improveCircuit(context);
      break;
    case 'why':
      text = gate ? `${explainSelectedGate(context, gate)}\n\n${whyAnswer(context)}` : whyAnswer(context);
      break;
    case 'explain':
    default: {
      const concept = conceptAnswer(prompt);
      if (gate) {
        text = explainSelectedGate(context, gate);
      } else if (concept) {
        text = concept;
      } else if (context.selectedGate) {
        text = `${explainSelectedGate(context, context.selectedGate as GateType)}\n\n${explainCurrentLessonConcept(
          context,
        )}`;
      } else {
        text = explainCurrentLessonConcept(context);
      }
      break;
    }
  }

  const followUps: string[] = [];
  if (action !== 'explain-circuit') followUps.push('Explain my circuit gate by gate.');
  if (action !== 'explain-result' && context.simulation) followUps.push('Explain my simulation result.');
  if (context.challenge && action !== 'hint') followUps.push('Give me a hint for this challenge.');
  if (action !== 'mistake') followUps.push('Find my mistake in this circuit.');

  return {
    text,
    followUps: followUps.slice(0, 3),
    source: 'local',
    contextSummary: buildContextSummary(context),
  };
}

/** Fallback message used when a remote provider fails. */
export function tutorFallbackText(context: TutorContext): string {
  return `The remote AI provider did not answer, so here is the built-in explanation instead.\n\n${localTutorReply(
    { prompt: '', action: 'explain-result', context },
  ).text}`;
}

export const TUTOR_CAPABILITIES = [
  'Context: current lesson, circuit, selected gate, quantum state, last simulation, challenge and progress',
  'Actions: explain this · why did this happen · find my mistake · give me a hint · explain my circuit · explain the result · improve my code',
  'Modes: built-in local tutor (no API key) or any OpenAI-compatible endpoint configured in Settings',
];

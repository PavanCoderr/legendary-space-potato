import type { AiProviderSettings } from '../data/types';
import { buildContextSummary, localTutorReply, type TutorReply, type TutorRequest } from './tutor';

/**
 * Remote tutor provider.
 *
 * Any OpenAI-compatible chat-completions endpoint works (OpenAI, Azure OpenAI, Groq,
 * Together, Ollama, vLLM …). The live application context is serialised into the system
 * prompt so the model answers about *this* circuit instead of generic quantum theory,
 * and a failure always falls back to the built-in local tutor so the app keeps working
 * without a key.
 */
export function buildSystemPrompt(request: TutorRequest): string {
  const { context } = request;
  const lines: string[] = [
    'You are the QubitVerse quantum computing tutor. Be concrete, beginner friendly and concise (max 200 words).',
    'Use the JSON context below, which describes exactly what the learner is looking at right now.',
    'Never invent measurement counts: only use the numbers in the context.',
    'If the learner made a mistake, name the gate and the wire.',
    '',
    'Context:',
    JSON.stringify(
      {
        route: context.route,
        lesson: context.lesson ? { id: context.lesson.id, title: context.lesson.title, summary: context.lesson.summary } : null,
        challenge: context.challenge
          ? { id: context.challenge.id, title: context.challenge.title, objectives: context.challenge.objectives }
          : null,
        circuit: {
          numQubits: context.circuit.numQubits,
          ops: context.circuit.ops.map(op => ({ gate: op.type, qubits: op.qubits, column: op.column })),
        },
        selectedGate: context.selectedGate,
        simulation: context.simulation
          ? {
              shots: context.simulation.shots,
              stale: context.simulationStale,
              probabilities: context.simulation.probabilities
                .filter(entry => entry.probability > 1e-9)
                .map(entry => ({ state: entry.label, probability: Number(entry.probability.toFixed(4)) })),
              counts: context.simulation.measurement.buckets.map(bucket => ({ state: bucket.label, count: bucket.count })),
              bloch: context.simulation.bloch.map((vector, index) => ({
                qubit: index,
                x: Number(vector.x.toFixed(3)),
                y: Number(vector.y.toFixed(3)),
                z: Number(vector.z.toFixed(3)),
                magnitude: Number(vector.magnitude.toFixed(3)),
              })),
            }
          : null,
        failingChecks: context.lastChallengeChecks?.filter(check => !check.passed).map(check => check.detail) ?? [],
        codeIssues: context.lastCodeIssues,
        progress: context.progress,
        xp: context.xp,
        streak: context.streak,
      },
      null,
      1,
    ),
  ];
  return lines.join('\n');
}

export async function remoteTutorReply(
  request: TutorRequest,
  provider: AiProviderSettings,
): Promise<TutorReply> {
  const contextSummary = buildContextSummary(request.context);
  if (!provider.apiKey.trim()) {
    return {
      ...localTutorReply(request),
      error: 'No API key configured — answered with the built-in tutor. Add a key in Settings to use your own model.',
    };
  }
  const url = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: provider.temperature,
        messages: [
          { role: 'system', content: buildSystemPrompt(request) },
          { role: 'user', content: request.prompt || 'Explain my current circuit and result.' },
        ],
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`${response.status} ${response.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ''}`);
    }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('The provider returned an empty message.');
    return { text, followUps: [], source: 'remote', contextSummary };
  } catch (error) {
    const fallback = localTutorReply(request);
    return {
      ...fallback,
      text: `${fallback.text}`,
      error: `Remote provider failed (${error instanceof Error ? error.message : String(error)}). Showing the built-in answer instead.`,
    };
  }
}

import type { Topic, TopicId } from './types';

export const TOPICS: Topic[] = [
  {
    id: 'fundamentals',
    name: 'Quantum Fundamentals',
    shortName: 'Fundamentals',
    description: 'Qubits, superposition, entanglement and measurement.',
    color: '#7c5cff',
  },
  {
    id: 'gates',
    name: 'Quantum Gates',
    shortName: 'Gates',
    description: 'Unitary operations and how they move the state vector.',
    color: '#3ba7ff',
  },
  {
    id: 'circuit-building',
    name: 'Circuit Building',
    shortName: 'Circuits',
    description: 'Assembling, running and debugging quantum circuits.',
    color: '#00d1d1',
  },
  {
    id: 'algorithms',
    name: 'Algorithms',
    shortName: 'Algorithms',
    description: 'Interference-based algorithms such as Grover and Deutsch–Jozsa.',
    color: '#ff8a3d',
  },
  {
    id: 'programming',
    name: 'Programming',
    shortName: 'Programming',
    description: 'Writing circuits as Qiskit-style quantum code.',
    color: '#2fd3a5',
  },
];

export const TOPIC_MAP: Record<TopicId, Topic> = TOPICS.reduce(
  (acc, topic) => ({ ...acc, [topic.id]: topic }),
  {} as Record<TopicId, Topic>,
);

export function topicName(id: TopicId): string {
  return TOPIC_MAP[id]?.shortName ?? id;
}

export function topicColor(id: TopicId): string {
  return TOPIC_MAP[id]?.color ?? '#7c5cff';
}

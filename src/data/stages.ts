import {
  BookOpenCheck,
  CirclePlay,
  Eye,
  Flag,
  FlaskConical,
  MessageCircleQuestion,
  Target,
  type LucideIcon,
} from 'lucide-react';

export interface LessonStage {
  id: 'learn' | 'watch' | 'visualize' | 'experiment' | 'ask-ai' | 'practice' | 'complete';
  label: string;
  icon: LucideIcon;
  /** One line, shown beside the stage in the lesson rail. */
  hint: string;
  /** What actually happens at this stage, for the landing page and the lesson header. */
  detail: string;
}

/**
 * The seven stages of a QubitVerse module, in order.
 *
 * This is the single definition: the lesson rail, the stage anchors, the "what next" card and
 * the landing page walkthrough all read from it, so the flow can never be described two
 * different ways in two places.
 */
export const LESSON_STAGES: readonly LessonStage[] = [
  {
    id: 'learn',
    label: 'Learn',
    icon: BookOpenCheck,
    hint: 'Read the concept',
    detail:
      'A short explanation with formula cards and expandable asides, ending with the two or three points you are expected to walk away with.',
  },
  {
    id: 'watch',
    label: 'Watch',
    icon: CirclePlay,
    hint: 'Teaching video',
    detail: 'One teaching video per module, with chapters you can jump between and a watched checkpoint.',
  },
  {
    id: 'visualize',
    label: 'Visualize',
    icon: Eye,
    hint: 'State, probabilities and Bloch sphere',
    detail:
      'The state written in Dirac notation, its amplitudes, the measurement distribution and the Bloch vector — updating as you change the circuit.',
  },
  {
    id: 'experiment',
    label: 'Experiment',
    icon: FlaskConical,
    hint: 'Build it yourself',
    detail:
      'The module starts you from the gate it is teaching. Add gates, delete them, run the circuit and watch the numbers move.',
  },
  {
    id: 'ask-ai',
    label: 'Ask AI',
    icon: MessageCircleQuestion,
    hint: 'Why did this happen?',
    detail:
      'The tutor is given your circuit, the selected gate, the state and the simulation result before it answers, so "why did I get 50%?" is answered against your run.',
  },
  {
    id: 'practice',
    label: 'Practice',
    icon: Target,
    hint: 'Quiz and challenge',
    detail:
      'A quiz question on the concept and a circuit challenge that is checked by simulating what you built, not by matching a gate list.',
  },
  {
    id: 'complete',
    label: 'Complete',
    icon: Flag,
    hint: 'Earn the XP',
    detail: 'The module closes with XP, an updated streak and the next module unlocked.',
  },
] as const;

export type StageId = (typeof LESSON_STAGES)[number]['id'];

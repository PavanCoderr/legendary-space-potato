import { CHALLENGES } from '../data/challenges';
import { GLOSSARY } from '../data/glossary';
import { LESSONS } from '../data/lessons';
import { QUIZZES } from '../data/quizzes';

/**
 * Global search.
 *
 * The index is built from the same data the pages render (lessons, their teaching videos,
 * challenges, the quiz bank and the glossary), so search can never drift from the
 * curriculum. Results are grouped the way the spec asks: Lessons · Videos · Practice ·
 * Concepts.
 */
export type SearchGroupId = 'lessons' | 'videos' | 'practice' | 'concepts';

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  /** Extra terms that should match this hit without being displayed. */
  keywords: string;
}

export interface SearchGroup {
  id: SearchGroupId;
  label: string;
  hits: SearchHit[];
}

const INDEX: Record<SearchGroupId, SearchHit[]> = {
  lessons: LESSONS.map(lesson => ({
    id: `lesson-${lesson.id}`,
    title: lesson.title,
    subtitle: lesson.summary,
    href: `#/lesson/${lesson.id}`,
    badge: `${lesson.minutes} min · ${lesson.level}`,
    keywords: [lesson.id, lesson.title, lesson.summary, lesson.objectives.join(' '), lesson.topic].join(' '),
  })),

  videos: LESSONS.map(lesson => ({
    id: `video-${lesson.id}`,
    title: lesson.video.title,
    subtitle: lesson.video.summary,
    href: `#/lesson/${lesson.id}`,
    badge: `Video · ${lesson.video.duration}`,
    keywords: [lesson.video.title, lesson.video.summary, lesson.video.chapters.map(c => c.label).join(' '), lesson.title].join(' '),
  })),

  practice: [
    ...CHALLENGES.map(challenge => ({
      id: `challenge-${challenge.id}`,
      title: challenge.title,
      subtitle: challenge.brief,
      href: `#/practice/${challenge.id}`,
      badge: `Challenge · ${challenge.difficulty}`,
      keywords: [challenge.title, challenge.brief, challenge.objectives.join(' '), challenge.expectedOutcome].join(' '),
    })),
    ...QUIZZES.map(quiz => ({
      id: `quiz-${quiz.id}`,
      title: quiz.question,
      subtitle: quiz.explanation,
      href: `#/lesson/${quiz.lessonId}`,
      badge: 'Quiz question',
      keywords: [quiz.question, quiz.options.join(' '), quiz.explanation].join(' '),
    })),
  ],

  concepts: [
    ...GLOSSARY.map(entry => ({
      id: `concept-${entry.term}`,
      title: entry.term,
      subtitle: entry.definition,
      href: entry.href,
      badge: 'Concept',
      keywords: [entry.term, entry.aliases.join(' '), entry.definition].join(' '),
    })),
    ...LESSONS.flatMap(lesson =>
      lesson.concept.keyPoints.map((point, index) => ({
        id: `keypoint-${lesson.id}-${index}`,
        title: point,
        subtitle: `Key point from ${lesson.title}`,
        href: `#/lesson/${lesson.id}`,
        badge: 'Key point',
        keywords: point,
      })),
    ),
  ],
};

export const SEARCH_GROUP_LABELS: Record<SearchGroupId, string> = {
  lessons: 'Lessons',
  videos: 'Videos',
  practice: 'Practice',
  concepts: 'Concepts',
};

/** Suggested searches shown before the learner types anything. */
export const SEARCH_SUGGESTIONS = ['qubit', 'superposition', 'H gate', 'CNOT', 'Grover', 'entanglement'];

function score(hit: SearchHit, tokens: string[], rawQuery: string): number {
  const haystack = `${hit.title} ${hit.subtitle} ${hit.keywords}`.toLowerCase();
  const title = hit.title.toLowerCase();
  if (!tokens.every(token => haystack.includes(token))) return 0;

  let value = 1;
  if (title === rawQuery) value += 8;
  else if (title.startsWith(rawQuery)) value += 5;
  else if (title.includes(rawQuery)) value += 3;
  // Whole-word matches beat partial ones so "H gate" does not outrank "Hadamard gate".
  value += tokens.filter(token => new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(haystack)).length;
  return value;
}

/**
 * Searches every group. A hit is kept when all query tokens appear somewhere in it, which
 * makes multi-word queries such as "grover amplitude" behave sensibly.
 */
export function searchAll(query: string, limitPerGroup = 5): SearchGroup[] {
  const rawQuery = query.trim().toLowerCase();
  if (rawQuery.length < 1) return [];
  const tokens = rawQuery.split(/\s+/).filter(Boolean);

  return (Object.keys(INDEX) as SearchGroupId[])
    .map(id => {
      const hits = INDEX[id]
        .map(hit => ({ hit, value: score(hit, tokens, rawQuery) }))
        .filter(entry => entry.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, limitPerGroup)
        .map(entry => entry.hit);
      return { id, label: SEARCH_GROUP_LABELS[id], hits };
    })
    .filter(group => group.hits.length > 0);
}

export function totalHits(groups: SearchGroup[]): number {
  return groups.reduce((sum, group) => sum + group.hits.length, 0);
}

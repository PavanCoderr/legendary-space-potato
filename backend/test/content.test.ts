import { describe, expect, it } from 'vitest';
import { LESSONS } from '../src/data/lessons';
import { QUIZZES } from '../src/data/quizzes';
import { CHALLENGES } from '../src/data/challenges';
import { GLOSSARY } from '../src/data/glossary';

/**
 * E2 content sanity + E3 two-tree drift guard (backend copy).
 *
 * Mirror of `src/data/content.test.ts`. The drift tests import the FRONTEND tree
 * from the backend side, so any edit made in one tree only fails loudly in BOTH
 * test suites. Fields that differ by design (icon component vs name string,
 * runtime vs serialized circuits) are skipped.
 *
 * The E1 marker test is RED until the qubits-1 explanation is fixed in this tree —
 * per plan E2 acceptance: "the test fails on the pre-E1 text and passes after E1".
 */

// ── E2: quiz sanity ─────────────────────────────────────────────────────────

const STATE_LITERAL = /(-?\d*\.?\d+)\s*\|0⟩\s*\+\s*(-?\d*\.?\d+)\s*\|1⟩/g;

function normalisationViolations(text: string): string[] {
  const problems: string[] = [];
  for (const match of text.matchAll(STATE_LITERAL)) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    const sum = a * a + b * b;
    if (Math.abs(sum - 1) > 1e-9) {
      problems.push(`|${a}|² + |${b}|² = ${sum} ≠ 1 in "${text}"`);
    }
  }
  return problems;
}

describe('Quiz content sanity (E2, backend tree)', () => {
  it('has unique quiz ids', () => {
    const ids = QUIZZES.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every quiz has valid options, a valid correctIndex, and a normalised question state', () => {
    for (const quiz of QUIZZES) {
      expect(quiz.options.length, `${quiz.id}: needs options`).toBeGreaterThan(1);
      for (const option of quiz.options) {
        expect(option.trim().length, `${quiz.id}: empty option`).toBeGreaterThan(0);
      }
      expect(quiz.correctIndex, `${quiz.id}: correctIndex out of range`).toBeGreaterThanOrEqual(0);
      expect(quiz.correctIndex, `${quiz.id}: correctIndex out of range`).toBeLessThan(
        quiz.options.length,
      );
      expect(quiz.xp, `${quiz.id}: xp must be positive`).toBeGreaterThan(0);
      const problems = normalisationViolations(quiz.question);
      expect(problems, `${quiz.id}: ${problems.join('; ')}`).toEqual([]);
    }
  });

  it('every quiz belongs to an existing lesson', () => {
    const lessonIds = new Set(LESSONS.map(l => l.id));
    for (const quiz of QUIZZES) {
      expect(
        lessonIds.has(quiz.lessonId),
        `${quiz.id}: lessonId "${quiz.lessonId}" has no lesson`,
      ).toBe(true);
    }
  });
});

describe('Lesson and reference content sanity (E2, backend tree)', () => {
  it('lesson ids, quizIds and challengeIds all resolve', () => {
    const lessonIds = new Set(LESSONS.map(l => l.id));
    const quizIds = new Set(QUIZZES.map(q => q.id));
    const challengeIds = new Set(CHALLENGES.map(c => c.id));

    for (const lesson of LESSONS) {
      expect(lesson.xp, `${lesson.id}: xp must be positive`).toBeGreaterThan(0);
      for (const quizId of lesson.quizIds) {
        expect(quizIds.has(quizId), `${lesson.id}: unknown quizId "${quizId}"`).toBe(true);
      }
      expect(
        challengeIds.has(lesson.challengeId),
        `${lesson.id}: unknown challengeId "${lesson.challengeId}"`,
      ).toBe(true);
      if (lesson.nextLessonId !== null) {
        expect(
          lessonIds.has(lesson.nextLessonId),
          `${lesson.id}: unknown nextLessonId "${lesson.nextLessonId}"`,
        ).toBe(true);
      }
      expect(lesson.video.youtubeId, `${lesson.id}: missing video.youtubeId`).not.toBe('');
    }
  });

  it('glossary terms are unique with non-empty definitions', () => {
    const terms = GLOSSARY.map(g => g.term);
    expect(new Set(terms).size).toBe(terms.length);
    const lessonIds = new Set(LESSONS.map(l => l.id));
    for (const entry of GLOSSARY) {
      expect(entry.definition.trim().length, `${entry.term}: empty definition`).toBeGreaterThan(0);
      expect(lessonIds.has(entry.lessonId), `${entry.term}: unknown lessonId`).toBe(true);
    }
  });
});

// ── E3: drift guard (backend side) ─────────────────────────────────────────

// Frontend copies — the reference. `../../src` from backend/test → <root>/src.
// Importing the frontend data modules may pull in lucide-react (icon components);
// if that breaks under node, vite's SSR transform handles the ESM import without
// evaluating React rendering, so plain-data imports are safe here.
import {
  LESSONS as FRONTEND_LESSONS,
  TOTAL_LESSON_XP,
} from '../../src/data/lessons';
import { QUIZZES as FRONTEND_QUIZZES } from '../../src/data/quizzes';
import { CHALLENGES as FRONTEND_CHALLENGES } from '../../src/data/challenges';
import { GLOSSARY as FRONTEND_GLOSSARY } from '../../src/data/glossary';

describe('Two-tree content drift (E3, backend side)', () => {
  it('quizzes are identical between backend/src/data and src/data', () => {
    expect(QUIZZES.map(pickQuizFields)).toEqual(FRONTEND_QUIZZES.map(pickQuizFields));
  });

  it('lessons are identical on content-critical fields', () => {
    expect(LESSONS.map(pickLessonFields)).toEqual(FRONTEND_LESSONS.map(pickLessonFields));
  });

  it('challenges are identical on content-critical fields', () => {
    expect(CHALLENGES.map(pickChallengeFields)).toEqual(
      FRONTEND_CHALLENGES.map(pickChallengeFields),
    );
  });

  it('glossary is identical between the two trees', () => {
    expect(GLOSSARY).toEqual(FRONTEND_GLOSSARY);
  });

  it('TOTAL_LESSON_XP equals the sum of lesson xp (frontend helper stays in sync)', () => {
    expect(TOTAL_LESSON_XP).toBe(FRONTEND_LESSONS.reduce((sum, l) => sum + l.xp, 0));
  });
});

function pickQuizFields(q: (typeof QUIZZES)[number]) {
  return {
    id: q.id,
    lessonId: q.lessonId,
    topic: q.topic,
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    xp: q.xp,
  };
}

function pickLessonFields(l: (typeof LESSONS)[number]) {
  return {
    id: l.id,
    title: l.title,
    topic: l.topic,
    level: l.level,
    minutes: l.minutes,
    xp: l.xp,
    summary: l.summary,
    prerequisites: l.prerequisites,
    objectives: l.objectives,
    videoYoutubeId: l.video.youtubeId,
    videoTitle: l.video.title,
    quizIds: l.quizIds,
    challengeId: l.challengeId,
    nextLessonId: l.nextLessonId,
  };
}

function pickChallengeFields(c: (typeof CHALLENGES)[number]) {
  return {
    id: c.id,
    lessonId: c.lessonId,
    topic: c.topic,
    title: c.title,
    difficulty: c.difficulty,
    xp: c.xp,
    brief: c.brief,
    objectives: c.objectives,
    hints: c.hints,
    shots: c.shots,
    expectedOutcome: c.expectedOutcome,
    solutionCode: c.solutionCode,
  };
}

// ── E1 marker (RED until E1 applied in this tree) ──────────────────────────

describe('E1 marker — qubits-1 explanation', () => {
  it('does not imply the normalised state 0.6|0⟩ + 0.8|1⟩ is invalid', () => {
    const quiz = QUIZZES.find(q => q.id === 'qubits-1');
    expect(quiz).toBeDefined();
    expect(quiz!.explanation).not.toContain('0.6 + 0.8 ≠ 1');
    expect(quiz!.explanation).toContain('properly normalised');
  });
});

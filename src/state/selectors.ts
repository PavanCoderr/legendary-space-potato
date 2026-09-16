import { levelForXp } from '../data/achievements';
import { LESSONS, LESSON_MAP } from '../data/lessons';
import { TOPICS } from '../data/topics';
import type { AchievementStats, Lesson, LessonProgress, Project, TopicId } from '../data/types';
import { CHALLENGES } from '../data/challenges';
import { dayKey, blankProgress } from './defaults';
import type { AppState } from './types';

export function lessonProgressOf(state: AppState, lessonId: string): LessonProgress {
  return state.progress[lessonId] ?? blankProgress(lessonId);
}

export function completedLessonIds(state: AppState): string[] {
  return LESSONS.filter(lesson => lessonProgressOf(state, lesson.id).status === 'completed').map(l => l.id);
}

export function startedLessonIds(state: AppState): string[] {
  return LESSONS.filter(lesson => lessonProgressOf(state, lesson.id).status !== 'not-started').map(l => l.id);
}

export function isLessonUnlocked(state: AppState, lesson: Lesson): boolean {
  if (!lesson.locked && lesson.prerequisites.length === 0) return true;
  return lesson.prerequisites.every(id => lessonProgressOf(state, id).status === 'completed');
}

/**
 * Lesson the dashboard should offer next: the one currently open, otherwise the first
 * started-but-unfinished lesson, otherwise the next uncompleted lesson in curriculum order.
 */
export function continueLesson(state: AppState): Lesson {
  if (state.currentLessonId) {
    const current = LESSON_MAP[state.currentLessonId];
    if (current && lessonProgressOf(state, current.id).status !== 'completed') return current;
  }
  const started = LESSONS.find(lesson => lessonProgressOf(state, lesson.id).status === 'in-progress');
  if (started) return started;
  const uncompleted = LESSONS.find(lesson => lessonProgressOf(state, lesson.id).status !== 'completed');
  return uncompleted ?? LESSONS[LESSONS.length - 1];
}

export function recommendedLesson(state: AppState): Lesson {
  const done = completedLessonIds(state);
  const next = LESSONS.find(lesson => !done.includes(lesson.id) && isLessonUnlocked(state, lesson));
  return next ?? LESSONS[LESSONS.length - 1];
}

/**
 * How much of a lesson is done.
 *
 * Six checkpoints, mirroring the seven stages of the lesson timeline (concept, video,
 * experiment, simulation, practice, completion). The video counts towards progress but
 * never blocks automatic completion — a learner who skips it can still finish.
 */
export function lessonCompletionPercent(state: AppState, lessonId: string): number {
  const progress = lessonProgressOf(state, lessonId);
  const steps = [
    progress.conceptRead,
    progress.videoWatched,
    progress.interactiveDone,
    progress.simulationRun,
    progress.quizTotal > 0 && progress.quizCorrect === progress.quizTotal,
    progress.challengePassed,
  ];
  const done = steps.filter(Boolean).length;
  return Math.round((done / steps.length) * 100);
}

export function streakOf(state: AppState): number {
  const days = [...new Set(state.activity.activeDays)].sort().reverse();
  if (days.length === 0) return 0;
  const today = dayKey();
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  if (days[0] !== today && days[0] !== yesterday) return 0;
  let streak = 0;
  let cursor = new Date(days[0]);
  for (const day of days) {
    if (day === dayKey(cursor)) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 86400000);
    } else {
      break;
    }
  }
  return streak;
}

export function quizStats(state: AppState) {
  const attempts = state.quizAttempts;
  const correct = attempts.filter(a => a.correct).length;
  const uniqueCorrect = new Set(attempts.filter(a => a.correct).map(a => a.quizId)).size;
  return {
    attempts: attempts.length,
    correct,
    uniqueCorrect,
    accuracy: attempts.length === 0 ? 0 : correct / attempts.length,
  };
}

export interface TopicMastery {
  topic: TopicId;
  name: string;
  color: string;
  mastery: number;
  lessonsTotal: number;
  lessonsCompleted: number;
  quizAccuracy: number;
  challengesPassed: number;
  challengesTotal: number;
}

export function topicMastery(state: AppState): TopicMastery[] {
  return TOPICS.map(topic => {
    const lessons = LESSONS.filter(lesson => lesson.topic === topic.id);
    const completed = lessons.filter(lesson => lessonProgressOf(state, lesson.id).status === 'completed');
    const lessonScore = lessons.length
      ? lessons.reduce((sum, lesson) => sum + lessonCompletionPercent(state, lesson.id) / 100, 0) / lessons.length
      : 0;
    const quizIds = new Set(
      lessons.flatMap(lesson =>
        state.quizAttempts.filter(a => a.lessonId === lesson.id).map(a => a.quizId),
      ),
    );
    const quizCorrect = new Set(
      state.quizAttempts.filter(a => a.correct && quizIds.has(a.quizId)).map(a => a.quizId),
    );
    const quizAccuracy = quizIds.size ? quizCorrect.size / quizIds.size : 0;
    const challenges = CHALLENGES.filter(challenge => challenge.topic === topic.id);
    const challengesPassed = challenges.filter(challenge =>
      state.challengeAttempts.some(a => a.challengeId === challenge.id && a.passed),
    ).length;
    const challengeScore = challenges.length ? challengesPassed / challenges.length : 0;
    const mastery = Math.round((lessonScore * 0.5 + quizAccuracy * 0.3 + challengeScore * 0.2) * 100);
    return {
      topic: topic.id,
      name: topic.name,
      color: topic.color,
      mastery,
      lessonsTotal: lessons.length,
      lessonsCompleted: completed.length,
      quizAccuracy,
      challengesPassed,
      challengesTotal: challenges.length,
    };
  });
}

export function achievementStatsOf(state: AppState): AchievementStats {
  const completed = completedLessonIds(state);
  return {
    lessonsCompleted: completed.length,
    completedLessons: completed,
    lessonsStarted: startedLessonIds(state).length,
    quizzesCorrect: state.quizAttempts.filter(a => a.correct).length,
    quizzesTaken: state.quizAttempts.length,
    challengesPassed: new Set(
      state.challengeAttempts.filter(a => a.passed).map(a => a.challengeId),
    ).size,
    simulations: state.activity.simulations,
    projectsCreated: state.projects.length,
    xp: state.user.xp,
    streak: streakOf(state),
    entanglementsBuilt: state.entanglementsBuilt,
  };
}

/** XP earned by the user, including achievement bonuses, and the derived level. */
export function levelInfo(state: AppState) {
  const bonus = state.achievements.reduce((sum, id) => {
    return sum + (ACHIEVEMENT_BONUS[id] ?? 0);
  }, 0);
  const totalXp = state.user.xp + bonus;
  return { ...levelForXp(totalXp), totalXp };
}

const ACHIEVEMENT_BONUS: Record<string, number> = {
  'first-steps': 10,
  'superposition-master': 25,
  entangler: 30,
  'simulator-runner': 20,
  'quiz-ace': 30,
  challenger: 40,
  'project-builder': 25,
  'on-a-streak': 35,
  'curriculum-complete': 100,
};

export interface SkillScore {
  key: string;
  label: string;
  value: number;
  hint: string;
}

/**
 * Per-skill scores.
 *
 * Every skill is derived from real recorded activity (checkpoints, simulations, quiz and
 * challenge results) and the hint spells out the formula, so the number is never a
 * mysterious score.
 */
export function skillsBreakdown(state: AppState): SkillScore[] {
  const lessonsTotal = LESSONS.length;
  const conceptReads = LESSONS.filter(lesson => lessonProgressOf(state, lesson.id).conceptRead).length;
  const labs = LESSONS.filter(lesson => lessonProgressOf(state, lesson.id).interactiveDone).length;
  const quizzes = quizStats(state);
  const challengePasses = new Set(
    state.challengeAttempts.filter(attempt => attempt.passed).map(attempt => attempt.challengeId),
  ).size;
  const challengeRate = CHALLENGES.length ? challengePasses / CHALLENGES.length : 0;
  const simulations = state.activity.simulations;
  const clamp = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 100);

  return [
    {
      key: 'concept',
      label: 'Concept Understanding',
      value: clamp(0.6 * (conceptReads / lessonsTotal) + 0.4 * quizzes.accuracy),
      hint: '60% concepts marked as read · 40% quiz accuracy',
    },
    {
      key: 'circuit',
      label: 'Circuit Building',
      value: clamp(0.7 * challengeRate + 0.3 * (labs / lessonsTotal)),
      hint: '70% challenges passed · 30% interactive labs completed',
    },
    {
      key: 'simulation',
      label: 'Simulation',
      value: clamp(simulations / 20),
      hint: `${simulations} run(s) — 20 runs is full marks`,
    },
    {
      key: 'maths',
      label: 'Quantum Mathematics',
      value: clamp(quizzes.accuracy),
      hint: 'Accuracy across the quiz bank (amplitudes, the Born rule, gate identities)',
    },
    {
      key: 'problem-solving',
      label: 'Problem Solving',
      value: clamp(0.5 * challengeRate + 0.3 * quizzes.accuracy + 0.2 * Math.min(1, state.projects.length / 3)),
      hint: '50% challenges · 30% quizzes · 20% saved projects',
    },
  ];
}

export interface ActivityItem {
  id: string;
  at: string;
  title: string;
  detail: string;
  href: string;
  tone: 'good' | 'accent' | 'warn' | 'default';
}

/**
 * Recent activity feed, rebuilt from what actually happened (quiz attempts, challenge
 * submissions and lesson completions) rather than a separate hand-written log.
 */
export function recentActivity(state: AppState, limit = 6): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const attempt of state.quizAttempts) {
    const lesson = LESSON_MAP[attempt.lessonId];
    items.push({
      id: `quiz-${attempt.id}`,
      at: attempt.attemptedAt,
      title: `${attempt.correct ? 'Correct answer' : 'Wrong answer'} in the ${lesson?.title ?? attempt.lessonId} quiz`,
      detail: attempt.correct ? 'Feedback and the explanation were shown immediately.' : 'Review the explanation and try the other options.',
      href: `#/lesson/${attempt.lessonId}`,
      tone: attempt.correct ? 'good' : 'warn',
    });
  }

  for (const attempt of state.challengeAttempts) {
    const challenge = CHALLENGES.find(entry => entry.id === attempt.challengeId);
    const passed = attempt.checks.filter(check => check.passed).length;
    items.push({
      id: `challenge-${attempt.id}`,
      at: attempt.attemptedAt,
      title: `${attempt.passed ? 'Passed' : 'Attempted'} challenge: ${challenge?.title ?? attempt.challengeId}`,
      detail: `${passed}/${attempt.checks.length} checks passed${attempt.xpAwarded > 0 ? ` · +${attempt.xpAwarded} XP` : ''}`,
      href: `#/practice/${attempt.challengeId}`,
      tone: attempt.passed ? 'good' : 'accent',
    });
  }

  for (const lesson of LESSONS) {
    const progress = lessonProgressOf(state, lesson.id);
    if (!progress.completedAt) continue;
    items.push({
      id: `lesson-${lesson.id}`,
      at: progress.completedAt,
      title: `Completed ${lesson.title}`,
      detail: `+${lesson.xp} XP · ${lesson.outline.length} lessons covered`,
      href: `#/lesson/${lesson.id}`,
      tone: 'good',
    });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export function recentProjects(state: AppState, count = 3): Project[] {
  return [...state.projects]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, count);
}

export function dashboardStats(state: AppState) {
  const level = levelInfo(state);
  const quizzes = quizStats(state);
  const mastery = topicMastery(state);
  const completed = completedLessonIds(state);
  const challengesPassed = new Set(
    state.challengeAttempts.filter(a => a.passed).map(a => a.challengeId),
  ).size;
  const overallMastery = mastery.length
    ? Math.round(mastery.reduce((sum, topic) => sum + topic.mastery, 0) / mastery.length)
    : 0;
  return {
    level,
    quizzes,
    mastery,
    overallMastery,
    lessonsCompleted: completed.length,
    lessonsTotal: LESSONS.length,
    lessonPercent: Math.round((completed.length / LESSONS.length) * 100),
    streak: streakOf(state),
    simulations: state.activity.simulations,
    challengesPassed,
    challengesTotal: CHALLENGES.length,
    projects: state.projects.length,
    activeDays: state.activity.activeDays.length,
    totalShots: state.activity.totalShots,
  };
}


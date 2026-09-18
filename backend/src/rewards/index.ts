import { v4 as uuidv4 } from 'uuid';
import { getDb, type SqliteDatabase } from '../db';
import { LESSONS } from '../data/lessons';
import { QUIZZES } from '../data/quizzes';
import { CHALLENGES } from '../data/challenges';
import { dayKey } from '../utils/dates';

export interface XpAward {
  amount: number;
  reason: string;
  sourceType: 'lesson_complete' | 'quiz_correct' | 'challenge_passed' | 'achievement_bonus';
  sourceId?: string;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  xpBonus: number;
  isUnlocked: (stats: AggregatedStats) => boolean;
}

/** XP values mirror the frontend lesson/quiz/challenge data. */
const LESSON_XP: Record<string, number> = Object.fromEntries(
  LESSONS.map(l => [l.id, l.xp])
);
const QUIZ_XP: Record<string, number> = Object.fromEntries(
  QUIZZES.map(q => [q.id, q.xp])
);
const CHALLENGE_XP: Record<string, number> = Object.fromEntries(
  CHALLENGES.map(c => [c.id, c.xp])
);

/**
 * Achievement definitions. These mirror `src/data/achievements.ts` but are
 * expressed as pure predicates over server-side aggregated stats, so they can
 * be re-evaluated at any point without trusting the client.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-steps',
    name: 'First Steps',
    description: 'Open your first module.',
    xpBonus: 10,
    isUnlocked: stats => stats.lessonsStarted >= 1,
  },
  {
    id: 'superposition-master',
    name: 'Superposition Master',
    description: 'Finish the Superposition module.',
    xpBonus: 25,
    isUnlocked: stats => stats.completedLessons.includes('superposition'),
  },
  {
    id: 'entangler',
    name: 'Entangler',
    description: 'Build a circuit whose qubits are entangled.',
    xpBonus: 30,
    isUnlocked: stats => stats.entanglementsBuilt,
  },
  {
    id: 'simulator-runner',
    name: 'Simulator Runner',
    description: 'Run five simulations.',
    xpBonus: 20,
    isUnlocked: stats => stats.simulations >= 5,
  },
  {
    id: 'quiz-ace',
    name: 'Quiz Ace',
    description: 'Answer eight quiz questions correctly.',
    xpBonus: 30,
    isUnlocked: stats => stats.quizzesCorrect >= 8,
  },
  {
    id: 'challenger',
    name: 'Challenger',
    description: 'Pass three practice challenges.',
    xpBonus: 40,
    isUnlocked: stats => stats.challengesPassed >= 3,
  },
  {
    id: 'project-builder',
    name: 'Project Builder',
    description: 'Save three circuits to your project list.',
    xpBonus: 25,
    isUnlocked: stats => stats.projectsCreated >= 3,
  },
  {
    id: 'on-a-streak',
    name: 'On a Streak',
    description: 'Practise on three different days.',
    xpBonus: 35,
    isUnlocked: stats => stats.streak >= 3,
  },
  {
    id: 'curriculum-complete',
    name: 'Quantum Graduate',
    description: 'Finish every module in the curriculum.',
    xpBonus: 100,
    isUnlocked: stats => stats.completedLessons.length >= LESSONS.length,
  },
];

/** Aggregated stats used to evaluate achievement predicates. */
export interface AggregatedStats {
  lessonsCompleted: number;
  completedLessons: string[];
  lessonsStarted: number;
  quizzesCorrect: number;
  quizzesTaken: number;
  challengesPassed: number;
  simulations: number;
  projectsCreated: number;
  xp: number;
  streak: number;
  entanglementsBuilt: boolean;
}

/** Learner level derived from XP — 100 XP per level, growing slightly with each level. */
export function levelForXp(xp: number): { level: number; label: string; intoLevel: number; needed: number } {
  let level = 1;
  let remaining = xp;
  let needed = 100;
  while (remaining >= needed && level < 99) {
    remaining -= needed;
    level += 1;
    needed = 100 + (level - 1) * 25;
  }
  const labels = ['Observer', 'Tinkerer', 'Circuit Builder', 'Gate Wrangler', 'Entangler', 'Algorithmist', 'Quantum Engineer'];
  return {
    level,
    label: labels[Math.min(labels.length - 1, Math.floor((level - 1) / 1.5))],
    intoLevel: remaining,
    needed,
  };
}

/**
 * Award XP to a user. Records the award in the xp_ledger, updates the user's
 * xp total, and re-evaluates achievements. Newly unlocked achievements get
 * their xp bonus applied and recorded in user_achievements.
 *
 * Returns the full updated user state: xp, streak, achievements unlocked.
 */
export async function awardXp(
  userId: string,
  award: XpAward,
): Promise<{ xp: number; streak: number; newlyUnlocked: string[] }> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.run('BEGIN');

  try {
    // Record the XP award in the ledger
    await db.run(
      `INSERT INTO xp_ledger (id, user_id, amount, reason, source_type, source_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      uuidv4(),
      userId,
      award.amount,
      award.reason,
      award.sourceType,
      award.sourceId ?? null,
      now,
    );

    // Update user's total XP
    await db.run(
      `UPDATE users SET xp = xp + ?, updated_at = ? WHERE id = ?`,
      award.amount,
      now,
      userId,
    );

    // Update streak (active days) — register today as an active day
    await updateStreak(db, userId, now);

    // Re-evaluate achievements
    const newlyUnlocked = await evaluateAndRecordAchievements(db, userId, now);

    await db.run('COMMIT');

    // Fetch updated user
    const user = await db.get<{ xp: number; streak: number }>(
      'SELECT xp, streak FROM users WHERE id = ?',
      userId,
    );

    return {
      xp: user?.xp ?? 0,
      streak: user?.streak ?? 0,
      newlyUnlocked,
    };
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
}

/**
 * Update the streak count for a user based on their active days.
 * Recomputes streak from the activities table's active_days JSON array.
 */
async function updateStreak(db: SqliteDatabase, userId: string, now: string): Promise<void> {
  // Add today to active_days
  const activities = await db.get<{ active_days: string }>(
    'SELECT active_days FROM activities WHERE user_id = ?',
    userId,
  );

  let activeDays: string[] = [];
  if (activities?.active_days) {
    try {
      activeDays = JSON.parse(activities.active_days);
    } catch {
      activeDays = [];
    }
  }

  const today = dayKey();
  if (!activeDays.includes(today)) {
    activeDays.push(today);
    activeDays = activeDays.sort(); // keep chronological for streak calc
  }

  // Compute streak
  const streak = computeStreak(activeDays);

  // Persist
  await db.run(
    `UPDATE activities SET active_days = ?, last_active_at = ?, updated_at = ? WHERE user_id = ?`,
    JSON.stringify(activeDays),
    now,
    now,
    userId,
  );

  // Update streak on users table
  await db.run(
    `UPDATE users SET streak = ?, updated_at = ? WHERE id = ?`,
    streak,
    now,
    userId,
  );
}

/**
 * Compute the current practice streak from a sorted list of active day keys.
 * Streak = number of consecutive days ending today (or yesterday) the user was active.
 */
export function computeStreak(activeDays: string[]): number {
  if (activeDays.length === 0) return 0;

  const sorted = [...new Set(activeDays)].sort().reverse();
  const today = dayKey();
  const yesterday = dayKey(new Date(Date.now() - 86400000));

  // If last active day is not today or yesterday, streak is broken
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

  let streak = 0;
  let cursor = new Date(sorted[0]);

  for (const day of sorted) {
    const expected = dayKey(cursor);
    if (day === expected) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 86400000);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Aggregate all stats needed for achievement evaluation from the database.
 * This is the single source of truth for achievement predicates.
 */
async function aggregateStats(db: SqliteDatabase, userId: string): Promise<AggregatedStats> {
  // Count completed lessons
  const completedRows = await db.all<{ lesson_id: string }>(
    `SELECT lesson_id FROM lesson_progress WHERE user_id = ? AND status = 'completed'`,
    userId,
  );
  const completedLessons = completedRows.map(r => r.lesson_id);

  // Count started lessons
  const startedRows = await db.all<{ lesson_id: string }>(
    `SELECT lesson_id FROM lesson_progress WHERE user_id = ? AND status != 'not-started'`,
    userId,
  );
  const startedLessonIds = [...new Set(startedRows.map(r => r.lesson_id))];

  // Quiz stats
  const quizRows = await db.all<{ correct: boolean }>(
    `SELECT correct FROM quiz_attempts WHERE user_id = ?`,
    userId,
  );
  const quizzesCorrect = quizRows.filter(r => r.correct === 1 || r.correct === true).length;

  // Challenge stats
  const challengeRows = await db.all<{ challenge_id: string; passed: boolean }>(
    `SELECT challenge_id, passed FROM challenge_attempts WHERE user_id = ?`,
    userId,
  );
  const challengesPassed = [...new Set(
    challengeRows.filter(r => r.passed === 1 || r.passed === true).map(r => r.challenge_id)
  )].length;

  // Activity stats
  const activities = await db.get<{
    simulations: number;
    active_days: string;
  }>(
    `SELECT simulations, active_days FROM activities WHERE user_id = ?`,
    userId,
  );

  const activeDays = activities?.active_days
    ? JSON.parse(activities.active_days) as string[]
    : [];
  const streak = computeStreak(activeDays);

  // Projects count
  const projectCount = await db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM projects WHERE user_id = ?`,
    userId,
  ).then(r => r?.count ?? 0);

  // Current XP
  const user = await db.get<{ xp: number }>(
    `SELECT xp FROM users WHERE id = ?`,
    userId,
  );

  // Check for entanglement — any saved project whose simulation showed entangled measurements
  // For simplicity, we check if any completed lesson was entanglement
  const entanglementsBuilt = challengeRows.some(r => {
    const challenge = CHALLENGES.find(c => c.id === r.challenge_id);
    return challenge?.topic === 'fundamentals' && challenge.id === 'challenge-bell-state' && r.passed;
  });

  return {
    lessonsCompleted: completedLessons.length,
    completedLessons,
    lessonsStarted: startedLessonIds.length,
    quizzesCorrect,
    quizzesTaken: quizRows.length,
    challengesPassed,
    simulations: activities?.simulations ?? 0,
    projectsCreated: projectCount,
    xp: user?.xp ?? 0,
    streak,
    entanglementsBuilt,
  };
}

/**
 * Evaluate all achievements and record newly unlocked ones.
 * Returns the list of newly unlocked achievement IDs.
 */
async function evaluateAndRecordAchievements(
  db: SqliteDatabase,
  userId: string,
  now: string,
): Promise<string[]> {
  const stats = await aggregateStats(db, userId);
  const alreadyUnlocked = await db.all<{ achievement_id: string }>(
    `SELECT achievement_id FROM user_achievements WHERE user_id = ?`,
    userId,
  );
  const unlockedSet = new Set(alreadyUnlocked.map(r => r.achievement_id));

  const newlyUnlocked: string[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (unlockedSet.has(achievement.id)) continue;
    if (achievement.isUnlocked(stats)) {
      // Record the achievement
      await db.run(
        `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at, xp_bonus)
         VALUES (?, ?, ?, ?)`,
        userId,
        achievement.id,
        now,
        achievement.xpBonus,
      );

      // Award the XP bonus
      await db.run(
        `INSERT INTO xp_ledger (id, user_id, amount, reason, source_type, source_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        uuidv4(),
        userId,
        achievement.xpBonus,
        `Achievement: ${achievement.name}`,
        'achievement_bonus',
        achievement.id,
        now,
      );

      await db.run(
        `UPDATE users SET xp = xp + ?, updated_at = ? WHERE id = ?`,
        achievement.xpBonus,
        now,
        userId,
      );

      newlyUnlocked.push(achievement.id);
    }
  }

  return newlyUnlocked;
}

/**
 * Get the current achievement/level summary for a user.
 * Called by the GET /api/progress endpoint.
 */
export async function getUserProgress(userId: string): Promise<{
  xp: number;
  level: number;
  levelLabel: string;
  intoLevel: number;
  needed: number;
  streak: number;
  achievements: { id: string; name: string; description: string; xpBonus: number; unlockedAt: string }[];
  recentXp: { amount: number; reason: string; sourceType: string; createdAt: string }[];
}> {
  const db = await getDb();
  const user = await db.get<{ xp: number; streak: number }>(
    `SELECT xp, streak FROM users WHERE id = ?`,
    userId,
  );

  const levelInfo = levelForXp(user?.xp ?? 0);

  // Get all unlocked achievements
  const achievs = await db.all<{
    achievement_id: string;
    unlocked_at: string;
    xp_bonus: number;
  }>(
    `SELECT achievement_id, unlocked_at, xp_bonus FROM user_achievements WHERE user_id = ? ORDER BY unlocked_at ASC`,
    userId,
  );

  const achievements = achievs.map(a => {
    const def = ACHIEVEMENTS.find(ac => ac.id === a.achievement_id);
    return {
      id: a.achievement_id,
      name: def?.name ?? a.achievement_id,
      description: def?.description ?? '',
      xpBonus: a.xp_bonus,
      unlockedAt: a.unlocked_at,
    };
  });

  // Recent XP awards (last 20)
  const recentXp = await db.all<{
    amount: number;
    reason: string;
    source_type: string;
    created_at: string;
  }>(
    `SELECT amount, reason, source_type, created_at FROM xp_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
    userId,
  );

  return {
    xp: user?.xp ?? 0,
    level: levelInfo.level,
    levelLabel: levelInfo.label,
    intoLevel: levelInfo.intoLevel,
    needed: levelInfo.needed,
    streak: user?.streak ?? 0,
    achievements,
    recentXp: recentXp.map(r => ({
      amount: r.amount,
      reason: r.reason,
      sourceType: r.source_type,
      createdAt: r.created_at,
    })),
  };
}
